import { NextRequest, NextResponse } from 'next/server';

import { AUTH_COOKIE_NAME } from '@/lib/auth';

const API_URL = (process.env.API_URL || 'http://api-gateway:8080').replace(/\/$/, '');

const buildTargetUrl = (request: NextRequest, path: string[]) => {
  const pathname = path.join('/');
  const target = new URL(`${API_URL}/${pathname}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  return target;
};

const proxy = async (request: NextRequest, { params }: { params: { path: string[] } }) => {
  const target = buildTargetUrl(request, params.path);
  const headers = new Headers(request.headers);
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('cookie');

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', 'Bearer ' + token);
  }

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

  const response = await fetch(target, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
    redirect: 'manual'
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
};

export const dynamic = 'force-dynamic';

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS };
