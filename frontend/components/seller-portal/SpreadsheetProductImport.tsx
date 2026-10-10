'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Package,
  RotateCcw,
  Upload,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategoryTypeahead, categoryPathLabel } from '@/components/seller-portal/CategoryTypeahead'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import {
  IMPORT_MAX_FILE_BYTES,
  useImportProducts,
  usePreviewProductImport,
} from '@/hooks/queries/useProductImport'
import { getApiError } from '@/lib/getApiError'
import { cn, formatINR } from '@/lib/utils'
import type { CategoryNode, ImportCandidate, ProductImportSource } from '@/types'

const INPUT_CLS =
  'w-full h-10 px-3 rounded border border-border-warm bg-surface text-[14px] font-sans text-primary placeholder:text-muted-text/60 focus:outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const CARD_CLS = 'bg-surface border border-border-warm rounded-xl'

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx']

const SOURCE_LABEL: Record<ProductImportSource, string> = {
  shopify: 'Shopify export',
  woocommerce: 'WooCommerce export',
}

type Step = 'upload' | 'review' | 'result'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function validateFile(file: File): string | null {
  const name = file.name.toLowerCase()
  if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return 'Please choose a .csv or .xlsx file.'
  }
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    return 'That file is larger than 5 MB. Export fewer products at a time and try again.'
  }
  if (file.size === 0) return 'That file is empty.'
  return null
}

/** Seller-price summary for a candidate: its own price, or the range across variants. */
function priceLabel(product: ImportCandidate): string | null {
  const prices = [product.sellerPrice, ...product.variants.map((v) => v.sellerPrice)].filter(
    (p): p is number => typeof p === 'number',
  )
  if (prices.length === 0) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`
}

const PUBLISHED_BADGE: Record<ProductImportSource, Record<'private' | 'draft', string>> = {
  woocommerce: {
    private: 'Private in WooCommerce',
    draft: 'Draft in WooCommerce',
  },
  shopify: {
    private: 'Archived in Shopify',
    draft: 'Draft in Shopify',
  },
}

function isHiddenInSource(p: ImportCandidate): boolean {
  return p.published === 'private' || p.published === 'draft'
}

/** Weight / stock summary for a candidate (own value, else its variants'). */
function detailLabels(p: ImportCandidate): string[] {
  const out: string[] = []
  const weights = [p.weightKg, ...p.variants.map((v) => v.weightKg)].filter((w): w is number => typeof w === 'number')
  if (weights.length > 0) {
    const min = Math.min(...weights)
    const max = Math.max(...weights)
    out.push(min === max ? `${min} kg` : `${min}–${max} kg`)
  }
  const variantStock = p.variants.map((v) => v.stock).filter((n): n is number => typeof n === 'number')
  if (typeof p.stock === 'number') out.push(`Stock ${p.stock}`)
  else if (variantStock.length > 0) out.push(`Stock ${variantStock.reduce((a, b) => a + b, 0)}`)
  return out
}

// ─── Per-product category control ────────────────────────────────────────────

function ProductCategory({
  tree,
  value,
  defaultCategoryId,
  suggestedPath,
  productName,
  disabled,
  missing,
  onChange,
}: {
  tree: CategoryNode[]
  value: string
  defaultCategoryId: string
  suggestedPath: string | null
  productName: string
  disabled: boolean
  missing: boolean
  onChange: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const inputId = useId()
  const changeRef = useRef<HTMLButtonElement>(null)

  let text: string
  if (value) text = categoryPathLabel(tree, value) || suggestedPath || 'Selected category'
  else if (defaultCategoryId) text = `Default category: ${categoryPathLabel(tree, defaultCategoryId)}`
  else text = 'No category chosen'

  return (
    <div className="mt-2">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={inputId} className="sr-only">
            Category for {productName}
          </label>
          <div className="w-full sm:w-80">
            <CategoryTypeahead
              id={inputId}
              tree={tree}
              value={value}
              onChange={onChange}
              disabled={disabled}
              className={INPUT_CLS}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[44px]"
            onClick={() => {
              setEditing(false)
              requestAnimationFrame(() => changeRef.current?.focus())
            }}
          >
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className={cn(
              'flex items-center gap-1.5 text-[12.5px] font-sans',
              missing ? 'text-error font-[600]' : 'text-muted-text',
            )}
          >
            {missing && <XCircle size={13} className="shrink-0" aria-hidden="true" />}
            <span>
              <span className="font-[600] text-primary">Category: </span>
              {missing ? 'Choose a category for this product' : text}
            </span>
          </p>
          <button
            ref={changeRef}
            type="button"
            disabled={disabled}
            onClick={() => setEditing(true)}
            className="inline-flex items-center min-h-[44px] px-2 text-[12.5px] font-[600] font-sans text-primary underline underline-offset-2 hover:no-underline disabled:opacity-50"
          >
            Change<span className="sr-only"> category for {productName}</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

function Thumbnail({ src, alt }: { src: string | undefined; alt: string }) {
  return (
    <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-muted-bg border border-border-warm">
      {!src ? (
        <div className="w-full h-full flex items-center justify-center">
          <Package size={18} className="text-muted-text/60" aria-hidden="true" />
        </div>
      ) : src.startsWith('https://') ? (
        // next.config allows any https host for the image optimizer.
        <Image src={src} alt={alt} fill sizes="56px" className="object-cover" />
      ) : (
        // Non-https (e.g. http:// WooCommerce media) isn't in remotePatterns —
        // fall back to a plain img inside the fixed-size box.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      )}
    </div>
  )
}

function IssueList({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null
  return (
    <ul className="mt-1.5 space-y-0.5">
      {issues.map((issue, i) => (
        <li key={`${i}-${issue}`} className="flex items-start gap-1.5 text-[12px] font-sans text-primary">
          <AlertTriangle size={13} className="text-warning shrink-0 mt-[2px]" aria-hidden="true" />
          <span>
            <span className="sr-only">Warning: </span>
            {issue}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 px-3.5 py-3 text-[13px] font-sans text-error"
    >
      <XCircle size={15} className="shrink-0 mt-[1px]" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

// ─── Step 1: Upload ───────────────────────────────────────────────────────────

function UploadStep({
  headingRef,
  isPending,
  error,
  onFile,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  isPending: boolean
  error: string | null
  onFile: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const hintId = useId()

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file) onFile(file)
    // Allow re-picking the same file after an error.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section aria-labelledby="import-upload-heading" className={cn(CARD_CLS, 'p-6')}>
      <h2
        id="import-upload-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-[16px] font-[700] font-sans text-primary focus:outline-none"
      >
        Upload your product export
      </h2>
      <p className="text-[13px] font-sans text-muted-text mt-1 mb-5 max-w-2xl">
        Upload the product spreadsheet exported from your Shopify or WooCommerce store. You’ll review the products
        before anything is created.
      </p>

      <button
        type="button"
        disabled={isPending}
        aria-describedby={hintId}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (!isPending) handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          dragOver ? 'border-primary bg-muted-bg' : 'border-border-warm bg-bg hover:bg-muted-bg/60',
          isPending && 'cursor-wait opacity-80',
        )}
      >
        {isPending ? (
          <>
            <Loader2 size={24} className="animate-spin text-primary" aria-hidden="true" />
            <span className="text-[14px] font-[600] font-sans text-primary">Reading your file…</span>
          </>
        ) : (
          <>
            <Upload size={24} className="text-primary" aria-hidden="true" />
            <span className="text-[14px] font-[600] font-sans text-primary">
              Drag and drop a file here, or click to choose one
            </span>
            <span id={hintId} className="text-[12.5px] font-sans text-muted-text">
              .csv or .xlsx, up to 5 MB
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 mt-6">
        <div className="rounded-lg border border-border-warm p-4">
          <h3 className="text-[13px] font-[700] font-sans text-primary mb-1.5">Exporting from Shopify</h3>
          <p className="text-[12.5px] font-sans text-muted-text leading-relaxed">
            In Shopify admin go to <strong className="text-primary">Products → Export</strong>, choose the products
            to export, and pick <strong className="text-primary">CSV for Excel</strong> or{' '}
            <strong className="text-primary">Plain CSV file</strong>. We follow{' '}
            <a
              href="https://help.shopify.com/en/manual/products/import-export/using-csv"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-[600] text-primary underline underline-offset-2 hover:no-underline"
            >
              Shopify’s product CSV guide
              <ExternalLink size={12} aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            ; both the older and the current Shopify column names are accepted.
          </p>
          <p className="text-[12.5px] font-sans text-muted-text leading-relaxed mt-2">
            <strong className="text-primary">Used:</strong> title, description, price, variants and options, SKU,
            images, weight (grams), inventory quantity, packed dimensions, product category, type, tags and
            status/published. <strong className="text-primary">Ignored:</strong> vendor, cost per item, compare-at
            price, SEO and Google Shopping columns, barcodes, collections and market-specific prices.
          </p>
          <a
            href="/templates/shopify-product-import-template.csv"
            download
            className="inline-flex items-center gap-1.5 min-h-[44px] mt-1 text-[13px] font-[600] font-sans text-primary underline underline-offset-2 hover:no-underline"
          >
            <Download size={14} aria-hidden="true" />
            Download Shopify template
          </a>
        </div>
        <div className="rounded-lg border border-border-warm p-4">
          <h3 className="text-[13px] font-[700] font-sans text-primary mb-1.5">Exporting from WooCommerce</h3>
          <p className="text-[12.5px] font-sans text-muted-text leading-relaxed">
            In WordPress admin go to <strong className="text-primary">Products → Export</strong>, keep all columns,
            and click <strong className="text-primary">Generate CSV</strong>. We follow the{' '}
            <a
              href="https://github.com/woocommerce/woocommerce/wiki/Product-CSV-Import-Schema"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-[600] text-primary underline underline-offset-2 hover:no-underline"
            >
              official WooCommerce product CSV schema
              <ExternalLink size={12} aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            .
          </p>
          <p className="text-[12.5px] font-sans text-muted-text leading-relaxed mt-2">
            <strong className="text-primary">Used:</strong> name, description, price, variations, images, weight,
            dimensions, stock, categories and tags. <strong className="text-primary">Ignored:</strong> sale price and
            dates, tax, reviews, shipping class, downloads, upsells and cross-sells, and grouped, external, virtual and
            downloadable products.
          </p>
          <a
            href="/templates/woocommerce-product-import-template.csv"
            download
            className="inline-flex items-center gap-1.5 min-h-[44px] mt-1 text-[13px] font-[600] font-sans text-primary underline underline-offset-2 hover:no-underline"
          >
            <Download size={14} aria-hidden="true" />
            Download WooCommerce template
          </a>
        </div>
      </div>

      <ul className="mt-5 space-y-1.5 text-[12.5px] font-sans text-muted-text">
        <li className="flex items-start gap-2">
          <FileSpreadsheet size={14} className="shrink-0 mt-[1px] text-primary" aria-hidden="true" />
          Imported products are created as <strong className="text-primary">drafts</strong> — finish the details and
          submit each one for review.
        </li>
        <li className="flex items-start gap-2">
          <FileSpreadsheet size={14} className="shrink-0 mt-[1px] text-primary" aria-hidden="true" />
          Prices in the file are treated as your price to Solomon Bharat (your seller price, in INR).
        </li>
      </ul>
    </section>
  )
}

// ─── Step 2: Review ───────────────────────────────────────────────────────────

function ReviewStep({
  headingRef,
  source,
  warnings,
  products,
  selected,
  onToggle,
  onSelectAll,
  categoryId,
  onCategoryChange,
  productCategory,
  onProductCategory,
  importing,
  progress,
  error,
  onImport,
  onReset,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  source: ProductImportSource
  warnings: string[]
  products: ImportCandidate[]
  selected: Set<string>
  onToggle: (key: string) => void
  onSelectAll: (all: boolean) => void
  categoryId: string
  onCategoryChange: (id: string) => void
  productCategory: Record<string, string>
  onProductCategory: (key: string, id: string) => void
  importing: boolean
  progress: { processed: number; total: number } | null
  error: string | null
  onImport: () => void
  onReset: () => void
}) {
  const { data: tree = [] } = useCategoryTree()
  const selectAllRef = useRef<HTMLInputElement>(null)
  const categoryInputId = useId()
  const allSelected = products.length > 0 && selected.size === products.length
  const someSelected = selected.size > 0 && !allSelected

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

  const withIssues = products.filter((p) => p.issues.length > 0).length
  const missingCategory = products.filter((p) => selected.has(p.key) && !productCategory[p.key] && !categoryId)
  const missingKeys = new Set(missingCategory.map((p) => p.key))

  return (
    <section aria-labelledby="import-review-heading" className="flex flex-col gap-5">
      <div className={cn(CARD_CLS, 'p-6')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="import-review-heading"
              ref={headingRef}
              tabIndex={-1}
              className="text-[16px] font-[700] font-sans text-primary focus:outline-none"
            >
              Review products
            </h2>
            <p className="text-[13px] font-sans text-muted-text mt-1">
              Found {plural(products.length, 'product')}
              {withIssues > 0 ? ` · ${withIssues} with warnings` : ''}. Choose which to import.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-warm bg-muted-bg px-3 py-1 text-[12px] font-[600] font-sans text-primary">
              <FileSpreadsheet size={13} aria-hidden="true" />
              {SOURCE_LABEL[source]}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={importing} className="gap-1.5">
              <RotateCcw size={13} aria-hidden="true" />
              Choose another file
            </Button>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-3">
            <p className="text-[12.5px] font-[700] font-sans text-primary mb-1">About this file</p>
            <IssueList issues={warnings} />
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <div className={cn(CARD_CLS, 'py-14 flex flex-col items-center text-center px-6')}>
          <Package size={24} className="text-muted-text/60 mb-3" aria-hidden="true" />
          <p className="text-[15px] font-[600] font-sans text-primary">No products found in this file</p>
          <p className="text-[13px] font-sans text-muted-text mt-1">
            Check that it’s a product export from Shopify or WooCommerce, then try again.
          </p>
        </div>
      ) : (
        <div className={cn(CARD_CLS, 'overflow-hidden')}>
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-warm bg-muted-bg/50">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                disabled={importing}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-border-warm accent-primary"
              />
              <span className="text-[13px] font-[600] font-sans text-primary">Select all</span>
            </label>
            <p className="text-[12.5px] font-sans text-muted-text" aria-live="polite">
              {selected.size} of {products.length} selected
            </p>
          </div>
          <ul className="divide-y divide-border-warm max-h-[560px] overflow-y-auto">
            {products.map((p) => {
              const checkboxId = `import-${p.key}`
              const price = priceLabel(p)
              const details = detailLabels(p)
              return (
                <li key={p.key} className={cn('px-5 py-3.5', selected.has(p.key) && 'bg-muted-bg/40')}>
                  <div className="flex items-start gap-4">
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={selected.has(p.key)}
                      disabled={importing}
                      onChange={() => onToggle(p.key)}
                      className="w-4 h-4 mt-5 shrink-0 rounded border-border-warm accent-primary cursor-pointer"
                    />
                    <Thumbnail src={p.imageUrls[0]} alt={p.name} />
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={checkboxId}
                        className="block text-[14px] font-[600] font-sans text-primary cursor-pointer truncate"
                      >
                        {p.name}
                      </label>
                      <p className="text-[12.5px] font-sans text-muted-text mt-0.5">
                        {p.variants.length > 0 ? plural(p.variants.length, 'variant') : 'No variants'}
                        {' · '}
                        {plural(p.imageUrls.length, 'image')}
                        {details.map((d) => ` · ${d}`).join('')}
                      </p>
                      {(p.published === 'private' || p.published === 'draft') && (
                        <span className="inline-flex items-center gap-1 mt-1 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11.5px] font-[600] font-sans text-primary">
                          <AlertTriangle size={11} aria-hidden="true" />
                          {PUBLISHED_BADGE[source][p.published]}
                        </span>
                      )}
                      <ProductCategory
                        tree={tree}
                        value={productCategory[p.key] ?? ''}
                        defaultCategoryId={categoryId}
                        suggestedPath={p.suggestedCategory?.path ?? null}
                        productName={p.name}
                        disabled={importing}
                        missing={missingKeys.has(p.key)}
                        onChange={(id) => onProductCategory(p.key, id)}
                      />
                      <IssueList issues={p.issues} />
                    </div>
                    <div className="text-right shrink-0">
                      {price ? (
                        <>
                          <p className="text-[14px] font-[600] font-sans text-primary">{price}</p>
                          <p className="text-[11.5px] font-sans text-muted-text">Your price</p>
                        </>
                      ) : (
                        <p className="text-[12.5px] font-sans text-muted-text">No price</p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {products.length > 0 && (
        <div className={cn(CARD_CLS, 'p-6')}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="w-full sm:w-96">
              <label
                htmlFor={categoryInputId}
                className="block text-[12px] font-[600] font-sans text-muted-text mb-1.5"
              >
                Default category (used for products without their own)
              </label>
              <CategoryTypeahead
                id={categoryInputId}
                tree={tree}
                value={categoryId}
                onChange={onCategoryChange}
                disabled={importing}
                className={INPUT_CLS}
              />
              <p className="text-[11.5px] font-sans text-muted-text mt-1.5">
                {categoryId
                  ? categoryPathLabel(tree, categoryId)
                  : 'Optional if every selected product has its own category.'}
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={selected.size === 0 || missingCategory.length > 0 || importing}
              aria-busy={importing}
              onClick={onImport}
              className="gap-2"
            >
              {importing && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {importing ? 'Importing…' : `Import ${plural(selected.size, 'product')}`}
            </Button>
          </div>

          {importing && progress && progress.total > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-[12px] font-sans text-muted-text mb-1.5">
                <span id="import-progress-label">Importing products…</span>
                <span>
                  {progress.processed} of {progress.total}
                </span>
              </div>
              <div
                role="progressbar"
                aria-labelledby="import-progress-label"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.processed}
                className="h-2 rounded-full bg-muted-bg overflow-hidden"
              >
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{ width: `${Math.round((progress.processed / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {missingCategory.length > 0 && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 px-3.5 py-3 text-[13px] font-sans text-error"
            >
              <XCircle size={15} className="shrink-0 mt-[1px]" aria-hidden="true" />
              <span>
                {plural(missingCategory.length, 'selected product')} need
                {missingCategory.length === 1 ? 's' : ''} a category: choose a default category above or set one per
                product ({missingCategory.slice(0, 3).map((p) => p.name).join(', ')}
                {missingCategory.length > 3 ? ', …' : ''}).
              </span>
            </div>
          )}

          {error && (
            <div className="mt-4">
              <ErrorAlert message={error} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Step 3: Result ───────────────────────────────────────────────────────────

function ResultStep({
  headingRef,
  created,
  failed,
  editHref,
  onReset,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  created: { id: string; name: string; slug: string }[]
  failed: { key: string; name: string; error: string }[]
  editHref: (id: string) => string
  onReset: () => void
}) {
  return (
    <section aria-labelledby="import-result-heading" className="flex flex-col gap-5">
      <div className={cn(CARD_CLS, 'p-6')}>
        <h2
          id="import-result-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-[16px] font-[700] font-sans text-primary focus:outline-none"
        >
          Import finished
        </h2>
        <div className="flex flex-wrap gap-6 mt-3">
          <p className="flex items-center gap-2 text-[14px] font-sans text-primary">
            <CheckCircle2 size={16} className="text-success" aria-hidden="true" />
            <strong>{created.length}</strong> created as drafts
          </p>
          {failed.length > 0 && (
            <p className="flex items-center gap-2 text-[14px] font-sans text-primary">
              <XCircle size={16} className="text-error" aria-hidden="true" />
              <strong>{failed.length}</strong> failed
            </p>
          )}
        </div>
        <p className="text-[12.5px] font-sans text-muted-text mt-3">
          Drafts aren’t visible to anyone yet. Open each one to confirm MOQ, pricing and details, then submit it for
          review.
        </p>
        <div className="mt-5">
          <Button type="button" variant="primary" size="md" onClick={onReset} className="gap-2">
            <Upload size={14} aria-hidden="true" />
            Import another file
          </Button>
        </div>
      </div>

      {created.length > 0 && (
        <div className={cn(CARD_CLS, 'overflow-hidden')}>
          <h3 className="px-5 py-3 border-b border-border-warm bg-muted-bg/50 text-[13px] font-[700] font-sans text-primary">
            Created drafts
          </h3>
          <ul className="divide-y divide-border-warm max-h-[420px] overflow-y-auto">
            {created.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="text-[13.5px] font-sans text-primary truncate">{c.name}</span>
                <Link
                  href={editHref(c.id)}
                  className="shrink-0 text-[13px] font-[600] font-sans text-primary underline underline-offset-2 hover:no-underline"
                >
                  Edit draft<span className="sr-only">: {c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <div className={cn(CARD_CLS, 'overflow-hidden')}>
          <h3 className="px-5 py-3 border-b border-border-warm bg-muted-bg/50 text-[13px] font-[700] font-sans text-primary">
            Not imported
          </h3>
          <ul className="divide-y divide-border-warm">
            {failed.map((f) => (
              <li key={f.key} className="flex items-start gap-2.5 px-5 py-3">
                <XCircle size={15} className="text-error shrink-0 mt-[2px]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-[600] font-sans text-primary">{f.name}</p>
                  <p className="text-[12.5px] font-sans text-error mt-0.5">{f.error}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

/** Spreadsheet (Shopify / WooCommerce export) product import. Drives both the
 *  seller self-service page and the admin on-behalf-of page — pass
 *  `sellerProfileId` for the admin case. */
export function SpreadsheetProductImport({ sellerProfileId }: { sellerProfileId?: string }) {
  const preview = usePreviewProductImport(sellerProfileId)
  const importer = useImportProducts(sellerProfileId)

  const [fileError, setFileError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [categoryId, setCategoryId] = useState('')
  const [productCategory, setProductCategory] = useState<Record<string, string>>({})
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null)

  const step: Step = importer.data ? 'result' : preview.data ? 'review' : 'upload'

  // Move focus to the new step's heading whenever the step changes (not on mount).
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const prevStep = useRef<Step>(step)
  useEffect(() => {
    if (prevStep.current !== step) {
      prevStep.current = step
      headingRef.current?.focus()
    }
  }, [step])

  const products = useMemo(() => preview.data?.products ?? [], [preview.data])

  function handleFile(file: File) {
    const problem = validateFile(file)
    setFileError(problem)
    if (problem) return
    preview.mutate(file, {
      onSuccess: (data) => {
        // Private / archived / draft products start unticked (still tickable).
        setSelected(new Set(data.products.filter((p) => !isHiddenInSource(p)).map((p) => p.key)))
        const suggested: Record<string, string> = {}
        for (const p of data.products) {
          if (p.suggestedCategory?.id) suggested[p.key] = p.suggestedCategory.id
        }
        setProductCategory(suggested)
      },
    })
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleImport() {
    const chosen = products.filter((p) => selected.has(p.key))
    if (chosen.length === 0) return
    const withCategory = chosen.map((p) => ({ ...p, categoryId: productCategory[p.key] || null }))
    if (withCategory.some((p) => !p.categoryId) && !categoryId) return
    importer.mutate({
      categoryId: categoryId || undefined,
      products: withCategory,
      onProgress: (processed, total) => setProgress({ processed, total }),
    })
  }

  function reset() {
    preview.reset()
    importer.reset()
    setFileError(null)
    setSelected(new Set())
    setProductCategory({})
    setProgress(null)
    // Keep the chosen category — sellers often import several files into the same one.
  }

  const editHref = (id: string) => (sellerProfileId ? `/admin/products/${id}` : `/portal/products/${id}/edit`)

  if (step === 'result' && importer.data) {
    return (
      <ResultStep
        headingRef={headingRef}
        created={importer.data.created}
        failed={importer.data.failed}
        editHref={editHref}
        onReset={reset}
      />
    )
  }

  if (step === 'review' && preview.data) {
    return (
      <ReviewStep
        headingRef={headingRef}
        source={preview.data.source}
        warnings={preview.data.warnings}
        products={products}
        selected={selected}
        onToggle={toggle}
        onSelectAll={(all) => setSelected(all ? new Set(products.map((p) => p.key)) : new Set())}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        productCategory={productCategory}
        onProductCategory={(key, id) =>
          setProductCategory((prev) => {
            const next = { ...prev }
            if (id) next[key] = id
            else delete next[key]
            return next
          })
        }
        importing={importer.isPending}
        progress={progress}
        error={importer.error ? getApiError(importer.error, 'Import failed. Please try again.') : null}
        onImport={handleImport}
        onReset={reset}
      />
    )
  }

  return (
    <UploadStep
      headingRef={headingRef}
      isPending={preview.isPending}
      error={fileError ?? (preview.error ? getApiError(preview.error, 'We couldn’t read that file.') : null)}
      onFile={handleFile}
    />
  )
}
