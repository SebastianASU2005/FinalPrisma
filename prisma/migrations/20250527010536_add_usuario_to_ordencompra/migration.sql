/*
  Warnings:

  - Added the required column `usuarioId` to the `orden_compra` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `orden_compra` ADD COLUMN `usuarioId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `orden_compra` ADD CONSTRAINT `orden_compra_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
