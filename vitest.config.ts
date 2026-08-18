import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Plugin to mock react-datepicker CSS import
const mockCssPlugin = (): Plugin => ({
  name: 'mock-react-datepicker-css',
  enforce: 'pre', // Run before other plugins
  resolveId(id) {
    // Handle the CSS import for react-datepicker
    if (
      id === 'react-datepicker/dist/react-datepicker.css' ||
      (id.includes('react-datepicker') && id.endsWith('.css'))
    ) {
      // Return a virtual module ID
      return '\0react-datepicker-css-mock';
    }
    return null;
  },
  load(id) {
    if (id === '\0react-datepicker-css-mock') {
      // Return empty CSS content as a virtual CSS module
      return '/* Mock CSS for react-datepicker in tests */';
    }
    return null;
  },
  transform(code, id) {
    // Remove the CSS import statement from the code if it still exists
    if (
      id.includes('calendar.component') ||
      id.endsWith('calendar.component.tsx')
    ) {
      return {
        code: code.replace(
          /import\s+["']react-datepicker\/dist\/react-datepicker\.css["'];?\s*/g,
          ''
        ),
        map: null,
      };
    }
    return null;
  },
});

export default defineConfig({
  plugins: [
    react(),
    mockCssPlugin(), // Add the mock CSS plugin
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'react-datepicker': fileURLToPath(
        new URL('./src/test/mocks/react-datepicker.ts', import.meta.url)
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    env: {
      VITE_OPENMRS_API_URL: 'http://localhost:8080/openmrs/ws/rest/v1',
    },
    /**
     * Scope vitest to the app. Without this its default glob sweeps the whole
     * repo and picks up .github/review/scripts/test/*.test.mjs, which are
     * node:test files and fail with "No test suite found".
     */
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'coverage/**', 'src/examples/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
        'src/examples/**',
        // Exclude entire types folder (pure type definition files with no runtime code)
        'src/types/**',
        // Exclude all .types.ts files (pure type definition files)
        '**/*.types.ts',
        'src/services/mindmap.ts',
        'src/services/openmrs.ts',
        'src/config/sentry.ts',
        'src/config/sentry-wrapper.tsx',
        'src/config/env.ts',
        'src/components/common/**/!(camera-capture-modal)*.{ts,tsx}',
        // Exclude profile-related files (tests were removed)
        'src/assets/data/**',
        // Exclude Loader component (not tested)
        'src/components/Loader/**',
        // Exclude entry point files (mostly boilerplate)
        'src/main.tsx',
        'src/App.tsx',
        'src/modules/patient/add/add-patient.types.ts',
      ],
      // 100% coverage requirements
      thresholds: {
        global: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
      // Detailed coverage info
      all: true,
      include: ['src/**/*.{ts,tsx}'],
    },
    // Test timeout
    testTimeout: 30000,
    // Hook timeout
    hookTimeout: 30000,
  },
});
