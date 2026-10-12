import type {NextConfig} from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingExcludes: {
    '*': [
      './qiskit-judge/**/*',
      './archive/**/*',
      './tests/**/*',
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    SESSION_SECRET:
      process.env.SESSION_SECRET ||
      'qff-srmap-2026-fallback-cryptographic-session-signing-secret-key-32chars!',
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'sb_publishable_wjeOXSiT7E63DsDqTaL1cw_JBMTC3kj',
  },
  // Allow access to remote image placeholder.
  images: {
    qualities: [75, 88],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  async redirects() {
    return [
      {
        source: '/join',
        destination: 'https://events.srmap.edu.in/event/qiskit-fall-fest-2026/',
        permanent: false,
      },
      {
        source: '/register',
        destination: 'https://events.srmap.edu.in/event/qiskit-fall-fest-2026/',
        permanent: false,
      },
      {
        source: '/signup',
        destination: 'https://events.srmap.edu.in/event/qiskit-fall-fest-2026/',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com"), usb=()',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://checkout.razorpay.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              "img-src 'self' blob: data: https://picsum.photos https://fastly.picsum.photos https://images.unsplash.com https://*.supabase.co https://*.googleusercontent.com",
              "font-src 'self' data: https://cdn.jsdelivr.net",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://api.razorpay.com https://checkout.razorpay.com https://cdn.jsdelivr.net https://vitals.vercel-insights.com",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://api.razorpay.com https://checkout.razorpay.com",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://accounts.google.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
