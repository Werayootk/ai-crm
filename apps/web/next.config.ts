import path from 'node:path';
import type { NextConfig } from 'next';

// URL ของ apps/api — rewrites ถูกคำนวณตอน build จึงต้องตั้งก่อน `next build` ด้วย
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

if (process.env.NODE_ENV === 'production' && !process.env.API_URL) {
  throw new Error('API_URL must be set for production builds');
}

// CSP แบบไม่ใช้ nonce ตามเอกสาร Next 16 (guides/content-security-policy) — ทุกอย่างมาจาก origin เดียวกัน
// ไม่ใส่ upgrade-insecure-requests เพราะ production stack ในเครื่อง (docker-compose.prod.yml) เป็น http
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // browser สนใจเฉพาะตอนเปิดผ่าน HTTPS (Railway) — http ในเครื่องไม่มีผล
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

const nextConfig: NextConfig = {
  // Docker image เล็ก: .next/standalone มี server.js + node_modules เท่าที่ใช้จริง
  output: 'standalone',
  poweredByHeader: false,
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
  // monorepo: trace ไฟล์จาก root เพื่อให้รวม packages/shared และ dependency ที่ hoist ไว้ที่ root
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  // shared export เป็น TypeScript source
  transpilePackages: ['@ai-crm/shared'],
  // browser เรียก /api/* ที่ origin เดียวกับเว็บ → cookie เป็น first-party และไม่ต้องเปิด CORS
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]);
  },
};

export default nextConfig;
