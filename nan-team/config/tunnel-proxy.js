#!/usr/bin/env node
'use strict';
// Single-origin reverse proxy that the Cloudflare quick tunnel points at.
//   /api/*      -> backend (prefix stripped, like Postiz's docker Caddyfile)
//   /uploads/*  -> frontend (Next serves local uploads)
//   everything  -> frontend
// The frontend bakes http://localhost:3000 / http://localhost:4200 into SSR output and the backend
// returns FRONTEND_URL-based media paths, so text responses are rewritten per request to the public
// origin (and JSON request bodies back), Set-Cookie loses its Domain (host-only cookie on the tunnel
// host) and redirects are re-pointed. Nothing changes for direct http://localhost:4200 use.
// Streaming-safe: bodies are piped and flushed chunk by chunk (SSE, NDJSON, uploads, websockets).
const http = require('http');
const net = require('net');
const { Transform } = require('stream');

const PORT = Number(process.env.TUNNEL_PROXY_PORT || 4280);
const FRONTEND = new URL(process.env.TUNNEL_FRONTEND_TARGET || 'http://127.0.0.1:4200');
const BACKEND = new URL(process.env.TUNNEL_BACKEND_TARGET || 'http://127.0.0.1:3000');
const FRONTEND_PUBLIC = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/+$/, '');
const BACKEND_PUBLIC = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
const REWRITABLE = /^(text\/|application\/(json|x-ndjson|graphql)|multipart\/mixed)/i;
const agent = new http.Agent({ keepAlive: true });

function route(url) {
  if (/^\/api(\/|\?|$)/.test(url) && !/^\/api\/uploads(\/|\?|$)/.test(url)) {
    const rest = url.slice(4);
    return { target: BACKEND, path: rest.startsWith('/') ? rest : '/' + rest, api: true };
  }
  return { target: FRONTEND, path: url, api: false };
}

function publicOrigin(req) {
  let proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (!proto && /"scheme":"https"/.test(String(req.headers['cf-visitor'] || ''))) proto = 'https';
  return `${proto || 'http'}://${req.headers.host}`;
}

function pairs(list) {
  return list.map(([from, to]) => [Buffer.from(from), Buffer.from(to)]);
}

function replaceBuf(buf, list) {
  const parts = [];
  let i = 0;
  for (;;) {
    let best = -1;
    let hit = null;
    for (const p of list) {
      const j = buf.indexOf(p[0], i);
      if (j !== -1 && (best === -1 || j < best || (j === best && p[0].length > hit[0].length))) {
        best = j;
        hit = p;
      }
    }
    if (best === -1) break;
    parts.push(buf.subarray(i, best), hit[1]);
    i = best + hit[0].length;
  }
  if (!parts.length) return buf;
  parts.push(buf.subarray(i));
  return Buffer.concat(parts);
}

// Bytes at the end of buf that could be the start of a needle split across chunks.
function partialSuffix(buf, list) {
  let keep = 0;
  for (const [needle] of list) {
    for (let k = Math.min(needle.length - 1, buf.length); k > keep; k--) {
      if (buf.subarray(buf.length - k).equals(needle.subarray(0, k))) {
        keep = k;
        break;
      }
    }
  }
  return keep;
}

function rewriter(list) {
  let tail = Buffer.alloc(0);
  return new Transform({
    transform(chunk, _encoding, callback) {
      const data = replaceBuf(tail.length ? Buffer.concat([tail, chunk]) : chunk, list);
      const keep = partialSuffix(data, list);
      tail = Buffer.from(data.subarray(data.length - keep));
      callback(null, data.subarray(0, data.length - keep));
    },
    flush(callback) {
      callback(null, tail);
    },
  });
}

const server = http.createServer((req, res) => {
  const origin = publicOrigin(req);
  const proto = origin.split(':')[0];
  const out = pairs([[BACKEND_PUBLIC, origin + '/api'], [FRONTEND_PUBLIC, origin]]);
  const back = pairs([[origin + '/api', BACKEND_PUBLIC], [origin, FRONTEND_PUBLIC]]);
  const r = route(req.url);
  const headers = { ...req.headers, 'x-forwarded-host': req.headers.host, 'x-forwarded-proto': proto };
  if (r.api) {
    if (headers.origin) headers.origin = FRONTEND_PUBLIC;
    if (headers.referer) headers.referer = replaceBuf(Buffer.from(headers.referer), back).toString();
  }
  if (!/^\/(_next\/static|uploads)\//.test(r.path)) delete headers['accept-encoding'];
  const rewriteBody =
    r.api && !['GET', 'HEAD'].includes(req.method) && /json/i.test(String(headers['content-type'] || ''));
  if (rewriteBody) delete headers['content-length'];

  const upstream = http.request(
    { host: r.target.hostname, port: r.target.port, method: req.method, path: r.path, headers, agent },
    (ur) => {
      const h = { ...ur.headers };
      if (h['set-cookie']) h['set-cookie'] = h['set-cookie'].map((c) => c.replace(/;\s*domain=[^;]*/gi, ''));
      if (h.location) {
        let loc = replaceBuf(Buffer.from(h.location), out).toString();
        const plain = `http://${req.headers.host}`;
        if (proto === 'https' && (loc === plain || loc.startsWith(plain + '/'))) loc = origin + loc.slice(plain.length);
        h.location = loc;
      }
      const rewrite =
        req.method !== 'HEAD' && !h['content-encoding'] && REWRITABLE.test(String(h['content-type'] || ''));
      if (rewrite) delete h['content-length'];
      if (/text\/event-stream|ndjson/i.test(String(h['content-type'] || ''))) h['x-accel-buffering'] = 'no';
      res.writeHead(ur.statusCode, h);
      res.flushHeaders();
      (rewrite ? ur.pipe(rewriter(out)) : ur).pipe(res);
    }
  );
  upstream.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(`tunnel proxy: ${r.target.host} unavailable (${err.code || err.message})\n`);
    } else {
      res.destroy();
    }
  });
  res.on('close', () => {
    if (!res.writableFinished) upstream.destroy();
  });
  (rewriteBody ? req.pipe(rewriter(back)) : req).pipe(upstream);
});

server.on('upgrade', (req, socket, head) => {
  const r = route(req.url);
  const upstream = net.connect(Number(r.target.port), r.target.hostname, () => {
    let raw = `${req.method} ${r.path} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    upstream.write(raw + '\r\n');
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.requestTimeout = 0;
server.timeout = 0;
server.keepAliveTimeout = 65_000;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`tunnel proxy on http://127.0.0.1:${PORT} -> api ${BACKEND.host}, app ${FRONTEND.host}`);
});
