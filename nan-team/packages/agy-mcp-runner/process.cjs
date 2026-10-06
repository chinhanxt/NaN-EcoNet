'use strict';
const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
function nativeToolDiagnostic(step) {
  const info=step.tool_info||{},specific=info[step.tool_name]||{};
  const raw=info.error?.message||info.error||specific.error?.message||specific.error||specific.error_message||info.error_message||step.error?.message||step.error||step.message||'';
  const message=(typeof raw==='string'?raw:JSON.stringify(raw)).slice(0,4000);
  const category=/quota|resource.exhausted|rate.limit|429/i.test(message)?'quota-or-rate-limit':/unauth|not logged|eligibility/i.test(message)?'authentication':/permission|denied|403/i.test(message)?'permission':/invalid|argument|schema/i.test(message)?'invalid-tool-input':'native-tool-failed';
  const safe=message.replace(/Bearer\s+[^\s"']+/gi,'Bearer [redacted]').replace(/ya29\.[\w.-]+|AIza[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[redacted]').replace(/((?:access_token|refresh_token|api_key|password|secret)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi,'$1[redacted]');
  return {tool:step.tool_name,category,message:safe.slice(0,600),infoKeys:Object.keys(info)};
}

// Signals the CLI's own process group (spawned detached, so pgid = child.pid). Never with a missing,
// 0/1 or own pid: process.kill(-0) / kill(0) would hit this server's own process group.
function signalGroup(child, signal) {
  const pid = child?.pid;
  if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) return;
  try { process.kill(process.platform === 'win32' ? pid : -pid, signal); } catch {}
}
function runProcess(binary, args, options) {
  return new Promise((resolve, reject) => {
    options.signal?.throwIfAborted();
    const child = spawn(binary, args, { cwd: options.cwd, env: options.env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let bytes = 0, output = '', error = '', failure, killTimer, completed = false;
    const decoder=new StringDecoder('utf8');let pendingLine='';
    const consume=(text)=>{
      output+=text;if(!options.onNativeEvent)return;pendingLine+=text;
      let newline;while((newline=pendingLine.indexOf('\n'))>=0){
        const line=pendingLine.slice(0,newline);pendingLine=pendingLine.slice(newline+1);
        try{const event=JSON.parse(line);options.onNativeEvent(event);}catch{/* Non-JSON CLI output is not an event. */}
      }
    };
    const stop = (reason) => {
      failure ||= reason;
      signalGroup(child, 'SIGTERM');
      killTimer ||= setTimeout(() => signalGroup(child, 'SIGKILL'), 1500);
    };
    const completionTimer = options.complete ? setInterval(() => { if (!completed && options.complete()) { completed = true; stop(); } }, 200) : undefined;
    const abort = () => stop(options.signal?.reason instanceof Error && /deadline exceeded/i.test(options.signal.reason.message)
      ? options.signal.reason : new Error('AGY job cancelled'));
    const timer = setTimeout(() => stop(new Error('AGY job deadline exceeded')), options.timeoutMs);
    options.signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', (chunk) => { bytes += chunk.length; if (bytes > 8_000_000) stop(new Error('AGY output exceeds limit')); else consume(decoder.write(chunk)); });
    child.stderr.on('data', (chunk) => { if (error.length < 16000) error += chunk; });
    const clean = () => { clearTimeout(timer); clearTimeout(killTimer); clearInterval(completionTimer); options.signal?.removeEventListener('abort', abort); };
    child.once('error', (err) => { clean(); reject(err); });
    child.once('close', (code) => {
      consume(decoder.end());
      // A CLI may leave its language-server descendants behind. The owned
      // process group must be stopped before the profile is removed.
      signalGroup(child, 'SIGKILL');
      clean();
      if (failure) { reject(failure); return; }
      if (code !== 0 && !completed) {
        // A proxy/account out of quota exits the CLI; tag it so the caller reroutes to another account.
        const tail = error + output.slice(-8000);
        const quota = !/connection refused/i.test(error) && /RESOURCE_EXHAUSTED|QUOTA_EXHAUSTED|429 Too Many Requests|exhausted your capacity|quota (?:exceeded|exhausted)|rate.?limit(?:ed| exceeded)/i.test(tail);
        const category = /connection refused/i.test(error) ? 'provider-unreachable'
          : quota ? 'provider-quota'
          : /eligibility/i.test(error) ? 'account-eligibility'
          : /not logged/i.test(error) ? 'not-logged-in'
          : 'process-failed';
        const reason = category === 'provider-unreachable' ? 'configured provider unreachable'
          : category === 'provider-quota' ? 'provider account rate-limited or out of quota'
          : ['account-eligibility', 'not-logged-in'].includes(category) ? 'native authentication unavailable'
          : 'inspect the job receipt';
        const problem = new Error(`AGY process failed (exit ${code}); ${reason}`);
        problem.category = category;
        if (quota) { const reset = /reset(?:s)? after\s+((?:[\d.]+[hms])+)|quotaResetDelay\\?"?\s*:\s*\\?"((?:[\d.]+[hms])+)/i.exec(tail); if (reset) problem.quotaResetAfter = reset[1] || reset[2]; }
        reject(problem);
        return;
      }
      resolve({ output, error }); });
  });
}
module.exports = { runProcess, nativeToolDiagnostic, signalGroup };
