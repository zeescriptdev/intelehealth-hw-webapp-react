import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest';

// Mock react-datepicker CSS import
vi.mock('react-datepicker/dist/react-datepicker.css', () => ({}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Extend expect with custom matchers
expect.extend({
  // Add custom matchers here if needed
});

/*
 * Save original URL methods so they can be restored after each test.
 * Several test files directly assign vi.fn() to globalThis.URL.createObjectURL
 * without cleanup, which can leak mocked behaviour into subsequent test files
 * that run in the same worker thread and cause intermittent failures.
 */
const originalCreateObjectURL = globalThis.URL.createObjectURL;
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;

// Clean up after each test
afterEach(() => {
  cleanup();

  // Restore URL methods that test files may have overwritten
  globalThis.URL.createObjectURL = originalCreateObjectURL;
  globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
});

// Store original console methods
let originalError: typeof console.error;
let originalWarn: typeof console.warn;

// Mock console methods to reduce noise in tests
beforeAll(() => {
  // Suppress console.error for React warnings during tests
  originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  // Suppress console.warn for React warnings during tests
  originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || args[0].includes('React'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  // Restore console methods
  if (originalError) console.error = originalError;
  if (originalWarn) console.warn = originalWarn;
});
