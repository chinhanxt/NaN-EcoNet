// @ts-check
import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    proxyTimeout: 90_000,
    // The multi-gigabyte dev cache periodically blocks route requests during compaction.
    turbopackFileSystemCacheForDev: false,
    optimizePackageImports: [
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
  webpack: (config, { buildId, dev, isServer, defaultLoaders }) => {
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
