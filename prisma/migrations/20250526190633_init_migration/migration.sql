-- CreateTable
CREATE TABLE `categorias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `denominacion` VARCHAR(255) NOT NULL,
    `categoriaPadreId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `descuentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `denominacion` VARCHAR(255) NOT NULL,
    `fechaDesde` DATE NOT NULL,
    `fechaHasta` DATE NOT NULL,
    `horaDesde` TIME(3) NOT NULL,
    `horaHasta` TIME(3) NOT NULL,
    `descripcionDescuento` TEXT NOT NULL,
    `precioPromocional` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `direcciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `calle` VARCHAR(255) NOT NULL,
    `numero` INTEGER NOT NULL,
    `piso` VARCHAR(255) NULL,
    `departamento` VARCHAR(255) NULL,
    `cp` INTEGER NOT NULL,
    `localidadId` INTEGER NOT NULL,
    `usuarioId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `imagen` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `denominacion` VARCHAR(255) NOT NULL,
    `productoId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `localidades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `localidad` VARCHAR(255) NOT NULL,
    `provinciaId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orden_compra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `total` DOUBLE NOT NULL,
    `fechaCompra` DATETIME(3) NOT NULL,
    `direccionEnvio` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orden_compra_detalle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `cantidad` INTEGER NOT NULL,
    `subtotal` DOUBLE NOT NULL,
    `ordenCompraId` INTEGER NOT NULL,
    `productoDetalleId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `denominacion` VARCHAR(255) NOT NULL,
    `precioVenta` DOUBLE NOT NULL,
    `sexo` ENUM('FEMENINO', 'MASCULINO', 'UNISEX_CHILD', 'UNISEX', 'OTRO') NOT NULL,
    `tienePromocion` BOOLEAN NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `producto_detalle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `precioCompra` DOUBLE NOT NULL,
    `stockActual` INTEGER NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `stockMaximo` INTEGER NOT NULL,
    `color` ENUM('AZUL', 'BLANCO', 'CELESTE', 'NEGRO', 'VERDE', 'MULTICOLOR', 'ROJO', 'ROSA', 'MARRON', 'AMARILLO', 'VIOLETA', 'GRIS') NOT NULL,
    `talle` ENUM('XS', 'S', 'M', 'L', 'XL', 'XXL', 'TALLE_25', 'TALLE_26', 'TALLE_27', 'TALLE_28', 'TALLE_29', 'TALLE_30', 'TALLE_31', 'TALLE_32', 'TALLE_33', 'TALLE_34', 'TALLE_35', 'TALLE_36', 'TALLE_37', 'TALLE_38', 'TALLE_39', 'TALLE_40', 'TALLE_41', 'TALLE_42', 'TALLE_43', 'TALLE_44', 'TALLE_45', 'TALLE_46', 'TALLE_47', 'TALLE_48', 'TALLE_49', 'TALLE_50', 'TALLE_51', 'TALLE_52') NOT NULL,
    `productoId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provincias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `provincia` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `auth0Id` VARCHAR(255) NULL,
    `userName` VARCHAR(255) NULL,
    `nombre` VARCHAR(255) NOT NULL,
    `apellido` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `dni` INTEGER NULL,
    `sexo` ENUM('FEMENINO', 'MASCULINO', 'UNISEX_CHILD', 'UNISEX', 'OTRO') NULL,
    `fechaNacimiento` DATE NULL,
    `telefono` VARCHAR(255) NULL,
    `rol` ENUM('ADMIN', 'CLIENTE') NOT NULL,
    `imagenId` INTEGER NULL,
    `password` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `usuarios_auth0Id_key`(`auth0Id`),
    UNIQUE INDEX `usuarios_userName_key`(`userName`),
    UNIQUE INDEX `usuarios_imagenId_key`(`imagenId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ProductoCategorias` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_ProductoCategorias_AB_unique`(`A`, `B`),
    INDEX `_ProductoCategorias_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ProductoDescuentos` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_ProductoDescuentos_AB_unique`(`A`, `B`),
    INDEX `_ProductoDescuentos_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `categorias` ADD CONSTRAINT `categorias_categoriaPadreId_fkey` FOREIGN KEY (`categoriaPadreId`) REFERENCES `categorias`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `direcciones` ADD CONSTRAINT `direcciones_localidadId_fkey` FOREIGN KEY (`localidadId`) REFERENCES `localidades`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `direcciones` ADD CONSTRAINT `direcciones_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `imagen` ADD CONSTRAINT `imagen_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `productos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `localidades` ADD CONSTRAINT `localidades_provinciaId_fkey` FOREIGN KEY (`provinciaId`) REFERENCES `provincias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orden_compra_detalle` ADD CONSTRAINT `orden_compra_detalle_ordenCompraId_fkey` FOREIGN KEY (`ordenCompraId`) REFERENCES `orden_compra`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orden_compra_detalle` ADD CONSTRAINT `orden_compra_detalle_productoDetalleId_fkey` FOREIGN KEY (`productoDetalleId`) REFERENCES `producto_detalle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `producto_detalle` ADD CONSTRAINT `producto_detalle_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `productos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_imagenId_fkey` FOREIGN KEY (`imagenId`) REFERENCES `imagen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductoCategorias` ADD CONSTRAINT `_ProductoCategorias_A_fkey` FOREIGN KEY (`A`) REFERENCES `categorias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductoCategorias` ADD CONSTRAINT `_ProductoCategorias_B_fkey` FOREIGN KEY (`B`) REFERENCES `productos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductoDescuentos` ADD CONSTRAINT `_ProductoDescuentos_A_fkey` FOREIGN KEY (`A`) REFERENCES `descuentos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductoDescuentos` ADD CONSTRAINT `_ProductoDescuentos_B_fkey` FOREIGN KEY (`B`) REFERENCES `productos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
