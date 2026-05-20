import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const API_BASE_URL = 'http://localhost:3000/api';

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
