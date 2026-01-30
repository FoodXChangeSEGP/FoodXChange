/**
 * Jest Configuration
 * 
 * Custom Jest config for Expo SDK 54+ to avoid runtime issues
 * with jest-expo preset.
 */

module.exports = {
  // Use jsdom for React Native web testing
  testEnvironment: 'node',
  
  // Setup file for mocking
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // File extensions to process
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Transform TypeScript and JSX
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  
  // Ignore patterns for transform
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|zustand)',
  ],
  
  // Ignore these paths for tests
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  
  // Module path aliases matching babel config
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
  },
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Collect coverage from src
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
};
