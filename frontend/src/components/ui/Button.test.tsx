import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children and applies the primary variant by default', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toHaveClass('bg-accent-primary');
  });

  it('applies the ghost variant when requested', () => {
    render(<Button variant="ghost">Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('border-border');
  });

  it('fires onClick handlers', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Submit</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('respects the disabled attribute', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
  });

  it('renders an anchor when used with asChild', () => {
    render(
      <Button asChild>
        <a href="/products">Browse</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: 'Browse' });
    expect(link).toHaveAttribute('href', '/products');
  });
});
