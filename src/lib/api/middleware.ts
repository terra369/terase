import { NextRequest, NextResponse } from 'next/server';
import { User } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';

export type AuthenticatedHandler<T = unknown> = (
  req: NextRequest,
  user: User
) => Promise<NextResponse<T>>;

/**
 * Middleware to handle authentication for API routes
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>
) {
  return async (req: NextRequest): Promise<NextResponse<T>> => {
    try {
      const supabase = await supabaseServer();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' }, 
          { status: 401 }
        ) as NextResponse<T>;
      }
      
      return handler(req, user);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      ) as NextResponse<T>;
    }
  };
}

/**
 * Middleware for handling CORS in API routes
 */
export function withCORS<T = unknown>(
  handler: (req: NextRequest) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest): Promise<NextResponse<T>> => {
    // Handle preflight request
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      }) as NextResponse<T>;
    }

    const response = await handler(req);
    
    // Add CORS headers to response
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  };
}

/**
 * Combine authentication and CORS middleware
 */
export function withAuthAndCORS<T = unknown>(
  handler: AuthenticatedHandler<T>
) {
  return withCORS(withAuth(handler));
}