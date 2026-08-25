import { Avatar, Box, Group, Menu, Stack, Text } from '@mantine/core';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  StateMessage,
  ThemeToggleControl,
} from '@shared/components/AppPrimitives';
import {
  ArchiveScopeIndicator,
  getUserAvatarProfile,
  useAuthSession,
} from '@features/auth';
import { SyncSafetyBadge } from '@features/sync';
import {
  CommandPalette,
  COMMAND_PALETTE_EVENT,
} from '@shared/components/CommandPalette';
import { SitesPocNotice } from '@shared/components/SitesPocNotice';
import { isSitesGuestPoc } from '@shared/runtime/deployment-profile';
import { useWorkLinkKeyboardNav } from '@shared/components/useWorkLinkKeyboardNav';
import { useAppTranslation } from '@app/i18n';
import { cn } from '@shared/utils/class-names';
import { getPrimaryNavigationItems } from './navigation';
import styles from './MainProductLayout.module.css';

const css = styles;
type NavIconName =
  | 'add'
  | 'community'
  | 'home'
  | 'insights'
  | 'settings'
  | 'tier'
  | 'works';

function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(css.navIcon)}
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="20"
    >
      {name === 'home' && (
        <>
          <path d="m3.5 10 8.5-7 8.5 7" />
          <path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" />
        </>
      )}
      {name === 'works' && (
        <>
          <path d="M4 4.5c2.7-.7 5.3-.2 8 1.5v14c-2.7-1.7-5.3-2.2-8-1.5z" />
          <path d="M20 4.5c-2.7-.7-5.3-.2-8 1.5v14c2.7-1.7 5.3-2.2 8-1.5z" />
        </>
      )}
      {name === 'community' && (
        <>
          <circle cx="8" cy="9" r="3" />
          <circle cx="16.5" cy="8" r="2.5" />
          <path d="M2.5 20c.4-4 2.3-6 5.5-6s5.1 2 5.5 6M13 14c3.2-.5 5.8 1.4 6.5 5" />
        </>
      )}
      {name === 'insights' && (
        <>
          <path d="M5 20v-6M10 20V9M15 20V4M20 20v-9" />
          <path d="M3 20h19" />
        </>
      )}
      {name === 'tier' && (
        <>
          <path d="M8 4h8v3a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 11v5M8.5 20h7M10 16h4v4" />
        </>
      )}
      {name === 'settings' && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
        </>
      )}
      {name === 'add' && <path d="M12 5v14M5 12h14" />}
    </svg>
  );
}

export function MainProductLayout() {
  const { t } = useAppTranslation();
  const sitesGuestPoc = isSitesGuestPoc();
  const navigate = useNavigate();
  const location = useLocation();
  useWorkLinkKeyboardNav();
  const { isLoading, mode, signOut, user } = useAuthSession();
  const authenticated = mode === 'authenticated';
  const profile = getUserAvatarProfile(authenticated ? user : null);
  const accountLabel = authenticated
    ? profile.displayName
    : t('navigation.guest');
  const avatarInitial = authenticated ? profile.initial : 'G';
  const accountMenuLabel = authenticated
    ? `${t('navigation.accountMenu')}: ${accountLabel}, ${profile.email}`
    : `${t('navigation.accountMenu')}: ${accountLabel}`;
  const items = getPrimaryNavigationItems();
  const coreItems = items.slice(0, 3);
  const secondaryItems = items.slice(3);
  const loginReturnTo = `${location.pathname}${location.search}${location.hash}`;

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  function accountMenu(compact: boolean) {
    return (
      <Menu
        position={compact ? 'bottom-end' : 'top-end'}
        shadow="xl"
        width={260}
      >
        <Menu.Target>
          <button
            aria-label={
              compact
                ? `${t('navigation.accountMenu')} · ${t('navigation.mobileNavigation')}`
                : accountMenuLabel
            }
            className={cn(compact ? css.mobileAvatarButton : css.accountButton)}
            type="button"
          >
            <Avatar
              color={authenticated ? 'archive' : 'gray'}
              radius="xl"
              size={compact ? 34 : 36}
              src={authenticated && profile.imageUrl ? profile.imageUrl : null}
            >
              {avatarInitial}
            </Avatar>
            {!compact && (
              <span className={cn(css.accountButtonCopy)}>
                <strong>{accountLabel}</strong>
                <span>
                  {authenticated
                    ? t('navigation.signedIn')
                    : t('navigation.guestMode')}
                </span>
              </span>
            )}
            {!compact && (
              <span aria-hidden="true" className={cn(css.accountChevron)}>
                ···
              </span>
            )}
          </button>
        </Menu.Target>
        <Menu.Dropdown className={cn(css.accountMenuDropdown)}>
          <Box className={cn(css.menuHeader)}>
            <Group gap="sm" wrap="nowrap">
              <Avatar
                color={authenticated ? 'archive' : 'gray'}
                radius="xl"
                size={38}
                src={
                  authenticated && profile.imageUrl ? profile.imageUrl : null
                }
              >
                {avatarInitial}
              </Avatar>
              <Stack gap={1} miw={0}>
                <Text fw={750} size="sm" truncate>
                  {accountLabel}
                </Text>
                {authenticated && (
                  <Text c="dimmed" size="xs" truncate>
                    {profile.email}
                  </Text>
                )}
                <Text c="dimmed" size="xs">
                  {authenticated
                    ? t('navigation.signedIn')
                    : t('navigation.guestMode')}
                </Text>
              </Stack>
            </Group>
          </Box>
          {secondaryItems.map((item, index) => (
            <Menu.Item
              className={cn(css.accountMenuItem)}
              key={item.to}
              leftSection={<NavIcon name={index === 0 ? 'insights' : 'tier'} />}
              onClick={() => navigate(item.to)}
            >
              {item.label}
            </Menu.Item>
          ))}
          {!sitesGuestPoc && (
            <Menu.Item
              className={cn(css.accountMenuItem)}
              onClick={() => navigate('/account')}
            >
              {t('navigation.accountOverview')}
            </Menu.Item>
          )}
          <Menu.Item
            className={cn(css.accountMenuItem)}
            leftSection={<NavIcon name="settings" />}
            onClick={() => navigate('/account/settings')}
          >
            {t('navigation.settingsBackup')}
          </Menu.Item>
          <Menu.Divider />
          <Box px="xs" pb="xs">
            <ThemeToggleControl fullWidth />
          </Box>
          <Menu.Divider />
          {authenticated ? (
            <Menu.Item color="red" onClick={() => void handleSignOut()}>
              {t('navigation.logout')}
            </Menu.Item>
          ) : !sitesGuestPoc ? (
            <Menu.Item
              onClick={() =>
                navigate('/auth/login', { state: { returnTo: loginReturnTo } })
              }
            >
              {t('navigation.login')}
            </Menu.Item>
          ) : null}
        </Menu.Dropdown>
      </Menu>
    );
  }

  return (
    <div className="app-frame">
      <aside className={cn(css.sidebar)}>
        <Link
          aria-label={t('navigation.workArchiveHome')}
          className={cn(css.brand)}
          to="/"
        >
          <span aria-hidden="true" className={cn(css.brandMark)}>
            WA
          </span>
          <span className={cn(css.brandName)}>Work Archive</span>
        </Link>
        <nav
          aria-label={t('navigation.primaryNavigation')}
          className={cn(css.primaryNav)}
        >
          {coreItems.map((item, index) => (
            <NavLink
              className={({ isActive }) =>
                `${cn(css.sidebarNavLink)} ${isActive ? cn(css.sidebarNavLinkActive) : ''}`
              }
              end={item.to === '/'}
              key={item.to}
              to={item.to}
            >
              <NavIcon
                name={
                  index === 0 ? 'home' : index === 1 ? 'works' : 'community'
                }
              />
              <span>
                {index === 1 ? t('navigation.worksLibrary') : item.label}
              </span>
            </NavLink>
          ))}
        </nav>
        <Link
          aria-label={`${t('navigation.addNewWork')} · ${t('navigation.primaryNavigation')}`}
          className={cn(css.sidebarAddWork)}
          to="/works/new"
        >
          <NavIcon name="add" />
          <span>{t('navigation.addWork')}</span>
        </Link>
        <nav
          aria-label={t('navigation.secondaryNavigation')}
          className={cn(css.secondaryNav)}
        >
          {secondaryItems.map((item, index) => (
            <NavLink
              className={({ isActive }) =>
                `${cn(css.sidebarNavLink)} ${cn(css.secondaryNavLink)} ${isActive ? cn(css.sidebarNavLinkActive) : ''}`
              }
              key={item.to}
              to={item.to}
            >
              <NavIcon name={index === 0 ? 'insights' : 'tier'} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={cn(css.sidebarFooter)}>
          {!sitesGuestPoc && <SyncSafetyBadge />}
          <button
            aria-label={t('navigation.commandPalette')}
            className={cn(css.commandButton)}
            onClick={() =>
              window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT))
            }
            type="button"
          >
            <span>{t('navigation.commandPalette')}</span>
            <kbd>⌘K</kbd>
          </button>
          {accountMenu(false)}
        </div>
      </aside>

      <header className={cn(css.mobileHeader)} role="banner">
        <Link
          aria-label={t('navigation.workArchiveHome')}
          className={cn(css.mobileBrand)}
          to="/"
        >
          <span aria-hidden="true" className={cn(css.brandMark)}>
            WA
          </span>
          <span className={cn(css.brandName)}>Work Archive</span>
        </Link>
        {accountMenu(true)}
      </header>

      <main className={`app-content ${css.pageTransition}`}>
        <SitesPocNotice />
        <ArchiveScopeIndicator attentionOnly />
        <div className={cn(css.mobileSafetyNotice)}>
          {!sitesGuestPoc && <SyncSafetyBadge />}
        </div>
        {isLoading ? (
          <Box p="xl">
            <StateMessage
              description={t('navigation.syncPreparingDescription')}
              title={t('navigation.syncPreparingTitle')}
              tone="loading"
            />
          </Box>
        ) : (
          <Outlet />
        )}
      </main>

      <nav
        aria-label={t('navigation.mobileNavigation')}
        className={cn(css.mobileBottomNav)}
      >
        <NavLink
          className={({ isActive }) =>
            `${cn(css.mobileNavLink)} ${isActive ? cn(css.mobileNavLinkActive) : ''}`
          }
          end
          to="/"
        >
          <NavIcon name="home" />
          <span>{t('navigation.home')}</span>
        </NavLink>
        <Link
          aria-label={`${t('navigation.addNewWork')} · ${t('navigation.mobileNavigation')}`}
          className={cn(css.mobileAddLink)}
          to="/works/new"
        >
          <span className={cn(css.mobileAddIcon)}>
            <NavIcon name="add" />
          </span>
          <span>{t('navigation.addWork')}</span>
        </Link>
        <NavLink
          className={({ isActive }) =>
            `${cn(css.mobileNavLink)} ${isActive ? cn(css.mobileNavLinkActive) : ''}`
          }
          to="/works"
        >
          <NavIcon name="works" />
          <span>{t('navigation.worksLibrary')}</span>
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `${cn(css.mobileNavLink)} ${isActive ? cn(css.mobileNavLinkActive) : ''}`
          }
          to="/community"
        >
          <NavIcon name="community" />
          <span>{t('navigation.community')}</span>
        </NavLink>
      </nav>
      <CommandPalette />
    </div>
  );
}
