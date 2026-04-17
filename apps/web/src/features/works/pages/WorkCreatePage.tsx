import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
      <header className="panel stack">
        <p className="eyebrow">New Work</p>
        <h2 className="page-title">Add a work to your local archive</h2>
        <p className="muted-copy">
          Saving writes directly to IndexedDB, so the record remains available
          after a refresh even without the backend.
        </p>
      </header>

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
