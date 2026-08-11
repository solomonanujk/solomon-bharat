import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';

describe('ApprovalStatusBadge', () => {
  it('renders the friendly label for APPROVED', () => {
    render(<ApprovalStatusBadge status="APPROVED" />);
    expect(screen.getByText('Approved')).toHaveClass('text-success');
  });

  it('renders the friendly label for REJECTED', () => {
    render(<ApprovalStatusBadge status="REJECTED" />);
    expect(screen.getByText('Rejected')).toHaveClass('text-error');
  });

  it('renders the friendly label for PENDING', () => {
    render(<ApprovalStatusBadge status="PENDING" />);
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('falls back to the raw status string when unknown', () => {
    render(<ApprovalStatusBadge status="UNKNOWN_STATUS" />);
    expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
  });
});
