import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

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
    <form className="panel stack" onSubmit={handleSubmit}>
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
            placeholder="Enter a title"
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

        <label className="field field--full" htmlFor="genresText">
          <span>Genres</span>
          <input
            id="genresText"
            name="genresText"
            onChange={handleInputChange}
            placeholder="Comma-separated genres"
            value={values.genresText}
          />
        </label>

        <label className="field field--full" htmlFor="thumbnailUrl">
          <span>Thumbnail URL</span>
          <input
            id="thumbnailUrl"
            name="thumbnailUrl"
            onChange={handleInputChange}
            placeholder="https://example.com/cover.jpg"
            type="url"
            value={values.thumbnailUrl}
          />
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

        <label className="field field--full" htmlFor="description">
          <span>Description</span>
          <textarea
            id="description"
            name="description"
            onChange={handleInputChange}
            placeholder="A short description or setup"
            rows={4}
            value={values.description}
          />
        </label>

        <label className="field field--full" htmlFor="shortReview">
          <span>Short review</span>
          <textarea
            id="shortReview"
            name="shortReview"
            onChange={handleInputChange}
            placeholder="A one-line impression"
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
            placeholder="Long-form notes"
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
          <span>Mark as favorite</span>
        </label>
      </div>

      {(validationError || submitError) && (
        <div aria-live="polite" className="error-banner" role="alert">
          {validationError ?? submitError}
        </div>
      )}

      <div className="button-row">
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
        <Link className="secondary-link" to={cancelTo}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
