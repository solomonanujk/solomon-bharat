-- CreateTable
CREATE TABLE "signup_email_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signup_email_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signup_email_codes_email_createdAt_idx" ON "signup_email_codes"("email", "createdAt");
