import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryCard } from './CategoryCard';

describe('CategoryCard', () => {
  it('links to the category detail page', () => {
    render(<CategoryCard slug="textiles" name="Textiles" heroImage={null} productCount={12} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/categories/textiles');
  });

  it('renders the category name and product count', () => {
    render(<CategoryCard slug="textiles" name="Textiles" heroImage={null} productCount={12} />);
    expect(screen.getByText('Textiles')).toBeInTheDocument();
    expect(screen.getByText('12 products')).toBeInTheDocument();
  });

  it('renders an image when heroImage is provided', () => {
    render(<CategoryCard slug="textiles" name="Textiles" heroImage="/hero.jpg" productCount={12} />);
    expect(screen.getByAltText('Textiles')).toBeInTheDocument();
  });
});
