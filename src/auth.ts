import axios from 'axios';

// API URLs for different environments
const API_URLS = {
  demo: 'https://demo.tradovateapi.com/v1',
  live: 'https://live.tradovateapi.com/v1',
  md_demo: 'https://md-demo.tradovateapi.com/v1',
  md_live: 'https://md-live.tradovateapi.com/v1'
};

// Get API environment from env vars
const API_ENVIRONMENT = process.env.TRADOVATE_API_ENVIRONMENT || 'demo';

// Set API URLs based on environment
export const TRADOVATE_API_URL = API_URLS[API_ENVIRONMENT as keyof typeof API_URLS] || API_URLS.demo;
export const TRADOVATE_MD_API_URL = API_ENVIRONMENT.includes('live') ? API_URLS.md_live : API_URLS.md_demo;

// Authentication state
export let accessToken: string | null = null;
export let accessTokenExpiry: number | null = null;
export let refreshToken: string | null = null;

/**
 * Tradovate API authentication credentials
 */
export interface TradovateCredentials {
  name: string;
  password: string;
  appId: string;
  appVersion: string;
  deviceId: string;
  cid: string;
  sec: string;
}

// Load credentials from environment variables
export const credentials: TradovateCredentials = {
  name: process.env.TRADOVATE_USERNAME || '',
  password: process.env.TRADOVATE_PASSWORD || '',
  appId: process.env.TRADOVATE_APP_ID || '',
  appVersion: process.env.TRADOVATE_APP_VERSION || '1.0.0',
  deviceId: process.env.TRADOVATE_DEVICE_ID || '',
  cid: process.env.TRADOVATE_CID || '',
  sec: process.env.TRADOVATE_SECRET || ''
};

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
  
  try {
    const response = await axios.post(`${TRADOVATE_API_URL}/auth/renewAccessToken`, { 
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
      
      console.log('Successfully refreshed access token');
      return response.data.accessToken;
    } else {
      throw new Error('Token refresh response did not contain an access token');
    }
  } catch (error) {
    console.error('Failed to refresh access token:', error);
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
      console.warn('Failed to refresh token, will attempt full authentication');
      // Continue with full authentication
    }
  }
  
  // Perform full authentication
  try {
    // Validate required credentials
    if (!credentials.name || !credentials.password || !credentials.appId || 
        !credentials.deviceId || !credentials.cid || !credentials.sec) {
      throw new Error('Missing required Tradovate API credentials');
    }
    
    const response = await axios.post(`${TRADOVATE_API_URL}/auth/accessTokenRequest`, credentials);
    
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
      
      console.log('Successfully authenticated with Tradovate API');
      return response.data.accessToken;
    } else {
      throw new Error('Authentication response did not contain an access token');
    }
  } catch (error) {
    console.error('Failed to authenticate with Tradovate API:', error);
    throw new Error('Authentication with Tradovate API failed');
  }
}

/**
 * Make an authenticated request to the Tradovate API
 */
export async function tradovateRequest(method: string, endpoint: string, data?: any, isMarketData: boolean = false): Promise<any> {
  const token = await authenticate();
  const baseUrl = isMarketData ? TRADOVATE_MD_API_URL : TRADOVATE_API_URL;
  
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
    
    return response.data;
  } catch (error: any) {
    // Handle specific API errors
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      // Handle authentication errors
      if (status === 401) {
        // Clear tokens to force re-authentication on next request
        accessToken = null;
        accessTokenExpiry = null;
        
        throw new Error('Authentication failed: ' + (errorData.errorText || 'Unauthorized'));
      }
      
      // Handle rate limiting
      if (status === 429) {
        console.warn('Rate limit exceeded, retrying after delay');
        // Wait for 2 seconds and retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        return tradovateRequest(method, endpoint, data, isMarketData);
      }
      
      // Handle other API errors
      throw new Error(`Tradovate API error (${status}): ${errorData.errorText || 'Unknown error'}`);
    }
    
    // Handle network errors
    console.error(`Error making request to ${endpoint}:`, error);
    throw new Error(`Tradovate API request to ${endpoint} failed: ${error.message}`);
  }
} 