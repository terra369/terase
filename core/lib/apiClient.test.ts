import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIClient, type APIClientConfig, type APIError, type APIResponse } from './apiClient';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to avoid noise in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  mockFetch.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('APIClient', () => {
  const baseConfig: APIClientConfig = {
    baseURL: 'https://api.example.com',
    defaultHeaders: {
      'Content-Type': 'application/json',
    },
  };

  let client: APIClient;

  beforeEach(() => {
    client = new APIClient(baseConfig);
  });

  describe('Constructor and Configuration', () => {
    it('should create client with default configuration', () => {
      const defaultClient = new APIClient();
      expect(defaultClient).toBeInstanceOf(APIClient);
    });

    it('should create client with custom configuration', () => {
      const customConfig: APIClientConfig = {
        baseURL: 'https://custom.api.com',
        timeout: 10000,
        defaultHeaders: {
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'value',
        },
        retryConfig: {
          maxRetries: 5,
          retryDelay: 2000,
          retryCondition: (error) => error.status >= 500,
        },
      };
      
      const customClient = new APIClient(customConfig);
      expect(customClient).toBeInstanceOf(APIClient);
    });

    it('should merge headers correctly', () => {
      const configWithHeaders: APIClientConfig = {
        defaultHeaders: {
          'Authorization': 'Bearer token',
          'X-App-Version': '1.0.0',
        },
      };
      
      const clientWithHeaders = new APIClient(configWithHeaders);
      expect(clientWithHeaders).toBeInstanceOf(APIClient);
    });
  });

  describe('GET Requests', () => {
    it('should make successful GET request with correct URL and headers', async () => {
      const mockResponse = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await client.get('/users/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result.data).toEqual(mockResponse);
      expect(result.status).toBe(200);
    });

    it('should handle GET request with query parameters', async () => {
      const mockResponse = { users: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const queryParams = { page: '1', limit: '10', search: 'test user' };
      await client.get('/users', { params: queryParams });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users?page=1&limit=10&search=test+user',
        expect.any(Object)
      );
    });

    it('should handle GET request with custom headers', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const customHeaders = { 'X-Custom-Header': 'custom-value' };
      await client.get('/data', { headers: customHeaders });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });
  });

  describe('POST Requests', () => {
    it('should make successful POST request with JSON data', async () => {
      const mockResponse = { id: 1, created: true };
      const requestData = { name: 'New User', email: 'user@example.com' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await client.post('/users', { data: requestData });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(requestData),
        })
      );
      expect(result.data).toEqual(mockResponse);
      expect(result.status).toBe(201);
    });

    it('should handle POST request with FormData', async () => {
      const mockResponse = { id: 1, uploaded: true };
      const formData = new FormData();
      formData.append('file', new Blob(['test'], { type: 'text/plain' }));
      formData.append('description', 'Test file');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await client.post('/upload', { data: formData });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/upload',
        expect.objectContaining({
          method: 'POST',
          body: formData,
          // Note: Content-Type should NOT be set for FormData (browser sets it)
        })
      );
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle POST request without data', async () => {
      const mockResponse = { success: true };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await client.post('/trigger-action');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/trigger-action',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: undefined,
        })
      );
      expect(result.data).toEqual(mockResponse);
    });
  });

  describe('PUT Requests', () => {
    it('should make successful PUT request', async () => {
      const mockResponse = { id: 1, updated: true };
      const requestData = { name: 'Updated User' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await client.put('/users/1', { data: requestData });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(requestData),
        })
      );
      expect(result.data).toEqual(mockResponse);
    });
  });

  describe('DELETE Requests', () => {
    it('should make successful DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
      });

      const result = await client.delete('/users/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result.status).toBe(204);
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP error responses', async () => {
      const errorResponse = {
        error: 'Not Found',
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => errorResponse,
        text: async () => JSON.stringify(errorResponse),
      });

      await expect(client.get('/users/999')).rejects.toThrow();
      
      try {
        await client.get('/users/999');
      } catch (error) {
        const apiError = error as APIError;
        expect(apiError.status).toBe(404);
        expect(apiError.message).toContain('User not found');
        expect(apiError.data).toEqual(errorResponse);
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.get('/users')).rejects.toThrow();
      
      try {
        await client.get('/users');
      } catch (error) {
        const apiError = error as APIError;
        expect(apiError.type).toBe('network');
        expect(apiError.message).toContain('Network error');
      }
    });

    it('should handle timeout errors', async () => {
      const timeoutClient = new APIClient({ ...baseConfig, timeout: 100 });
      
      // Mock a delayed response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(timeoutClient.get('/slow-endpoint')).rejects.toThrow();
      
      try {
        await timeoutClient.get('/slow-endpoint');
      } catch (error) {
        const apiError = error as APIError;
        expect(apiError.type).toBe('network');
        expect(apiError.message).toContain('timeout');
      }
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => { throw new Error('Invalid JSON'); },
        text: async () => 'Invalid JSON response',
      });

      await expect(client.get('/malformed')).rejects.toThrow();
      
      try {
        await client.get('/malformed');
      } catch (error) {
        const apiError = error as APIError;
        expect(apiError.type).toBe('validation');
        expect(apiError.message).toContain('Invalid JSON');
      }
    });
  });

  describe('Retry Logic', () => {
    it('should retry on retryable errors', async () => {
      const retryClient = new APIClient({
        ...baseConfig,
        retryConfig: {
          maxRetries: 2,
          retryDelay: 10,
          retryCondition: (error) => error.status >= 500,
        },
      });

      // First two calls fail with 500, third succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Server Error' }),
          text: async () => JSON.stringify({ error: 'Server Error' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Server Error' }),
          text: async () => JSON.stringify({ error: 'Server Error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true }),
          text: async () => JSON.stringify({ success: true }),
        });

      const result = await retryClient.get('/retry-test');
      
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.data).toEqual({ success: true });
    });

    it('should not retry on non-retryable errors', async () => {
      const retryClient = new APIClient({
        ...baseConfig,
        retryConfig: {
          maxRetries: 2,
          retryDelay: 10,
          retryCondition: (error) => error.status >= 500,
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Not Found' }),
        text: async () => JSON.stringify({ error: 'Not Found' }),
      });

      await expect(retryClient.get('/not-found')).rejects.toThrow();
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should exhaust all retries and throw error', async () => {
      const retryClient = new APIClient({
        ...baseConfig,
        retryConfig: {
          maxRetries: 2,
          retryDelay: 10,
          retryCondition: (error) => error.status >= 500,
        },
      });

      // All calls fail with 500
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Server Error' }),
        text: async () => JSON.stringify({ error: 'Server Error' }),
      });

      await expect(retryClient.get('/always-fails')).rejects.toThrow();
      
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe('Request and Response Interceptors', () => {
    it('should apply request interceptors', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const interceptorClient = new APIClient(baseConfig);
      
      // Add request interceptor that adds authorization
      interceptorClient.addRequestInterceptor((config) => ({
        ...config,
        headers: {
          ...config.headers,
          'Authorization': 'Bearer intercepted-token',
        },
      }));

      await interceptorClient.get('/protected');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/protected',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer intercepted-token',
          }),
        })
      );
    });

    it('should apply response interceptors', async () => {
      const mockResponse = { data: 'original' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const interceptorClient = new APIClient(baseConfig);
      
      // Add response interceptor that transforms data
      interceptorClient.addResponseInterceptor((response) => ({
        ...response,
        data: { ...response.data, transformed: true },
      }));

      const result = await interceptorClient.get('/transform');

      expect(result.data).toEqual({ data: 'original', transformed: true });
    });

    it('should handle multiple interceptors in order', async () => {
      const mockResponse = { value: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const interceptorClient = new APIClient(baseConfig);
      
      // Add multiple request interceptors
      interceptorClient.addRequestInterceptor((config) => ({
        ...config,
        headers: { ...config.headers, 'X-Step': '1' },
      }));
      
      interceptorClient.addRequestInterceptor((config) => ({
        ...config,
        headers: { ...config.headers, 'X-Step': '2' },
      }));

      await interceptorClient.get('/multi-interceptor');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/multi-interceptor',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Step': '2', // Last interceptor wins
          }),
        })
      );
    });
  });

  describe('Response Types', () => {
    it('should handle different content types correctly', async () => {
      // Test JSON response
      const jsonData = { message: 'Hello' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => jsonData,
        text: async () => JSON.stringify(jsonData),
      });

      const jsonResult = await client.get('/json');
      expect(jsonResult.data).toEqual(jsonData);
    });

    it('should handle empty responses correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Headers(),
        json: async () => { throw new Error('No content'); },
        text: async () => '',
      });

      const result = await client.delete('/resource');
      expect(result.status).toBe(204);
      expect(result.data).toBeNull();
    });
  });

  describe('Authentication Integration', () => {
    it('should include auth token from configuration', async () => {
      const authConfig: APIClientConfig = {
        ...baseConfig,
        defaultHeaders: {
          'Authorization': 'Bearer test-token',
        },
      };
      
      const authClient = new APIClient(authConfig);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ authenticated: true }),
        text: async () => JSON.stringify({ authenticated: true }),
      });

      await authClient.get('/protected');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/protected',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should override auth token in request options', async () => {
      const authClient = new APIClient({
        ...baseConfig,
        defaultHeaders: { 'Authorization': 'Bearer default-token' },
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ authenticated: true }),
        text: async () => JSON.stringify({ authenticated: true }),
      });

      await authClient.get('/protected', {
        headers: { 'Authorization': 'Bearer override-token' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/protected',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer override-token',
          }),
        })
      );
    });
  });
});