/* global Request, Response, URL */

const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; connect-src 'self' https://graphql.anilist.co https://s4.anilist.co https://archive.org https://*.archive.org https://books.google.com https://covers.openlibrary.org https://*.daumcdn.net https://googleusercontent.com https://*.googleusercontent.com https://image.aladin.co.kr https://image.tmdb.org https://*.kakaocdn.net https://*.pstatic.net https://static.tvmaze.com https://wikimedia.org https://*.wikimedia.org; img-src 'self' data: blob: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

function withSecurityHeaders(response) {
  const nextResponse = new Response(response.body, response);
  for (const [name, value] of Object.entries(securityHeaders)) {
    nextResponse.headers.set(name, value);
  }
  return nextResponse;
}

function apiUnavailable() {
  return withSecurityHeaders(
    Response.json(
      {
        code: 'API_NOT_CONFIGURED',
        message:
          'This private preview does not connect to the Work Archive API.',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    ),
  );
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return apiUnavailable();
    }

    let response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');

    if (response.status === 404 && request.method === 'GET' && acceptsHtml) {
      response = await env.ASSETS.fetch(
        new Request(new URL('/', request.url), request),
      );
    }

    return withSecurityHeaders(response);
  },
};

export default worker;
