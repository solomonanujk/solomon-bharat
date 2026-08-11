import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollectionCard } from './CollectionCard';

describe('CollectionCard', () => {
  it('links to the collection detail page', () => {
    render(<CollectionCard slug="monsoon" name="Monsoon Edit" heroImage={null} editorialIntro={null} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/collections/monsoon');
  });

  it('renders the editorial intro when provided', () => {
    render(
      <CollectionCard slug="monsoon" name="Monsoon Edit" heroImage={null} editorialIntro="Seasonal favorites" />,
    );
    expect(screen.getByText('Seasonal favorites')).toBeInTheDocument();
  });

  it('omits the intro paragraph when null', () => {
    render(<CollectionCard slug="monsoon" name="Monsoon Edit" heroImage={null} editorialIntro={null} />);
    expect(screen.queryByText('Seasonal favorites')).not.toBeInTheDocument();
  });
});
