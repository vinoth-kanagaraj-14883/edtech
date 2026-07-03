import { jwtDecode } from 'jwt-decode';

import type { User } from '@/types';

export const AUTH_COOKIE_NAME = 'edtech_token';

interface JwtClaims extends Partial<User> {
  sub?: string;
  exp?: number;
  role?: User['role'];
}

const readClientCookie = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
};

export const getToken = (): string | null => readClientCookie(AUTH_COOKIE_NAME);

export const setToken = (token: string, maxAgeSeconds = 60 * 60 * 24 * 7) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
};

export const removeToken = () => {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
};

export const getUserFromToken = (token?: string | null): User | null => {
  if (!token) {
    return null;
  }

  try {
    const decoded = jwtDecode<JwtClaims>(token);

    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      id: decoded.id ?? decoded.sub ?? decoded.email ?? 'current-user',
      name: decoded.name ?? 'EdTech Learner',
      email: decoded.email ?? '',
      role: decoded.role ?? 'student',
      avatarUrl: decoded.avatarUrl ?? null,
      headline: decoded.headline ?? null,
      bio: decoded.bio ?? null,
      createdAt: decoded.createdAt,
      updatedAt: decoded.updatedAt
    };
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => Boolean(getUserFromToken(getToken()));
