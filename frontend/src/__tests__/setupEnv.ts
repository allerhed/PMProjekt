// Jest setup: runs before any test files are loaded

// Polyfill TextEncoder/TextDecoder for react-router-dom v7 in jsdom
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}
if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

export {};
