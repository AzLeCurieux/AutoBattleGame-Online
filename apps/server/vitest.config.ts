import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['development'] },
  test: { name: 'server', include: ['test/**/*.test.ts'] },
});
