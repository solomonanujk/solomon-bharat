import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderStatusBadge } from './OrderStatusBadge';

describe('OrderStatusBadge', () => {
  it('renders a known status with its friendly label', () => {
    render(<OrderStatusBadge status="PAYMENT_RECEIVED" />);
    expect(screen.getByText('Payment Received')).toBeInTheDocument();
  });

  it('applies success styling for DELIVERED', () => {
    render(<OrderStatusBadge status="DELIVERED" />);
    expect(screen.getByText('Delivered')).toHaveClass('text-success');
  });

  it('applies error styling for CANCELLED', () => {
    render(<OrderStatusBadge status="CANCELLED" />);
    expect(screen.getByText('Cancelled')).toHaveClass('text-error');
  });

  it('falls back to the raw status string when unknown', () => {
    render(<OrderStatusBadge status="SOMETHING_NEW" />);
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument();
  });
});
