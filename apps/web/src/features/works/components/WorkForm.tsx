import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
import { AppButton } from '../../../shared/components/AppPrimitives';
import {
  createDefaultWorkFormValues,
  parseWorkFormValues,
  type UpsertWorkInput,
  type WorkFormValues,
} from '../utils/work-form';
import {
  workStatusOptions,
  workTierOptions,
  workTypeOptions,
  getWorkStatusLabel,
  getWorkTierLabel,
  getWorkTypeLabel,
} from '../utils/work-options';

interface WorkFormProps {
  cancelTo: string;
  focusArea?: 'general' | 'review';
  initialValues?: WorkFormValues;
  isSubmitting: boolean;
  onSubmit: (input: UpsertWorkInput) => Promise<void>;
  submitError: string | null;
  submitLabel: string;
}

export function WorkForm({
  cancelTo,
  focusArea = 'general',
  initialValues,
  isSubmitting,
  onSubmit,
  submitError,
  submitLabel,
}: WorkFormProps) {
  const [values, setValues] = useState<WorkFormValues>(
    initialValues ?? createDefaultWorkFormValues(),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const reviewSectionRef = useRef<HTMLElement | null>(null);
  const shortReviewInputRef = useRef<HTMLTextAreaElement | null>(null);
  const reviewInputRef = useRef<HTMLTextAreaElement | null>(null);
  const hasFocusedReviewRef = useRef(false);

  useEffect(() => {
    setValues(initialValues ?? createDefaultWorkFormValues());
  }, [initialValues]);

  useEffect(() => {
    if (focusArea !== 'review') {
      hasFocusedReviewRef.current = false;
    }
  }, [focusArea]);

  const previewTitle = values.title.trim() || '제목 없는 작품';
  const previewGenres = values.genresText
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean)
    .slice(0, 4);
  const shortReviewLength = values.shortReview.trim().length;
  const reviewLength = values.review.trim().length;

  useEffect(() => {
    if (focusArea !== 'review' || hasFocusedReviewRef.current) {
      return;
    }

    reviewSectionRef.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'start',
    });

    const focusTarget =
      shortReviewLength === 0 ? shortReviewInputRef.current : reviewInputRef.current;

    focusTarget?.focus();
    hasFocusedReviewRef.current = true;
  }, [focusArea, reviewLength, shortReviewLength]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setValidationError(null);
      await onSubmit(parseWorkFormValues(values));
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : '작품을 저장하지 못했습니다.',
      );
    }
  }

  return (
    <form className="work-form-layout" onSubmit={handleSubmit}>
      <div className="panel work-form-main stack">
        <section className="form-section stack">
          <div className="section-heading">
            <p className="section-kicker">기본 정보</p>
            <h3 className="section-title">어떤 작품인가요?</h3>
            <p className="section-description">
              기본 정보만 먼저 입력해도 충분합니다. 나머지는 나중에 채워도 됩니다.
            </p>
          </div>

          <div className="form-grid">
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

            <label className="field field--full" htmlFor="title">
              <span>제목</span>
              <input
                id="title"
                name="title"
                onChange={handleInputChange}
                placeholder="작품 제목을 입력해주세요"
                required
                value={values.title}
              />
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

            <div className="field field--full">
              <label htmlFor="thumbnailUrl">표지 이미지 주소</label>
              <input
                aria-describedby="thumbnailUrlHint"
                id="thumbnailUrl"
                name="thumbnailUrl"
                onChange={handleInputChange}
                placeholder="https://example.com/cover.jpg"
                type="url"
                value={values.thumbnailUrl}
              />
              <span className="field-hint" id="thumbnailUrlHint">
                선택 사항입니다. 표지를 넣어두면 라이브러리에서 더 쉽게 찾을 수 있습니다.
              </span>
            </div>

            <div className="field field--full">
              <label htmlFor="genresText">장르</label>
              <input
                aria-describedby="genresTextHint"
                id="genresText"
                name="genresText"
                onChange={handleInputChange}
                placeholder="SF, 로맨스, 스릴러"
                value={values.genresText}
              />
              <span className="field-hint" id="genresTextHint">
                장르는 쉼표로 구분해 입력해주세요.
              </span>
            </div>

            <label className="field field--full" htmlFor="description">
              <span>설명</span>
              <textarea
                id="description"
                name="description"
                onChange={handleInputChange}
                placeholder="작품 소개나 줄거리, 기록해두고 싶은 배경을 적어보세요"
                rows={5}
                value={values.description}
              />
            </label>
          </div>
        </section>

        <section className="form-section stack">
          <div className="section-heading">
            <p className="section-kicker">기록 정보</p>
            <h3 className="section-title">현재 상태를 정리해보세요</h3>
          </div>

          <div className="form-grid">
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
              <input
                id="rating"
                max="5"
                min="0"
                name="rating"
                onChange={handleInputChange}
                placeholder="0~5"
                step="0.5"
                type="number"
                value={values.rating}
              />
            </label>

            <label className="field" htmlFor="tier">
              <span>티어</span>
              <select
                id="tier"
                name="tier"
                onChange={handleInputChange}
                value={values.tier}
              >
                <option value="">미지정</option>
                {workTierOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
        </section>

        <section
          className={
            focusArea === 'review'
              ? 'form-section form-section--focus stack'
              : 'form-section stack'
          }
          id="review-writing-section"
          ref={reviewSectionRef}
        >
          <div className="section-heading">
            <p className="section-kicker">감상 기록</p>
            <h3 className="section-title">
              {focusArea === 'review' ? '이번엔 감상 문장에 집중해보세요' : '감상을 남겨보세요'}
            </h3>
            <p className="section-description">
              {focusArea === 'review'
                ? '한줄평은 목록과 최근 기록에 먼저 보이고, 상세 감상은 펼쳐보기 카드 안에서 천천히 읽게 됩니다.'
                : '짧은 감상과 긴 감상을 나눠두면 나중에 다시 읽을 때 더 편합니다.'}
            </p>
          </div>

          <div className="review-focus-metrics">
            <article className="review-focus-card">
              <span className="works-list-label">한줄평</span>
              <strong>{shortReviewLength > 0 ? `${shortReviewLength}자` : '아직 없음'}</strong>
              <p className="muted-copy">목록과 홈 최근 기록에 우선 노출됩니다.</p>
            </article>
            <article className="review-focus-card">
              <span className="works-list-label">상세 감상</span>
              <strong>{reviewLength > 0 ? `${reviewLength}자` : '아직 없음'}</strong>
              <p className="muted-copy">상세 화면에서는 펼쳐보기 방식으로 보여집니다.</p>
            </article>
          </div>

          <div className="form-grid">
            <label className="field field--full" htmlFor="shortReview">
              <span>한 줄 감상</span>
              <textarea
                id="shortReview"
                name="shortReview"
                onChange={handleInputChange}
                placeholder="나중에 빠르게 훑어볼 수 있는 짧은 감상을 남겨보세요"
                ref={shortReviewInputRef}
                rows={3}
                value={values.shortReview}
              />
            </label>

            <label className="field field--full" htmlFor="review">
              <span>상세 감상</span>
              <textarea
                id="review"
                name="review"
                onChange={handleInputChange}
                placeholder="조금 더 길게 남기고 싶은 생각이나 감상을 적어보세요"
                ref={reviewInputRef}
                rows={8}
                value={values.review}
              />
            </label>
          </div>
        </section>

        {(validationError || submitError) && (
          <div aria-live="polite" className="error-banner" role="alert">
            {validationError ?? submitError}
          </div>
        )}

        <div className="button-row form-actions">
          <AppButton disabled={isSubmitting} tone="primary" type="submit">
            {isSubmitting ? '저장 중...' : submitLabel}
          </AppButton>
          <Link className="secondary-link" to={cancelTo}>
            취소
          </Link>
        </div>
      </div>

      <aside className="panel work-form-aside stack">
        <div className="section-heading">
          <p className="section-kicker">미리보기</p>
          <h3 className="section-title">라이브러리에서는 이렇게 보여요</h3>
          <p className="section-description">
            입력한 내용을 바로 확인할 수 있습니다.
          </p>
        </div>

        <div className="work-preview-card">
          <ArtworkPoster
            thumbnailUrl={values.thumbnailUrl}
            title={previewTitle}
            typeLabel={getWorkTypeLabel(values.type)}
            variant="form"
          />

          <div className="stack">
            <div className="badge-row">
              <span className="badge">{getWorkTypeLabel(values.type)}</span>
              <span className="badge">{getWorkStatusLabel(values.status)}</span>
              <span className="badge">{getWorkTierLabel(values.tier || null)}</span>
              {values.favorite && <span className="badge badge-accent">즐겨찾기</span>}
            </div>

            <div className="stack">
              <p className="card-title">{previewTitle}</p>
              <p className="muted-copy">
                {values.author.trim() || '작가·제작자 미입력'}
              </p>
            </div>

            <p className="card-summary">
              {values.shortReview.trim() ||
                values.description.trim() ||
                '짧은 감상이나 설명을 남겨두면 나중에 다시 찾기 쉽습니다.'}
            </p>

            <div className="tag-list">
              {previewGenres.length > 0 ? (
                previewGenres.map((genre) => (
                  <span className="tag" key={genre}>
                    {genre}
                  </span>
                ))
              ) : (
                <span className="tag tag--muted">장르 없음</span>
              )}
            </div>

            <p className="work-preview-note">
              {focusArea === 'review'
                ? '지금 쓰는 감상은 저장 후 상세 화면의 리뷰 영역으로 바로 이어집니다.'
                : '지금은 핵심만 저장하고, 나중에 천천히 더 채워도 됩니다.'}
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
