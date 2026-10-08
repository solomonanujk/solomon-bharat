'use client'

import { FilterOptionButton } from '@/components/catalogue/filterControls'
import type { CategoryNode } from '@/types'

interface CategorySidebarTreeProps {
  /** The current category page's own category. Its direct children (and, for
   *  whichever one is on the selected path, their own children) are listed
   *  indented beneath it. */
  root: Pick<CategoryNode, 'id' | 'name' | 'children'>
  value: string | null
  onChange: (categoryId: string) => void
}

/** Category facet scoped to one category page. The page's own category is the
 *  first row and is selected by default — never "All categories". */
export function CategorySidebarTree({ root, value, onChange }: CategorySidebarTreeProps) {
  const selected = value ?? root.id
  return (
    <div className="flex flex-col gap-1">
      <FilterOptionButton label={`All ${root.name}`} active={selected === root.id} onClick={() => onChange(root.id)} />
      {(root.children ?? []).map((child) => {
        const grandchildren = child.children ?? []
        const childActive = selected === child.id
        const expanded = childActive || grandchildren.some((g) => g.id === selected)
        return (
          <div key={child.id} className="flex flex-col gap-1">
            <FilterOptionButton
              label={child.name}
              active={childActive}
              emphasis={expanded}
              indent={1}
              onClick={() => onChange(child.id)}
            />
            {expanded &&
              grandchildren.map((grandchild) => (
                <FilterOptionButton
                  key={grandchild.id}
                  label={grandchild.name}
                  active={selected === grandchild.id}
                  indent={2}
                  onClick={() => onChange(grandchild.id)}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}
