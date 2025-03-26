import axios from 'axios';
import dotenv from 'dotenv';
import * as logger from "./logger.js";
import WebSocket from 'ws';
// Load environment variables at module scope
dotenv.config();

// Tradovate API authentication credentials interface
export interface TradovateCredentials {
  name: string;
  password: string;
  appId: string;
  appVersion: string;
  deviceId: string;
  cid: string;
  sec: string;
}

// API URLs for different environments
const API_URLS = {
  demo: 'https://demo.tradovateapi.com/v1',
  live: 'https://live.tradovateapi.com/v1',
  md_demo: 'wss://md-demo.tradovateapi.com/v1/websocket',
  md_live: 'wss://md.tradovateapi.com/v1/websocket'
};

// Get API environment from env vars - use a function to get fresh values
function getApiEnvironment() {
  return process.env.TRADOVATE_API_ENVIRONMENT || 'demo';
}

// Set API URLs based on environment - updated to use the function
export function getTradovateApiUrl() {
  const apiEnv = getApiEnvironment();
  return API_URLS[apiEnv as keyof typeof API_URLS] || API_URLS.demo;
}

export function getTradovateMdApiUrl() {
  const apiEnv = getApiEnvironment();
  return apiEnv.includes('live') ? API_URLS.md_live : API_URLS.md_demo;
}

// Keep tokens in memory
let accessToken: string | null = null;
let accessTokenExpiry: number | null = null;
let refreshToken: string | null = null;

// Function to get credentials from environment variables
// This will be called when needed, not at module initialization
export function getCredentials(): TradovateCredentials {
  const credentials: TradovateCredentials = {
    name: process.env.TRADOVATE_USERNAME || '',
    password: process.env.TRADOVATE_PASSWORD || '',
    appId: process.env.TRADOVATE_APP_ID || '',
    appVersion: process.env.TRADOVATE_APP_VERSION || '1.0.0',
    deviceId: process.env.TRADOVATE_DEVICE_ID || '',
    cid: process.env.TRADOVATE_CID || '',
    sec: process.env.TRADOVATE_SECRET || ''
  };

  // Debug log for credentials
  logger.debug('DEBUG: Credentials retrieved from environment:');
  logger.debug('name present:', !!credentials.name);
  logger.debug('password present:', !!credentials.password);
  logger.debug('appId present:', !!credentials.appId);
  logger.debug('deviceId present:', !!credentials.deviceId);
  logger.debug('cid present:', !!credentials.cid);
  logger.debug('sec present:', !!credentials.sec);

  return credentials;
}

/**
 * Check if the current access token is valid
 */
export function isAccessTokenValid(): boolean {
  if (!accessToken || !accessTokenExpiry) return false;
  
  // Consider token expired 5 minutes before actual expiry
  const currentTime = Date.now();
  const expiryWithBuffer = accessTokenExpiry - (5 * 60 * 1000);
  
  return currentTime < expiryWithBuffer;
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshAccessToken(): Promise<string> {
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  const credentials = getCredentials();
  
  try {
    const response = await axios.post(`${getTradovateApiUrl()}/auth/renewAccessToken`, {
      name: credentials.name,
      refreshToken
    });
    
    if (response.data && response.data.accessToken) {
      accessToken = response.data.accessToken;
      
      // Set expiry time (default to 24 hours if not provided)
      if (response.data.expirationTime) {
        accessTokenExpiry = response.data.expirationTime;
      } else {
        accessTokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
      }
      
      logger.info('Successfully refreshed access token');
      return response.data.accessToken;
    } else {
      throw new Error('Token refresh response did not contain an access token');
    }
  } catch (error) {
    logger.error('Failed to refresh access token:', error);
    // Clear tokens to force a full re-authentication
    accessToken = null;
    accessTokenExpiry = null;
    refreshToken = null;
    throw new Error('Failed to refresh access token');
  }
}

/**
 * Authenticate with Tradovate API and get access token
 */
export async function authenticate(): Promise<string> {
  // If we have a valid token, return it
  if (isAccessTokenValid() && accessToken) {
    return accessToken;
  }
  
  // If we have a refresh token, try to use it
  if (refreshToken) {
    try {
      return await refreshAccessToken();
    } catch (error) {
      logger.warn('Failed to refresh token, will attempt full authentication');
      // Continue with full authentication
    }
  }
  
  // Get fresh credentials
  const credentials = getCredentials();
  
  // Perform full authentication
  try {
    // Validate required credentials
    if (!credentials.name || !credentials.password || !credentials.appId || 
        !credentials.deviceId || !credentials.cid || !credentials.sec) {
      logger.error('DEBUG: Credential validation failed!');
      throw new Error('Missing required Tradovate API credentials');
    }
    
    const response = await axios.post(`${getTradovateApiUrl()}/auth/accessTokenRequest`, credentials);
    
    if (response.data && response.data.accessToken) {
      accessToken = response.data.accessToken;
      
      // Store refresh token if provided
      if (response.data.refreshToken) {
        refreshToken = response.data.refreshToken;
      }
      
      // Set expiry time (default to 24 hours if not provided)
      if (response.data.expirationTime) {
        accessTokenExpiry = response.data.expirationTime;
      } else {
        accessTokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
      }
      
      logger.info('Successfully fetched access token');
      return response.data.accessToken;
    } else {
      throw new Error('Authentication response did not contain an access token');
    }
  } catch (error) {
    logger.error('Failed to authenticate with Tradovate API:', error);
    throw new Error('Authentication with Tradovate API failed');
  }
}

/**
 * Make an authenticated request to the Tradovate API
 * For market data requests, uses WebSocket connection
 */
export async function tradovateRequest(method: string, endpoint: string, data?: any, isMarketData: boolean = false): Promise<any> {
  const token = await authenticate();
  const baseUrl = isMarketData ? getTradovateMdApiUrl() : getTradovateApiUrl();
  logger.info(`Making request to ${baseUrl}/${endpoint}`);
  try {
    const response = await axios({
      method,
      url: `${baseUrl}/${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data
    });
    logger.info(`${baseUrl}/${endpoint}: ${ isMarketData ? response.data : JSON.stringify(response.data)}`);
    return response.data;
  } catch (error: any) {
    // Handle specific API errors
    if (error.response) {
      const status = error.response!.status;
      const errorData = error.response!.data;
      
      // Handle authentication errors
      if (status === 401) {
        // Clear tokens to force re-authentication on next request
        accessToken = null;
        accessTokenExpiry = null;
        
        throw new Error('Authentication failed: ' + (errorData.errorText || 'Unauthorized'));
      }
      
      // Handle rate limiting
      if (status === 429) {
        logger.warn('Rate limit exceeded, retrying after delay');
        // Wait for 2 seconds and retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        return tradovateRequest(method, endpoint, data, isMarketData);
      }
      
      // Handle other API errors
      throw new Error(`Tradovate API error (${status}): ${errorData.errorText || 'Unknown error'}`);
    }
    
    // Handle network errors
    logger.error(`Error making request to ${endpoint}:`, error);
    throw new Error(`Tradovate API request to ${endpoint} failed: ${error.message}`);
  }
}

export async function getAccessToken(retry: boolean = true) {
  try {
    // First try to use an existing valid token
    if (isAccessTokenValid() && accessToken) {
      logger.info('Using existing valid access token');
      return { accessToken, expiresAt: accessTokenExpiry };
    }
    
    // If no valid token, get a new one
    logger.info('No valid token found, authenticating...');
    const token = await authenticate();
    return { accessToken: token, expiresAt: accessTokenExpiry };
  } catch (error) {
    if (retry) {
      // If failed and retry is allowed, wait and try one more time
      logger.warn('Failed to get access token, retrying after delay...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return getAccessToken(false); // Retry once with retry=false to avoid infinite loops
    } else {
      // If retry also failed or not allowed, log and rethrow
      logger.error('Failed to get access token after retry:', error);
      throw error;
    }
  }
}

export function isTokenValid(expiration: number | null) {
  const timeLeft = new Date(expiration!).getTime() - new Date().getTime();
  return timeLeft > 0;
}
