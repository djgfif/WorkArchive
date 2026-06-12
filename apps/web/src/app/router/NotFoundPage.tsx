import { AppLinkButton } from '@shared/components/AppPrimitives';
import { MinimalPageTemplate } from '@shared/components/PageTemplates';
import { usePageTitle } from '@shared/hooks/usePageTitle';

export function NotFoundPage() {
  usePageTitle('페이지를 찾을 수 없습니다');

  return (
    <MinimalPageTemplate
      actions={
        <>
          <AppLinkButton to="/" tone="primary">
            홈으로 이동
          </AppLinkButton>
          <AppLinkButton to="/works">작품 보기</AppLinkButton>
        </>
      }
      description="요청한 주소를 찾을 수 없습니다. 홈이나 작품 화면으로 돌아가 다시 이어갈 수 있습니다."
      eyebrow="찾을 수 없음"
      title="페이지를 찾을 수 없습니다."
    />
  );
}
