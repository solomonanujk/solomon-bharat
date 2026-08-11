'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto">
    <table ref={ref} className={cn('w-full text-base font-sans border-collapse', className)} {...props} />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn('border-b border-border', className)} {...props} />
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn(className)} {...props} />
);
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn('border-b border-border hover:bg-fill-subtle transition-colors', className)} {...props} />
  )
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'px-4 py-3 text-left',
        'text-xs leading-tight font-medium font-sans text-text-muted uppercase tracking-[0.05em]',
        className
      )}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn('px-4 py-3 text-base font-sans text-text-primary', className)} {...props} />
  )
);
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-3 text-xs leading-tight font-normal font-sans text-text-muted', className)} {...props} />
  )
);
TableCaption.displayName = 'TableCaption';

interface TablePaginationProps {
  /** Total number of rows across all pages */
  total: number;
  /** Current 1-based page number */
  page: number;
  /** Rows per page (default: 20) */
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function TablePagination({ total, page, pageSize = 20, onPageChange, className }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className={cn('flex items-center justify-between px-4 py-3 border-t border-border', className)}>
      <span className="text-xs leading-tight font-medium font-sans text-text-muted">
        Showing {start}&ndash;{end} of {total}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className={cn(
            'inline-flex items-center justify-center h-8 w-8 rounded',
            'border border-border',
            'text-xs font-medium font-sans text-text-primary',
            'hover:bg-fill-subtle transition-colors',
            'disabled:opacity-40 disabled:pointer-events-none'
          )}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>

        <span className="text-xs font-medium font-sans text-text-muted px-2 select-none tabular-nums">
          {page} / {totalPages}
        </span>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className={cn(
            'inline-flex items-center justify-center h-8 w-8 rounded',
            'border border-border',
            'text-xs font-medium font-sans text-text-primary',
            'hover:bg-fill-subtle transition-colors',
            'disabled:opacity-40 disabled:pointer-events-none'
          )}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption, TablePagination };
