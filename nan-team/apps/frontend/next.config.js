// @ts-check
import { withSentryConfig } from '@sentry/nextjs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const lowMemoryDev = process.env.POSTIZ_DEV_LOW_MEMORY === '1';
const require = createRequire(import.meta.url);
const mermaidBrowserBuild = join(dirname(require.resolve('mermaid/package.json')), 'dist/mermaid.esm.min.mjs');
const copilotEsmAliases = Object.fromEntries(
  ['@copilotkit/react-core', '@copilotkit/react-ui', '@copilotkit/mcp-apps-renderer'].map(
    (name) => [name + '$', join(dirname(require.resolve(name + '/package.json')), 'dist/index.mjs')]
  )
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  serverExternalPackages: ['mermaid', 'shiki', 'jsdom', 'isomorphic-dompurify'],
  ...(lowMemoryDev ? { onDemandEntries: { maxInactiveAge: 20_000, pagesBufferLength: 2 } } : {}),
  experimental: {
    webpackMemoryOptimizations: lowMemoryDev,
    proxyTimeout: 90_000,
    // The multi-gigabyte dev cache periodically blocks route requests during compaction.
    turbopackFileSystemCacheForDev: false,
    optimizePackageImports: [
      'react-syntax-highlighter',
      '@blueprintjs/core',
      '@blueprintjs/icons',
      'lodash',
      'dayjs',
      'lucide-react',
      '@copilotkit/react-ui',
      '@copilotkit/react-core',
      '@mantine/core',
      '@mantine/hooks',
      'polotno',
      'date-fns',
      'chart.js',
      'react-loading',
      '@uidotdev/usehooks',
    ],
  },
  // Document-Policy header for browser profiling
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Document-Policy',
            value: 'js-profiling',
          },
        ],
      },
    ];
  },
  reactStrictMode: false,
  transpilePackages: ['crypto-hash'],
  // Disable heavy sourcemaps in local dev
  productionBrowserSourceMaps: false,

  // Custom webpack config
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // CopilotKit's renderer root is ESM-only. Keep its UI/core on the same
    // entry format so SSR cannot resolve the renderer through a CJS branch.
    config.resolve.alias = { ...config.resolve.alias, ...copilotEsmAliases,
      // Use the installed official bundle with every diagram type preserved.
      ...(isServer ? {} : { 'mermaid$': mermaidBrowserBuild }) };
    if (dev && lowMemoryDev) {
      // Keep the real application available on machines with limited RAM.
      // Compilation is slower without cached modules.
      config.cache = false;
      config.parallelism = 1;
      // Next installs its own dev sourcemap plugin even with devtool=false.
      // Retain runtime features while bounding vendor sourcemap memory.
      config.plugins = config.plugins.filter(
        (/** @type {any} */ plugin) => plugin?.constructor?.name !== 'EvalSourceMapDevToolPlugin'
      );
      // CachedSource keeps a Buffer copy of every rendered module and chunk
      // after emit (~0.5 GiB outside the JS heap for the agent routes).
      // The string form stays cached; the Buffer is rebuilt when requested.
      const cachedSource = webpack.sources.CachedSource.prototype;
      if (!cachedSource.postizUncachedBuffer) {
        const buffer = cachedSource.buffer;
        cachedSource.postizUncachedBuffer = true;
        cachedSource.buffer = function () {
          if (this._cachedBuffer !== undefined) return this._cachedBuffer;
          const result = buffer.call(this);
          this._cachedBuffer = undefined;
          if (this._cachedSize === undefined) this._cachedSize = result.length;
          return result;
        };
      }
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: '/api/uploads/:path*',
        destination:
          process.env.STORAGE_PROVIDER === 'local' ? '/uploads/:path*' : '/404',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination:
          process.env.STORAGE_PROVIDER === 'local'
            ? '/api/uploads/:path*'
            : '/404',
      },
    ];
  },
};

const isProdSentry = process.env.NODE_ENV === 'production' && Boolean(process.env.SENTRY_AUTH_TOKEN);

export default isProdSentry
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        disable: false,
        assets: [
          '.next/static/**/*.js',
          '.next/static/**/*.js.map',
          '.next/server/**/*.js',
          '.next/server/**/*.js.map',
        ],
        ignore: [
          '**/node_modules/**',
          '**/*hot-update*',
          '**/_buildManifest.js',
          '**/_ssgManifest.js',
          '**/*.test.js',
          '**/*.spec.js',
        ],
        deleteSourcemapsAfterUpload: true,
      },
      release: {
        create: true,
        finalize: true,
        name:
          process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || undefined,
      },
      widenClientFileUpload: true,
      telemetry: false,
      silent: true,
      debug: false,
      errorHandler: () => {},
    })
  : nextConfig;
