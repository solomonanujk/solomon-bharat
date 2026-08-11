'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useAdminCollections, useArchiveCollection, useCreateCollection, usePublishCollection } from '@/modules/collections';

export default function AdminCollectionsPage() {
  const { data, isLoading } = useAdminCollections();
  const createMutation = useCreateCollection();
  const publishMutation = usePublishCollection();
  const archiveMutation = useArchiveCollection();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [editorialIntro, setEditorialIntro] = useState('');

  async function handleCreate() {
    if (!name.trim()) return;
    await createMutation.mutateAsync({ name: name.trim(), editorialIntro: editorialIntro || undefined });
    setName('');
    setEditorialIntro('');
    setIsCreating(false);
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
                  {collection.status !== 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => publishMutation.mutate(collection.id)}
                      className="font-semibold text-accent-secondary hover:text-accent-secondary-hover"
                    >
                      Publish
                    </button>
                  )}
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
    </div>
  );
}
