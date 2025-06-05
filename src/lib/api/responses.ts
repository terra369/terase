import { NextResponse } from 'next/server';

/**
 * Standardized API response utilities
 */
export const APIResponses = {
  /**
   * 401 Unauthorized response
   */
  unauthorized(message = 'Unauthorized'): NextResponse {
    return NextResponse.json({ error: message }, { status: 401 });
  },

  /**
   * 400 Bad Request response
   */
  badRequest(message: string): NextResponse {
    return NextResponse.json({ error: message }, { status: 400 });
  },

  /**
   * 404 Not Found response
   */
  notFound(message = 'Not found'): NextResponse {
    return NextResponse.json({ error: message }, { status: 404 });
  },

  /**
   * 500 Internal Server Error response
   */
  internalError(message = 'Internal server error'): NextResponse {
    return NextResponse.json({ error: message }, { status: 500 });
  },

  /**
   * 403 Forbidden response
   */
  forbidden(message = 'Forbidden'): NextResponse {
    return NextResponse.json({ error: message }, { status: 403 });
  },

  /**
   * 422 Unprocessable Entity response (validation errors)
   */
  validationError(errors: Record<string, string[]> | string): NextResponse {
    return NextResponse.json({ 
      error: 'Validation failed',
      details: errors
    }, { status: 422 });
  },

  /**
   * 429 Too Many Requests response
   */
  rateLimited(message = 'Too many requests'): NextResponse {
    return NextResponse.json({ error: message }, { status: 429 });
  },

  /**
   * 200 OK response with data
   */
  success<T>(data: T): NextResponse<{ data: T }> {
    return NextResponse.json({ data });
  },

  /**
   * 201 Created response with data
   */
  created<T>(data: T): NextResponse<{ data: T }> {
    return NextResponse.json({ data }, { status: 201 });
  },

  /**
   * 204 No Content response
   */
  noContent(): NextResponse {
    return new NextResponse(null, { status: 204 });
  },

  /**
   * Generic error response with proper logging
   */
  error(error: unknown, fallbackMessage = 'An error occurred'): NextResponse {
    console.error('API Error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: error.message || fallbackMessage 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: fallbackMessage 
    }, { status: 500 });
  }
} as const;