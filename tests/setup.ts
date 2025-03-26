/// <reference types="jest" />

// Mock environment variables
process.env.TRADOVATE_API_ENVIRONMENT = 'demo';
process.env.TRADOVATE_USERNAME = 'test_user';
process.env.TRADOVATE_PASSWORD = 'test_password';
process.env.TRADOVATE_APP_ID = 'Test App';
process.env.TRADOVATE_APP_VERSION = '1.0';
process.env.TRADOVATE_CID = 'test_cid';
process.env.TRADOVATE_SEC = 'test_sec';

// Mock axios
import axios from 'axios';

jest.mock('axios', () => {
  return {
    default: {
      get: jest.fn(),
      post: jest.fn(),
    },
    get: jest.fn(),
    post: jest.fn(),
  };
});

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

import type { Config } from '@jest/types';
import { defaults } from 'jest-config';

// This file is configured in jest.config.cjs to run before and after tests
// Can be customized to handle various test setup and teardown tasks

// Track unhandled rejections during tests
const unhandledRejections: Error[] = [];

/**
 * Set up global handlers for unhandled rejections and uncaught exceptions
 */
export const setup = () => {
  // Set up handler for unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    console.warn('Unhandled promise rejection during tests:', reason);
    if (reason instanceof Error) {
      unhandledRejections.push(reason);
    } else {
      unhandledRejections.push(new Error(String(reason)));
    }
  });

  // Before each test, ensure all timers are reset
  beforeEach(() => {
    // Reset any fake timers if they exist
    if (jest.isMockFunction(setTimeout)) {
      jest.clearAllTimers();
    }
    
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  // After each test, fail if there were unhandled rejections during the test
  afterEach(() => {
    // Clear any fake timers that might have been set up
    if (jest.isMockFunction(setTimeout)) {
      try {
        jest.useRealTimers();
      } catch (e) {
        // May already be using real timers
      }
    }
    
    if (unhandledRejections.length > 0) {
      const rejection = unhandledRejections.pop();
      unhandledRejections.length = 0; // clear the array
      
      // Fail the test with the unhandled rejection
      throw new Error(`Unhandled promise rejection: ${rejection}`);
    }
  });
  
  // Ensure jest test environment is properly cleaned up
  afterAll(() => {
    jest.restoreAllMocks();
    
    // Final check for any unhandled rejections
    if (unhandledRejections.length > 0) {
      console.error('Unhandled rejections remained after tests:', unhandledRejections);
      unhandledRejections.length = 0;
    }
  });
};

export default setup; 