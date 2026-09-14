import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/shared', 'skills/crm-copilot', 'apps/api', 'apps/web'],
  },
});
