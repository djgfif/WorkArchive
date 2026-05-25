import { expect, test } from '@playwright/test';

test('renders the product shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /Work Archive/i })).toBeVisible();
});

test('lets a guest create a local-first work and find it in the library', async ({
  page,
}) => {
  const title = `Playwright Beta Work ${Date.now()}`;

  await page.goto('/works/new');

  await expect(page.getByRole('heading', { name: '작품 추가' })).toBeVisible();
  await page.getByRole('textbox', { name: '제목' }).fill(title);
  await page
    .getByRole('textbox', { name: '한줄평' })
    .fill('공개 베타 스모크 기록');
  await page.getByRole('button', { name: '내 아카이브에 저장' }).click();

  await expect(page.getByText(`${title}을(를) 등록했습니다`)).toBeVisible();

  await page.getByRole('button', { name: '방금 등록한 작품 보기' }).click();
  await expect(
    page.getByRole('heading', { exact: true, name: title }),
  ).toBeVisible();
  await expect(
    page.getByText('공개 베타 스모크 기록', { exact: true }),
  ).toBeVisible();

  await page.goto('/works?view=list');
  await expect(
    page.getByRole('link', { name: `${title} 상세 보기` }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: '작품 리스트' })).toBeVisible();
});

test('keeps guest backup and provider-key safety visible in settings', async ({
  page,
}) => {
  await page.goto('/account/settings#data-backup');

  await expect(
    page.getByRole('heading', { name: 'Settings Control Center' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '로컬 백업과 복구' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'JSON 백업 내보내기' }),
  ).toBeVisible();
  await expect(page.getByLabel('JSON 백업 파일 선택')).toBeAttached();
  await expect(page.getByText('API key 제외')).toBeVisible();

  await page.getByRole('tab', { name: '검색 소스와 API 키' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Search provider 관리' }),
  ).toBeVisible();
  await expect(page.getByText('개인 키 관리는 로그인 필요')).toBeVisible();
  await expect(
    page.getByText('공개 검색 소스는 계속 사용할 수 있습니다.'),
  ).toBeVisible();
});

test('captures the empty guest home visual baseline', async ({
  page,
}, testInfo) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: '내 아카이브' }),
  ).toBeVisible();
  await expect(page.getByText('첫 기록을 채우는 방법')).toBeVisible();
  await expect(page).toHaveScreenshot(
    `empty-home-${testInfo.project.name}.png`,
    {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    },
  );
});
