'use client'

import { cn } from '@/lib/utils'
import { useCategoryTree } from '@/hooks/queries/useCategories'

interface CategoryFilterProps {
  selectedCategoryId: string | null
  onSelect: (categoryId: string | null) => void
}

// ─── Component ────────────────────────────────────────────────────────────────
// Level-1 category filter for agent product browsing — unlike the buyer flow
// (where category is implied by the /categories/[slug] URL), the agent portal
// is a single flat browsing page, so category selection lives here as a filter
// rather than as separate category pages.

export function CategoryFilter({ selectedCategoryId, onSelect }: CategoryFilterProps) {
  const { data: categories, isLoading } = useCategoryTree()

  return (
    <div className="mb-6">
      <p className="text-[12px] font-[500] font-public-sans text-muted-text uppercase tracking-[0.05em] mb-3">
        Category
      </p>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            'text-left text-[14px] font-public-sans px-2 py-1.5 rounded transition-colors',
            selectedCategoryId === null
              ? 'bg-accent/10 text-accent font-[600]'
              : 'text-primary hover:bg-muted-bg'
          )}
        >
          All Categories
        </button>
        {isLoading && (
          <div className="flex flex-col gap-2 mt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 bg-muted-bg rounded animate-pulse" />
            ))}
          </div>
        )}
        {categories?.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
              'text-left text-[14px] font-public-sans px-2 py-1.5 rounded transition-colors flex items-center justify-between gap-2',
              selectedCategoryId === cat.id
                ? 'bg-accent/10 text-accent font-[600]'
                : 'text-primary hover:bg-muted-bg'
            )}
          >
            <span className="truncate">{cat.name}</span>
            <span className="text-[11px] text-muted-text flex-shrink-0">{cat.productCount}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
