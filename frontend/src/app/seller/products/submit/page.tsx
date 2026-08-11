'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/Select';
import { useCategories } from '@/modules/categories';
import { useCreateProduct } from '@/modules/products';

const submitSchema = z.object({
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

type SubmitFormValues = z.infer<typeof submitSchema>;

export default function SubmitProductPage() {
  const router = useRouter();
  const { data: categories } = useCategories();
  const createMutation = useCreateProduct();

  const [l1Id, setL1Id] = useState('');
  const [l2Id, setL2Id] = useState('');
  const [l3Id, setL3Id] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubmitFormValues>({ resolver: zodResolver(submitSchema) });

  const l1Options = useMemo(() => categories ?? [], [categories]);
  const l2Options = useMemo(() => l1Options.find((c) => c.id === l1Id)?.children ?? [], [l1Options, l1Id]);
  const l3Options = useMemo(() => l2Options.find((c) => c.id === l2Id)?.children ?? [], [l2Options, l2Id]);

  function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setImages((prev) => [...prev, ...files].slice(0, 10));
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(values: SubmitFormValues) {
    setFormError(null);

    if (!l3Id) {
      setFormError('Select a category down to the sub-subcategory level.');
      return;
    }
    if (images.length < 2) {
      setFormError('Upload at least 2 product images.');
      return;
    }

    try {
      await createMutation.mutateAsync({ ...values, categoryId: l3Id, images });
      router.push('/seller/products');
    } catch {
      setFormError('Could not submit the product. Please check your details and try again.');
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-h3 text-text-primary">Submit New Product</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        <section className="rounded-card border border-border bg-bg-surface p-6 space-y-4">
          <h2 className="border-b border-border pb-3 text-h4 font-semibold text-text-primary">Product Images</h2>
          <div className="flex flex-wrap gap-3">
            {images.map((file, index) => (
              <div key={`${file.name}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-card border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  aria-label="Remove image"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-bg-primary/90 text-error"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-card border border-dashed border-border text-caption font-medium text-text-muted hover:border-accent-primary hover:text-accent-primary transition-colors">
              + Add
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
            </label>
          </div>
          <p className="text-caption text-text-muted">2–10 images required.</p>
        </section>

        <section className="rounded-card border border-border bg-bg-surface p-6 space-y-4">
          <h2 className="border-b border-border pb-3 text-h4 font-semibold text-text-primary">Basic Info</h2>
          <div>
            <Label htmlFor="name">Product Name</Label>
            <Input id="name" {...register('name')} error={errors.name?.message} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              {...register('description')}
              rows={4}
              className="h-auto w-full rounded-input border border-border bg-bg-primary px-3 py-2 text-body font-sans text-text-primary outline-none transition-colors focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
            />
            {errors.description && <p className="mt-1 text-caption text-error">{errors.description.message}</p>}
          </div>

          <div>
            <Label>Category</Label>
            <div className="grid grid-cols-3 gap-2">
              <Select
                value={l1Id}
                onValueChange={(value) => {
                  setL1Id(value);
                  setL2Id('');
                  setL3Id('');
                }}
                placeholder="Category"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {l1Options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={l2Id}
                onValueChange={(value) => {
                  setL2Id(value);
                  setL3Id('');
                }}
                placeholder="Subcategory"
              >
                <SelectTrigger disabled={!l1Id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {l2Options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={l3Id} onValueChange={setL3Id} placeholder="Sub-subcategory">
                <SelectTrigger disabled={!l2Id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {l3Options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="rounded-card border border-border bg-bg-surface p-6 space-y-4">
          <h2 className="border-b border-border pb-3 text-h4 font-semibold text-text-primary">Pricing &amp; Stock</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="sellerPrice">Your Price</Label>
              <Input id="sellerPrice" type="number" step="0.01" {...register('sellerPrice')} error={errors.sellerPrice?.message} />
            </div>
            <div>
              <Label htmlFor="moq">MOQ</Label>
              <Input id="moq" type="number" {...register('moq')} error={errors.moq?.message} />
            </div>
            <div>
              <Label htmlFor="declaredStock">Declared Stock</Label>
              <Input id="declaredStock" type="number" {...register('declaredStock')} />
            </div>
          </div>
        </section>

        <section className="rounded-card border border-border bg-bg-surface p-6 space-y-4">
          <h2 className="border-b border-border pb-3 text-h4 font-semibold text-text-primary">Specifications</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="materials">Materials</Label>
              <Input id="materials" {...register('materials')} error={errors.materials?.message} />
            </div>
            <div>
              <Label htmlFor="dimensions">Dimensions</Label>
              <Input id="dimensions" {...register('dimensions')} />
            </div>
            <div>
              <Label htmlFor="leadTime">Lead Time</Label>
              <Input id="leadTime" {...register('leadTime')} />
            </div>
            <div>
              <Label htmlFor="certifications">Certifications</Label>
              <Input id="certifications" {...register('certifications')} />
            </div>
          </div>
        </section>

        {formError && <p className="text-small text-error">{formError}</p>}

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit for Review'}
          </Button>
          <p className="mt-2 text-caption text-text-muted">
            Your product will appear as Pending Review until an admin approves it.
          </p>
        </div>
      </form>
    </div>
  );
}
