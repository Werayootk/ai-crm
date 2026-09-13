import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // shared export เป็น TypeScript source → ต้อง bundle เข้าไป; dependencies อื่นเป็น external
  noExternal: ['@ai-crm/shared'],
});
