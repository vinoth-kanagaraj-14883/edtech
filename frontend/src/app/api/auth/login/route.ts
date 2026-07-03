import { NextRequest, NextResponse } from 'next/server';

import { AUTH_COOKIE_NAME, getUserFromToken } from '@/lib/auth';

const API_URL = (process.env.API_URL || 'http://api-gateway:8080').replace(/\/$/, '');

const parseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  return (payload as { message?: string }).message || (payload as { error?: string }).error || fallback;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.email || !body.password) {
      return NextResponse.json({ message: 'Email and password are required.' }, { status: 400 });
    }

    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    });

    const text = await response.text();
    const payload = text ? parseJson(text) : null;

    if (!response.ok) {
      return NextResponse.json({ message: getMessage(payload, 'Unable to authenticate.') }, { status: response.status });
    }

    const token =
      (payload as { token?: string; accessToken?: string; jwt?: string } | null)?.token ||
      (payload as { token?: string; accessToken?: string; jwt?: string } | null)?.accessToken ||
      (payload as { token?: string; accessToken?: string; jwt?: string } | null)?.jwt ||
      ((payload as { data?: { token?: string; accessToken?: string; jwt?: string } } | null)?.data?.token ??
        (payload as { data?: { token?: string; accessToken?: string; jwt?: string } } | null)?.data?.accessToken ??
        (payload as { data?: { token?: string; accessToken?: string; jwt?: string } } | null)?.data?.jwt);

    if (!token) {
      return NextResponse.json({ message: 'Authentication token missing from upstream response.' }, { status: 502 });
    }

    const user =
      ((payload as { user?: unknown; data?: { user?: unknown } } | null)?.user as undefined) ||
      ((payload as { user?: unknown; data?: { user?: unknown } } | null)?.data?.user as undefined) ||
      getUserFromToken(token);

    const result = NextResponse.json({ success: true, user });
    result.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    return result;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unexpected login error occurred.' }, { status: 500 });
  }
}
