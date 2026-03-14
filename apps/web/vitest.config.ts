import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts?(x)'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      all: true,
      include: [
        'src/api.ts',
        'src/referrals.ts',
        'src/hooks/**/*.ts'
      ]
    }
  }
});
