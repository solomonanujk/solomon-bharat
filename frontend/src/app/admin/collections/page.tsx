'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import {
  useAdminCollections,
  useArchiveCollection,
  useCreateCollection,
  usePublishCollection,
  useUnpublishCollection,
  useUpdateCollection,
  useSetCollectionFeatured,
} from '@/modules/collections';
import type { Collection } from '@/modules/collections';

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

export default function AdminCollectionsPage() {
  const { data, isLoading } = useAdminCollections();
  const createMutation = useCreateCollection();
  const publishMutation = usePublishCollection();
  const unpublishMutation = useUnpublishCollection();
  const archiveMutation = useArchiveCollection();
  const updateMutation = useUpdateCollection();
  const featuredMutation = useSetCollectionFeatured();

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [editorialIntro, setEditorialIntro] = useState('');

  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', slug: '', heroImage: '', editorialIntro: '', publishAt: '' });

  async function handleCreate() {
    if (!name.trim()) return;
    await createMutation.mutateAsync({ name: name.trim(), editorialIntro: editorialIntro || undefined });
    setName('');
    setEditorialIntro('');
    setIsCreating(false);
  }

  function startEdit(collection: Collection) {
    setEditingCollection(collection);
    setEditForm({
      name: collection.name,
      slug: collection.slug,
      heroImage: collection.heroImage ?? '',
      editorialIntro: collection.editorialIntro ?? '',
      publishAt: toDatetimeLocal(collection.publishAt),
    });
  }

  async function handleEditSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingCollection || !editForm.name.trim() || !editForm.slug.trim()) return;
    await updateMutation.mutateAsync({
      id: editingCollection.id,
      input: {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        heroImage: editForm.heroImage || undefined,
        editorialIntro: editForm.editorialIntro || undefined,
        publishAt: editForm.publishAt ? new Date(editForm.publishAt).toISOString() : null,
      },
    });
    setEditingCollection(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-serif font-medium text-text-primary">Collections</h1>
          <p className="mt-1 text-small text-text-muted">Curate editorial groupings of approved products</p>
        </div>
        <Button type="button" onClick={() => setIsCreating((v) => !v)} className="gap-1.5">
          <Plus size={14} aria-hidden="true" />
          Create Collection
        </Button>
      </div>

      {isCreating && (
        <div className="mb-6 rounded-card border border-border bg-bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="collection-name">Collection title</Label>
              <Input id="collection-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="collection-intro">Short description</Label>
              <Input
                id="collection-intro"
                value={editorialIntro}
                onChange={(event) => setEditorialIntro(event.target.value)}
              />
            </div>
          </div>
          <Button type="button" onClick={handleCreate} disabled={createMutation.isPending} className="mt-3">
            Save
          </Button>
        </div>
      )}

      {isLoading && <p className="text-small text-text-muted">Loading&hellip;</p>}

      {data && data.data.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {data.data.map((collection) => (
            <div key={collection.id} className="overflow-hidden rounded-card border border-border bg-bg-surface">
              <div className="relative aspect-video bg-fill-subtle">
                {collection.heroImage && (
                  <Image src={collection.heroImage} alt={collection.name} fill className="object-cover" />
                )}
                {collection.isFeatured && (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-gold/90 px-2 py-0.5 text-xs font-semibold text-white">
                    <Star size={11} aria-hidden="true" />
                    Featured
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="text-h4 font-serif text-text-primary">{collection.name}</p>
                <Badge
                  variant={collection.status === 'PUBLISHED' ? 'success' : collection.status === 'ARCHIVED' ? 'default' : 'warning'}
                  className="mt-2"
                >
                  {collection.status}
                </Badge>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-small">
                  {collection.status !== 'PUBLISHED' && collection.status !== 'ARCHIVED' && (
                    <button
                      type="button"
                      onClick={() => publishMutation.mutate(collection.id)}
                      className="font-semibold text-accent-secondary hover:text-accent-secondary-hover"
                    >
                      Publish
                    </button>
                  )}
                  {collection.status === 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => unpublishMutation.mutate(collection.id)}
                      className="font-semibold text-gold hover:opacity-80"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => featuredMutation.mutate({ id: collection.id, isFeatured: !collection.isFeatured })}
                    className="font-semibold text-accent-primary hover:text-accent-primary-hover"
                  >
                    {collection.isFeatured ? 'Unfeature' : 'Feature'}
                  </button>
                  <button type="button" onClick={() => startEdit(collection)} className="font-semibold text-text-primary hover:text-text-muted">
                    Edit
                  </button>
                  {collection.status !== 'ARCHIVED' && (
                    <button
                      type="button"
                      onClick={() => archiveMutation.mutate(collection.id)}
                      className="font-semibold text-error hover:opacity-80"
                    >
                      Archive
                    </button>
                  )}
                  <Link
                    href={`/admin/collections/${collection.id}`}
                    className="font-semibold text-accent-primary hover:text-accent-primary-hover"
                  >
                    Manage Products
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editingCollection !== null} onOpenChange={(open) => !open && setEditingCollection(null)}>
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
              <Button type="button" variant="ghost" onClick={() => setEditingCollection(null)}>
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
