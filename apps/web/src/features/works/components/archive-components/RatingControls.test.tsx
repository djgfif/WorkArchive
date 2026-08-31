import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import { StarRatingInput } from './RatingControls';

function RatingHarness() {
  const [value, setValue] = useState<number | null>(2.5);
  return <StarRatingInput onChange={setValue} value={value} />;
}

describe('StarRatingInput', () => {
  it('clears the pointer preview when the keyboard changes the rating', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RatingHarness />);
    const slider = screen.getByRole('slider', { name: '별점' });

    fireEvent.pointerMove(slider, { clientX: 0 });
    expect(screen.getByText(/0\.5/)).toBeInTheDocument();

    slider.focus();
    await user.keyboard('{End}');

    expect(slider).toHaveAttribute('aria-valuenow', '5');
    expect(screen.getByText(/5\.0/)).toBeInTheDocument();
  });
});
