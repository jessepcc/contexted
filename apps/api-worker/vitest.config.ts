import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@contexted/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/ai-providers.ts',
        'src/adapters.ts',
        'src/dependencies.ts',
        'src/model.ts',
        'src/postgres-repository.ts',
        'src/factories.ts',
        'src/config.ts',
        'src/services/drop-service.ts'
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
