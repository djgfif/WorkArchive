import { Fragment, type ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { SectionCard } from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
import styles from './SettingsControlCenter.module.css';
import { cx } from '@shared/utils/class-names';

const css = styles;

interface SettingsSectionItem {
  id: string;
  label: string;
  content: ReactNode;
  group?: string | undefined;
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
      'aria-controls': section.id,
      'aria-selected': isActive,
      className: cx(css.navLink ?? '', isActive && (css.navLinkActive ?? '')),
      'data-section-id': section.id,
      href: `#${section.id}`,
      onClick: () => selectSection(section.id),
      role: 'tab' as const,
    };
  }

  return (
    <div className={css.layout ?? ''}>
      <nav
        aria-label={t('settings.layout.sideNavAria')}
        className={css.sideNav ?? ''}
      >
        <SectionCard padding="sm" tone="subtle">
          <div className={css.navList ?? ''} role="tablist">
            {sections.map((section, index) => {
              const showGroupLabel =
                section.group !== undefined &&
                section.group !== sections[index - 1]?.group;

              return (
                <Fragment key={section.id}>
                  {showGroupLabel && (
                    <p
                      className={css.navGroupLabel ?? ''}
                      role="presentation"
                    >
                      {section.group}
                    </p>
                  )}
                  <a {...getNavLinkProps(section)}>
                    <span>{section.label}</span>
                  </a>
                </Fragment>
              );
            })}
          </div>
        </SectionCard>
      </nav>

      <nav
        aria-label={t('settings.layout.mobileNavAria')}
        className={css.mobileNav ?? ''}
        role="tablist"
      >
        {sections.map((section) => (
          <a key={section.id} {...getNavLinkProps(section)}>
            {section.label}
          </a>
        ))}
      </nav>

      <div className={css.content ?? ''}>
        {activeSection && (
          <section
            aria-label={activeSection.label}
            className={css.sectionPanel ?? ''}
            id={activeSection.id}
            key={activeSection.id}
            role="tabpanel"
          >
            {activeSection.content}
          </section>
        )}
      </div>
    </div>
  );
}
