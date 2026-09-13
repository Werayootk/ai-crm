import type { NextConfig } from 'next';

// URL ของ apps/api — rewrites ถูกคำนวณตอน build จึงต้องตั้งก่อน `next build` ด้วย
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

if (process.env.NODE_ENV === 'production' && !process.env.API_URL) {
  throw new Error('API_URL must be set for production builds');
}

const nextConfig: NextConfig = {
  // shared export เป็น TypeScript source
  transpilePackages: ['@ai-crm/shared'],
  // browser เรียก /api/* ที่ origin เดียวกับเว็บ → cookie เป็น first-party และไม่ต้องเปิด CORS
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]);
  },
};

export default nextConfig;
