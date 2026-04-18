import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { ArtworkPoster } from '../../../shared/components/ArtworkPoster';
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
  initialValues?: WorkFormValues;
  isSubmitting: boolean;
  onSubmit: (input: UpsertWorkInput) => Promise<void>;
  submitError: string | null;
  submitLabel: string;
}

export function WorkForm({
  cancelTo,
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

  useEffect(() => {
    setValues(initialValues ?? createDefaultWorkFormValues());
  }, [initialValues]);

  const previewTitle = values.title.trim() || '제목 없는 작품';
  const previewGenres = values.genresText
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean)
    .slice(0, 4);

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
              먼저 기본 정보만 입력해도 됩니다. 나머지는 나중에 천천히 채워보세요.
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
              <span>작가 / 제작자</span>
              <input
                id="author"
                name="author"
                onChange={handleInputChange}
                placeholder="작가, 스튜디오, 제작자를 입력해주세요"
                value={values.author}
              />
            </label>

            <div className="field field--full">
              <label htmlFor="thumbnailUrl">표지 이미지 URL</label>
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
                선택 사항입니다. 표지가 있으면 라이브러리에서 더 보기 쉽습니다.
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

        <section className="form-section stack">
          <div className="section-heading">
            <p className="section-kicker">감상 기록</p>
            <h3 className="section-title">감상을 남겨보세요</h3>
          </div>

          <div className="form-grid">
            <label className="field field--full" htmlFor="shortReview">
              <span>한줄 감상</span>
              <textarea
                id="shortReview"
                name="shortReview"
                onChange={handleInputChange}
                placeholder="나중에 빠르게 훑어볼 수 있는 짧은 감상을 남겨보세요"
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
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? '저장 중...' : submitLabel}
          </button>
          <Link className="secondary-link" to={cancelTo}>
            취소
          </Link>
        </div>
      </div>

      <aside className="panel work-form-aside stack">
        <div className="section-heading">
          <p className="section-kicker">미리보기</p>
          <h3 className="section-title">라이브러리에서 이렇게 보여요</h3>
          <p className="section-description">
            입력 중인 내용을 바로 확인할 수 있습니다.
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
                {values.author.trim() || '작가/제작자 정보 없음'}
              </p>
            </div>

            <p className="card-summary">
              {values.shortReview.trim() ||
                values.description.trim() ||
                '짧은 감상이나 설명을 남기면 나중에 다시 보기 좋습니다.'}
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
              지금은 핵심만 저장하고, 나중에 필요할 때 더 채워보세요.
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
