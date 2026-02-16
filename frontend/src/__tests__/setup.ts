import '@testing-library/jest-dom';

// Mock import.meta.env for Vite compatibility in Jest
Object.defineProperty(globalThis, 'import_meta_env', {
  value: { VITE_API_URL: '/api/v1' },
});
