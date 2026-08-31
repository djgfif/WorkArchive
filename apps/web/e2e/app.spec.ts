import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        error: 'Unauthorized',
        message: 'Guest E2E session',
        statusCode: 401,
      }),
      contentType: 'application/json',
      headers: {
        'cache-control': 'no-store',
      },
      status: 401,
    });
  });
});

async function mockAuthenticatedSession(page: Page) {
  await page.unroute('**/api/auth/refresh');
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        accessToken: 'e2e-access-token',
        user: {
          authAccounts: [
            {
              email: 'archive@example.com',
              emailVerified: true,
              name: '아카이브 사용자',
              pictureUrl: '',
              provider: 'google',
            },
          ],
          avatarUrl: '',
          email: 'archive@example.com',
          handle: 'archive-user',
          id: 'e2e-user',
          nickname: '아카이브 사용자',
          role: 'user',
        },
      }),
      contentType: 'application/json',
      headers: {
        'cache-control': 'no-store',
      },
      status: 200,
    });
  });
}

function gotoApp(page: Page, path: string) {
  return page.goto(path, { waitUntil: 'domcontentloaded' });
}
async function openDirectAddForm(page: Page) {
  await page.getByRole('button', { name: '직접 입력' }).click();
  await expect(page.getByRole('textbox', { name: '제목' })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual({ clientWidth: 320, scrollWidth: 320 });
}

interface BoundingRectangle {
  height: number;
  width: number;
  x: number;
  y: number;
}

const providerStatuses = [
  {
    configured: true,
    credentialMode: 'none',
    label: 'AniList',
    provider: 'anilist',
  },
  {
    configured: true,
    credentialMode: 'none',
    label: 'Wikidata',
    provider: 'wikidata',
  },
  {
    configured: true,
    credentialMode: 'none',
    label: 'Google Books',
    provider: 'google_books',
  },
  {
    configured: true,
    credentialMode: 'none',
    label: 'Open Library',
    provider: 'open_library',
  },
  {
    configured: false,
    credentialMode: 'user',
    label: 'TMDB',
    provider: 'tmdb',
  },
];

async function mockImportProviderStatus(page: Page) {
  await page.route('**/api/imports/providers', async (route) => {
    await route.fulfill({
      body: JSON.stringify(providerStatuses),
      contentType: 'application/json',
      status: 200,
    });
  });
}

function rectanglesOverlap(
  first: BoundingRectangle,
  second: BoundingRectangle,
) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

test('renders the product shell', async ({ page }) => {
  await gotoApp(page, '/');

  await expect(page.getByRole('link', { name: /Work Archive/i })).toBeVisible();
});

test('restores the authenticated archive and performs the startup pull', async ({
  page,
}) => {
  const pullRequests: Array<{
    headers: Record<string, string>;
    payload: Record<string, unknown>;
  }> = [];

  await mockAuthenticatedSession(page);
  await page.route('**/api/sync/pull', async (route) => {
    const request = route.request();

    pullRequests.push({
      headers: request.headers(),
      payload: request.postDataJSON() as Record<string, unknown>,
    });

    await route.fulfill({
      body: JSON.stringify({
        changes: [],
        hasMore: false,
        nextCursor: null,
        nextSince: '2026-07-19T14:00:00.000Z',
        pulledAt: '2026-07-19T14:00:00.000Z',
        schemaVersion: 5,
      }),
      contentType: 'application/json',
      status: 200,
    });
  });

  await gotoApp(page, '/');

  await expect(
    page.getByRole('button', {
      name: /계정 메뉴(?:: 아카이브 사용자, archive@example.com| · 모바일 탐색)/,
    }),
  ).toBeVisible();
  await expect
    .poll(() => pullRequests.length, {
      message: 'authenticated startup should request a sync pull',
    })
    .toBeGreaterThan(0);

  const userDatabaseExists = await page.evaluate(async () => {
    const databases = await indexedDB.databases();

    return databases.some(
      (database) => database.name === 'work-archive-db-user-e2e-user',
    );
  });

  expect(userDatabaseExists).toBe(true);
  expect(pullRequests[0]?.headers.authorization).toBe(
    'Bearer e2e-access-token',
  );
  expect(pullRequests[0]?.payload).toMatchObject({
    cursor: null,
    limit: 500,
    schemaVersion: 5,
    since: null,
  });
  expect(pullRequests[0]?.payload.clientId).toEqual(expect.any(String));
});

test('opens the command palette and runs a library search', async ({
  page,
}) => {
  await gotoApp(page, '/');

  await page.keyboard.press('Control+k');

  const commandInput = page.getByRole('combobox', { name: '명령 검색' });

  await expect(commandInput).toBeVisible();
  await commandInput.fill('은하철도');
  await expect(page.getByText('"은하철도" 검색')).toBeVisible();

  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(
    /\/works\?q=%EC%9D%80%ED%95%98%EC%B2%A0%EB%8F%84$/,
  );
  await expect(commandInput).toBeHidden();
  await expect(
    page.getByRole('heading', { name: /작품 서재|아직 작품이 없습니다/ }),
  ).toBeVisible();
});

test('completes a first record with core fields on desktop and mobile', async ({
  page,
}) => {
  const title = `Playwright Beta Work ${Date.now()}`;

  await gotoApp(page, '/works/new');
  await openDirectAddForm(page);

  await expect(page.getByRole('heading', { name: '작품 추가' })).toBeVisible();
  await expect(page.getByRole('button', { name: '보는 중' })).toBeVisible();
  const rating = page.getByRole('slider', { name: '별점' });
  await expect(rating).toBeVisible();
  await expect(page.getByLabel('유형', { exact: true })).toBeHidden();

  await page.getByRole('textbox', { name: '제목' }).fill(title);
  await page.getByRole('button', { name: '보는 중' }).click();
  await rating.press('End');
  await expect(rating).toHaveAttribute('aria-valuenow', '5');
  await page.getByRole('button', { name: '내 서재에 추가' }).click();

  await expect(
    page.getByRole('heading', { exact: true, name: title }),
  ).toBeVisible();

  await gotoApp(page, '/works?view=list');
  await expect(
    page.getByRole('link', { name: `${title} 상세 보기` }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: '작품 리스트' })).toBeVisible();
});

test('keeps mobile add-work save actions from covering first fields', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chrome',
    'mobile-only layout regression',
  );

  await gotoApp(page, '/works/new');
  await openDirectAddForm(page);

  await expect(page.getByRole('heading', { name: '작품 추가' })).toBeVisible();
  await expect(
    page.getByText('유형 · 감상 · 상세 정보 더하기', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('장르 선택', { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: '보는 중' })).toBeVisible();
  await expect(page.getByRole('slider', { name: '별점' })).toBeVisible();

  await page
    .getByText('유형 · 감상 · 상세 정보 더하기', { exact: true })
    .click();
  await expect(page.getByText('장르 선택', { exact: true })).toBeVisible();

  const layoutMetrics = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const saveButton = buttons.find((button) =>
      button.textContent?.includes('내 서재에 추가'),
    );
    const typeSelect = document.querySelector('select');
    const poster = document.querySelector('[aria-label*="포스터 대체 표지"]');
    const saveFooter = saveButton?.closest('[class*="addWorkSaveFooter"]');
    const toRectangle = (element: Element | null | undefined) => {
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();

      return {
        height: rect.height,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      };
    };

    return {
      footerPosition:
        saveFooter instanceof HTMLElement
          ? getComputedStyle(saveFooter).position
          : null,
      posterBox: toRectangle(poster),
      saveButtonBox: toRectangle(saveButton),
      typeSelectBox: toRectangle(typeSelect),
    };
  });

  expect(layoutMetrics.footerPosition).not.toBe('fixed');
  expect(layoutMetrics.footerPosition).not.toBe('sticky');
  expect(layoutMetrics.saveButtonBox).not.toBeNull();
  expect(layoutMetrics.typeSelectBox).not.toBeNull();
  expect(layoutMetrics.posterBox).not.toBeNull();
  expect(
    rectanglesOverlap(
      layoutMetrics.saveButtonBox!,
      layoutMetrics.typeSelectBox!,
    ),
  ).toBe(false);
  expect(
    layoutMetrics.saveButtonBox!.y + layoutMetrics.saveButtonBox!.height,
  ).toBeLessThanOrEqual(layoutMetrics.posterBox!.y);

  const viewportMetrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(viewportMetrics.scrollWidth).toBe(viewportMetrics.innerWidth);
});

test('keeps 320px core routes free of horizontal overflow', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'single-project 320px layout smoke',
  );

  await page.setViewportSize({ width: 320, height: 844 });

  const staticRoutes = [
    '/',
    '/works',
    '/works/new',
    '/insights',
    '/account',
    '/account/settings',
    '/tier-boards',
  ];

  for (const route of staticRoutes) {
    await gotoApp(page, route);
    await expect(
      page.getByRole('link', { name: /Work Archive/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  const title = `320 Layout Work ${Date.now()}`;

  await gotoApp(page, '/works/new');
  await openDirectAddForm(page);
  await page.getByRole('textbox', { name: '제목' }).fill(title);
  await page.getByRole('button', { name: '내 서재에 추가' }).click();
  await expect(
    page.getByRole('heading', { exact: true, name: title }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('link', { name: '전체 정보 수정' }).click();
  await expect(
    page.getByRole('heading', { name: `${title} 수정` }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await gotoApp(page, '/');
  await expect(
    page.getByRole('heading', { name: '오늘의 기록' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('lets mobile users navigate core routes from the bottom bar and account menu', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chrome',
    'mobile-only navigation regression',
  );

  await page.setViewportSize({ width: 320, height: 844 });
  await gotoApp(page, '/');

  await expect(
    page.getByRole('heading', { name: '오늘의 기록' }),
  ).toBeVisible();

  const mobileNavigation = page.getByRole('navigation', {
    name: '모바일 탐색',
  });

  await expect(mobileNavigation).toBeVisible();
  await expect(
    mobileNavigation.getByRole('link', { name: '홈' }),
  ).toBeVisible();
  await expect(
    mobileNavigation.getByRole('link', { name: /새 작품 추가/ }),
  ).toBeVisible();
  await expect(
    mobileNavigation.getByRole('link', { name: '작품 서재' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '메뉴 열기' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await mobileNavigation.getByRole('link', { name: '작품 서재' }).click();

  await expect(page).toHaveURL(/\/works$/);
  await expect(page.getByRole('heading', { name: '작품 서재' })).toBeVisible();
  await expect(mobileNavigation).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await mobileNavigation.getByRole('link', { name: /새 작품 추가/ }).click();

  await expect(page).toHaveURL(/\/works\/new$/);
  const addWorkHeading = page.getByRole('heading', { name: '작품 추가' });
  await expect(addWorkHeading).toBeVisible();

  const [mobileHeaderBox, addWorkHeadingBox] = await Promise.all([
    page.getByRole('banner').boundingBox(),
    addWorkHeading.boundingBox(),
  ]);

  expect(mobileHeaderBox).not.toBeNull();
  expect(addWorkHeadingBox).not.toBeNull();
  expect(addWorkHeadingBox!.y).toBeGreaterThanOrEqual(
    mobileHeaderBox!.y + mobileHeaderBox!.height,
  );
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: '계정 메뉴 · 모바일 탐색' }).click();
  await page.getByRole('menuitem', { name: '계정 개요' }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole('heading', { name: '개인 기록 센터' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page
    .getByRole('navigation', { name: '계정' })
    .getByRole('link', { name: '설정과 백업' })
    .click();

  await expect(page).toHaveURL(/\/account\/settings$/);
  await expect(
    page.getByRole('heading', { name: '설정과 백업' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('shows quick-add source coverage and keeps direct-add fallback visible', async ({
  page,
}) => {
  await mockImportProviderStatus(page);
  await page.route('**/api/imports/search**', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        candidates: [
          {
            author: 'Madhouse',
            catalogMatch: null,
            confidence: 0.89,
            confidenceLabel: '검토 추천',
            contributors: [{ name: 'Madhouse', role: 'studio' }],
            countLabel: '',
            description: '엘프 마법사 프리렌의 여행을 따라가는 애니메이션.',
            existingRecord: null,
            externalId: 'frieren-anime',
            externalRefs: [
              {
                externalId: '154587',
                provider: 'anilist',
                rawType: 'anime',
                url: 'https://anilist.co/anime/154587',
              },
              {
                externalId: 'Q112010603',
                provider: 'wikidata',
                rawType: 'entity',
                url: 'https://www.wikidata.org/wiki/Q112010603',
              },
            ],
            formatLabel: 'TV 애니메이션',
            franchiseName: null,
            genresText: '판타지, 모험',
            id: 'frieren-anime',
            mediumType: 'anime',
            note: '',
            reason: '별칭 제목 일치 · 출처 2개 확인',
            relationsHint: [],
            releaseCandidates: [
              {
                externalRefs: [
                  {
                    externalId: 'season-1',
                    provider: 'anilist',
                    rawType: 'season',
                    url: 'https://anilist.co/anime/154587',
                  },
                ],
                releaseDate: '2023',
                releaseType: 'tv',
                title: 'Sousou no Frieren',
              },
            ],
            releaseYear: 2023,
            scoreBreakdown: [
              { label: '별칭 제목 일치', weight: 32 },
              { label: '출처 2개 확인', weight: 10 },
            ],
            sourceCoverage: {
              externalIdentityCount: 3,
              providerCount: 2,
              providers: ['anilist', 'wikidata'],
              releaseCandidateCount: 1,
            },
            sourceId: 'anilist',
            sourceLabel: 'AniList',
            sourceUrl: 'https://anilist.co/anime/154587',
            subType: null,
            thumbnailUrl: '',
            title: '葬送のフリーレン',
            titleAliases: ['장송의 프리렌', 'Sousou no Frieren'],
            type: 'anime',
          },
        ],
        diagnostics: {
          providers: [
            {
              provider: 'anilist',
              resultCount: 1,
              status: 'ok',
            },
            {
              provider: 'wikidata',
              resultCount: 1,
              status: 'ok',
            },
          ],
        },
        provider: 'anilist',
        providers: ['anilist', 'wikidata'],
        query: '장송의 프리렌',
      }),
      contentType: 'application/json',
      status: 200,
    });
  });

  await gotoApp(page, '/works/new?mode=search');

  await expect(page.getByRole('heading', { name: '작품 추가' })).toBeVisible();
  await page.getByRole('textbox', { name: '작품 검색' }).fill('장송의 프리렌');
  await page.getByRole('button', { name: '검색', exact: true }).click();

  const candidateButton = page.getByRole('button', {
    name: /葬送のフリーレン.*후보 선택/,
  });

  await expect(candidateButton).toBeVisible();
  await expect(
    candidateButton.getByText(/TV 애니메이션 · 출처 2개/),
  ).toBeVisible();
  await candidateButton.click();
  await expect(page.getByText(/AniList · Wikidata · 출처 2개/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: '직접 추가로 계속' }),
  ).toBeVisible();

  await page.getByRole('button', { name: '이 후보로 입력 채우기' }).click();

  await expect(page.getByText('검색으로 채운 정보')).toBeVisible();
  await expect(
    page.getByText('출처 2개 · 외부 식별자 3개 · 릴리스 후보 1개'),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: '제목' })).toHaveValue(
    '葬送のフリーレン',
  );
});

test('keeps direct add usable when quick-add search fails', async ({
  page,
}) => {
  await mockImportProviderStatus(page);
  await page.route('**/api/imports/search**', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        message: 'Provider search failed.',
        statusCode: 500,
      }),
      contentType: 'application/json',
      status: 500,
    });
  });

  await gotoApp(page, '/works/new?mode=search');

  await expect(page.getByRole('heading', { name: '작품 추가' })).toBeVisible();
  await page.getByRole('textbox', { name: '작품 검색' }).fill('실패한 검색어');
  await page.getByRole('button', { name: '검색', exact: true }).click();

  const searchFailureAlert = page.getByRole('alert');

  await expect(
    searchFailureAlert.getByText(
      '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    ),
  ).toBeVisible();
  await expect(
    searchFailureAlert.getByText(
      '검색 없이도 입력한 제목으로 직접 추가를 계속할 수 있습니다.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '직접 추가로 계속' }),
  ).toBeVisible();

  await page.getByRole('button', { name: '직접 추가로 계속' }).click();

  await expect(page.getByRole('textbox', { name: '제목' })).toHaveValue(
    '실패한 검색어',
  );
  const saveButton = page.getByRole('button', {
    name: '내 서재에 추가',
  });
  await expect(saveButton).toBeVisible();
  await saveButton.click();
  await expect(
    page.getByRole('heading', { exact: true, name: '실패한 검색어' }),
  ).toBeVisible();
});

test('keeps guest backup and provider-key safety visible in settings', async ({
  page,
}, testInfo) => {
  await gotoApp(page, '/account/settings#data-backup');

  const settingsHeading = page.getByRole('heading', { name: '설정과 백업' });

  await expect(settingsHeading).toBeVisible();
  if (testInfo.project.name === 'mobile-chrome') {
    const headingTop = await settingsHeading.evaluate(
      (element) => element.getBoundingClientRect().top,
    );

    // Font rasterization can move this boundary by a few pixels across hosts;
    // keep the assertion focused on the heading remaining in the first screen.
    expect(headingTop).toBeLessThan(440);
  }
  await expect(
    page.getByRole('heading', { name: '로컬 백업과 복구' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '지금 백업하기' }),
  ).toBeVisible();
  await expect(
    page.getByText('자동 백업 · 저장소 보호 · 계정 동기화', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '저장소 보호와 자동 폴더 백업' }),
  ).toBeHidden();

  await page
    .getByText('자동 백업 · 저장소 보호 · 계정 동기화', {
      exact: true,
    })
    .click();

  await expect(
    page.getByRole('heading', { name: '저장소 보호와 자동 폴더 백업' }),
  ).toBeVisible();
  await expect(page.getByLabel('JSON 백업 파일 선택')).toBeAttached();
  await expect(page.getByText('검색 key 제외')).toBeVisible();

  await gotoApp(page, '/account/settings#search-providers');
  await expect(
    page.getByRole('heading', { name: '검색 소스 관리' }),
  ).toBeVisible();
  await expect(page.getByText('개인 키 관리는 로그인 필요')).toBeVisible();
  await expect(
    page.getByText('공개 검색 소스는 계속 사용할 수 있습니다.'),
  ).toBeVisible();
});

test('checks archive health and opens an affected record for editing', async ({
  page,
}) => {
  const title = `Playwright Health Work ${Date.now()}`;

  await gotoApp(page, '/works/new');
  await openDirectAddForm(page);
  await page.getByRole('textbox', { name: '제목' }).fill(title);
  await page.getByRole('button', { name: '내 서재에 추가' }).click();
  await gotoApp(page, '/account/settings#archive-health');

  await expect(
    page.getByRole('heading', { name: '아카이브 건강검진' }),
  ).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText('표지가 비어 있습니다')).toBeVisible();

  await page.getByText(/^보강 제안 \d+$/).click();
  await expect(page.getByText('표지가 비어 있습니다')).toBeVisible();

  await page.getByRole('link', { name: '기록 수정' }).click();

  await expect(page).toHaveURL(
    /\/works\/[^/]+\/edit\?focus=archive-health&issues=missing_thumbnail$/,
  );
  await expect(
    page.getByRole('heading', { name: `${title} 건강검진` }),
  ).toBeVisible();
});

test('shows the empty guest home onboarding path', async ({ page }) => {
  await gotoApp(page, '/');

  await expect(
    page.getByRole('heading', { name: '오늘의 기록' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '아직 기록한 작품이 없습니다' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '직접 추가' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'JSON 백업 가져오기' }),
  ).toBeVisible();
});

test('lets a guest create a local-first tier board and open the editor', async ({
  page,
}) => {
  const title = `Playwright Tier Board ${Date.now()}`;

  await gotoApp(page, '/tier-boards');

  await expect(
    page.getByRole('heading', { name: '자유형 티어보드' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '새 티어보드 만들기' })
    .first()
    .click();
  await expect(
    page.getByRole('dialog', { name: '새 티어보드 만들기' }),
  ).toBeVisible();
  const createDialog = page.getByRole('dialog', {
    name: '새 티어보드 만들기',
  });

  await page.getByLabel('새 티어보드 제목').fill(title);
  await page.getByLabel('새 티어보드 설명').fill('e2e 로컬 티어보드');
  await createDialog
    .getByRole('button', { name: /최애\/좋음\/무난\/아쉬움/ })
    .click();
  await createDialog
    .getByRole('button', { exact: true, name: '만들기' })
    .click();

  await expect(page).toHaveURL(/\/tier-boards\/[^/]+$/);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: '행 추가' })).toBeVisible();
  await expect(page.getByRole('button', { name: '보드 설정' })).toBeVisible();
  await expect(page.getByText('최애')).toBeVisible();
  await expect(page.getByText('아쉬움')).toBeVisible();
});

test('keeps community-core public and hides full-only discovery', async ({
  page,
}) => {
  test.skip(
    process.env.VITE_PRODUCT_RELEASE_PROFILE !== 'community-core',
    'community-core release-profile contract',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/community/feed**', async (route) => {
    await route.fulfill({
      body: JSON.stringify({ items: [], nextCursor: null }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    });
  });
  await page.route('**/api/community/works/trending', async (route) => {
    await route.fulfill({
      body: JSON.stringify([]),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    });
  });

  await gotoApp(page, '/community');

  await expect(
    page.getByRole('heading', { name: '작품에서 시작하는 이야기' }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: '커뮤니티 둘러보기' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /게시판/ }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /취향 찾기/ })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '팔로잉' })).toHaveCount(0);
  await expect(page.getByText('내 기록은 그대로 비공개')).toBeVisible();
  await expect(page.getByRole('link', { name: '내 서재로' })).toHaveCount(0);

  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(viewport.scrollWidth).toBe(viewport.innerWidth);
});

test('keeps the library recovery route when community-core API fails', async ({
  page,
}) => {
  test.skip(
    process.env.VITE_PRODUCT_RELEASE_PROFILE !== 'community-core',
    'community-core release-profile contract',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/community/feed**', async (route) => {
    await route.fulfill({
      body: JSON.stringify({ message: 'Community unavailable' }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 503,
    });
  });
  await page.route('**/api/community/works/trending', async (route) => {
    await route.fulfill({
      body: JSON.stringify({ message: 'Community unavailable' }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 503,
    });
  });

  await gotoApp(page, '/community');

  await expect(
    page.getByRole('heading', { name: '커뮤니티에 연결하지 못했습니다' }),
  ).toBeVisible();
  await page.getByRole('link', { name: '내 서재로' }).click();

  await expect(page).toHaveURL(/\/works$/);
  await expect(page.getByRole('heading', { name: '작품 서재' })).toBeVisible();
});
