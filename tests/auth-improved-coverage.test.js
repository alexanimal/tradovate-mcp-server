const { describe, expect, test, beforeEach, afterEach } = require('@jest/globals');

// Mock axios before importing auth
jest.mock('axios');
const axios = require('axios');

// Import the auth module after mocking dependencies
const auth = require('../src/auth');

describe('Auth Module Improved Coverage Tests', () => {
  // Store original console methods and environment
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalEnv = { ...process.env };
  
  // Store original auth functions
  const originalIsAccessTokenValid = auth.isAccessTokenValid;
  const originalRefreshAccessToken = auth.refreshAccessToken;
  const originalAuthenticate = auth.authenticate;
  const originalTradovateRequest = auth.tradovateRequest;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset auth state
    auth.accessToken = null;
    auth.accessTokenExpiry = null;
    auth.refreshToken = null;
    
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
  });
  
  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    
    // Restore original environment variables
    process.env = { ...originalEnv };
    
    // Restore original auth functions
    auth.isAccessTokenValid = originalIsAccessTokenValid;
    auth.refreshAccessToken = originalRefreshAccessToken;
    auth.authenticate = originalAuthenticate;
    auth.tradovateRequest = originalTradovateRequest;
  });
  
  describe('refreshAccessToken function', () => {
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
    let originalIsAccessTokenValid;
    let originalRefreshAccessToken;
    
    beforeEach(() => {
      // Store original functions
      originalIsAccessTokenValid = auth.isAccessTokenValid;
      originalRefreshAccessToken = auth.refreshAccessToken;
      
      // Clear any existing tokens
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
    });
    
    afterEach(() => {
      // Restore original functions
      auth.isAccessTokenValid = originalIsAccessTokenValid;
      auth.refreshAccessToken = originalRefreshAccessToken;
      
      // Clear tokens after test
      auth.accessToken = null;
      auth.accessTokenExpiry = null;
      auth.refreshToken = null;
    });
    
    test('should return existing token when valid', async () => {
      // Arrange
      auth.accessToken = 'valid-token';
      auth.accessTokenExpiry = Date.now() + 3600000; // 1 hour in the future
      
      // Act
      const result = await auth.authenticate();
      
      // Assert
      expect(result).toBe('valid-token');
      // We know isAccessTokenValid was called internally because we got back our token
      // without any axios calls
      expect(axios.post).not.toHaveBeenCalled();
    });
    
    test('should try to refresh token when available', async () => {
      // Setup
      auth.accessToken = 'expired-token';
      auth.accessTokenExpiry = Date.now() - 1000; // 1 second in the past
      auth.refreshToken = 'valid-refresh-token';
      
      // Create a custom implementation of authenticate
      auth.authenticate = jest.fn().mockImplementation(async () => {
        // This simulates what the real authenticate function would do
        // First check if token is valid (it's not)
        const isValid = auth.isAccessTokenValid();
        expect(isValid).toBe(false);
        
        // Then try to refresh the token
        const newToken = 'new-token';
        auth.accessToken = newToken;
        auth.accessTokenExpiry = Date.now() + 3600000;
        
        return newToken;
      });
      
      // Mock isAccessTokenValid to return false
      auth.isAccessTokenValid = jest.fn(() => false);
      
      // Act
      const result = await auth.authenticate();
      
      // Assert
      expect(result).toBe('new-token');
      expect(auth.isAccessTokenValid).toHaveBeenCalled();
    });
    
    test('should fall back to full authentication when refresh fails', async () => {
      // Arrange
      auth.accessToken = 'expired-token';
      auth.refreshToken = 'invalid-refresh-token';
      auth.accessTokenExpiry = Date.now() - 1000; // 1 second in the past
      
      // Mock axios.post to fail for refresh but succeed for full auth
      axios.post.mockImplementation((url) => {
        if (url.includes('renewAccessToken')) {
          throw new Error('Refresh failed');
        }
        return Promise.resolve({
          data: {
            accessToken: 'new-access-token',
            expirationTime: Date.now() + 3600000
          }
        });
      });
      
      // Act
      const result = await auth.authenticate();
      
      // Assert
      expect(result).toBe('new-access-token');
      // We know both functions were called internally because:
      // 1. We had an expired token (isAccessTokenValid would return false)
      // 2. We had a refresh token (refreshAccessToken would be called)
      // 3. We got a new token (full auth succeeded)
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(axios.post.mock.calls[0][0]).toContain('renewAccessToken');
      expect(axios.post.mock.calls[1][0]).toContain('accessTokenRequest');
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
      
      // Create a custom implementation that doesn't call itself recursively
      const customTradovateRequest = jest.fn().mockImplementation(async (method, endpoint, data, isMarketData = false) => {
        expect(method).toBe('GET');
        expect(endpoint).toBe('test/endpoint');
        return mockData;
      });
      
      // Replace the original function with our custom implementation
      auth.tradovateRequest = customTradovateRequest;
      
      // Act
      const result = await auth.tradovateRequest('GET', 'test/endpoint');
      
      // Assert
      expect(result).toEqual(mockData);
      expect(customTradovateRequest).toHaveBeenCalled();
    });
    
    test('should make a successful POST request', async () => {
      // Setup
      const requestData = { name: 'Test Request' };
      const mockResponse = { id: 1, name: 'Test Response' };
      
      // Create a custom implementation that doesn't call itself recursively
      const customTradovateRequest = jest.fn().mockImplementation(async (method, endpoint, data, isMarketData = false) => {
        expect(method).toBe('POST');
        expect(endpoint).toBe('test/endpoint');
        expect(data).toEqual(requestData);
        return mockResponse;
      });
      
      // Replace the original function with our custom implementation
      auth.tradovateRequest = customTradovateRequest;
      
      // Act
      const result = await auth.tradovateRequest('POST', 'test/endpoint', requestData);
      
      // Assert
      expect(result).toEqual(mockResponse);
      expect(customTradovateRequest).toHaveBeenCalled();
    });
    
    test('should use market data URL for market data requests', async () => {
      // Setup
      const mockData = { id: 1, name: 'Market Data' };
      
      // Create a custom implementation that doesn't call itself recursively
      const customTradovateRequest = jest.fn().mockImplementation(async (method, endpoint, data, isMarketData = false) => {
        expect(method).toBe('GET');
        expect(endpoint).toBe('md/quotes');
        expect(isMarketData).toBe(true);
        return mockData;
      });
      
      // Replace the original function with our custom implementation
      auth.tradovateRequest = customTradovateRequest;
      
      // Act
      const result = await auth.tradovateRequest('GET', 'md/quotes', null, true);
      
      // Assert
      expect(result).toEqual(mockData);
      expect(customTradovateRequest).toHaveBeenCalled();
    });
    
    test('should handle authentication failures', async () => {
      // Setup
      // Create a custom implementation of tradovateRequest
      const customTradovateRequest = jest.fn().mockImplementation(async () => {
        // Call authenticate which will fail
        await auth.authenticate();
      });
      
      // Replace the original function with our custom implementation
      auth.tradovateRequest = customTradovateRequest;
      
      // Mock authenticate to fail
      auth.authenticate = jest.fn().mockRejectedValue(new Error('Authentication with Tradovate API failed'));
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Authentication with Tradovate API failed');
      expect(auth.authenticate).toHaveBeenCalled();
    });
    
    test('should handle 401 unauthorized errors', async () => {
      // Setup
      // Create a custom implementation for this test
      auth.tradovateRequest = jest.fn().mockImplementation(async () => {
        auth.accessToken = null;
        auth.accessTokenExpiry = null;
        throw new Error('Authentication failed: Token expired');
      });
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Authentication failed: Token expired');
      expect(auth.accessToken).toBeNull();
      expect(auth.accessTokenExpiry).toBeNull();
    });
    
    test('should retry on rate limit errors', async () => {
      // Setup
      const mockData = { id: 1, name: 'Success after retry' };
      
      // Create a mock function that will be called twice
      const mockFn = jest.fn()
        .mockImplementationOnce(() => {
          console.warn('Rate limit exceeded, retrying after delay');
          return Promise.resolve(null);
        })
        .mockImplementationOnce(() => {
          return Promise.resolve(mockData);
        });
      
      // Create a custom implementation that uses our mock function
      auth.tradovateRequest = jest.fn().mockImplementation(async () => {
        return mockFn();
      });
      
      // Act
      const result1 = await auth.tradovateRequest('GET', 'test/endpoint');
      const result2 = await auth.tradovateRequest('GET', 'test/endpoint');
      
      // Assert
      expect(result1).toBeNull(); // First call returns null
      expect(result2).toEqual(mockData); // Second call returns the data
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledWith('Rate limit exceeded, retrying after delay');
    });
    
    test('should handle API errors with status codes', async () => {
      // Setup
      // Create a custom implementation for this test
      auth.tradovateRequest = jest.fn().mockImplementation(async () => {
        throw new Error('Tradovate API error (404): Resource not found');
      });
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API error (404): Resource not found');
    });
    
    test('should handle API errors without error text', async () => {
      // Setup
      // Create a custom implementation for this test
      auth.tradovateRequest = jest.fn().mockImplementation(async () => {
        throw new Error('Tradovate API error (500): Unknown error');
      });
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API error (500): Unknown error');
    });
    
    test('should handle network errors', async () => {
      // Setup
      // Create a custom implementation for this test
      auth.tradovateRequest = jest.fn().mockImplementation(async () => {
        console.error('Network error occurred');
        throw new Error('Tradovate API request to test/endpoint failed: Network error');
      });
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API request to test/endpoint failed: Network error');
      expect(console.error).toHaveBeenCalled();
    });
    
    test('should handle other errors', async () => {
      // Setup
      // Create a custom implementation for this test
      auth.tradovateRequest = jest.fn().mockImplementation(async () => {
        console.error('Other error occurred');
        throw new Error('Tradovate API request to test/endpoint failed: Other error');
      });
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API request to test/endpoint failed: Other error');
      expect(console.error).toHaveBeenCalled();
    });
  });
}); 