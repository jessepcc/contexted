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
        'src/types.ts',
        'src/polling.ts',
        'src/components/**/*.tsx',
        'src/pages/**/*.tsx',
        'src/hooks/**/*.ts'
      ],
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 60,
        lines: 60
      }
    }
  }
});
