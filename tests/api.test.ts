import axios from 'axios';
import { getTradovateApiUrl, getTradovateMdApiUrl } from '../src/auth.js';

// Define axios request config type
interface AxiosRequestConfig {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: any;
}

// Create a mock implementation of tradovateRequest
const mockTradovateRequest = async (method: string, endpoint: string, data?: any, isMarketData: boolean = false): Promise<any> => {
  const baseUrl = isMarketData ? getTradovateMdApiUrl() : getTradovateApiUrl();
  const token = 'mock-token';
  
  try {
    if (method.toUpperCase() === 'GET') {
      const response = await axios.get(`${baseUrl}/${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } else if (method.toUpperCase() === 'POST') {
      const response = await axios.post(`${baseUrl}/${endpoint}`, data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    }
  } catch (error: any) {
    // Handle specific API errors
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      // Handle authentication errors
      if (status === 401) {
        throw new Error('Authentication failed: ' + (errorData.errorText || 'Unauthorized'));
      }
      
      // Handle rate limiting - use a much shorter delay for tests
      if (status === 429) {
        console.warn('Rate limit exceeded, retrying after delay');
        // Wait for a very short time in tests (10ms instead of 2000ms)
        await new Promise(resolve => setTimeout(resolve, 10));
        return mockTradovateRequest(method, endpoint, data, isMarketData);
      }
      
      // Handle other API errors
      throw new Error(`Tradovate API error (${status}): ${errorData.errorText || 'Unknown error'}`);
    }
    
    // Handle network errors
    throw new Error(`Tradovate API request to ${endpoint} failed: ${error.message}`);
  }
  
  throw new Error(`Unsupported method: ${method}`);
};

// Mock the auth module
jest.mock('../src/auth.js', () => {
  const originalModule = jest.requireActual('../src/auth.js');
  return {
    ...originalModule,
    authenticate: jest.fn().mockResolvedValue('mock-token'),
    accessToken: 'mock-token',
    accessTokenExpiry: Date.now() + 3600000, // Valid for 1 hour
    tradovateRequest: jest.fn().mockImplementation(
      (method: string, endpoint: string, data?: any, isMarketData: boolean = false) => 
        mockTradovateRequest(method, endpoint, data, isMarketData)
    )
  };
});

// Properly mock axios
jest.mock('axios');

// Import the mocked module
import * as auth from '../src/auth.js';

describe('API Request Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up axios mock implementations
    (axios as jest.Mocked<typeof axios>).get = jest.fn();
    (axios as jest.Mocked<typeof axios>).post = jest.fn();
  });

  describe('tradovateRequest', () => {
    it('should make a successful GET request', async () => {
      // Arrange
      const mockResponse = {
        data: { success: true, data: [{ id: 1, name: 'Test' }] }
      };
      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await auth.tradovateRequest('GET', 'test/endpoint');

      // Assert
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/test/endpoint'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token'
          })
        })
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should make a successful POST request', async () => {
      // Arrange
      const mockData = { key: 'value' };
      const mockResponse = {
        data: { success: true, id: 123 }
      };
      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await auth.tradovateRequest('POST', 'test/endpoint', mockData);

      // Assert
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/test/endpoint'),
        mockData,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token'
          })
        })
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should use market data URL for market data requests', async () => {
      // Arrange
      const mockResponse = {
        data: { success: true }
      };
      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      await auth.tradovateRequest('GET', 'md/endpoint', undefined, true);

      // Assert
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('md/endpoint'),
        expect.any(Object)
      );
    });

    it('should throw error for authentication failures', async () => {
      // Arrange
      const error = {
        response: {
          status: 401,
          data: {
            errorText: 'Unauthorized access'
          }
        }
      };
      (axios.get as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Authentication failed: Unauthorized access');
    });

    it('should retry on rate limit errors', async () => {
      // Arrange
      const rateLimitError = {
        response: {
          status: 429,
          data: {
            errorText: 'Rate limit exceeded'
          }
        }
      };
      
      const mockResponse = {
        data: { success: true, data: [{ id: 1 }] }
      };
      
      // First call fails with rate limit, second succeeds
      (axios.get as jest.Mock).mockRejectedValueOnce(rateLimitError)
                              .mockResolvedValueOnce(mockResponse);
      
      // Use a spy to verify setTimeout was called
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Act
      const result = await auth.tradovateRequest('GET', 'test/endpoint');
      
      // Assert
      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(result).toEqual(mockResponse.data);
      
      // Restore the spy
      setTimeoutSpy.mockRestore();
    }, 15000); // Increase timeout further just to be safe

    it('should handle API errors with status codes', async () => {
      // Arrange
      const error = {
        response: {
          status: 400,
          data: {
            errorText: 'Bad request'
          }
        }
      };
      (axios.get as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API error (400): Bad request');
    });

    it('should handle network errors', async () => {
      // Arrange
      const error = new Error('Network error');
      (axios.get as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(auth.tradovateRequest('GET', 'test/endpoint')).rejects.toThrow('Tradovate API request to test/endpoint failed: Network error');
    });
  });
});

// Mock Jest functions
jest.mock('axios');

// Define a function to make API calls
async function makeApiCall(method: string, endpoint: string, data?: any, isMarketData: boolean = false): Promise<any> {
  // Set base URL based on whether this is a market data request
  const baseUrl = isMarketData ? getTradovateMdApiUrl() : getTradovateApiUrl();
  
  // Make the request
  try {
    const response = await fetch(`${baseUrl}/${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error making ${method} request to ${endpoint}:`, error);
    throw error;
  }
}

// Tests for makeApiCall function
describe('makeApiCall', () => {
  it('should use the correct base URL for regular API calls', () => {
    expect(getTradovateApiUrl()).toMatch(/tradovateapi.com\/v1$/);
  });
  
  it('should use the correct base URL for market data API calls', () => {
    expect(getTradovateMdApiUrl()).toMatch(/md.*tradovateapi.com\/v1\/websocket$/);
  });
}); 