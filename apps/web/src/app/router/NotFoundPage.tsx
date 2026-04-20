import { Link } from 'react-router-dom';

import { MinimalPageTemplate } from '../../shared/components/PageTemplates';

export function NotFoundPage() {
  return (
    <MinimalPageTemplate
      actions={
        <>
          <Link className="primary-link" to="/">
            홈으로 이동
          </Link>
          <Link className="secondary-link" to="/works">
            작품 보기
          </Link>
        </>
      }
      description="요청한 주소를 찾을 수 없습니다. 홈이나 작품 화면으로 돌아가 다시 이어갈 수 있습니다."
      eyebrow="찾을 수 없음"
      title="페이지를 찾을 수 없습니다."
    />
  );
}
