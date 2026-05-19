import { screen, waitFor, within } from '@testing-library/react';
import { expect } from 'vitest';

type ClickUser = {
  click: (element: Element) => Promise<void>;
};

type TextMatcher = Parameters<typeof screen.getByText>[0];
type RoleNameMatcher =
  | string
  | RegExp
  | ((accessibleName: string, element: Element) => boolean);

function describeMatcher(matcher: unknown) {
  return typeof matcher === 'string' ? matcher : String(matcher);
}

export function getLinkByHref(href: string, name?: RoleNameMatcher) {
  const links = screen.getAllByRole('link', name ? { name } : undefined);
  const match = links.find((link) => link.getAttribute('href') === href);

  if (!match) {
    throw new Error(`Expected link with href "${href}"${name ? ` and name ${describeMatcher(name)}` : ''}`);
  }

  return match;
}

export async function findLinkByHref(href: string, name?: RoleNameMatcher) {
  await waitFor(() => expect(getLinkByHref(href, name)).toBeInTheDocument());

  return getLinkByHref(href, name);
}

export async function expectVisibleTexts(texts: TextMatcher[]) {
  for (const text of texts) {
    expect(await screen.findByText(text)).toBeInTheDocument();
  }
}

export function expectAbsentTexts(texts: TextMatcher[]) {
  for (const text of texts) {
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  }
}

export async function openProfileMenu(
  user: ClickUser,
  name: RoleNameMatcher = /프로필:/,
) {
  const trigger = await screen.findByRole('button', { name });

  await user.click(trigger);

  return trigger;
}

export async function selectWorksView(user: ClickUser, view: 'grid' | 'list') {
  const label = view === 'list' ? '리스트 뷰' : '포스터 뷰';

  await user.click(await screen.findByRole('button', { name: label }));
}

export async function openAdvancedFilters(user: ClickUser) {
  const trigger = getAdvancedFiltersButton();

  await user.click(trigger);

  return trigger;
}

export function getAdvancedFiltersButton() {
  return screen.getByRole('button', { name: '고급 필터' });
}

export function getActiveFilterControls() {
  return within(screen.getByRole('group', { name: '적용된 필터' })).getAllByRole(
    'button',
    { name: /필터 제거/ },
  );
}

export async function removeActiveFilter(user: ClickUser, name: RoleNameMatcher) {
  const activeFilterGroup = screen.getByRole('group', {
    name: '적용된 필터',
  });

  await user.click(within(activeFilterGroup).getByRole('button', { name }));
}
