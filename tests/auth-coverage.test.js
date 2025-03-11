const auth = require('../src/auth');
const axios = require('axios');
const { describe, expect, test, beforeEach, afterEach } = require('@jest/globals');

// Mock axios
jest.mock('axios');

describe('Auth Module Direct Tests', () => {
  // Set up before each test
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Reset auth module state
    auth.accessToken = null;
    auth.accessTokenExpiry = null;
    auth.refreshToken = null;
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('API URL Configuration', () => {
    test('should use demo URLs by default', () => {
      expect(auth.TRADOVATE_API_URL).toBe('https://demo.tradovateapi.com/v1');
      expect(auth.TRADOVATE_MD_API_URL).toBe('https://md-demo.tradovateapi.com/v1');
    });
    
    test('should use live URLs when environment is set to live', () => {
      const originalEnv = process.env.TRADOVATE_API_ENVIRONMENT;
      process.env.TRADOVATE_API_ENVIRONMENT = 'live';
      
      // Re-import to get updated values
      jest.resetModules();
      const freshAuth = require('../src/auth');
      
      expect(freshAuth.TRADOVATE_API_URL).toBe('https://live.tradovateapi.com/v1');
      expect(freshAuth.TRADOVATE_MD_API_URL).toBe('https://md-live.tradovateapi.com/v1');
      
      // Restore original environment
      process.env.TRADOVATE_API_ENVIRONMENT = originalEnv;
    });
    
    test('should fall back to demo URLs for invalid environment', () => {
      const originalEnv = process.env.TRADOVATE_API_ENVIRONMENT;
      process.env.TRADOVATE_API_ENVIRONMENT = 'invalid';
      
      // Re-import to get updated values
      jest.resetModules();
      const freshAuth = require('../src/auth');
      
      expect(freshAuth.TRADOVATE_API_URL).toBe('https://demo.tradovateapi.com/v1');
      expect(freshAuth.TRADOVATE_MD_API_URL).toBe('https://md-demo.tradovateapi.com/v1');
      
      // Restore original environment
      process.env.TRADOVATE_API_ENVIRONMENT = originalEnv;
    });
  });
  
  describe('Credentials Configuration', () => {
    test('should load credentials from environment variables', () => {
      // Save original env vars
      const originalEnv = { ...process.env };
      
      // Set test env vars
      process.env.TRADOVATE_USERNAME = 'test-user';
      process.env.TRADOVATE_PASSWORD = 'test-pass';
      process.env.TRADOVATE_APP_ID = 'test-app';
      process.env.TRADOVATE_APP_VERSION = '2.0.0';
      process.env.TRADOVATE_DEVICE_ID = 'test-device';
      process.env.TRADOVATE_CID = 'test-cid';
      process.env.TRADOVATE_SECRET = 'test-secret';
      
      // Re-import to get updated values
      jest.resetModules();
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
      
      // Restore original env vars
      Object.keys(originalEnv).forEach(key => {
        process.env[key] = originalEnv[key];
      });
    });
    
    test('should use default values when environment variables are not set', () => {
      // Save original env vars
      const originalEnv = { ...process.env };
      
      // Clear env vars
      delete process.env.TRADOVATE_USERNAME;
      delete process.env.TRADOVATE_PASSWORD;
      delete process.env.TRADOVATE_APP_ID;
      delete process.env.TRADOVATE_APP_VERSION;
      delete process.env.TRADOVATE_DEVICE_ID;
      delete process.env.TRADOVATE_CID;
      delete process.env.TRADOVATE_SECRET;
      
      // Re-import to get updated values
      jest.resetModules();
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
      
      // Restore original env vars
      Object.keys(originalEnv).forEach(key => {
        process.env[key] = originalEnv[key];
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
  });
}); 