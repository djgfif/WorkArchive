import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { SectionCard } from '../../../../shared/components/AppPrimitives';
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

  function getNavLinkProps(section: SettingsSectionItem) {
    const isActive = section.id === activeSectionId;

    return {
      className: cx(css.navLink ?? '', isActive && (css.navLinkActive ?? '')),
      href: `#${section.id}`,
      onClick: () => setActiveSectionId(section.id),
      ...(isActive ? { 'aria-current': 'location' as const } : {}),
    };
  }

  return (
    <div className={css.layout ?? ''}>
      <nav aria-label="설정 섹션" className={css.sideNav ?? ''}>
        <SectionCard padding="sm" tone="subtle">
          {sections.map((section) => (
            <a key={section.id} {...getNavLinkProps(section)}>
              <span>{section.label}</span>
            </a>
          ))}
        </SectionCard>
      </nav>

      <nav aria-label="설정 섹션 바로가기" className={css.mobileNav ?? ''}>
        {sections.map((section) => (
          <a key={section.id} {...getNavLinkProps(section)}>
            {section.label}
          </a>
        ))}
      </nav>

      <div className={css.content ?? ''}>
        {sections.map((section) => (
          <section
            aria-label={section.label}
            className={css.sectionAnchor ?? ''}
            id={section.id}
            key={section.id}
          >
            {section.content}
          </section>
        ))}
      </div>
    </div>
  );
}
