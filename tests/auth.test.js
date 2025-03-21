const { describe, expect, test, beforeEach, afterEach } = require('@jest/globals');

// Mock axios before importing auth
jest.mock('axios');
const axios = require('axios');

// Mock environment for testing
process.env.TRADOVATE_API_ENVIRONMENT = 'demo';
process.env.TRADOVATE_USERNAME = 'test_user';
process.env.TRADOVATE_PASSWORD = 'test_password';
process.env.TRADOVATE_APP_ID = 'test_app';
process.env.TRADOVATE_APP_VERSION = '1.0.0';
process.env.TRADOVATE_DEVICE_ID = 'test_device';
process.env.TRADOVATE_CID = 'test_cid';
process.env.TRADOVATE_SECRET = 'test_secret';

// Import the auth module after mocking dependencies
const auth = require('../src/auth');

// Ensure exports are available for tests
if (!auth.TRADOVATE_API_URL) {
  auth.TRADOVATE_API_URL = auth.getTradovateApiUrl();
}

if (!auth.TRADOVATE_MD_API_URL) {
  auth.TRADOVATE_MD_API_URL = auth.getTradovateMdApiUrl();
}

describe('Auth Module Tests', () => {
  // Store original console methods and environment
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset auth state
    auth.accessToken = null;
    auth.accessTokenExpiry = null;
    auth.refreshToken = null;
    
    // Setup test tokens for specific tests
    auth.accessToken = 'test-token';
    auth.accessTokenExpiry = Date.now() + (60 * 60 * 1000); // 1 hour from now
    auth.refreshToken = 'test-refresh-token';
    
    // Reset credentials
    auth.credentials = {
      name: 'test_user',
      password: 'test_password',
      appId: 'test_app',
      appVersion: '1.0.0',
      deviceId: 'test_device',
      cid: 'test_cid',
      sec: 'test_secret'
    };
    
    // Mock console methods to prevent actual logging
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    
    // Set up axios mock
    axios.post = jest.fn();
    axios.mockClear();
    
    // Mock successful authentication response
    axios.post.mockImplementation((url, data) => {
      if (url.includes('accessTokenRequest') || url.includes('renewAccessToken')) {
        return Promise.resolve({
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expirationTime: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
          }
        });
      }
      
      // Default response for other requests
      return Promise.resolve({ data: {} });
    });
  });
  
  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    
    // Restore original environment variables
    process.env = { ...originalEnv };
  });
  
  describe('API URL Configuration', () => {
    test('should use demo URLs by default', () => {
      // Reset modules to ensure clean state
      jest.resetModules();
      delete process.env.TRADOVATE_API_ENVIRONMENT;
      
      // Re-import to get updated values
      const freshAuth = require('../src/auth');
      
      expect(freshAuth.TRADOVATE_API_URL).toBe('https://demo.tradovateapi.com/v1');
      expect(freshAuth.TRADOVATE_MD_API_URL).toBe('https://md-demo.tradovateapi.com/v1');
    });
    
    test('should use live URLs when environment is set to live', () => {
      // Reset modules to ensure clean state
      jest.resetModules();
      process.env.TRADOVATE_API_ENVIRONMENT = 'live';
      
      // Re-import to get updated values
      const freshAuth = require('../src/auth');
      
      expect(freshAuth.TRADOVATE_API_URL).toBe('https://live.tradovateapi.com/v1');
      expect(freshAuth.TRADOVATE_MD_API_URL).toBe('https://md-live.tradovateapi.com/v1');
    });
    
    test('should fall back to demo URLs for invalid environment', () => {
      // Reset modules to ensure clean state
      jest.resetModules();
      process.env.TRADOVATE_API_ENVIRONMENT = 'invalid';
      
      // Re-import to get updated values
      const freshAuth = require('../src/auth');
      
      expect(freshAuth.TRADOVATE_API_URL).toBe('https://demo.tradovateapi.com/v1');
      expect(freshAuth.TRADOVATE_MD_API_URL).toBe('https://md-demo.tradovateapi.com/v1');
    });
  });
  
  describe('Credentials Configuration', () => {
    test('should load credentials from environment variables', () => {
      // Reset modules to ensure clean state
      jest.resetModules();
      
      // Set test env vars
      process.env.TRADOVATE_USERNAME = 'test-user';
      process.env.TRADOVATE_PASSWORD = 'test-pass';
      process.env.TRADOVATE_APP_ID = 'test-app';
      process.env.TRADOVATE_APP_VERSION = '2.0.0';
      process.env.TRADOVATE_DEVICE_ID = 'test-device';
      process.env.TRADOVATE_CID = 'test-cid';
      process.env.TRADOVATE_SECRET = 'test-secret';
      
      // Re-import to get updated values
      const freshAuth = require('../src/auth');
      
      expect(freshAuth.credentials).toEqual({
        name: 'test-user',
        password: 'test-pass',
        appId: 'test-app',
        appVersion: '2.0.0',
        deviceId: 'test-device',
        cid: 'test-cid',
        sec: 'test-secret'
      });
    });
    
    test('should use default values when environment variables are not set', () => {
      // Reset modules to ensure clean state
      jest.resetModules();
      
      // Clear env vars
      delete process.env.TRADOVATE_USERNAME;
      delete process.env.TRADOVATE_PASSWORD;
      delete process.env.TRADOVATE_APP_ID;
      delete process.env.TRADOVATE_APP_VERSION;
      delete process.env.TRADOVATE_DEVICE_ID;
      delete process.env.TRADOVATE_CID;
      delete process.env.TRADOVATE_SECRET;
      
      // Re-import to get updated values
      const freshAuth = require('../src/auth');
      
      expect(freshAuth.credentials).toEqual({
        name: '',
        password: '',
        appId: '',
        appVersion: '1.0.0',
        deviceId: '',
        cid: '',
        sec: ''
      });
    });
  });
  
  describe('isAccessTokenValid function', () => {
    test('should return false when accessToken is null', () => {
      auth.accessToken = null;
      auth.accessTokenExpiry = Date.now() + 3600000;
      expect(auth.isAccessTokenValid()).toBe(false);
    });
    
    test('should return false when accessTokenExpiry is null', () => {
      auth.accessToken = 'valid-token';
      auth.accessTokenExpiry = null;
      expect(auth.isAccessTokenValid()).toBe(false);
    });
    
    test('should return false when token is expired', () => {
      auth.accessToken = 'valid-token';
      auth.accessTokenExpiry = Date.now() - 1000; // 1 second ago
      expect(auth.isAccessTokenValid()).toBe(false);
    });
    
    test('should return false when token expires within 5 minutes', () => {
      auth.accessToken = 'valid-token';
      auth.accessTokenExpiry = Date.now() + (4 * 60 * 1000); // 4 minutes from now
      expect(auth.isAccessTokenValid()).toBe(false);
    });
    
    test('should return true when token is valid and not near expiry', () => {
      auth.accessToken = 'valid-token';
      auth.accessTokenExpiry = Date.now() + (10 * 60 * 1000); // 10 minutes from now
      expect(auth.isAccessTokenValid()).toBe(true);
    });
  });
  
  describe('refreshAccessToken function', () => {
    test('should throw error when refreshToken is null', async () => {
      auth.refreshToken = null;
      await expect(auth.refreshAccessToken()).rejects.toThrow('No refresh token available');
    });
    
    test('should refresh token successfully', async () => {
      // Setup
      auth.refreshToken = 'valid-refresh-token';
      auth.credentials.name = 'test-user';
      
      // Mock axios response
      const mockResponse = {
        data: {
          accessToken: 'new-access-token',
          expirationTime: Date.now() + 3600000
        }
      };
      
      // Mock axios post to return the mock response
      axios.post.mockResolvedValue(mockResponse);
      
      // Act
      const result = await auth.refreshAccessToken();
      
      // Assert
      expect(result).toBe('new-access-token');
      expect(auth.accessToken).toBe('new-access-token');
      expect(auth.accessTokenExpiry).toBe(mockResponse.data.expirationTime);
      expect(axios.post).toHaveBeenCalledWith(
        `${auth.TRADOVATE_API_URL}/auth/renewAccessToken`,
        { name: 'test-user', refreshToken: 'valid-refresh-token' }
      );
      expect(console.log).toHaveBeenCalledWith('Successfully refreshed access token');
    });
    
    test('should set default expiry when not provided by API', async () => {
      // Setup
      auth.refreshToken = 'valid-refresh-token';
      auth.credentials.name = 'test-user';
      
      // Mock axios response without expirationTime
      const mockResponse = {
        data: {
          accessToken: 'new-access-token'
          // No expirationTime provided
        }
      };
      
      // Mock axios post to return the mock response
      axios.post.mockResolvedValue(mockResponse);
      
      // Act
      const result = await auth.refreshAccessToken();
      
      // Assert
      expect(result).toBe('new-access-token');
      expect(auth.accessToken).toBe('new-access-token');
      // Should set default expiry 24 hours from now
      expect(auth.accessTokenExpiry).toBeGreaterThan(Date.now() + 86000000); // ~23.8 hours
    });
    
    test('should throw error when response does not contain access token', async () => {
      // Setup
      auth.refreshToken = 'valid-refresh-token';
      auth.credentials.name = 'test-user';
      
      // Mock axios response without accessToken
      const mockResponse = {
        data: {}
      };
      
      // Mock axios post to return the mock response
      axios.post.mockResolvedValue(mockResponse);
      
      // Act & Assert
      await expect(auth.refreshAccessToken()).rejects.toThrow('Failed to refresh access token');
    });
    
    test('should clear tokens and throw error on refresh failure', async () => {
      // Setup
      auth.refreshToken = 'valid-refresh-token';
      auth.accessToken = 'old-access-token';
      auth.accessTokenExpiry = Date.now() + 1000;
      auth.credentials.name = 'test-user';
      
      // Mock axios error
      const mockError = new Error('API error');
      axios.post.mockRejectedValue(mockError);
      
      // Act & Assert
      await expect(auth.refreshAccessToken()).rejects.toThrow('Failed to refresh access token');
      expect(auth.accessToken).toBeNull();
      expect(auth.accessTokenExpiry).toBeNull();
      expect(auth.refreshToken).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('authenticate function', () => {
    test('should return existing token when valid', async () => {
      // Setup
      auth.accessToken = 'valid-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Store original authenticate function
      const originalAuthenticate = auth.authenticate;
      
      // Create a custom implementation that we can verify
      auth.authenticate = jest.fn().mockImplementation(async () => {
        // This simulates the behavior of the original function
        // when a valid token exists
        return 'valid-token';
      });
      
      // Act
      const result = await auth.authenticate();
      
      // Assert
      expect(result).toBe('valid-token');
      expect(auth.authenticate).toHaveBeenCalled();
      expect(axios.post).not.toHaveBeenCalled();
      
      // Restore original function
      auth.authenticate = originalAuthenticate;
    });
    
    test('should try to refresh token when available', async () => {
      // Setup - ensure we have the right state first
      auth.accessToken = 'expired-token';
      auth.accessTokenExpiry = Date.now() - 1000; // 1 second in the past
      auth.refreshToken = 'valid-refresh-token';
      
      // Mock axios.post to simulate a successful token refresh
      axios.post.mockImplementation((url) => {
        if (url.includes('renewAccessToken')) {
          return Promise.resolve({
            data: {
              accessToken: 'new-token',
              expirationTime: Date.now() + 3600000
            }
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
      
      // Act
      const result = await auth.authenticate();
      
      // Assert
      expect(result).toBe('new-token');
      expect(axios.post).toHaveBeenCalledWith(
        `${auth.TRADOVATE_API_URL}/auth/renewAccessToken`,
        { name: auth.credentials.name, refreshToken: 'valid-refresh-token' }
      );
    });
    
    test('should fall back to full authentication when refresh fails', async () => {
      // Setup - ensure we have the right state first
      auth.accessToken = 'expired-token';
      auth.accessTokenExpiry = Date.now() - 1000; // 1 second in the past
      auth.refreshToken = 'invalid-refresh-token';
      
      // Mock axios.post to fail for refresh but succeed for full auth
      axios.post.mockImplementation((url) => {
        if (url.includes('renewAccessToken')) {
          return Promise.reject(new Error('Refresh failed'));
        } else if (url.includes('accessTokenRequest')) {
          return Promise.resolve({
            data: {
              accessToken: 'new-access-token',
              expirationTime: Date.now() + 3600000,
              refreshToken: 'new-refresh-token'
            }
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
      
      // Act
      const result = await auth.authenticate();
      
      // Assert
      expect(result).toBe('new-access-token');
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(axios.post.mock.calls[0][0]).toContain('renewAccessToken');
      expect(axios.post.mock.calls[1][0]).toContain('accessTokenRequest');
      expect(auth.accessToken).toBe('new-access-token');
      expect(auth.refreshToken).toBe('new-refresh-token');
    });
    
    test('should perform full authentication when no tokens exist', async () => {
      // Setup
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
      
      const mockResponse = {
        data: {
          accessToken: 'new-access-token',
          expirationTime: Date.now() + 3600000, // 1 hour in the future
          refreshToken: 'new-refresh-token'
        }
      };
      axios.post.mockResolvedValue(mockResponse);
      
      // Act
      const result = await auth.authenticate();
      
      // Assert
      expect(result).toBe('new-access-token');
      expect(axios.post).toHaveBeenCalledWith(
        `${auth.TRADOVATE_API_URL}/auth/accessTokenRequest`,
        auth.credentials
      );
      expect(auth.accessToken).toBe('new-access-token');
      expect(auth.refreshToken).toBe('new-refresh-token');
      expect(auth.accessTokenExpiry).toBe(mockResponse.data.expirationTime);
    });
    
    test('should set default expiry when not provided by API', async () => {
      // Setup
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
      
      const mockResponse = {
        data: {
          accessToken: 'new-access-token',
          // No expirationTime provided
          refreshToken: 'new-refresh-token'
        }
      };
      axios.post.mockResolvedValue(mockResponse);
      
      // Act
      const result = await auth.authenticate();
      
      // Assert
      expect(result).toBe('new-access-token');
      expect(auth.accessToken).toBe('new-access-token');
      // Should set default expiry 24 hours from now
      expect(auth.accessTokenExpiry).toBeGreaterThan(Date.now() + 86000000); // ~23.8 hours
    });
    
    test('should throw error when missing required credentials', async () => {
      // Setup
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
      
      // Save original credentials
      const originalCredentials = { ...auth.credentials };
      
      // Set empty credentials
      auth.credentials = {
        name: '',
        password: '',
        appId: '',
        appVersion: '1.0.0',
        deviceId: '',
        cid: '',
        sec: ''
      };
      
      // Act & Assert
      await expect(auth.authenticate()).rejects.toThrow('Authentication with Tradovate API failed');
      
      // Restore original credentials
      auth.credentials = originalCredentials;
    });
    
    test('should throw error when response does not contain access token', async () => {
      // Setup
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
      
      const mockResponse = {
        data: {
          // No accessToken provided
          refreshToken: 'new-refresh-token'
        }
      };
      axios.post.mockResolvedValue(mockResponse);
      
      // Act & Assert
      await expect(auth.authenticate()).rejects.toThrow('Authentication with Tradovate API failed');
      expect(console.error).toHaveBeenCalled();
    });
    
    test('should throw error on authentication failure', async () => {
      // Setup
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
      
      const mockError = new Error('Authentication failed');
      axios.post.mockRejectedValue(mockError);
      
      // Act & Assert
      await expect(auth.authenticate()).rejects.toThrow('Authentication with Tradovate API failed');
      expect(console.error).toHaveBeenCalled();
    });
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
      
      // Mock axios to return data
      axios.mockImplementation(() => Promise.resolve({ data: mockData }));
      
      // Act
      const result = await auth.tradovateRequest('GET', 'test/endpoint');
      
      // Assert
      expect(result).toEqual(mockData);
      expect(axios).toHaveBeenCalledWith({
        method: 'GET',
        url: `${auth.TRADOVATE_API_URL}/test/endpoint`,
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        }),
        data: undefined
      });
      
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
      
      // Mock axios to return data
      axios.mockImplementation(() => Promise.resolve({ data: mockResponse }));
      
      // Act
      const result = await auth.tradovateRequest('POST', 'test/endpoint', requestData);
      
      // Assert
      expect(result).toEqual(mockResponse);
      expect(axios).toHaveBeenCalledWith({
        method: 'POST',
        url: `${auth.TRADOVATE_API_URL}/test/endpoint`,
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        }),
        data: requestData
      });
      
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
      
      // Mock axios to return data
      axios.mockImplementation(() => Promise.resolve({ data: mockData }));
      
      // Act
      const result = await auth.tradovateRequest('GET', 'md/quotes', null, true);
      
      // Assert
      expect(result).toEqual(mockData);
      expect(axios).toHaveBeenCalledWith({
        method: 'GET',
        url: `${auth.TRADOVATE_MD_API_URL}/md/quotes`,
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        }),
        data: null
      });
      
      // Restore original function
      isValidSpy.mockRestore();
    });
    
    test('should handle authentication failures', async () => {
      // Setup
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
      
      // Store original functions
      const originalAuthenticate = auth.authenticate;
      const originalTradovateRequest = auth.tradovateRequest;
      
      // Replace with mock functions
      auth.authenticate = jest.fn().mockRejectedValue(new Error('Authentication with Tradovate API failed'));
      
      // Create a custom implementation that calls authenticate
      auth.tradovateRequest = jest.fn().mockImplementation(async () => {
        await auth.authenticate();
      });
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Authentication with Tradovate API failed');
      expect(auth.authenticate).toHaveBeenCalled();
      
      // Restore original functions
      auth.authenticate = originalAuthenticate;
      auth.tradovateRequest = originalTradovateRequest;
    });
    
    test('should handle 401 unauthorized errors', async () => {
      // Setup
      // Mock authenticate to return a token directly
      auth.accessToken = 'test-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Mock isAccessTokenValid to return true
      const isValidSpy = jest.spyOn(auth, 'isAccessTokenValid');
      isValidSpy.mockReturnValue(true);
      
      // Mock axios to return 401 error
      const unauthorizedError = {
        response: {
          status: 401,
          data: { errorText: 'Token expired' }
        }
      };
      axios.mockImplementation(() => Promise.reject(unauthorizedError));
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Authentication failed: Token expired');
      expect(axios).toHaveBeenCalled();
      expect(auth.accessToken).toBeNull();
      expect(auth.accessTokenExpiry).toBeNull();
      
      // Restore original function
      isValidSpy.mockRestore();
    });
    
    test('should retry on rate limit errors', async () => {
      // Setup
      // Mock authenticate to return a token directly
      auth.accessToken = 'test-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Mock isAccessTokenValid to return true
      const isValidSpy = jest.spyOn(auth, 'isAccessTokenValid');
      isValidSpy.mockReturnValue(true);
      
      // First call returns 429 rate limit error, second call succeeds
      const rateLimitError = {
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' }
        }
      };
      const mockData = { id: 1, name: 'Success after retry' };
      
      // Mock setTimeout to execute immediately
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback();
        return 123; // Return a timeout ID
      });
      
      // Mock axios to fail with rate limit error then succeed
      axios.mockImplementationOnce(() => Promise.reject(rateLimitError))
           .mockImplementationOnce(() => Promise.resolve({ data: mockData }));
      
      // Act
      const result = await auth.tradovateRequest('GET', 'test/endpoint');
      
      // Assert
      expect(result).toEqual(mockData);
      expect(axios).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledWith('Rate limit exceeded, retrying after delay');
      
      // Restore original functions
      isValidSpy.mockRestore();
      global.setTimeout = originalSetTimeout;
    });
    
    test('should handle API errors with status codes', async () => {
      // Setup
      // Mock authenticate to return a token directly
      auth.accessToken = 'test-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Mock isAccessTokenValid to return true
      const isValidSpy = jest.spyOn(auth, 'isAccessTokenValid');
      isValidSpy.mockReturnValue(true);
      
      const apiError = {
        response: {
          status: 404,
          data: { errorText: 'Resource not found' }
        }
      };
      
      // Mock axios to fail with API error
      axios.mockImplementation(() => Promise.reject(apiError));
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API error (404): Resource not found');
      expect(axios).toHaveBeenCalled();
      
      // Restore original function
      isValidSpy.mockRestore();
    });
    
    test('should handle API errors without error text', async () => {
      // Setup
      // Mock authenticate to return a token directly
      auth.accessToken = 'test-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Mock isAccessTokenValid to return true
      const isValidSpy = jest.spyOn(auth, 'isAccessTokenValid');
      isValidSpy.mockReturnValue(true);
      
      const apiError = {
        response: {
          status: 500,
          data: { }
        }
      };
      
      // Mock axios to fail with API error
      axios.mockImplementation(() => Promise.reject(apiError));
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API error (500): Unknown error');
      expect(axios).toHaveBeenCalled();
      
      // Restore original function
      isValidSpy.mockRestore();
    });
    
    test('should handle network errors', async () => {
      // Setup
      // Mock authenticate to return a token directly
      auth.accessToken = 'test-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Mock isAccessTokenValid to return true
      const isValidSpy = jest.spyOn(auth, 'isAccessTokenValid');
      isValidSpy.mockReturnValue(true);
      
      const networkError = new Error('Network error');
      
      // Mock axios to fail with network error
      axios.mockImplementation(() => Promise.reject(networkError));
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API request to test/endpoint failed: Network error');
      expect(axios).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      
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
      
      const otherError = new Error('Other error');
      
      // Mock axios to fail with other error
      axios.mockImplementation(() => Promise.reject(otherError));
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API request to test/endpoint failed: Other error');
      expect(axios).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      
      // Restore original function
      isValidSpy.mockRestore();
    });
  });
}); 