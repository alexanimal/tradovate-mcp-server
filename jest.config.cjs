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
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  verbose: true,
  testTimeout: 30000,
  logHeapUsage: true,
  detectLeaks: false,
  detectOpenHandles: false,
}; 