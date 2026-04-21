import { liveQuery } from 'dexie';
import type { WorkRecord } from '@work-archive/shared-types';
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import {
  importsService,
  type ImportCandidate,
} from '../../imports/services/imports.service';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import { worksRepository } from '../services/works.repository';
import {
  createDefaultWorkFormValues,
  parseWorkFormValues,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';
import {
  getWorkStatusLabel,
  getWorkTypeLabel,
  workStatusOptions,
  workTypeOptions,
} from '../utils/work-options';

interface QuickAddWorkFormProps {
  isSubmitting: boolean;
  onSubmit: (input: UpsertWorkInput) => Promise<void>;
  submitError: string | null;
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

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/[^0-9a-z가-힣]+/g, '');
}

function findLikelyMatches(
  candidate: ImportCandidate,
  existingWorks: WorkRecord[],
) {
  const candidateTitleKeys = Array.from(
    new Set(
      [candidate.title, candidate.title.replace(/\s*\([^)]*\)\s*$/, '')]
        .map(normalizeTitle)
        .filter(Boolean),
    ),
  );

  return existingWorks.filter((work) =>
    candidateTitleKeys.some((key) => normalizeTitle(work.title) === key),
  );
}

function createValuesFromCandidate(candidate: ImportCandidate): WorkFormValues {
  return {
    ...createQuickAddDefaults(),
    author: candidate.author,
    description: candidate.description,
    genresText: candidate.genresText,
    title: candidate.title,
    type: candidate.type,
  };
}

export function QuickAddWorkForm({
  isSubmitting,
  onSubmit,
  submitError,
}: QuickAddWorkFormProps) {
  const { archiveScopeKey } = useAuthSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('');
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [existingWorks, setExistingWorks] = useState<WorkRecord[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ImportCandidate | null>(
    null,
  );
  const [confirmedDuplicateCandidateId, setConfirmedDuplicateCandidateId] = useState<
    string | null
  >(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [values, setValues] = useState<WorkFormValues>(createQuickAddDefaults);

  useEffect(() => {
    const subscription = liveQuery(() => worksRepository.listAll()).subscribe({
      next: (works) => {
        setExistingWorks(works);
      },
      error: () => {
        setExistingWorks([]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

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
    setConfirmedDuplicateCandidateId(null);
    setCandidates(importsService.searchCandidates(normalizedSearchTerm));
    setValues(createQuickAddDefaults());
  }

  function handleSelectCandidate(candidate: ImportCandidate) {
    setSelectedCandidate(candidate);
    setConfirmedDuplicateCandidateId((currentValue) =>
      currentValue === candidate.id ? currentValue : null,
    );
    setValidationError(null);
    setValues(createValuesFromCandidate(candidate));
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

  const duplicateMatches =
    selectedCandidate === null
      ? []
      : findLikelyMatches(selectedCandidate, existingWorks);
  const shouldConfirmDuplicate =
    selectedCandidate !== null &&
    duplicateMatches.length > 0 &&
    confirmedDuplicateCandidateId !== selectedCandidate.id;
  const activeStep =
    selectedCandidate && !shouldConfirmDuplicate ? 4 : candidates.length > 0 ? 2 : 1;

  return (
    <div className="stack">
      <div className="quick-add-steps" aria-label="작품 추가 단계">
        {['검색', '선택', '자동 채움', '개인 기록 입력', '저장'].map((label, index) => {
          const stepNumber = index + 1;
          const isActive = activeStep === stepNumber;
          const isComplete = activeStep > stepNumber;

          return (
            <div
              className={
                isActive
                  ? 'quick-add-step active'
                  : isComplete
                    ? 'quick-add-step complete'
                    : 'quick-add-step'
              }
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
            검색에서 시작하고 후보를 고르는 흐름을 먼저 고정합니다. 실제 메타데이터
            연동은 다음 단계에서 붙입니다.
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

        <div className="quick-add-search-meta">
          <span className="badge">외부 API 연동 전</span>
          <p className="muted-copy">
            지금은 검색어 기반 목업 후보를 보여주지만, 선택 이후의 구조는 실제
            가져오기 플로우와 동일하게 유지합니다.
          </p>
        </div>
      </section>

      {candidates.length > 0 && (
        <section className="panel stack">
          <div className="quick-add-results-header">
            <div className="section-heading">
              <p className="section-kicker">2단계</p>
              <h3 className="section-title">검색 결과 선택</h3>
              <p className="section-description">
                &quot;{submittedSearchTerm}&quot; 기준 후보 {candidates.length}개를
                준비했습니다. 표지, 타입, 설명, 형식 정보를 비교해서 가장 가까운
                후보를 먼저 고르세요.
              </p>
            </div>
          </div>

          <div className="quick-add-candidate-grid">
            {candidates.map((candidate) => {
              const candidateMatches = findLikelyMatches(candidate, existingWorks);

              return (
                <button
                  aria-label={`${candidate.title} ${getWorkTypeLabel(candidate.type)} 후보 선택`}
                  className={
                    selectedCandidate?.id === candidate.id
                      ? 'quick-add-candidate active'
                      : 'quick-add-candidate'
                  }
                  key={candidate.id}
                  onClick={() => handleSelectCandidate(candidate)}
                  type="button"
                >
                  <ArtworkPoster
                    title={candidate.title}
                    typeLabel={getWorkTypeLabel(candidate.type)}
                    variant="row"
                  />
                  <div className="quick-add-candidate-copy">
                    <div className="quick-add-candidate-meta">
                      <span className="mode-badge">{candidate.confidenceLabel}</span>
                      <span className="badge">{candidate.note}</span>
                      <span className="badge">{getWorkTypeLabel(candidate.type)}</span>
                      {candidateMatches.length > 0 && (
                        <span className="badge badge-warning">
                          비슷한 기록 {candidateMatches.length}개
                        </span>
                      )}
                    </div>

                    <div className="stack">
                      <h4 className="section-title">{candidate.title}</h4>
                      <p className="muted-copy">{candidate.author}</p>
                    </div>

                    <div className="quick-add-candidate-facts">
                      <div className="quick-add-candidate-fact">
                        <span className="works-list-label">형식</span>
                        <strong>{candidate.formatLabel}</strong>
                      </div>
                      <div className="quick-add-candidate-fact">
                        <span className="works-list-label">식별 정보</span>
                        <strong>{candidate.countLabel}</strong>
                      </div>
                      <div className="quick-add-candidate-fact">
                        <span className="works-list-label">초안 출처</span>
                        <strong>{candidate.sourceLabel}</strong>
                      </div>
                    </div>

                    <p className="muted-copy">{candidate.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {selectedCandidate && shouldConfirmDuplicate && (
        <section className="panel stack quick-add-duplicate-panel">
          <div className="section-heading">
            <p className="section-kicker">중복 확인</p>
            <h3 className="section-title">비슷한 기록이 이미 있습니다</h3>
            <p className="section-description">
              같은 제목의 작품을 이미 기록했을 수 있습니다. 먼저 기존 기록을 열어보고,
              다른 작품이 맞다면 계속 추가하세요.
            </p>
          </div>

          <div className="quick-add-duplicate-list">
            {duplicateMatches.map((work) => (
              <article className="quick-add-duplicate-card" key={work.id}>
                <ArtworkPoster
                  thumbnailUrl={work.thumbnailUrl}
                  title={work.title}
                  typeLabel={getWorkTypeLabel(work.type)}
                  variant="row"
                />
                <div className="stack">
                  <div className="badge-row">
                    <span className="badge">
                      {work.deletedAt === null ? '기존 기록' : '휴지통'}
                    </span>
                    <span className="badge">{getWorkTypeLabel(work.type)}</span>
                    <span className="badge">{getWorkStatusLabel(work.status)}</span>
                  </div>
                  <p className="card-title">{work.title}</p>
                  <p className="muted-copy">
                    {work.author || '작가·제작자 미입력'}
                  </p>
                </div>
                <div className="button-row">
                  {work.deletedAt === null ? (
                    <Link className="secondary-link" to={`/works/${work.id}`}>
                      기존 작품 보기
                    </Link>
                  ) : (
                    <Link
                      className="secondary-link"
                      to={`/works?scope=trash&q=${encodeURIComponent(work.title)}`}
                    >
                      휴지통에서 보기
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="button-row">
            <button
              onClick={() => setConfirmedDuplicateCandidateId(selectedCandidate.id)}
              type="button"
            >
              그래도 계속 추가
            </button>
            <button
              onClick={() => {
                setSelectedCandidate(null);
                setValues(createQuickAddDefaults());
              }}
              type="button"
            >
              다른 후보 보기
            </button>
          </div>
        </section>
      )}

      {selectedCandidate && !shouldConfirmDuplicate && (
        <form className="stack" onSubmit={handleSubmit}>
          <section className="panel stack">
            <div className="section-heading">
              <p className="section-kicker">3단계</p>
              <h3 className="section-title">자동 채움 검토</h3>
              <p className="section-description">
                가져온 초안을 전부 손으로 입력하지 않고, 필요한 필드만 검토하는
                흐름을 먼저 만듭니다.
              </p>
            </div>

            <div className="quick-add-selection-summary">
              <ArtworkPoster
                thumbnailUrl={values.thumbnailUrl}
                title={values.title || selectedCandidate.title}
                typeLabel={getWorkTypeLabel(values.type)}
                variant="row"
              />
              <div className="stack">
                <div className="badge-row">
                  <span className="mode-badge">{selectedCandidate.confidenceLabel}</span>
                  <span className="badge">{selectedCandidate.note}</span>
                  <span className="badge">{selectedCandidate.formatLabel}</span>
                  <span className="badge">{selectedCandidate.countLabel}</span>
                  <span className="badge">자동 채움 초안</span>
                </div>
                <p className="card-title">{values.title || selectedCandidate.title}</p>
                <p className="muted-copy">{values.author || '작가·제작자 미입력'}</p>
                <p className="card-summary">
                  {values.description || '설명은 아직 없습니다.'}
                </p>
                <p className="muted-copy">
                  {selectedCandidate.sourceLabel} 기준으로 가져온 초안입니다. 제목, 타입,
                  작가만 먼저 확인하면 피로를 많이 줄일 수 있습니다.
                </p>
              </div>
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
          </section>

          <section className="panel stack">
            <div className="quick-add-personal-header">
              <div className="section-heading">
                <p className="section-kicker">4단계</p>
                <h3 className="section-title">개인 기록 입력</h3>
                <p className="section-description">
                  저장 전에 직접 입력해야 하는 핵심 정보만 여기서 마무리합니다.
                </p>
              </div>
              <span className="mode-badge">필수 입력 3개</span>
            </div>

            <div className="quick-add-required-grid">
              <label className="quick-add-required-card" htmlFor="status">
                <span className="works-list-label">상태</span>
                <strong>어디까지 봤는지</strong>
                <select
                  aria-label="상태"
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

              <label className="quick-add-required-card" htmlFor="rating">
                <span className="works-list-label">별점</span>
                <strong>지금 남길 평가</strong>
                <select
                  aria-label="별점"
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

              <label className="quick-add-required-card quick-add-required-card--wide" htmlFor="shortReview">
                <span className="works-list-label">한줄평</span>
                <strong>짧게 남기는 감상</strong>
                <textarea
                  aria-label="한줄평"
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
