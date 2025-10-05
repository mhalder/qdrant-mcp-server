import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'build/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'vitest.config.ts',
        'src/index.ts', // MCP server SDK integration - tested via integration
      ],
      // Set thresholds for core business logic modules
      thresholds: {
        'src/qdrant/client.ts': {
          lines: 90,
          functions: 100,
          branches: 80,
          statements: 90,
        },
        'src/embeddings/openai.ts': {
          lines: 100,
          functions: 100,
          branches: 90,
          statements: 100,
        },
      },
    },
  },
});
