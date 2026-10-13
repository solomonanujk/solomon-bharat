-- CreateTable
CREATE TABLE "brand_email_invites" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_email_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_email_invites_brandId_email_key" ON "brand_email_invites"("brandId", "email");
CREATE INDEX "brand_email_invites_email_idx" ON "brand_email_invites"("email");

ALTER TABLE "brand_email_invites" ADD CONSTRAINT "brand_email_invites_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
