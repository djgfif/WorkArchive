import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { SectionCard } from '@shared/components/AppPrimitives';
import styles from './SettingsControlCenter.module.css';

const css = styles as Record<string, string>;

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

interface SettingsSectionItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface SettingsLayoutProps {
  sections: SettingsSectionItem[];
}

export function SettingsLayout({ sections }: SettingsLayoutProps) {
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
      'aria-controls': `settings-panel-${section.id}`,
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
      <nav aria-label="설정 사이드 섹션 탐색" className={css.sideNav ?? ''}>
        <SectionCard padding="sm" tone="subtle">
          <div className={css.navList ?? ''} role="tablist">
            {sections.map((section) => (
              <a key={section.id} {...getNavLinkProps(section)}>
                <span>{section.label}</span>
              </a>
            ))}
          </div>
        </SectionCard>
      </nav>

      <nav
        aria-label="설정 모바일 섹션 탐색"
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
            id={`settings-panel-${activeSection.id}`}
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
