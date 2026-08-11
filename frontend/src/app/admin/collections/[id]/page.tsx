'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import {
  useAdminCollectionDetail,
  useAddProductToCollection,
  useRemoveProductFromCollection,
  useReorderCollectionProducts,
  usePublishCollection,
  useUnpublishCollection,
  useSetCollectionFeatured,
  useUpdateCollection,
} from '@/modules/collections';
import { useAdminProducts } from '@/modules/products';
import { formatCurrency } from '@/utils/formatCurrency';

interface EditForm {
  name: string;
  slug: string;
  heroImage: string;
  editorialIntro: string;
  publishAt: string;
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

export default function AdminCollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const collectionId = params.id;

  const { data: collection, isLoading } = useAdminCollectionDetail(collectionId);
  const addMutation = useAddProductToCollection(collectionId);
  const removeMutation = useRemoveProductFromCollection(collectionId);
  const reorderMutation = useReorderCollectionProducts(collectionId);
  const publishMutation = usePublishCollection();
  const unpublishMutation = useUnpublishCollection();
  const featuredMutation = useSetCollectionFeatured();
  const updateMutation = useUpdateCollection();

  const [search, setSearch] = useState('');
  const { data: approvedProducts, isLoading: isLoadingCatalog } = useAdminProducts({ approvalStatus: 'APPROVED' });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', slug: '', heroImage: '', editorialIntro: '', publishAt: '' });

  if (isLoading || !collection) {
    return <p className="text-small text-text-muted">Loading&hellip;</p>;
  }

  const memberIds = new Set(collection.products.map((p) => p.id));
  const sortedMembers = [...collection.products].sort((a, b) => a.sortOrder - b.sortOrder);
  const searchResults = (approvedProducts?.data ?? []).filter(
    (product) => !memberIds.has(product.id) && product.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedMembers.length) return;

    const reordered = [...sortedMembers];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(targetIndex, 0, moved);

    reorderMutation.mutate(reordered.map((product, i) => ({ productId: product.id, sortOrder: i })));
  }

  function openEdit() {
    setEditForm({
      name: collection!.name,
      slug: collection!.slug,
      heroImage: collection!.heroImage ?? '',
      editorialIntro: collection!.editorialIntro ?? '',
      publishAt: toDatetimeLocal(collection!.publishAt),
    });
    setIsEditing(true);
  }

  async function handleEditSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!editForm.name.trim() || !editForm.slug.trim()) return;
    await updateMutation.mutateAsync({
      id: collectionId,
      input: {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        heroImage: editForm.heroImage || undefined,
        editorialIntro: editForm.editorialIntro || undefined,
        publishAt: editForm.publishAt ? new Date(editForm.publishAt).toISOString() : null,
      },
    });
    setIsEditing(false);
  }

  return (
    <div>
      <Link
        href="/admin/collections"
        className="mb-4 flex w-fit items-center gap-1.5 text-small font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Collections
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-h2 font-serif font-medium text-text-primary">{collection.name}</h1>
          <Badge variant={collection.status === 'PUBLISHED' ? 'success' : collection.status === 'ARCHIVED' ? 'default' : 'warning'}>
            {collection.status}
          </Badge>
          {collection.isFeatured && (
            <Badge variant="warning" className="gap-1">
              <Star size={11} aria-hidden="true" />
              Featured
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {collection.status === 'PUBLISHED' ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => unpublishMutation.mutate(collectionId)}>
              Unpublish
            </Button>
          ) : (
            collection.status !== 'ARCHIVED' && (
              <Button type="button" size="sm" variant="ghost" onClick={() => publishMutation.mutate(collectionId)}>
                Publish
              </Button>
            )
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => featuredMutation.mutate({ id: collectionId, isFeatured: !collection.isFeatured })}
          >
            {collection.isFeatured ? 'Unfeature' : 'Feature'}
          </Button>
          <Button type="button" size="sm" onClick={openEdit}>
            Edit Collection
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-h4 font-serif text-text-primary">Products in Collection ({sortedMembers.length})</h2>
          <div className="mt-4 space-y-3">
            {sortedMembers.length === 0 && (
              <p className="text-small text-text-muted">No products added yet.</p>
            )}
            {sortedMembers.map((product, index) => (
              <div key={product.id} className="flex items-center gap-3 rounded-card border border-border bg-bg-surface p-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-fill-subtle">
                  {product.images[0] && (
                    <Image src={product.images[0].url} alt={product.name} fill className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-medium text-text-primary">{product.name}</p>
                  <p className="text-caption text-text-muted">{formatCurrency(product.adminPrice)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0 || reorderMutation.isPending}
                    className="rounded p-1.5 text-text-muted hover:bg-fill-subtle disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === sortedMembers.length - 1 || reorderMutation.isPending}
                    className="rounded p-1.5 text-text-muted hover:bg-fill-subtle disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(product.id)}
                    disabled={removeMutation.isPending}
                    className="ml-2 text-caption font-semibold text-error hover:opacity-80"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-h4 font-serif text-text-primary">Add Products</h2>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search approved products by name&hellip;"
            className="mt-4"
          />
          <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto">
            {isLoadingCatalog && <p className="text-small text-text-muted">Loading&hellip;</p>}
            {!isLoadingCatalog && searchResults.length === 0 && (
              <p className="text-small text-text-muted">No matching approved products.</p>
            )}
            {searchResults.map((product) => (
              <div key={product.id} className="flex items-center gap-3 rounded-card border border-border bg-bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-medium text-text-primary">{product.name}</p>
                  <p className="text-caption text-text-muted">{formatCurrency(product.adminPrice ?? '0')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => addMutation.mutate({ productId: product.id, sortOrder: sortedMembers.length })}
                  disabled={addMutation.isPending}
                  className="shrink-0 text-caption font-semibold text-accent-primary hover:text-accent-primary-hover"
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit collection</DialogTitle>
            <DialogDescription>Update the collection&rsquo;s public details and publish schedule.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 px-6 pb-2">
            <div>
              <Label htmlFor="edit-collection-name">Name</Label>
              <Input
                id="edit-collection-name"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-collection-slug">Slug</Label>
              <Input
                id="edit-collection-slug"
                value={editForm.slug}
                onChange={(event) => setEditForm((prev) => ({ ...prev, slug: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-collection-hero">Hero Image URL</Label>
              <Input
                id="edit-collection-hero"
                value={editForm.heroImage}
                onChange={(event) => setEditForm((prev) => ({ ...prev, heroImage: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-collection-intro">Editorial Intro</Label>
              <textarea
                id="edit-collection-intro"
                value={editForm.editorialIntro}
                onChange={(event) => setEditForm((prev) => ({ ...prev, editorialIntro: event.target.value }))}
                rows={3}
                className="w-full rounded-input border border-border bg-bg-surface px-3 py-2 text-body text-text-primary outline-none transition-colors focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
              />
            </div>
            <div>
              <Label htmlFor="edit-collection-publish-at">Publish At</Label>
              <Input
                id="edit-collection-publish-at"
                type="datetime-local"
                value={editForm.publishAt}
                onChange={(event) => setEditForm((prev) => ({ ...prev, publishAt: event.target.value }))}
              />
            </div>
            <DialogFooter className="-mx-6 -mb-0">
              <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || !editForm.name.trim() || !editForm.slug.trim()}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
