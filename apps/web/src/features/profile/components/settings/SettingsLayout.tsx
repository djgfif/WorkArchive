import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { SectionCard } from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
import styles from './SettingsControlCenter.module.css';
import { cx } from '@shared/utils/class-names';

const css = styles;
type SettingsGroupId = 'account' | 'data' | 'integrations' | 'general';

interface SettingsSectionItem {
  id: string;
  label: string;
  content: ReactNode;
  group?: SettingsGroupId | undefined;
}

interface SettingsLayoutProps {
  sections: SettingsSectionItem[];
}

export function SettingsLayout({ sections }: SettingsLayoutProps) {
  const { t } = useAppTranslation();
  const defaultSectionId = sections[0]?.id ?? '';
  const [activeSectionId, setActiveSectionId] = useState(defaultSectionId);
  const activeSection =
    sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const primarySectionIds = new Set([
    'data-backup',
    'account',
    'external-import',
    'display',
  ]);
  const primarySections = sections.filter((section) =>
    primarySectionIds.has(section.id),
  );
  const advancedSections = sections.filter(
    (section) => !primarySectionIds.has(section.id),
  );

  useEffect(() => {
    function syncActiveSectionFromHash() {
      const hash = window.location.hash.replace('#', '');

      setActiveSectionId(
        sections.some((section) => section.id === hash)
          ? hash
          : defaultSectionId,
      );
    }

    syncActiveSectionFromHash();
    window.addEventListener('hashchange', syncActiveSectionFromHash);

    return () => {
      window.removeEventListener('hashchange', syncActiveSectionFromHash);
    };
  }, [defaultSectionId, sections]);

  function selectSection(sectionId: string) {
    setActiveSectionId(sectionId);
  }

  function getNavLinkProps(section: SettingsSectionItem) {
    const isActive = section.id === activeSectionId;

    return {
      'aria-current': isActive ? ('location' as const) : undefined,
      className: cx(css.navLink ?? '', isActive && (css.navLinkActive ?? '')),
      'data-section-id': section.id,
      href: `#${section.id}`,
      onClick: () => selectSection(section.id),
    };
  }

  return (
    <div className={css.layout ?? ''}>
      <nav
        aria-label={t('settings.layout.primaryNavAria')}
        className={css.sectionNav ?? ''}
      >
        <SectionCard padding="sm" tone="subtle">
          <div className={css.primaryNavList ?? ''}>
            {primarySections.map((section) => (
              <a key={section.id} {...getNavLinkProps(section)}>
                <span>{section.label}</span>
              </a>
            ))}
          </div>
          {advancedSections.length > 0 && (
            <details className={css.advancedNav ?? ''}>
              <summary>{t('settings.layout.advancedTitle')}</summary>
              <div className={css.advancedNavList ?? ''}>
                {advancedSections.map((section) => (
                  <a key={section.id} {...getNavLinkProps(section)}>
                    <span>{section.label}</span>
                  </a>
                ))}
              </div>
            </details>
          )}
        </SectionCard>
      </nav>

      <div className={css.content ?? ''}>
        {activeSection && (
          <section
            aria-label={activeSection.label}
            className={css.sectionPanel ?? ''}
            id={activeSection.id}
            key={activeSection.id}
          >
            {activeSection.content}
          </section>
        )}
      </div>
    </div>
  );
}
