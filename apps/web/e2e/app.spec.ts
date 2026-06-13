import { expect, test, type Page } from '@playwright/test';

function gotoApp(page: Page, path: string) {
  return page.goto(path, { waitUntil: 'domcontentloaded' });
}

test('renders the product shell', async ({ page }) => {
  await gotoApp(page, '/');

  await expect(page.getByRole('link', { name: /Work Archive/i })).toBeVisible();
});

test('lets a guest create a local-first work and find it in the library', async ({
  page,
}) => {
  const title = `Playwright Beta Work ${Date.now()}`;

  await gotoApp(page, '/works/new');

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

  await gotoApp(page, '/works?view=list');
  await expect(
    page.getByRole('link', { name: `${title} 상세 보기` }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: '작품 리스트' })).toBeVisible();
});

test('keeps guest backup and provider-key safety visible in settings', async ({
  page,
}) => {
  await gotoApp(page, '/account/settings#data-backup');

  await expect(
    page.getByRole('heading', { name: '설정과 백업' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '저장소 보호와 자동 폴더 백업' }),
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
    page.getByRole('heading', { name: '검색 소스 관리' }),
  ).toBeVisible();
  await expect(page.getByText('개인 키 관리는 로그인 필요')).toBeVisible();
  await expect(
    page.getByText('공개 검색 소스는 계속 사용할 수 있습니다.'),
  ).toBeVisible();
});

test('shows the empty guest home onboarding path', async ({ page }) => {
  await gotoApp(page, '/');

  await expect(
    page.getByRole('heading', { name: '오늘 펼쳐볼 작품' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '첫 작품을 놓는 방법' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /첫 작품 추가/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /백업 가져오기/ })).toBeVisible();
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
  await createDialog.getByRole('button', { exact: true, name: '만들기' }).click();

  await expect(page).toHaveURL(/\/tier-boards\/[^/]+$/);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: '행 추가' })).toBeVisible();
  await expect(page.getByRole('button', { name: '보드 설정' })).toBeVisible();
  await expect(page.getByText('최애')).toBeVisible();
  await expect(page.getByText('아쉬움')).toBeVisible();
});
