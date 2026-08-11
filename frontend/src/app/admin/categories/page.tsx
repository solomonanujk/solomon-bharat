'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import {
  useAdminCategoryTree,
  useArchiveCategory,
  useCreateCategory,
  useReorderCategories,
  useRestoreCategory,
  useUpdateCategory,
} from '@/modules/categories';
import type { CategoryNode } from '@/modules/categories';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

interface NewCategoryForm {
  name: string;
  description: string;
}

const EMPTY_FORM: NewCategoryForm = { name: '', description: '' };

export default function AdminCategoriesPage() {
  const { data: tree, isLoading } = useAdminCategoryTree();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const archiveMutation = useArchiveCategory();
  const restoreMutation = useRestoreCategory();
  const reorderMutation = useReorderCategories();

  const [addingUnder, setAddingUnder] = useState<{ parentId: string | null; level: 1 | 2 | 3 } | null>(null);
  const [form, setForm] = useState<NewCategoryForm>(EMPTY_FORM);

  function startAdding(parentId: string | null, level: 1 | 2 | 3) {
    setAddingUnder({ parentId, level });
    setForm(EMPTY_FORM);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!addingUnder || !form.name.trim()) return;
    await createMutation.mutateAsync({
      name: form.name.trim(),
      level: addingUnder.level,
      parentId: addingUnder.parentId ?? undefined,
      description: form.description || undefined,
    });
    setAddingUnder(null);
    setForm(EMPTY_FORM);
  }

  function handleRename(node: CategoryNode) {
    const name = window.prompt('Category name:', node.name);
    if (name && name.trim() && name.trim() !== node.name) {
      updateMutation.mutate({ id: node.id, input: { name: name.trim() } });
    }
  }

  function handleMove(siblings: CategoryNode[], index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(targetIndex, 0, moved);

    reorderMutation.mutate(reordered.map((node, i) => ({ id: node.id, sortOrder: i })));
  }

  const addForm = addingUnder && (
    <form onSubmit={handleCreate} className="mt-3 flex flex-wrap items-end gap-3 rounded-card border border-border bg-bg-surface p-4">
      <div>
        <Label htmlFor="new-category-name">Name</Label>
        <Input
          id="new-category-name"
          autoFocus
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="new-category-description">Description (optional)</Label>
        <Input
          id="new-category-description"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        />
      </div>
      <Button type="submit" size="sm" disabled={createMutation.isPending}>
        Save
      </Button>
      <button type="button" onClick={() => setAddingUnder(null)} className="text-small text-text-muted hover:text-text-primary">
        Cancel
      </button>
    </form>
  );

  function renderNode(node: CategoryNode, siblings: CategoryNode[], index: number) {
    const isArchived = node.status === 'ARCHIVED';
    const isAddingHere = addingUnder?.parentId === node.id;

    return (
      <div key={node.id} className={node.level > 1 ? 'ml-6 mt-3' : 'mt-4 first:mt-0'}>
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-bg-surface p-3.5">
          <div className="min-w-0 flex-1">
            <span className={`text-body-lg font-serif ${isArchived ? 'text-text-muted line-through' : 'text-text-primary'}`}>
              {node.name}
            </span>
            {isArchived && (
              <Badge variant="error" className="ml-2">
                Archived
              </Badge>
            )}
            <span className="ml-2 text-caption text-text-muted">{node.productCount} products</span>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-caption">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleMove(siblings, index, -1)}
                disabled={index === 0 || reorderMutation.isPending}
                className="rounded p-1 text-text-muted hover:bg-fill-subtle disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleMove(siblings, index, 1)}
                disabled={index === siblings.length - 1 || reorderMutation.isPending}
                className="rounded p-1 text-text-muted hover:bg-fill-subtle disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </div>
            <button type="button" onClick={() => handleRename(node)} className="font-semibold text-accent-secondary hover:text-accent-secondary-hover">
              Rename
            </button>
            {node.level < 3 && (
              <button
                type="button"
                onClick={() => startAdding(node.id, (node.level + 1) as 1 | 2 | 3)}
                className="font-semibold text-accent-primary hover:text-accent-primary-hover"
              >
                + Subcategory
              </button>
            )}
            {isArchived ? (
              <button
                type="button"
                onClick={() => restoreMutation.mutate(node.id)}
                disabled={restoreMutation.isPending}
                className="font-semibold text-success hover:opacity-80"
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                onClick={() => archiveMutation.mutate(node.id)}
                disabled={archiveMutation.isPending}
                className="font-semibold text-error hover:opacity-80"
              >
                Archive
              </button>
            )}
          </div>
        </div>

        {isAddingHere && addForm}

        {node.children.map((child, childIndex) => renderNode(child, node.children, childIndex))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-serif font-medium text-text-primary">Categories</h1>
          <p className="mt-1 text-small text-text-muted">Manage the 3-level category taxonomy</p>
        </div>
        <Button type="button" onClick={() => startAdding(null, 1)} className="gap-1.5">
          <Plus size={14} aria-hidden="true" />
          Add Category
        </Button>
      </div>

      {addingUnder?.parentId === null && addForm}

      {isLoading && <p className="mt-6 text-small text-text-muted">Loading&hellip;</p>}

      {tree && tree.length === 0 && <p className="mt-6 text-small text-text-muted">No categories yet.</p>}

      {tree?.map((node, index) => renderNode(node, tree, index))}
    </div>
  );
}
