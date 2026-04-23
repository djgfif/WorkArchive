import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../../auth/context/AuthContext';
import { renderWithProviders } from '../../../test/render-with-providers';
import { QuickAddWorkForm } from './QuickAddWorkForm';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function renderAuthenticatedQuickAdd() {
  return renderWithProviders(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          archiveScopeKey: 'user:user-1',
          isLoading: false,
          mode: 'authenticated',
          user: {
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          },
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        }}
      >
        <QuickAddWorkForm
          isSubmitting={false}
          onSubmit={vi.fn()}
          submitError={null}
        />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('QuickAddWorkForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses Aladin search candidates to prefill the Quick Add form', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          provider: 'aladin',
          providers: ['aladin'],
          query: '듄',
          candidates: [
            {
              id: 'aladin:123',
              externalId: '123',
              sourceId: 'aladin',
              sourceLabel: 'Aladin Book',
              title: '듄',
              author: '프랭크 허버트',
              catalogMatch: null,
              confidence: 0.86,
              type: 'novel',
              mediumType: 'novel',
              subType: null,
              description: '사막 행성을 둘러싼 이야기',
              existingRecord: null,
              externalRefs: [
                {
                  externalId: '123',
                  provider: 'aladin',
                  rawType: 'novel',
                  url: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123',
                },
              ],
              franchiseName: null,
              thumbnailUrl: 'https://image.aladin.co.kr/cover.jpg',
              genresText: '소설/시/희곡, 영미소설',
              formatLabel: '소설',
              countLabel: '황금가지 · 2026-04-18',
              confidenceLabel: '가장 유력',
              contributors: [
                {
                  name: '프랭크 허버트',
                  role: 'author',
                },
              ],
              note: '도서 DB 제공: 알라딘 인터넷서점(www.aladin.co.kr)',
              reason: '제목/도서 카테고리 일치',
              relationsHint: [],
              releaseYear: 2026,
              sourceUrl: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123',
            },
          ],
        }),
      ),
    );

    const user = userEvent.setup();

    renderAuthenticatedQuickAdd();

    await user.type(screen.getByLabelText(/^작품 검색$/), '듄');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await user.click(await screen.findByRole('button', { name: /듄 소설 후보 선택/ }));

    expect(await screen.findByLabelText(/^제목$/)).toHaveValue('듄');
    expect(screen.getByLabelText(/작가·제작자/)).toHaveValue('프랭크 허버트');
    expect(
      screen.getAllByText('도서 DB 제공: 알라딘 인터넷서점(www.aladin.co.kr)').length,
    ).toBeGreaterThan(0);
  });

  it('falls back to preview candidates when the user has no Aladin key', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            message: 'Aladin API key is not configured for this user.',
          },
          403,
        ),
      ),
    );

    const user = userEvent.setup();

    renderAuthenticatedQuickAdd();

    await user.type(screen.getByLabelText(/^작품 검색$/), 'Dune');
    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(await screen.findByText(/TTBKey를 등록해주세요/)).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /Dune 소설 후보 선택/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('외부 검색 아님').length).toBeGreaterThan(0);
  });
});
