-- AlterTable: rename height/weight columns to imperial units
ALTER TABLE "UserProfile" RENAME COLUMN "heightCm" TO "heightIn";
ALTER TABLE "UserProfile" RENAME COLUMN "weightKg" TO "weightLbs";
