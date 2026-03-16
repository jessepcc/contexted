import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts?(x)'],
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      all: true,
      include: [
        'src/api.ts',
        'src/referrals.ts',
        'src/intakeDraft.ts',
        'src/memoryReview.ts',
        'src/hooks/**/*.ts'
      ],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60
      }
    }
  }
});
