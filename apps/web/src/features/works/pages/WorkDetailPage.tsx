import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';

import { WorkDetailPanel } from '../components/WorkDetailPanel';
import { useWorkDetail } from '../hooks/useWorkDetail';
import { worksService } from '../services/works.service';

export function WorkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { error, isLoading, work } = useWorkDetail(id);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete() {
    if (!work) {
      return;
    }

    const shouldDelete = window.confirm(
      `"${work.title}"을 삭제할까요?\n현재는 목록에서 숨겨집니다.`,
    );

    if (!shouldDelete) {
      return;
    }

    try {
      setActionError(null);
      await worksService.deleteWork(work.id);
      navigate('/works');
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : '작품을 삭제하지 못했습니다.',
      );
    }
  }

  if (error) {
    return (
      <section className="panel stack">
        <h2 className="section-title">작품 정보를 불러오지 못했습니다.</h2>
        <p className="muted-copy">{error}</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="panel stack">
        <h2 className="section-title">작품 정보를 불러오는 중입니다.</h2>
        <p className="muted-copy">잠시만 기다려주세요.</p>
      </section>
    );
  }

  if (!work) {
    return (
      <section className="panel stack">
        <p className="eyebrow">찾을 수 없음</p>
        <h2 className="section-title">해당 작품을 찾을 수 없습니다.</h2>
        <p className="muted-copy">
          삭제되었거나 주소가 올바르지 않을 수 있습니다.
        </p>
        <div className="button-row">
          <Link className="primary-link" to="/works">
            작품으로 돌아가기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      {actionError && (
        <div aria-live="polite" className="error-banner" role="alert">
          {actionError}
        </div>
      )}

      <WorkDetailPanel
        actions={
          <>
            <Link className="secondary-link" to="/works">
              작품으로 돌아가기
            </Link>
            <Link className="secondary-link" to={`/works/${work.id}/edit`}>
              수정
            </Link>
            <button
              className="danger-button"
              onClick={() => void handleDelete()}
              type="button"
            >
              삭제
            </button>
          </>
        }
        work={work}
      />
    </div>
  );
}
