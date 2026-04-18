import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PageHero } from '../../../shared/components/PageHero';
import { WorkForm } from '../components/WorkForm';
import { useWorkDetail } from '../hooks/useWorkDetail';
import { worksService } from '../services/works.service';
import {
  createWorkFormValuesFromRecord,
  type UpsertWorkInput,
} from '../utils/work-form';

export function WorkEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { error, isLoading, work } = useWorkDetail(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(input: UpsertWorkInput) {
    if (!id) {
      setSubmitError('Work id is missing.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      await worksService.updateWork(id, input);

      navigate(`/works/${id}`);
    } catch (saveError) {
      setSubmitError(
        saveError instanceof Error ? saveError.message : 'Could not update this work.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (error) {
    return (
      <section className="panel stack">
        <h2 className="section-title">Could not load this work.</h2>
        <p className="muted-copy">{error}</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="panel stack">
        <h2 className="section-title">Loading work...</h2>
        <p className="muted-copy">Preparing the local edit form.</p>
      </section>
    );
  }

  if (!work) {
    return (
      <section className="panel stack">
        <h2 className="section-title">This work is not available for editing.</h2>
        <div className="button-row">
          <Link className="primary-link" to="/works">
            Back to library
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="stack">
      <PageHero
        actions={
          <Link className="secondary-link" to={`/works/${work.id}`}>
            Back to detail
          </Link>
        }
        description="Refine the details, notes, and personal status without losing the original flow."
        eyebrow="Edit Entry"
        meta={
          <>
            <div className="stat-pill">
              <span className="stat-pill-value">{work.title}</span>
              <span className="stat-pill-label">Current title</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">Live</span>
              <span className="stat-pill-label">Updates save to the archive</span>
            </div>
          </>
        }
        title={`Edit ${work.title}`}
      />

      <WorkForm
        cancelTo={`/works/${work.id}`}
        initialValues={createWorkFormValuesFromRecord(work)}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitError={submitError}
        submitLabel="Save changes"
      />
    </section>
  );
}
