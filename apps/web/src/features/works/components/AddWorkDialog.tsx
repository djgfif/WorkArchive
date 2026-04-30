import { Modal } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useState } from 'react';

import type { WorkRecord } from '@work-archive/shared-types';

import { worksService } from '../services/works.service';
import type { UpsertWorkInput } from '../utils/work-form';
import { AddWorkFlow } from './AddWorkFlow';

interface AddWorkDialogProps {
  onClose: () => void;
  onCreated?: (work: WorkRecord) => void;
  opened: boolean;
}

export function AddWorkDialog({
  onClose,
  onCreated,
  opened,
}: AddWorkDialogProps) {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [formVersion, setFormVersion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(input: UpsertWorkInput) {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const work = await worksService.createWork(input);

      onCreated?.(work);
      setFormVersion((currentValue) => currentValue + 1);
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : '작품을 추가하지 못했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      centered={!isMobile}
      fullScreen={Boolean(isMobile)}
      onClose={onClose}
      opened={opened}
      padding="lg"
      radius="lg"
      size="min(72rem, 100vw - 2rem)"
      title="새 작품 기록"
    >
      <AddWorkFlow
        isSubmitting={isSubmitting}
        key={formVersion}
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitError={submitError}
        variant="dialog"
      />
    </Modal>
  );
}
