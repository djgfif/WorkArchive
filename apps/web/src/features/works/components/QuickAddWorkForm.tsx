import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  createDefaultWorkFormValues,
  parseWorkFormValues,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';
import {
  getWorkTypeLabel,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';

interface QuickAddWorkFormProps {
  isSubmitting: boolean;
  onSubmit: (input: UpsertWorkInput) => Promise<void>;
  submitError: string | null;
}

interface QuickAddCandidate {
  description: string;
  note: string;
  title: string;
}

const ratingOptions = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) * 0.5;

  return {
    label: `${value.toFixed(1)}점`,
    value: value.toString(),
  };
});

function createQuickAddDefaults(): WorkFormValues {
  return {
    ...createDefaultWorkFormValues(),
    type: 'other',
  };
}

function buildCandidate(searchTerm: string): QuickAddCandidate {
  return {
    description: '현재 단계에서는 제목 기반 초안을 먼저 만들고, 메타데이터 연동은 다음 단계에서 확장합니다.',
    note: '외부 메타데이터 연동 전 단계',
    title: searchTerm,
  };
}

export function QuickAddWorkForm({
  isSubmitting,
  onSubmit,
  submitError,
}: QuickAddWorkFormProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<QuickAddCandidate | null>(
    null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [values, setValues] = useState<WorkFormValues>(createQuickAddDefaults);

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, type } = event.target;

    setValues((currentValues) => ({
      ...currentValues,
      [name]:
        type === 'checkbox'
          ? (event.target as HTMLInputElement).checked
          : event.target.value,
    }));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedSearchTerm = searchTerm.trim();

    if (!normalizedSearchTerm) {
      setValidationError('먼저 작품 제목이나 작가를 검색해주세요.');
      return;
    }

    setValidationError(null);
    setSubmittedSearchTerm(normalizedSearchTerm);
    setSelectedCandidate(null);
  }

  function handleSelectCandidate(candidate: QuickAddCandidate) {
    setSelectedCandidate(candidate);
    setValidationError(null);
    setValues((currentValues) => ({
      ...currentValues,
      title: candidate.title,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCandidate) {
      setValidationError('검색 결과에서 먼저 작품을 선택해주세요.');
      return;
    }

    try {
      setValidationError(null);
      await onSubmit(parseWorkFormValues(values));
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : '작품을 저장하지 못했습니다.',
      );
    }
  }

  const candidate = submittedSearchTerm ? buildCandidate(submittedSearchTerm) : null;
  const activeStep = selectedCandidate ? 4 : candidate ? 2 : 1;

  return (
    <div className="stack">
      <div className="quick-add-steps" aria-label="작품 추가 단계">
        {[
          '검색',
          '선택',
          '자동 채움',
          '개인 기록 입력',
          '저장',
        ].map((label, index) => {
          const stepNumber = index + 1;
          const isActive = activeStep === stepNumber;
          const isComplete = activeStep > stepNumber;

          return (
            <div
              className={isActive ? 'quick-add-step active' : isComplete ? 'quick-add-step complete' : 'quick-add-step'}
              key={label}
            >
              <span className="quick-add-step-number">{stepNumber}</span>
              <span>{label}</span>
            </div>
          );
        })}
      </div>

      <section className="panel stack">
        <div className="section-heading">
          <p className="section-kicker">1단계</p>
          <h3 className="section-title">작품 검색</h3>
          <p className="section-description">
            최종 흐름은 검색에서 시작합니다. 지금은 제목 기반 초안을 만들어 같은
            구조로 이어지게 합니다.
          </p>
        </div>

        <form className="quick-add-search-form" onSubmit={handleSearchSubmit}>
          <label className="field home-search-input" htmlFor="quickAddSearch">
            <span>작품 검색</span>
            <input
              id="quickAddSearch"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="제목이나 작가를 입력하세요"
              value={searchTerm}
            />
          </label>
          <button type="submit">검색</button>
        </form>

        <p className="muted-copy">
          외부 메타데이터 연동이 들어오면 이 단계에서 표지, 작가, 설명을 자동으로
          가져오게 됩니다.
        </p>
      </section>

      {candidate && (
        <section className="panel stack">
          <div className="section-heading">
            <p className="section-kicker">2단계</p>
            <h3 className="section-title">검색 결과 선택</h3>
            <p className="section-description">
              검색 결과에서 작품을 고르면 다음 단계에서 자동 채움된 초안을 검토할
              수 있습니다.
            </p>
          </div>

          <div className="quick-add-candidate-grid">
            <button
              className={
                selectedCandidate?.title === candidate.title
                  ? 'quick-add-candidate active'
                  : 'quick-add-candidate'
              }
              onClick={() => handleSelectCandidate(candidate)}
              type="button"
            >
              <ArtworkPoster
                title={candidate.title}
                typeLabel="Draft"
                variant="row"
              />
              <div className="quick-add-candidate-copy">
                <div className="badge-row">
                  <span className="badge">{candidate.note}</span>
                  <span className="badge">제목 초안</span>
                </div>
                <h4 className="section-title">{candidate.title}</h4>
                <p className="muted-copy">{candidate.description}</p>
              </div>
            </button>
          </div>
        </section>
      )}

      {selectedCandidate && (
        <form className="stack" onSubmit={handleSubmit}>
          <section className="panel stack">
            <div className="section-heading">
              <p className="section-kicker">3단계</p>
              <h3 className="section-title">자동 채움 확인</h3>
              <p className="section-description">
                자동 채움된 정보를 빠르게 검토하고 필요한 부분만 다듬어 주세요.
              </p>
            </div>

            <div className="quick-add-review-grid">
              <label className="field field--full" htmlFor="title">
                <span>제목</span>
                <input
                  id="title"
                  name="title"
                  onChange={handleInputChange}
                  placeholder="작품 제목"
                  required
                  value={values.title}
                />
              </label>

              <label className="field" htmlFor="type">
                <span>유형</span>
                <select
                  id="type"
                  name="type"
                  onChange={handleInputChange}
                  value={values.type}
                >
                  {workTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field" htmlFor="author">
                <span>작가·제작자</span>
                <input
                  id="author"
                  name="author"
                  onChange={handleInputChange}
                  placeholder="작가, 스튜디오, 제작자를 입력해주세요"
                  value={values.author}
                />
              </label>
            </div>

            <div className="quick-add-preview-card">
              <ArtworkPoster
                thumbnailUrl={values.thumbnailUrl}
                title={values.title || selectedCandidate.title}
                typeLabel={getWorkTypeLabel(values.type)}
                variant="row"
              />
              <div className="stack">
                <div className="badge-row">
                  <span className="badge">{getWorkTypeLabel(values.type)}</span>
                  <span className="badge">자동 채움 검토</span>
                </div>
                <p className="card-title">{values.title || selectedCandidate.title}</p>
                <p className="muted-copy">
                  {values.author || '작가·제작자 미입력'}
                </p>
              </div>
            </div>
          </section>

          <section className="panel stack">
            <div className="section-heading">
              <p className="section-kicker">4단계</p>
              <h3 className="section-title">개인 기록 입력</h3>
              <p className="section-description">
                최소 입력은 상태, 별점, 한줄평입니다. 긴 리뷰와 추가 정보는 아래에서
                더 적을 수 있습니다.
              </p>
            </div>

            <div className="quick-add-personal-grid">
              <label className="field" htmlFor="status">
                <span>상태</span>
                <select
                  id="status"
                  name="status"
                  onChange={handleInputChange}
                  value={values.status}
                >
                  {workStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field" htmlFor="rating">
                <span>별점</span>
                <select
                  id="rating"
                  name="rating"
                  onChange={handleInputChange}
                  value={values.rating}
                >
                  <option value="">아직 안 매김</option>
                  {ratingOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field field--full" htmlFor="shortReview">
                <span>한줄평</span>
                <textarea
                  id="shortReview"
                  name="shortReview"
                  onChange={handleInputChange}
                  placeholder="나중에 다시 볼 때 떠오를 짧은 한줄평을 남겨보세요"
                  rows={3}
                  value={values.shortReview}
                />
              </label>
            </div>
          </section>

          <details className="panel quick-add-details">
            <summary>추가 정보 편집</summary>
            <div className="stack quick-add-details-body">
              <div className="form-grid">
                <label className="field field--full" htmlFor="thumbnailUrl">
                  <span>표지 이미지 주소</span>
                  <input
                    id="thumbnailUrl"
                    name="thumbnailUrl"
                    onChange={handleInputChange}
                    placeholder="https://example.com/cover.jpg"
                    type="url"
                    value={values.thumbnailUrl}
                  />
                </label>

                <label className="field field--full" htmlFor="genresText">
                  <span>장르</span>
                  <input
                    id="genresText"
                    name="genresText"
                    onChange={handleInputChange}
                    placeholder="SF, 로맨스, 스릴러"
                    value={values.genresText}
                  />
                </label>

                <label className="field field--full" htmlFor="description">
                  <span>설명</span>
                  <textarea
                    id="description"
                    name="description"
                    onChange={handleInputChange}
                    placeholder="작품 소개나 줄거리를 적어둘 수 있습니다"
                    rows={5}
                    value={values.description}
                  />
                </label>

                <label className="field field--full" htmlFor="review">
                  <span>상세 감상</span>
                  <textarea
                    id="review"
                    name="review"
                    onChange={handleInputChange}
                    placeholder="더 길게 남기고 싶은 감상이 있으면 적어보세요"
                    rows={7}
                    value={values.review}
                  />
                </label>

                <label className="checkbox-field" htmlFor="favorite">
                  <input
                    checked={values.favorite}
                    id="favorite"
                    name="favorite"
                    onChange={handleInputChange}
                    type="checkbox"
                  />
                  <span>즐겨찾기로 표시</span>
                </label>
              </div>
            </div>
          </details>

          {(validationError || submitError) && (
            <div aria-live="polite" className="error-banner" role="alert">
              {validationError ?? submitError}
            </div>
          )}

          <div className="button-row form-actions">
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
            <Link className="secondary-link" to="/works">
              작품으로 돌아가기
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
