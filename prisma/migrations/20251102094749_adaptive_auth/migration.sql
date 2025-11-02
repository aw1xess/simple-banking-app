/*
  Warnings:

  - You are about to drop the column `typingPattern` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("id");

-- DropIndex
DROP INDEX "public"."Authenticator_id_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "typingPattern",
ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "image" TEXT,
ADD COLUMN     "otpCodeHash" TEXT,
ADD COLUMN     "otpExpiry" TIMESTAMP(3);
