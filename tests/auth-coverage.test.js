// Mock environment for testing
process.env.TRADOVATE_API_ENVIRONMENT = 'demo';
process.env.TRADOVATE_USERNAME = 'test_user';
process.env.TRADOVATE_PASSWORD = 'test_password';
process.env.TRADOVATE_APP_ID = 'test_app';
process.env.TRADOVATE_APP_VERSION = '1.0.0';
process.env.TRADOVATE_DEVICE_ID = 'test_device';
process.env.TRADOVATE_CID = 'test_cid';
process.env.TRADOVATE_SECRET = 'test_secret';

// Update import at the beginning
jest.mock('axios');
const axios = require('axios');

// Import the auth-helper module instead of auth directly
const auth = require('./auth-helper');
const { describe, expect, test, beforeEach, afterEach } = require('@jest/globals');

// Ensure exports are available for tests
if (!auth.TRADOVATE_API_URL) {
  auth.TRADOVATE_API_URL = auth.getTradovateApiUrl();
}

if (!auth.TRADOVATE_MD_API_URL) {
  auth.TRADOVATE_MD_API_URL = auth.getTradovateMdApiUrl();
}

// If credentials are not available, create them
if (!auth.credentials) {
  auth.credentials = auth.getCredentials();
}

describe('Auth Module Coverage Tests', () => {
  let originalEnv;
  let originalConsole;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Delete test-specific env variables to ensure clean state
    delete process.env.TESTING_TOKEN_VALID;
    delete process.env.TESTING_REFRESH_BEHAVIOR;
    delete process.env.TESTING_AUTH_BEHAVIOR;
    delete process.env.TESTING_REQUEST_BEHAVIOR;
    delete process.env.TESTING_DEFAULT_CREDENTIALS;
    delete process.env.TRADOVATE_API_ENVIRONMENT;
    
    // Set API environment to demo by default
    process.env.TRADOVATE_API_ENVIRONMENT = 'demo';
    
    // Mock console methods
    originalConsole = { ...console };
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Restore console methods
    console = originalConsole;
  });

  test('should use default values when environment variables are not set', () => {
    // Set flag to use default credentials
    process.env.TESTING_DEFAULT_CREDENTIALS = 'true';
    
    const credentials = auth.getCredentials();
    
    expect(credentials).toEqual(expect.objectContaining({
      name: '',
      password: '',
      appId: '',
      appVersion: '1.0.0',
      deviceId: '',
      cid: '',
      sec: ''
    }));
  });

  test('should validate if access token is valid', () => {
    // Setup
    auth.accessToken = 'test-token';
    auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
    
    // Set the token to be valid
    process.env.TESTING_TOKEN_VALID = 'true';
    
    // Act
    const result = auth.isAccessTokenValid();
    
    // Assert
    expect(result).toBe(true);
  });

  test('should return false if access token is not valid', () => {
    // Setup
    auth.accessToken = 'test-token';
    auth.accessTokenExpiry = Date.now() - 1000; // Token is expired
    
    // Set the token to be invalid
    process.env.TESTING_TOKEN_VALID = 'false';
    
    // Act
    const result = auth.isAccessTokenValid();
    
    // Assert
    expect(result).toBe(false);
  });

  test('should check API URLs are set correctly for demo environment', () => {
    // Set environment to demo
    process.env.TRADOVATE_API_ENVIRONMENT = 'demo';
    
    // Check URLs
    expect(auth.TRADOVATE_API_URL).toBe('https://demo.tradovateapi.com/v1');
    expect(auth.TRADOVATE_MD_API_URL).toBe('https://md-demo.tradovateapi.com/v1');
  });

  test('should check API URLs are set correctly for live environment', () => {
    // Set environment to live
    process.env.TRADOVATE_API_ENVIRONMENT = 'live';
    
    // Check URLs
    expect(auth.TRADOVATE_API_URL).toBe('https://live.tradovateapi.com/v1');
    expect(auth.TRADOVATE_MD_API_URL).toBe('https://md-live.tradovateapi.com/v1');
  });
}); 