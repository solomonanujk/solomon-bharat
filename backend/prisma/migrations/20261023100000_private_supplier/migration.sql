CREATE TABLE "PrivateSupplier" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateSupplier_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "products" ADD COLUMN "privateSupplierId" TEXT;
ALTER TABLE "products" ADD CONSTRAINT "products_privateSupplierId_fkey"
  FOREIGN KEY ("privateSupplierId") REFERENCES "PrivateSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Product_privateSupplierId_idx" ON "products"("privateSupplierId");
