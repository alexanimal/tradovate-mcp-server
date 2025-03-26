module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { 
      tsconfig: 'tsconfig.json',
      useESM: true
    }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transformIgnorePatterns: [
    // Don't transform node_modules except for @modelcontextprotocol/sdk
    'node_modules/(?!(@modelcontextprotocol)/)'
  ],
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['**/__tests__/**/*.ts', '**/__tests__/**/*.js', '**/?(*.)+(spec|test).ts', '**/?(*.)+(spec|test).js'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  collectCoverage: false,
  coverageDirectory: './coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!**/node_modules/**',
    '!**/vendor/**'
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  globalSetup: '<rootDir>/tests/global-setup.cjs',
  globalTeardown: '<rootDir>/tests/global-teardown.cjs',
  verbose: true,
  testTimeout: 30000,
  logHeapUsage: true,
  
  // Configure memory leak and open handle detection based on NODE_ENV
  detectLeaks: process.env.NODE_ENV === 'ci' ? true : false,
  detectOpenHandles: process.env.NODE_ENV === 'ci' ? true : false,
  
  // Force exit to ensure process terminates in dev environment
  forceExit: process.env.NODE_ENV !== 'ci',
  
  // Use jest-circus for better async handling
  testRunner: 'jest-circus/runner',
  
  // Ignore certain patterns in socket tests that are known to cause issues
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/tests/socket-implementation.test.js'
  ]
}; 