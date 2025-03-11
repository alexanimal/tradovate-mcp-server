const { describe, expect, test, beforeEach, afterEach } = require('@jest/globals');

// Mock axios before importing auth
jest.mock('axios');
const axios = require('axios');

// Import the auth module after mocking dependencies
const auth = require('../src/auth');

describe('Auth Module Final Coverage Tests', () => {
  // Store original console methods
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
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
      axios.mockResolvedValueOnce({ data: mockData });
      
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
      axios.mockResolvedValueOnce({ data: mockResponse });
      
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
      axios.mockResolvedValueOnce({ data: mockData });
      
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
      axios.mockRejectedValueOnce(unauthorizedError);
      
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
      axios.mockRejectedValueOnce(rateLimitError)
           .mockResolvedValueOnce({ data: mockData });
      
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
      axios.mockRejectedValueOnce(apiError);
      
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
      axios.mockRejectedValueOnce(apiError);
      
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
      axios.mockRejectedValueOnce(networkError);
      
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
      axios.mockRejectedValueOnce(otherError);
      
      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API request to test/endpoint failed: Other error');
      expect(axios).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      
      // Restore original function
      isValidSpy.mockRestore();
    });
  });
}); 