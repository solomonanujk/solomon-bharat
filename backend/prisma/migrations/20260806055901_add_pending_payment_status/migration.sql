-- AlterEnum
-- Split into its own migration: Postgres requires a new enum value to be
-- committed before it can be referenced (e.g. in a column DEFAULT) in a
-- later statement/transaction.
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_PAYMENT';
