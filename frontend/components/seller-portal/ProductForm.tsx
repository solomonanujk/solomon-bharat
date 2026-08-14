'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Upload, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { useSubmitProduct, useUpdateMyProduct, useResubmitProduct } from '@/hooks/queries/useProducts'
import { CategoryCascadeSelect, categoryPathLabel } from '@/components/seller-portal/CategoryCascade'
import { ApprovalStatusBadge } from '@/components/seller-portal/StatusBadges'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import { getApiError } from '@/lib/getApiError'
import type { MyProduct } from '@/types'

const MIN_IMAGES = 2
const MAX_IMAGES = 10

const INPUT_CLS =
  'w-full h-10 px-3 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const TEXTAREA_CLS =
  'w-full px-3 py-2 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed'

let _id = 0
function uid() { return `v-${++_id}` }

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-[600] font-public-sans text-primary">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[12px] font-public-sans text-muted-text">{hint}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border-warm rounded p-6 space-y-5">
      <h2 className="text-[16px] font-[600] font-public-sans text-primary pb-3 border-b border-border-warm">
        {title}
      </h2>
      {children}
    </div>
  )
}

interface VariantRow { id: string; type: string; value: string }

interface ProductFormProps {
  /** Omit for the "Submit Product" create flow; pass the loaded product to edit it. */
  product?: MyProduct
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter()
  const { data: tree = [] } = useCategoryTree()

  const submitMutation = useSubmitProduct()
  const updateMutation = useUpdateMyProduct()
  const resubmitMutation = useResubmitProduct()

  const isEdit = !!product
  const isApproved = product?.approvalStatus === 'APPROVED'
  const isRejected = product?.approvalStatus === 'REJECTED'
  const locked = isApproved // APPROVED products can't be edited — backend 400s on it

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '') // create-only, see below
  const [materials, setMaterials] = useState(product?.materials ?? '')
  const [dimensions, setDimensions] = useState(product?.dimensions ?? '')
  const [weight, setWeight] = useState(product?.weight != null ? String(product.weight) : '')
  const [moq, setMoq] = useState(product?.moq != null ? String(product.moq) : '')
  const [declaredStock, setDeclaredStock] = useState(product?.declaredStock != null ? String(product.declaredStock) : '')
  const [sellerPrice, setSellerPrice] = useState(product?.sellerPrice != null ? String(product.sellerPrice) : '')
  const [leadTime, setLeadTime] = useState(product?.leadTime ?? '')
  const [certifications, setCertifications] = useState(product?.certifications ?? '')
  const [variants, setVariants] = useState<VariantRow[]>(
    product?.variants?.map((v) => ({ id: uid(), type: v.type, value: v.value })) ?? []
  )

  // ── Images ───────────────────────────────────────────────────────────────────
  const [existingImages, setExistingImages] = useState(product?.images ?? [])
  const [removeImageIds, setRemoveImageIds] = useState<string[]>([])
  const [newImages, setNewImages] = useState<File[]>([])
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { openLightbox, lightboxNode } = useImageLightbox()
  const totalImageCount = existingImages.length + newImages.length

  // Object URLs are created once per `newImages` change and revoked on the
  // next change / unmount, instead of being recreated on every render.
  useEffect(() => {
    const urls = newImages.map((f) => URL.createObjectURL(f))
    setNewImagePreviews(urls)
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)) }
  }, [newImages])

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const accepted = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const room = MAX_IMAGES - totalImageCount
    if (room <= 0) {
      toast.error(`You can have at most ${MAX_IMAGES} images.`)
      return
    }
    setNewImages((prev) => [...prev, ...accepted].slice(0, prev.length + room))
  }

  function removeNewImage(idx: number) {
    setNewImages((prev) => prev.filter((_, i) => i !== idx))
  }

  function removeExistingImage(id: string) {
    setExistingImages((prev) => prev.filter((img) => img.id !== id))
    setRemoveImageIds((prev) => [...prev, id])
  }

  // ── Variants ─────────────────────────────────────────────────────────────────
  function addVariant() {
    setVariants((prev) => [...prev, { id: uid(), type: '', value: '' }])
  }
  function updateVariant(id: string, field: 'type' | 'value', val: string) {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: val } : v)))
  }
  function removeVariant(id: string) {
    setVariants((prev) => prev.filter((v) => v.id !== id))
  }

  // ── Validation + submit ──────────────────────────────────────────────────────
  function validate(): string | null {
    if (!name.trim()) return 'Product name is required.'
    if (!description.trim()) return 'Description is required.'
    if (!isEdit && !categoryId) return 'Select a category — all 3 levels.'
    if (!materials.trim()) return 'Materials is required.'
    if (!moq || Number(moq) <= 0) return 'MOQ must be a positive number.'
    if (!declaredStock || Number(declaredStock) < 0) return 'Declared stock must be 0 or more.'
    if (!sellerPrice || Number(sellerPrice) <= 0) return 'Seller price must be a positive number.'
    if (totalImageCount < MIN_IMAGES || totalImageCount > MAX_IMAGES) {
      return `Upload between ${MIN_IMAGES} and ${MAX_IMAGES} images (currently ${totalImageCount}).`
    }
    return null
  }

  function cleanVariants() {
    return variants
      .filter((v) => v.type.trim() && v.value.trim())
      .map((v) => ({ type: v.type.trim(), value: v.value.trim() }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const error = validate()
    if (error) { toast.error(error); return }

    if (isEdit && product) {
      updateMutation.mutate(
        {
          id: product.id,
          data: {
            name: name.trim(),
            description: description.trim(),
            materials: materials.trim(),
            dimensions: dimensions.trim() || undefined,
            weight: weight ? Number(weight) : undefined,
            moq: Number(moq),
            declaredStock: Number(declaredStock),
            sellerPrice: Number(sellerPrice),
            leadTime: leadTime.trim() || undefined,
            certifications: certifications.trim() || undefined,
            variants: cleanVariants(),
            images: newImages.length ? newImages : undefined,
            removeImageIds: removeImageIds.length ? removeImageIds : undefined,
          },
        },
        { onSuccess: () => router.push('/portal/products') }
      )
    } else {
      submitMutation.mutate(
        {
          name: name.trim(),
          description: description.trim(),
          categoryId,
          materials: materials.trim(),
          dimensions: dimensions.trim() || undefined,
          weight: weight ? Number(weight) : undefined,
          moq: Number(moq),
          declaredStock: Number(declaredStock),
          sellerPrice: Number(sellerPrice),
          leadTime: leadTime.trim() || undefined,
          certifications: certifications.trim() || undefined,
          variants: cleanVariants(),
          images: newImages,
        },
        { onSuccess: () => router.push('/portal/products') }
      )
    }
  }

  async function handleResubmit() {
    if (!product) return
    const error = validate()
    if (error) { toast.error(error); return }
    try {
      // Persist any edits first, then flip the product back to Pending Review —
      // matches "seller edits the product and resubmits" (AGENTS.md rejection flow).
      await updateMutation.mutateAsync({
        id: product.id,
        data: {
          name: name.trim(),
          description: description.trim(),
          materials: materials.trim(),
          dimensions: dimensions.trim() || undefined,
          weight: weight ? Number(weight) : undefined,
          moq: Number(moq),
          declaredStock: Number(declaredStock),
          sellerPrice: Number(sellerPrice),
          leadTime: leadTime.trim() || undefined,
          certifications: certifications.trim() || undefined,
          variants: cleanVariants(),
          images: newImages.length ? newImages : undefined,
          removeImageIds: removeImageIds.length ? removeImageIds : undefined,
        },
      })
      await resubmitMutation.mutateAsync(product.id)
      router.push('/portal/products')
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const saving = submitMutation.isPending || updateMutation.isPending || resubmitMutation.isPending

  return (
    <form onSubmit={handleSave} noValidate>
      <div className="max-w-2xl space-y-6">

        {locked && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded border border-border-warm bg-muted-bg/60">
            <AlertTriangle size={16} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-[600] font-public-sans text-primary">This product is approved and live</p>
              <p className="text-[12px] font-public-sans text-muted-text mt-0.5">
                Approved products can&apos;t be edited from the seller portal. Contact the Solomon Bharat team if something needs to change.
              </p>
            </div>
          </div>
        )}

        {isRejected && product?.rejectionReason && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded border border-error/30 bg-error/5">
            <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-[600] font-public-sans text-error">Rejected — reason from Solomon Bharat</p>
              <p className="text-[13px] font-public-sans text-primary mt-0.5">{product.rejectionReason}</p>
            </div>
          </div>
        )}

        {isEdit && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em]">Status</span>
            <ApprovalStatusBadge status={product!.approvalStatus} />
          </div>
        )}

        {/* ── Photos ──────────────────────────────────────────────────────── */}
        <Section title="Photos">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={locked}
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = '' }}
          />
          {!locked && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-border-warm rounded p-6 flex flex-col items-center gap-2 text-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-muted-bg flex items-center justify-center">
                <Upload size={18} className="text-muted-text" />
              </div>
              <p className="text-[14px] font-[500] font-public-sans text-primary">Click or drag photos here</p>
              <p className="text-[12px] font-public-sans text-muted-text">{MIN_IMAGES}–{MAX_IMAGES} images · JPG, PNG or WebP</p>
            </div>
          )}
          {(existingImages.length > 0 || newImages.length > 0) && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {existingImages.map((img, i) => (
                <div key={img.id} className="relative group aspect-square rounded overflow-hidden border border-border-warm bg-muted-bg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt=""
                    onClick={() => openLightbox(img.url, 'Product image')}
                    className="w-full h-full object-cover cursor-zoom-in"
                  />
                  {!locked && (
                    <button type="button" onClick={() => removeExistingImage(img.id)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove image">
                      <X size={12} />
                    </button>
                  )}
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 text-[10px] font-[600] font-public-sans bg-black/60 text-white px-1.5 py-0.5 rounded">Cover</span>
                  )}
                </div>
              ))}
              {newImages.map((_file, i) => (
                <div key={`new-${i}`} className="relative group aspect-square rounded overflow-hidden border border-border-warm bg-muted-bg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={newImagePreviews[i]} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeNewImage(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] font-public-sans text-muted-text">
            {totalImageCount}/{MAX_IMAGES} selected — minimum {MIN_IMAGES} required
          </p>
        </Section>

        {/* ── Core details ────────────────────────────────────────────────── */}
        <Section title="Core Details">
          <Field label="Product Name" required>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={locked}
              placeholder="e.g. Hand-Block Printed Cotton Table Runner" className={INPUT_CLS} />
          </Field>

          <Field label="Description" required>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={locked}
              rows={5} placeholder="Describe the product — craftsmanship, use case, care instructions…" className={TEXTAREA_CLS} />
          </Field>

          <Field label="Category" required hint={isEdit ? 'Category can’t be changed after submission.' : 'Choose all 3 levels.'}>
            {isEdit ? (
              <p className="text-[14px] font-public-sans text-primary px-3 py-2.5 rounded border border-border-warm bg-muted-bg/30">
                {categoryPathLabel(tree, product?.categoryId)}
              </p>
            ) : (
              <CategoryCascadeSelect tree={tree} value={categoryId} onChange={setCategoryId} disabled={locked} />
            )}
          </Field>

          <Field label="Materials" required>
            <input type="text" value={materials} onChange={(e) => setMaterials(e.target.value)} disabled={locked}
              placeholder="e.g. 100% cotton, brass hardware" className={INPUT_CLS} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Dimensions">
              <input type="text" value={dimensions} onChange={(e) => setDimensions(e.target.value)} disabled={locked}
                placeholder="e.g. 150 x 33 cm" className={INPUT_CLS} />
            </Field>
            <Field label="Weight (kg)">
              <input type="number" min="0" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} disabled={locked}
                placeholder="e.g. 0.4" className={INPUT_CLS} />
            </Field>
          </div>
        </Section>

        {/* ── Trade terms ─────────────────────────────────────────────────── */}
        <Section title="Trade Terms">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="MOQ (units)" required>
              <input type="number" min="1" value={moq} onChange={(e) => setMoq(e.target.value)} disabled={locked}
                placeholder="e.g. 50" className={INPUT_CLS} />
            </Field>
            <Field label="Declared Stock" required hint="Self-reported — not system-tracked.">
              <input type="number" min="0" value={declaredStock} onChange={(e) => setDeclaredStock(e.target.value)} disabled={locked}
                placeholder="e.g. 500" className={INPUT_CLS} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Seller Price (₹ per unit)" required hint="What Solomon Bharat pays you. Never shown to buyers.">
              <input type="number" min="0" step="0.01" value={sellerPrice} onChange={(e) => setSellerPrice(e.target.value)} disabled={locked}
                placeholder="e.g. 450" className={INPUT_CLS} />
            </Field>
            <Field label="Lead Time">
              <input type="text" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} disabled={locked}
                placeholder="e.g. 2–3 weeks" className={INPUT_CLS} />
            </Field>
          </div>
          <Field label="Certifications">
            <input type="text" value={certifications} onChange={(e) => setCertifications(e.target.value)} disabled={locked}
              placeholder="e.g. GOTS certified, Fair Trade" className={INPUT_CLS} />
          </Field>
        </Section>

        {/* ── Variants ─────────────────────────────────────────────────────── */}
        <Section title="Variants (optional)">
          <p className="text-[12px] font-public-sans text-muted-text -mt-2">
            e.g. Color / Red, Size / Large — add one row per variant option.
          </p>
          {variants.length > 0 && (
            <div className="space-y-2">
              {variants.map((v) => (
                <div key={v.id} className="flex items-center gap-2">
                  <input type="text" value={v.type} disabled={locked}
                    onChange={(e) => updateVariant(v.id, 'type', e.target.value)}
                    placeholder="Type (e.g. Color)" className={INPUT_CLS} />
                  <input type="text" value={v.value} disabled={locked}
                    onChange={(e) => updateVariant(v.id, 'value', e.target.value)}
                    placeholder="Value (e.g. Red)" className={INPUT_CLS} />
                  {!locked && (
                    <button type="button" onClick={() => removeVariant(v.id)}
                      className="text-muted-text hover:text-error transition-colors shrink-0" aria-label="Remove variant">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!locked && (
            <button type="button" onClick={addVariant}
              className="inline-flex items-center gap-1.5 text-[12px] font-[600] font-public-sans text-accent hover:opacity-70 transition-opacity">
              <Plus size={13} />Add variant
            </button>
          )}
        </Section>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        {!locked && (
          <div className="flex items-center gap-3">
            {isRejected ? (
              <Button type="button" variant="accent" size="md" disabled={saving} onClick={handleResubmit}>
                {saving ? 'Resubmitting…' : 'Resubmit for Review'}
              </Button>
            ) : (
              <Button type="submit" variant="primary" size="md" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Submit for Review'}
              </Button>
            )}
            <Button type="button" variant="ghost" size="md" onClick={() => router.push('/portal/products')}>
              Cancel
            </Button>
          </div>
        )}
      </div>
      {lightboxNode}
    </form>
  )
}
