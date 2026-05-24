/** @type {import('next').NextConfig} */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseHostname;
try {
  supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;
} catch {
  supabaseHostname = undefined;
}

// Dominios de Supabase para CSP (realtime + storage)
const supabaseDomain = supabaseHostname || '*.supabase.co';

// CSP base para toda la app
// - script-src necesita 'unsafe-inline'/'unsafe-eval' por Next.js hydration y Tailwind
// - form-action incluye Webpay (Transbank) para el flujo de pago
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://${supabaseDomain} wss://${supabaseDomain} https://api.resend.com`,
  `frame-src 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  // Permite POST a Webpay (Transbank) desde formularios de pago
  `form-action 'self' https://webpay3g.transbank.cl https://webpay3gint.transbank.cl`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join('; ');

const nextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseHostname ? [{ protocol: 'https', hostname: supabaseHostname }] : []),
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
      };
    }
    return config;
  },

  async headers() {
    return [
      // --- Headers de seguridad globales ---
      {
        source: '/:path*',
        headers: [
          // Evita clickjacking (refuerza frame-ancestors en CSP)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Evita MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Restringe info de referrer entre orígenes
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Deshabilita permisos de hardware no usados
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), payment=()' },
          // HSTS: fuerza HTTPS por 1 año, incluye subdominios (PCI DSS requirement)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Content Security Policy
          { key: 'Content-Security-Policy', value: csp },
          // Recomendación moderna: deshabilitar XSS Auditor legacy (CSP es suficiente)
          { key: 'X-XSS-Protection', value: '0' },
        ],
      },
      // --- APIs con datos sensibles: no cachear en ningún proxy/CDN ---
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Surrogate-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
