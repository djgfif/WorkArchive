import type { ReactNode } from 'react';

import { SectionCard } from '../../../../shared/components/AppPrimitives';
import styles from './SettingsControlCenter.module.css';

const css = styles as Record<string, string>;

interface SettingsSectionItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface SettingsLayoutProps {
  sections: SettingsSectionItem[];
}

export function SettingsLayout({ sections }: SettingsLayoutProps) {
  return (
    <div className={css.layout ?? ''}>
      <SectionCard className={css.sideNav ?? ''} padding="sm" tone="subtle">
        {sections.map((section) => (
          <a className={css.navLink ?? ''} href={`#${section.id}`} key={section.id}>
            <span>{section.label}</span>
          </a>
        ))}
      </SectionCard>

      <nav aria-label="설정 섹션" className={css.mobileNav ?? ''}>
        {sections.map((section) => (
          <a className={css.navLink ?? ''} href={`#${section.id}`} key={section.id}>
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
