'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, X } from 'lucide-react';
import { ApprovalStatusBadge } from '@/components/ApprovalStatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useMyProduct, useResubmitProduct, useUpdateProduct } from '@/modules/products';
import { SellerProduct, UpdateProductInput } from '@/modules/products/types';
import { formatCurrency } from '@/utils/formatCurrency';

export interface SellerProductDetailPageProps {
  readonly params: { id: string };
}

function SpecRow({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-3 last:border-b-0">
      <span className="text-small font-semibold text-text-primary">{label}</span>
      <span className="text-small text-text-muted">{value}</span>
    </div>
  );
}

function SectionCard({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-bg-surface p-6">
      <h2 className="border-b border-border pb-3 text-h4 font-semibold text-text-primary">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

const editSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  materials: z.string().min(1, 'Materials are required').max(500),
  dimensions: z.string().max(200).optional(),
  weight: z.string().max(100).optional(),
  moq: z.coerce.number().int().min(1, 'MOQ must be at least 1'),
  declaredStock: z.coerce.number().int().min(0),
  sellerPrice: z.coerce.number().positive('Enter a valid price'),
  leadTime: z.string().max(200).optional(),
  certifications: z.string().max(500).optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

interface EditProductFormProps {
  readonly product: SellerProduct;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}

function EditProductForm({ product, onCancel, onSaved }: EditProductFormProps) {
  const updateMutation = useUpdateProduct();
  const resubmitMutation = useResubmitProduct();

  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: product.name,
      description: product.description,
      materials: product.materials,
      dimensions: product.dimensions ?? '',
      weight: product.weight ?? '',
      moq: product.moq,
      declaredStock: product.declaredStock,
      sellerPrice: Number(product.sellerPrice),
      leadTime: product.leadTime ?? '',
      certifications: product.certifications ?? '',
    },
  });

  const remainingImages = product.images.filter((image) => !removedImageIds.includes(image.id));
  const isSaving = updateMutation.isPending || resubmitMutation.isPending;

  function handleNewImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setNewImages((prev) => [...prev, ...files]);
  }

  function removeNewImage(index: number) {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleRemoveExisting(imageId: string) {
    setRemovedImageIds((prev) => (prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]));
  }

  async function save(values: EditFormValues, resubmitAfter: boolean) {
    setFormError(null);

    if (remainingImages.length + newImages.length < 2) {
      setFormError('Keep at least 2 product images.');
      return;
    }

    const input: UpdateProductInput = {
      ...values,
      removeImageIds: removedImageIds.length > 0 ? removedImageIds : undefined,
      images: newImages.length > 0 ? newImages : undefined,
    };

    try {
      await updateMutation.mutateAsync({ id: product.id, input });
      if (resubmitAfter) {
        await resubmitMutation.mutateAsync(product.id);
      }
      onSaved();
    } catch {
      setFormError('Could not save your changes. Please check your details and try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit((values) => save(values, true))} className="mt-6 space-y-6">
      <SectionCard title="Product Images">
        <div className="flex flex-wrap gap-3">
          {remainingImages.map((image) => (
            <div key={image.id} className="relative h-20 w-20 overflow-hidden rounded-card border border-border">
              <Image src={image.url} alt="" fill className="object-cover" unoptimized />
              <button
                type="button"
                onClick={() => toggleRemoveExisting(image.id)}
                aria-label="Remove image"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-bg-primary/90 text-error"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {newImages.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-card border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeNewImage(index)}
                aria-label="Remove image"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-bg-primary/90 text-error"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-card border border-dashed border-border text-caption font-medium text-text-muted transition-colors hover:border-accent-primary hover:text-accent-primary">
            + Add
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleNewImageSelect} />
          </label>
        </div>
        <p className="text-caption text-text-muted">At least 2 images required.</p>
      </SectionCard>

      <SectionCard title="Basic Info">
        <div>
          <Label htmlFor="edit-name">Product Name</Label>
          <Input id="edit-name" {...register('name')} error={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="edit-description">Description</Label>
          <textarea
            id="edit-description"
            {...register('description')}
            rows={4}
            className="h-auto w-full rounded-input border border-border bg-bg-primary px-3 py-2 text-body font-sans text-text-primary outline-none transition-colors focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
          />
          {errors.description && <p className="mt-1 text-caption text-error">{errors.description.message}</p>}
        </div>
      </SectionCard>

      <SectionCard title="Pricing & Stock">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="edit-sellerPrice">Your Price</Label>
            <Input id="edit-sellerPrice" type="number" step="0.01" {...register('sellerPrice')} error={errors.sellerPrice?.message} />
          </div>
          <div>
            <Label htmlFor="edit-moq">MOQ</Label>
            <Input id="edit-moq" type="number" {...register('moq')} error={errors.moq?.message} />
          </div>
          <div>
            <Label htmlFor="edit-declaredStock">Declared Stock</Label>
            <Input id="edit-declaredStock" type="number" {...register('declaredStock')} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Specifications">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="edit-materials">Materials</Label>
            <Input id="edit-materials" {...register('materials')} error={errors.materials?.message} />
          </div>
          <div>
            <Label htmlFor="edit-dimensions">Dimensions</Label>
            <Input id="edit-dimensions" {...register('dimensions')} />
          </div>
          <div>
            <Label htmlFor="edit-weight">Weight</Label>
            <Input id="edit-weight" {...register('weight')} />
          </div>
          <div>
            <Label htmlFor="edit-leadTime">Lead Time</Label>
            <Input id="edit-leadTime" {...register('leadTime')} />
          </div>
          <div>
            <Label htmlFor="edit-certifications">Certifications</Label>
            <Input id="edit-certifications" {...register('certifications')} />
          </div>
        </div>
      </SectionCard>

      {formError && <p className="text-small text-error">{formError}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save & Resubmit for Review'}
        </Button>
        <Button type="button" variant="ghost" disabled={isSaving} onClick={handleSubmit((values) => save(values, false))}>
          Save Without Resubmitting
        </Button>
        <Button type="button" variant="tertiary" disabled={isSaving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function SellerProductDetailPage({ params }: SellerProductDetailPageProps) {
  const { data: product, isLoading } = useMyProduct(params.id);
  const resubmitMutation = useResubmitProduct();
  const [isEditing, setIsEditing] = useState(false);

  if (isLoading || !product) {
    return <p className="text-small text-text-muted">Loading&hellip;</p>;
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/seller/products"
        className="mb-4 inline-flex items-center gap-1.5 text-small font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft size={14} />
        Back to Products
      </Link>

      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-h3 text-text-primary">{product.name}</h1>
        <ApprovalStatusBadge status={product.approvalStatus} />
      </div>

      {product.approvalStatus === 'REJECTED' && (
        <div className="mt-4 rounded-card border border-error bg-error/5 p-5">
          <p className="text-small font-semibold text-error">Rejection Reason</p>
          <p className="mt-1 text-small text-text-primary">{product.rejectionReason}</p>
          {!isEditing && (
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                type="button"
                size="sm"
                onClick={() => resubmitMutation.mutate(product.id)}
                disabled={resubmitMutation.isPending}
              >
                {resubmitMutation.isPending ? 'Resubmitting…' : 'Resubmit for Review'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                Edit Product
              </Button>
            </div>
          )}
        </div>
      )}

      {product.isPublished && (
        <p className="mt-4 text-small font-medium text-success">This product is live on the marketplace.</p>
      )}

      {isEditing ? (
        <EditProductForm product={product} onCancel={() => setIsEditing(false)} onSaved={() => setIsEditing(false)} />
      ) : (
        <>
          {product.images.length > 0 && (
            <div className="mt-6 flex gap-3 overflow-x-auto">
              {product.images.map((image) => (
                <div key={image.id} className="relative h-32 w-32 shrink-0 overflow-hidden rounded-card border border-border bg-bg-surface">
                  <Image src={image.url} alt={product.name} fill className="object-cover" />
                </div>
              ))}
            </div>
          )}

          <p className="mt-6 text-body text-text-primary">{product.description}</p>

          <div className="mt-8 overflow-hidden rounded-card border border-border bg-bg-surface">
            <SpecRow label="Your Price" value={formatCurrency(product.sellerPrice)} />
            <SpecRow label="MOQ" value={product.moq} />
            <SpecRow label="Declared Stock" value={product.declaredStock} />
            <SpecRow label="Materials" value={product.materials} />
            {product.dimensions && <SpecRow label="Dimensions" value={product.dimensions} />}
            {product.weight && <SpecRow label="Weight" value={product.weight} />}
            {product.leadTime && <SpecRow label="Lead Time" value={product.leadTime} />}
            {product.certifications && <SpecRow label="Certifications" value={product.certifications} />}
          </div>
        </>
      )}
    </div>
  );
}
