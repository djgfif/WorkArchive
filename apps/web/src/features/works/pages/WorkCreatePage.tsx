import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PageHero } from '../../../shared/components/PageHero';
import { WorkForm } from '../components/WorkForm';
import { worksService } from '../services/works.service';
import type { UpsertWorkInput } from '../utils/work-form';

export function WorkCreatePage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(input: UpsertWorkInput) {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const work = await worksService.createWork(input);

      navigate(`/works/${work.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Could not create this work.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <PageHero
        actions={
          <Link className="secondary-link" to="/works">
            Back to library
          </Link>
        }
        description="Capture the essentials quickly, then come back for richer notes whenever you want."
        eyebrow="Quick Add"
        meta={
          <>
            <div className="stat-pill">
              <span className="stat-pill-value">Fast</span>
              <span className="stat-pill-label">Minimal friction</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">Local first</span>
              <span className="stat-pill-label">Saved on this device</span>
            </div>
          </>
        }
        title="Add a new work"
      />

      <WorkForm
        cancelTo="/works"
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitError={submitError}
        submitLabel="Save work"
      />
    </section>
  );
}
