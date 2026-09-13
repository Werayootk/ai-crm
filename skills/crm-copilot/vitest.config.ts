import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'crm-copilot',
    include: ['src/**/*.test.ts', 'evals/**/*.test.ts'],
  },
});
