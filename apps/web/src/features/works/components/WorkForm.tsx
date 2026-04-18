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

  const previewTitle = values.title.trim() || 'Untitled work';
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
        error instanceof Error ? error.message : 'Could not save this work.',
      );
    }
  }

  return (
    <form className="work-form-layout" onSubmit={handleSubmit}>
      <div className="panel work-form-main stack">
        <section className="form-section stack">
          <div className="section-heading">
            <p className="section-kicker">Core details</p>
            <h3 className="section-title">What is this entry?</h3>
            <p className="section-description">
              Capture the essentials first. Everything else can be refined later.
            </p>
          </div>

          <div className="form-grid">
            <label className="field" htmlFor="type">
              <span>Type</span>
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
              <span>Title</span>
              <input
                id="title"
                name="title"
                onChange={handleInputChange}
                placeholder="Enter the work title"
                required
                value={values.title}
              />
            </label>

            <label className="field" htmlFor="author">
              <span>Author / Creator</span>
              <input
                id="author"
                name="author"
                onChange={handleInputChange}
                placeholder="Author, studio, or creator"
                value={values.author}
              />
            </label>

            <div className="field field--full">
              <label htmlFor="thumbnailUrl">Cover image URL</label>
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
                Optional, but a cover makes the library much easier to scan.
              </span>
            </div>

            <div className="field field--full">
              <label htmlFor="genresText">Genres</label>
              <input
                aria-describedby="genresTextHint"
                id="genresText"
                name="genresText"
                onChange={handleInputChange}
                placeholder="Science Fiction, Romance, Thriller"
                value={values.genresText}
              />
              <span className="field-hint" id="genresTextHint">
                Separate each genre with a comma.
              </span>
            </div>

            <label className="field field--full" htmlFor="description">
              <span>Description</span>
              <textarea
                id="description"
                name="description"
                onChange={handleInputChange}
                placeholder="Add a short setup, premise, or why you picked it up."
                rows={5}
                value={values.description}
              />
            </label>
          </div>
        </section>

        <section className="form-section stack">
          <div className="section-heading">
            <p className="section-kicker">Tracking</p>
            <h3 className="section-title">How does it sit in your archive?</h3>
          </div>

          <div className="form-grid">
            <label className="field" htmlFor="status">
              <span>Status</span>
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
              <span>Rating</span>
              <input
                id="rating"
                max="5"
                min="0"
                name="rating"
                onChange={handleInputChange}
                placeholder="0 to 5"
                step="0.5"
                type="number"
                value={values.rating}
              />
            </label>

            <label className="field" htmlFor="tier">
              <span>Tier</span>
              <select
                id="tier"
                name="tier"
                onChange={handleInputChange}
                value={values.tier}
              >
                <option value="">Unranked</option>
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
              <span>Mark as favorite</span>
            </label>
          </div>
        </section>

        <section className="form-section stack">
          <div className="section-heading">
            <p className="section-kicker">Notes</p>
            <h3 className="section-title">Your impression</h3>
          </div>

          <div className="form-grid">
            <label className="field field--full" htmlFor="shortReview">
              <span>Short review</span>
              <textarea
                id="shortReview"
                name="shortReview"
                onChange={handleInputChange}
                placeholder="A one-line impression you can scan quickly later"
                rows={3}
                value={values.shortReview}
              />
            </label>

            <label className="field field--full" htmlFor="review">
              <span>Detailed review</span>
              <textarea
                id="review"
                name="review"
                onChange={handleInputChange}
                placeholder="Longer notes, thoughts, or a full review"
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
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
          <Link className="secondary-link" to={cancelTo}>
            Cancel
          </Link>
        </div>
      </div>

      <aside className="panel work-form-aside stack">
        <div className="section-heading">
          <p className="section-kicker">Preview</p>
          <h3 className="section-title">How it will feel in your archive</h3>
          <p className="section-description">
            A quick glance at the entry while you edit.
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
              {values.favorite && <span className="badge badge-accent">Favorite</span>}
            </div>

            <div className="stack">
              <p className="card-title">{previewTitle}</p>
              <p className="muted-copy">
                {values.author.trim() || 'Creator not added yet'}
              </p>
            </div>

            <p className="card-summary">
              {values.shortReview.trim() ||
                values.description.trim() ||
                'Add a quick note or description to make this entry easier to scan.'}
            </p>

            <div className="tag-list">
              {previewGenres.length > 0 ? (
                previewGenres.map((genre) => (
                  <span className="tag" key={genre}>
                    {genre}
                  </span>
                ))
              ) : (
                <span className="tag tag--muted">No genres yet</span>
              )}
            </div>

            <p className="work-preview-note">
              Save with the essentials now and expand the record whenever you are
              ready.
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
