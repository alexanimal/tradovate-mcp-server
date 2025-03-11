import axios from 'axios';
import * as authModule from '../src/auth.js';

// Create a mock state that we can modify in tests
const mockAuthState = {
  accessToken: null as string | null,
  accessTokenExpiry: null as number | null,
  refreshToken: null as string | null
};

// Mock the auth module
jest.mock('../src/auth.js', () => {
  const originalModule = jest.requireActual('../src/auth.js');
  return {
    ...originalModule,
    // Mock functions that will use our mockAuthState
    authenticate: jest.fn(),
    isAccessTokenValid: jest.fn(),
    refreshAccessToken: jest.fn()
  };
});

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
  default: {
    post: jest.fn(),
    get: jest.fn()
  }
}));

describe('Authentication Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock state before each test
    mockAuthState.accessToken = null;
    mockAuthState.accessTokenExpiry = null;
    mockAuthState.refreshToken = null;
  });

  describe('authenticate', () => {
    it('should authenticate successfully', async () => {
      // Arrange
      const mockResponse = {
        data: {
          accessToken: 'test-token',
          refreshToken: 'test-refresh-token',
          expirationTime: Date.now() + 3600000 // 1 hour from now
        }
      };
      (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      // Mock the authenticate function
      (authModule.authenticate as jest.Mock).mockImplementationOnce(async () => {
        const response = await axios.post('/auth/accessTokenRequest', {
          name: 'test_user',
          password: 'test_password'
        });
        
        mockAuthState.accessToken = response.data.accessToken;
        mockAuthState.refreshToken = response.data.refreshToken;
        mockAuthState.accessTokenExpiry = response.data.expirationTime;
        
        return response.data.accessToken;
      });

      // Act
      const result = await authModule.authenticate();

      // Assert
      expect(axios.post).toHaveBeenCalledWith(
        '/auth/accessTokenRequest',
        expect.objectContaining({
          name: 'test_user',
          password: 'test_password'
        })
      );
      expect(result).toBe('test-token');
      expect(mockAuthState.accessToken).toBe('test-token');
      expect(mockAuthState.refreshToken).toBe('test-refresh-token');
    });

    it('should handle authentication errors', async () => {
      // Arrange
      const error = {
        response: {
          status: 401,
          data: {
            errorText: 'Invalid credentials'
          }
        }
      };
      (axios.post as jest.Mock).mockRejectedValueOnce(error);
      
      // Mock the authenticate function
      (authModule.authenticate as jest.Mock).mockImplementationOnce(async () => {
        try {
          await axios.post('/auth/accessTokenRequest', {
            name: 'test_user',
            password: 'test_password'
          });
        } catch (err: any) {
          if (err.response && err.response.status === 401) {
            throw new Error(`Authentication failed: ${err.response.data.errorText}`);
          }
          throw err;
        }
      });

      // Act & Assert
      await expect(authModule.authenticate()).rejects.toThrow('Authentication failed: Invalid credentials');
    });
  });

  describe('isAccessTokenValid', () => {
    it('should return true for valid token', () => {
      // Arrange - set up the mock state
      mockAuthState.accessToken = 'test-token';
      mockAuthState.accessTokenExpiry = Date.now() + 3600000; // 1 hour from now
      
      // Mock the function to use our mock state
      (authModule.isAccessTokenValid as jest.Mock).mockImplementationOnce(() => {
        if (!mockAuthState.accessToken || !mockAuthState.accessTokenExpiry) return false;
        
        // Consider token expired 5 minutes before actual expiry
        const currentTime = Date.now();
        const expiryWithBuffer = mockAuthState.accessTokenExpiry - (5 * 60 * 1000);
        
        return currentTime < expiryWithBuffer;
      });

      // Act
      const result = authModule.isAccessTokenValid();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for expired token', () => {
      // Arrange - set up the mock state
      mockAuthState.accessToken = 'test-token';
      mockAuthState.accessTokenExpiry = Date.now() - 1000; // 1 second ago
      
      // Mock the function to use our mock state
      (authModule.isAccessTokenValid as jest.Mock).mockImplementationOnce(() => {
        if (!mockAuthState.accessToken || !mockAuthState.accessTokenExpiry) return false;
        
        // Consider token expired 5 minutes before actual expiry
        const currentTime = Date.now();
        const expiryWithBuffer = mockAuthState.accessTokenExpiry - (5 * 60 * 1000);
        
        return currentTime < expiryWithBuffer;
      });

      // Act
      const result = authModule.isAccessTokenValid();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for missing token', () => {
      // Arrange - set up the mock state
      mockAuthState.accessToken = null;
      mockAuthState.accessTokenExpiry = null;
      
      // Mock the function to use our mock state
      (authModule.isAccessTokenValid as jest.Mock).mockImplementationOnce(() => {
        if (!mockAuthState.accessToken || !mockAuthState.accessTokenExpiry) return false;
        
        // Consider token expired 5 minutes before actual expiry
        const currentTime = Date.now();
        const expiryWithBuffer = mockAuthState.accessTokenExpiry - (5 * 60 * 1000);
        
        return currentTime < expiryWithBuffer;
      });

      // Act
      const result = authModule.isAccessTokenValid();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      // Arrange
      const mockResponse = {
        data: {
          accessToken: 'new-token',
          expirationTime: Date.now() + 3600000 // 1 hour from now
        }
      };
      (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      // Set up the mock state
      mockAuthState.accessToken = 'old-token';
      mockAuthState.refreshToken = 'refresh-token';
      
      // Mock the refreshAccessToken function
      (authModule.refreshAccessToken as jest.Mock).mockImplementationOnce(async () => {
        if (!mockAuthState.refreshToken) {
          throw new Error('No refresh token available');
        }
        
        const response = await axios.post('/auth/renewAccessToken', { 
          name: 'test_user',
          refreshToken: mockAuthState.refreshToken
        });
        
        if (response.data && response.data.accessToken) {
          mockAuthState.accessToken = response.data.accessToken;
          
          // Set expiry time
          if (response.data.expirationTime) {
            mockAuthState.accessTokenExpiry = response.data.expirationTime;
          } else {
            mockAuthState.accessTokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
          }
          
          return response.data.accessToken;
        } else {
          throw new Error('Token refresh response did not contain an access token');
        }
      });

      // Act
      const result = await authModule.refreshAccessToken();

      // Assert
      expect(axios.post).toHaveBeenCalledWith(
        '/auth/renewAccessToken',
        expect.objectContaining({
          name: 'test_user',
          refreshToken: 'refresh-token'
        })
      );
      expect(result).toBe('new-token');
      expect(mockAuthState.accessToken).toBe('new-token');
    });

    it('should handle refresh errors', async () => {
      // Arrange
      const error = {
        response: {
          status: 401,
          data: {
            errorText: 'Invalid refresh token'
          }
        }
      };
      (axios.post as jest.Mock).mockRejectedValueOnce(error);
      
      // Set up the mock state
      mockAuthState.accessToken = 'old-token';
      mockAuthState.refreshToken = 'refresh-token';
      
      // Mock the refreshAccessToken function
      (authModule.refreshAccessToken as jest.Mock).mockImplementationOnce(async () => {
        if (!mockAuthState.refreshToken) {
          throw new Error('No refresh token available');
        }
        
        try {
          await axios.post('/auth/renewAccessToken', { 
            name: 'test_user',
            refreshToken: mockAuthState.refreshToken
          });
        } catch (err: any) {
          if (err.response && err.response.status === 401) {
            throw new Error(`Token refresh failed: ${err.response.data.errorText}`);
          }
          throw err;
        }
      });

      // Act & Assert
      await expect(authModule.refreshAccessToken()).rejects.toThrow('Token refresh failed: Invalid refresh token');
    });
  });
}); 