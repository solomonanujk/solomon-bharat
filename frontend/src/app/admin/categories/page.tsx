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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';

interface NewCategoryForm {
  name: string;
  description: string;
}

interface EditCategoryForm {
  name: string;
  slug: string;
  description: string;
  heroImage: string;
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

  const [editingNode, setEditingNode] = useState<CategoryNode | null>(null);
  const [editForm, setEditForm] = useState<EditCategoryForm>({ name: '', slug: '', description: '', heroImage: '' });

  const [archivingNode, setArchivingNode] = useState<CategoryNode | null>(null);

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

  function startEdit(node: CategoryNode) {
    setEditingNode(node);
    setEditForm({
      name: node.name,
      slug: node.slug,
      description: node.description ?? '',
      heroImage: node.heroImage ?? '',
    });
  }

  async function handleEditSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingNode || !editForm.name.trim() || !editForm.slug.trim()) return;
    await updateMutation.mutateAsync({
      id: editingNode.id,
      input: {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        description: editForm.description || undefined,
        heroImage: editForm.heroImage || undefined,
      },
    });
    setEditingNode(null);
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

  async function confirmArchive() {
    if (!archivingNode) return;
    await archiveMutation.mutateAsync(archivingNode.id);
    setArchivingNode(null);
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
            <span className="ml-2 text-caption text-text-muted">/{node.slug}</span>
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
            <button type="button" onClick={() => startEdit(node)} className="font-semibold text-accent-secondary hover:text-accent-secondary-hover">
              Edit
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
                onClick={() => setArchivingNode(node)}
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

      <Dialog open={editingNode !== null} onOpenChange={(open) => !open && setEditingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
            <DialogDescription>Update the name, slug, description, or hero image.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 px-6 pb-2">
            <div>
              <Label htmlFor="edit-category-name">Name</Label>
              <Input
                id="edit-category-name"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-category-slug">Slug</Label>
              <Input
                id="edit-category-slug"
                value={editForm.slug}
                onChange={(event) => setEditForm((prev) => ({ ...prev, slug: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-category-description">Description</Label>
              <Input
                id="edit-category-description"
                value={editForm.description}
                onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-category-hero">Hero Image URL</Label>
              <Input
                id="edit-category-hero"
                value={editForm.heroImage}
                onChange={(event) => setEditForm((prev) => ({ ...prev, heroImage: event.target.value }))}
              />
            </div>
            <DialogFooter className="-mx-6 -mb-0">
              <Button type="button" variant="ghost" onClick={() => setEditingNode(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || !editForm.name.trim() || !editForm.slug.trim()}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={archivingNode !== null} onOpenChange={(open) => !open && setArchivingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive &ldquo;{archivingNode?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              Archived categories are hidden from buyers but can be restored later. Products remain assigned to
              this category.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setArchivingNode(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmArchive} disabled={archiveMutation.isPending}>
              Archive Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
