-- The coach_v2 migration inserted the owner Client with CURRENT_TIMESTAMP (TEXT); Prisma stores DateTime as
-- INTEGER ms. SQLite sorts INTEGER before TEXT, so new clients sorted ahead of the owner. Normalize to Prisma's format.
UPDATE "Client" SET "createdAt" = CAST(strftime('%s', "createdAt") AS INTEGER) * 1000 WHERE typeof("createdAt") = 'text';
