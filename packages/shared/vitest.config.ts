import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['development'] },
  test: { name: 'shared', include: ['test/**/*.test.ts'] },
});
