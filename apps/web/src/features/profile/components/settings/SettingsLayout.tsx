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

interface SettingsNavGroup {
  group?: SettingsGroupId | undefined;
  sections: SettingsSectionItem[];
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
  const sideNavGroups = sections.reduce<SettingsNavGroup[]>(
    (groups, section) => {
      const currentGroup = groups[groups.length - 1];

      if (currentGroup && currentGroup.group === section.group) {
        currentGroup.sections.push(section);
        return groups;
      }

      groups.push({
        group: section.group,
        sections: [section],
      });

      return groups;
    },
    [],
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
        aria-label={t('settings.layout.sideNavAria')}
        className={css.sideNav ?? ''}
      >
        <SectionCard padding="sm" tone="subtle">
          <div className={css.navGroups ?? ''}>
            {sideNavGroups.map((navGroup) => {
              const groupLabel = navGroup.group
                ? t(`settings.groups.${navGroup.group}`)
                : undefined;
              const groupLabelId = groupLabel
                ? `settings-group-${navGroup.group}`
                : undefined;

              return (
                <div
                  aria-labelledby={groupLabelId}
                  className={css.navGroup ?? ''}
                  key={navGroup.group ?? 'overview'}
                  role={groupLabelId ? 'group' : undefined}
                >
                  {groupLabel && (
                    <h2 className={css.navGroupLabel ?? ''} id={groupLabelId}>
                      {groupLabel}
                    </h2>
                  )}
                  <div className={css.navList ?? ''}>
                    {navGroup.sections.map((section) => (
                      <a key={section.id} {...getNavLinkProps(section)}>
                        <span>{section.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </nav>

      <nav
        aria-label={t('settings.layout.mobileNavAria')}
        className={css.mobileNav ?? ''}
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
          >
            {activeSection.content}
          </section>
        )}
      </div>
    </div>
  );
}
