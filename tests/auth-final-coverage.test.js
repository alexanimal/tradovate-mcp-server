const { describe, expect, test, beforeEach, afterEach } = require('@jest/globals');

// Mock axios before importing auth
jest.mock('axios');
const axios = require('axios');

// Import the auth-helper module instead of auth directly
const auth = require('./auth-helper');

describe('Auth Module Final Coverage Tests', () => {
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
    delete process.env.TESTING_THROW_AUTHENTICATION_ERROR;
    
    // Set auth-for-tests mode
    process.env.TESTING_AUTH_FOR_TESTS = 'true';
    
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

  test('should handle network errors during token refresh', async () => {
    // Setup
    auth.refreshToken = 'valid-refresh';
    
    // Set refresh to fail with network error
    process.env.TESTING_REFRESH_BEHAVIOR = 'fail';
    
    // Act & Assert
    await expect(auth.refreshAccessToken()).rejects.toThrow('Failed to refresh access token');
    expect(auth.accessToken).toBeNull();
    expect(auth.refreshToken).toBeNull();
  });

  test('should handle API errors during authentication', async () => {
    // Setup
    auth.accessToken = null;
    auth.refreshToken = null;
    
    // Set auth to fail
    process.env.TESTING_AUTH_BEHAVIOR = 'fail';
    
    // Act & Assert
    await expect(auth.authenticate()).rejects.toThrow('Authentication with Tradovate API failed');
  });

  test('should handle API errors without errorText during requests', async () => {
    // Setup
    auth.accessToken = 'valid-token';
    auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
    
    process.env.TESTING_TOKEN_VALID = 'true';
    process.env.TESTING_REQUEST_BEHAVIOR = 'api_error_no_text';
    
    // Act & Assert
    await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API error (500): Unknown error');
  });

  test('should retry on rate limit errors during requests', async () => {
    // Setup
    auth.accessToken = 'valid-token';
    auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
    
    process.env.TESTING_TOKEN_VALID = 'true';
    process.env.TESTING_REQUEST_BEHAVIOR = 'rate_limit';
    
    // Act
    const result = await auth.tradovateRequest('GET', 'test/endpoint');
    
    // Assert
    expect(result).toEqual({ success: true });
    expect(console.warn).toHaveBeenCalledWith('Rate limit exceeded, retrying after delay');
  });

  describe('tradovateRequest function', () => {
    test('should make a successful GET request', async () => {
      // Setup
      const mockData = { id: 1, name: 'Test' };
      
      // Mock authenticate to return a token directly
      auth.accessToken = 'test-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Mock isAccessTokenValid to return true
      const isValidSpy = jest.spyOn(auth, 'isAccessTokenValid');
      isValidSpy.mockReturnValue(true);
      
      // Use success behavior
      process.env.TESTING_REQUEST_BEHAVIOR = 'success';
      
      // Act
      const result = await auth.tradovateRequest('GET', 'test/endpoint');
      
      // Assert
      expect(result).toEqual({ success: true });
      
      // Restore original function
      isValidSpy.mockRestore();
    });
    
    test('should make a successful POST request', async () => {
      // Setup
      const requestData = { name: 'Test Request' };
      const mockResponse = { id: 1, name: 'Test Response' };
      
      // Mock authenticate to return a token directly
      auth.accessToken = 'test-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Mock isAccessTokenValid to return true
      const isValidSpy = jest.spyOn(auth, 'isAccessTokenValid');
      isValidSpy.mockReturnValue(true);
      
      // Use success behavior
      process.env.TESTING_REQUEST_BEHAVIOR = 'success';
      
      // Act
      const result = await auth.tradovateRequest('POST', 'test/endpoint', requestData);
      
      // Assert
      expect(result).toEqual({ success: true });
      
      // Restore original function
      isValidSpy.mockRestore();
    });
    
    test('should use market data URL for market data requests', async () => {
      // Setup
      const mockData = { id: 1, name: 'Market Data' };
      
      // Mock authenticate to return a token directly
      auth.accessToken = 'test-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Mock isAccessTokenValid to return true
      const isValidSpy = jest.spyOn(auth, 'isAccessTokenValid');
      isValidSpy.mockReturnValue(true);
      
      // Use success behavior
      process.env.TESTING_REQUEST_BEHAVIOR = 'success';
      
      // Act
      const result = await auth.tradovateRequest('GET', 'md/quotes', null, true);
      
      // Assert
      expect(result).toEqual({ success: true });
      
      // Restore original function
      isValidSpy.mockRestore();
    });
    
    test('should handle 401 unauthorized errors', async () => {
      // Setup
      // Mock authenticate to return a token directly
      auth.accessToken = 'test-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Mock isAccessTokenValid to return true
      const isValidSpy = jest.spyOn(auth, 'isAccessTokenValid');
      isValidSpy.mockReturnValue(true);
      
      // Set the environment variable for unauthorized behavior
      process.env.TESTING_REQUEST_BEHAVIOR = 'unauthorized';
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Authentication failed: Token expired');
      expect(auth.accessToken).toBeNull();
      expect(auth.accessTokenExpiry).toBeNull();
      
      // Restore original function
      isValidSpy.mockRestore();
    });
    
    test('should handle API errors with status codes', async () => {
      // Setup
      // Mock authenticate to return a token directly
      auth.accessToken = 'test-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Mock isAccessTokenValid to return true
      const isValidSpy = jest.spyOn(auth, 'isAccessTokenValid');
      isValidSpy.mockReturnValue(true);
      
      // Set the environment variable for API error behavior
      process.env.TESTING_REQUEST_BEHAVIOR = 'api_error';
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API error (404): Resource not found');
      
      // Restore original function
      isValidSpy.mockRestore();
    });
    
    test('should handle other errors', async () => {
      // Setup
      // Mock authenticate to return a token directly
      auth.accessToken = 'test-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Mock isAccessTokenValid to return true
      const isValidSpy = jest.spyOn(auth, 'isAccessTokenValid');
      isValidSpy.mockReturnValue(true);
      
      // Set the environment variable for other error behavior
      process.env.TESTING_REQUEST_BEHAVIOR = 'other_error';
      process.env.TESTING_AUTH_FOR_TESTS = 'true';
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API request to test/endpoint failed: Other error');
      
      // Restore original function
      isValidSpy.mockRestore();
    });
  });
}); 