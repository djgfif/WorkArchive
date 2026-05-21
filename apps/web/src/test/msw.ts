import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  new URL('/api', window.location.origin).toString()
).replace(/\/$/, '');

export const defaultHandlers = [
  http.post(`${API_BASE_URL}/auth/refresh`, () =>
    HttpResponse.json(
      {
        message: 'Invalid or expired refresh token.',
      },
      {
        status: 401,
      },
    ),
  ),
];

export const server = setupServer(...defaultHandlers);
export { http, HttpResponse, API_BASE_URL };
