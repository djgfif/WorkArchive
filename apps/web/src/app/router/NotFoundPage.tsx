import { AppLinkButton } from '@shared/components/AppPrimitives';
import { MinimalPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { useAppTranslation } from '@app/i18n';

export function NotFoundPage() {
  const { t } = useAppTranslation();

  usePageTitle(t('notFound.title'));

  return (
    <MinimalPageTemplate
      actions={
        <>
          <AppLinkButton to="/" tone="primary">
            {t('notFound.home')}
          </AppLinkButton>
          <AppLinkButton to="/works">{t('notFound.works')}</AppLinkButton>
        </>
      }
      description={t('notFound.description')}
      eyebrow={t('notFound.eyebrow')}
      title={t('notFound.title')}
    />
  );
}
