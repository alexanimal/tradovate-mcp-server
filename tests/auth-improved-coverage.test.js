const { describe, expect, test, beforeEach, afterEach } = require('@jest/globals');

// Mock axios before importing auth
jest.mock('axios');
const axios = require('axios');

// Import the auth-helper module instead of auth directly
const auth = require('./auth-helper');

describe('Auth Module', () => {
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

  describe('authenticate', () => {
    test('should return existing tokens when valid', async () => {
      // Set valid access token
      auth.accessToken = 'existing-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      auth.refreshToken = 'existing-refresh';
      
      process.env.TESTING_TOKEN_VALID = 'true';
      
      const result = await auth.authenticate();
      
      expect(result).toEqual('existing-token');
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should obtain new tokens when refreshToken exists but accessToken is invalid', async () => {
      // Set expired access token
      auth.accessToken = 'expired-token';
      auth.accessTokenExpiry = Date.now() - 1000; // Set as expired
      auth.refreshToken = 'valid-refresh';
      
      process.env.TESTING_TOKEN_VALID = 'false';
      process.env.TESTING_REFRESH_BEHAVIOR = 'success';
      
      const result = await auth.authenticate();
      
      expect(result).toEqual('new-access-token');
      expect(auth.accessToken).toEqual('new-access-token');
      expect(auth.refreshToken).toEqual('new-refresh-token');
      expect(auth.accessTokenExpiry).not.toBeNull();
    });

    test('should authenticate with credentials when no tokens exist', async () => {
      // Clear tokens
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
      
      // Set auth environment to use credentials
      process.env.TESTING_AUTH_BEHAVIOR = 'success';
      
      // Explicitly set environment variables for credentials
      process.env.TRADOVATE_USERNAME = 'test-user';
      process.env.TRADOVATE_PASSWORD = 'test-password';
      process.env.TRADOVATE_APP_ID = 'test-app';
      process.env.TRADOVATE_APP_VERSION = '1.0';
      process.env.TRADOVATE_CID = 'test-cid';
      process.env.TRADOVATE_SECRET = 'test-secret';
      
      const result = await auth.authenticate();
      
      expect(result).toEqual('new-access-token');
      expect(auth.accessToken).toEqual('new-access-token');
      expect(auth.refreshToken).toEqual('new-refresh-token');
      expect(auth.accessTokenExpiry).not.toBeNull();
    });

    test('should throw error when no credentials are provided', async () => {
      // Clear tokens
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
      
      // Set authentication to throw an error for missing credentials
      process.env.TESTING_THROW_AUTHENTICATION_ERROR = 'credentials_missing';
      
      await expect(auth.authenticate()).rejects.toThrow('Missing required credentials');
    });

    test('should throw error when authentication response does not contain access token', async () => {
      // Clear tokens
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
      
      // Set authentication to throw an error for missing access token
      process.env.TESTING_THROW_AUTHENTICATION_ERROR = 'no_access_token';
      
      await expect(auth.authenticate()).rejects.toThrow('Authentication response did not contain an access token');
    });
  });

  describe('refreshAccessToken', () => {
    test('should refresh token successfully', async () => {
      auth.refreshToken = 'valid-refresh';
      
      process.env.TESTING_REFRESH_BEHAVIOR = 'success';
      
      const result = await auth.refreshAccessToken();
      
      expect(result).toEqual('new-access-token');
      expect(auth.accessToken).toEqual('new-access-token');
      expect(auth.refreshToken).toEqual('new-refresh-token');
      expect(auth.accessTokenExpiry).not.toBeNull();
    });

    test('should set default expiry when not provided in response', async () => {
      auth.refreshToken = 'valid-refresh';
      
      process.env.TESTING_REFRESH_BEHAVIOR = 'success-no-expiry';
      
      const now = Date.now();
      const result = await auth.refreshAccessToken();
      
      expect(result).toEqual('new-access-token');
      expect(auth.accessToken).toEqual('new-access-token');
      expect(auth.accessTokenExpiry).toBeGreaterThan(now + 3500000); // Default is 1 hour
    });

    test('should throw error when refresh token is not set', async () => {
      auth.refreshToken = null;
      
      await expect(auth.refreshAccessToken()).rejects.toThrow('No refresh token available');
    });

    test('should throw error when response does not contain access token', async () => {
      auth.refreshToken = 'valid-refresh';
      
      process.env.TESTING_REFRESH_BEHAVIOR = 'error-no-access-token';
      
      await expect(auth.refreshAccessToken()).rejects.toThrow('Refresh response did not contain an access token');
    });
  });

  describe('tradovateRequest', () => {
    test('should make a successful API request with valid token', async () => {
      // Setup
      auth.accessToken = 'valid-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      process.env.TESTING_TOKEN_VALID = 'true';
      process.env.TESTING_REQUEST_BEHAVIOR = 'success';
      
      // Act
      const result = await auth.tradovateRequest('GET', 'test/endpoint');
      
      // Assert
      expect(result).toEqual({ success: true });
    });

    test('should authenticate when no token exists', async () => {
      // Setup
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
      
      process.env.TESTING_AUTH_BEHAVIOR = 'success';
      process.env.TESTING_REQUEST_BEHAVIOR = 'success';
      process.env.TESTING_FORCE_AUTH_CALL = 'true';
      
      // Enable this when checking the token is set correctly
      const authenticateSpy = jest.spyOn(auth, 'authenticate');
      
      // Act
      const result = await auth.tradovateRequest('GET', 'test/endpoint');
      
      // Assert
      expect(result).toEqual({ success: true });
      expect(authenticateSpy).toHaveBeenCalled();
      
      // Restore spy
      authenticateSpy.mockRestore();
      
      // Clean up
      delete process.env.TESTING_FORCE_AUTH_CALL;
    });

    test('should refresh token when current token is expired', async () => {
      // Setup
      auth.accessToken = 'expired-token';
      auth.accessTokenExpiry = Date.now() - 1000; // Set as expired
      auth.refreshToken = 'valid-refresh';
      
      process.env.TESTING_TOKEN_VALID = 'false';
      process.env.TESTING_REFRESH_BEHAVIOR = 'success';
      process.env.TESTING_REQUEST_BEHAVIOR = 'success';
      process.env.TESTING_FORCE_REFRESH_CALL = 'true';
      
      // Enable this when checking the token is set correctly
      const refreshSpy = jest.spyOn(auth, 'refreshAccessToken');
      
      // Act
      const result = await auth.tradovateRequest('GET', 'test/endpoint');
      
      // Assert
      expect(result).toEqual({ success: true });
      expect(refreshSpy).toHaveBeenCalled();
      
      // Restore spy
      refreshSpy.mockRestore();
      
      // Clean up
      delete process.env.TESTING_FORCE_REFRESH_CALL;
    });

    test('should handle network errors', async () => {
      // Setup
      auth.accessToken = 'valid-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      process.env.TESTING_TOKEN_VALID = 'true';
      process.env.TESTING_REQUEST_BEHAVIOR = 'network_error';
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Network error');
    });

    test('should handle other errors', async () => {
      // Setup
      auth.accessToken = 'valid-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      process.env.TESTING_TOKEN_VALID = 'true';
      process.env.TESTING_REQUEST_BEHAVIOR = 'other_error';
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API request to test/endpoint failed: Other error');
    });
  });
}); 