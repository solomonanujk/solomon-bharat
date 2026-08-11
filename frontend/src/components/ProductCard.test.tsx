import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  it('links to the product detail page', () => {
    render(<ProductCard slug="brass-lamp" name="Brass Lamp" adminPrice="42.5" moq={10} imageUrl={null} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/brass-lamp');
  });

  it('renders formatted price and MOQ', () => {
    render(<ProductCard slug="brass-lamp" name="Brass Lamp" adminPrice="42.5" moq={10} imageUrl={null} />);
    expect(screen.getByText('$42.50 · MOQ 10')).toBeInTheDocument();
  });
});
