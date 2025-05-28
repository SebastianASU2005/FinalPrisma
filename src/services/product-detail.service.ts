// src/services/product_detail.service.ts

import prisma from '../config/prisma'; // Importa la instancia de PrismaClient
import { Prisma, Color, Talle } from '@prisma/client'; // Importa el namespace Prisma y los enums directamente
import { CreateProductoDetallePayload, UpdateProductoDetallePayload } from '../types/product_detail.d';


export const ProductDetailService = {
    // ==============================================================================
    // Métodos CRUD básicos (similares a BaseService en Java)
    // Devolverán los tipos generados directamente por Prisma (e.g., Prisma.ProductoDetalleGetPayload)
    // ==============================================================================

    /**
     * Crea un nuevo ProductoDetalle.
     * @param data Los datos para crear el ProductoDetalle.
     * @returns El ProductoDetalle creado (tipo de Prisma).
     */
    create: async (data: CreateProductoDetallePayload) => {
        return prisma.productoDetalle.create({
            data: {
                ...data,
                activo: true, // Asegura que se crea como activo
            },
        });
    },

    /**
     * Busca un ProductoDetalle por su ID.
     * @param id El ID del ProductoDetalle.
     * @returns El ProductoDetalle encontrado (tipo de Prisma) o null si no existe o no está activo.
     */
    findById: async (id: number) => {
        return prisma.productoDetalle.findUnique({
            where: {
                id,
                activo: true, // Solo busca activos
            },
        });
    },

    /**
     * Actualiza un ProductoDetalle existente.
     * @param id El ID del ProductoDetalle a actualizar.
     * @param data Los datos a actualizar.
     * @returns El ProductoDetalle actualizado (tipo de Prisma).
     */
    update: async (id: number, data: UpdateProductoDetallePayload) => {
        return prisma.productoDetalle.update({
            where: {
                id,
                activo: true, // Solo permite actualizar si está activo
            },
            data,
        });
    },

    /**
     * Desactiva (soft delete) un ProductoDetalle.
     * @param id El ID del ProductoDetalle a desactivar.
     * @returns El ProductoDetalle desactivado (tipo de Prisma).
     */
    delete: async (id: number) => {
        return prisma.productoDetalle.update({
            where: {
                id,
            },
            data: {
                activo: false,
            },
        });
    },

    /**
     * Reactiva un ProductoDetalle previamente desactivado.
     * @param id El ID del ProductoDetalle a reactivar.
     * @returns El ProductoDetalle reactivado (tipo de Prisma).
     */
    reactivate: async (id: number) => {
        return prisma.productoDetalle.update({
            where: { id },
            data: { activo: true },
        });
    },

    // ==============================================================================
    // Métodos de Búsqueda específicos (replicando el repositorio y servicio de Java)
    // ==============================================================================

    /**
     * Obtiene todos los detalles de un producto específico, solo los activos.
     * Equivalente a `findAllByProductoIdAndActivoTrue`.
     * @param productoId El ID del producto.
     * @returns Una lista de ProductoDetalle (tipo de Prisma).
     */
    findAllByProductoId: async (productoId: number) => {
        return prisma.productoDetalle.findMany({
            where: {
                productoId,
                activo: true,
            },
        });
    },

    /**
     * Busca un ProductoDetalle específico por ID de producto, talle y color.
     * Equivalente a `findByProductoIdAndTalleAndColorAndActivoTrue`.
     * @param productoId El ID del producto.
     * @param talle El talle del detalle.
     * @param color El color del detalle.
     * @returns El ProductoDetalle encontrado (tipo de Prisma) o null.
     */
    findByProductoIdAndTalleAndColor: async (productoId: number, talle: Talle, color: Color) => {
        return prisma.productoDetalle.findFirst({
            where: {
                productoId,
                talle,
                color,
                activo: true,
            },
        });
    },

    /**
     * Obtiene todos los ProductoDetalles con stock actual mayor a un mínimo, solo los activos.
     * Equivalente a `findAllByStockActualGreaterThanAndActivoTrue`.
     * @param stockMinimo El valor mínimo de stock.
     * @returns Una lista de ProductoDetalle (tipo de Prisma).
     */
    findAllByStockActualGreaterThan: async (stockMinimo: number) => {
        return prisma.productoDetalle.findMany({
            where: {
                stockActual: {
                    gt: stockMinimo,
                },
                activo: true,
            },
        });
    },

    /**
     * Filtra ProductoDetalles por producto, color, talle y stock mínimo.
     * Equivalente a `filtrarPorOpciones` (método `@Query` en Java).
     * @param productoId (Opcional) ID del producto.
     * @param color (Opcional) Color del detalle.
     * @param talle (Opcional) Talle del detalle.
     * @param stockMin (Opcional) Stock mínimo.
     * @returns Una lista de ProductoDetalle (tipo de Prisma).
     */
    filtrarPorOpciones: async (productoId?: number, color?: Color, talle?: Talle, stockMin?: number) => {
        const where: Prisma.ProductoDetalleWhereInput = {
            activo: true, // Siempre filtramos por activos
        };

        if (productoId !== undefined) {
            where.productoId = productoId;
        }
        if (color !== undefined) {
            where.color = color;
        }
        if (talle !== undefined) {
            where.talle = talle;
        }
        if (stockMin !== undefined) { // Usar !== undefined para permitir 0
            where.stockActual = {
                gte: stockMin,
            };
        }

        return prisma.productoDetalle.findMany({
            where,
        });
    },

    /**
     * Obtiene los talles únicos disponibles para un producto específico, solo de detalles activos.
     * Equivalente a `obtenerTallesDisponibles` (método `@Query` en Java).
     * @param productoId El ID del producto.
     * @returns Una lista de Talles (directamente los valores del enum).
     */
    obtenerTallesDisponibles: async (productoId: number): Promise<Talle[]> => {
        const detalles = await prisma.productoDetalle.findMany({
            where: {
                productoId,
                activo: true,
                // Si 'talle' es un campo no-nullable en tu esquema, la condición 'talle: { not: null }' no es necesaria.
                // Si fuera nullable y quisieras excluir nulos, se manejaría de otra forma en la cláusula where,
                // o se filtraría después del fetch.
            },
            distinct: ['talle'], // Asegura que solo se devuelvan valores únicos de talle
            select: {
                talle: true,
            },
        });
        // Si 'talle' es nullable en tu esquema, el `filter` es necesario.
        // Si 'talle' es no-nullable, simplemente mapear es suficiente.
        return detalles.map(d => d.talle).filter((talle): talle is Talle => talle !== null);
    },

    /**
     * Obtiene los colores únicos disponibles para un producto específico, solo de detalles activos.
     * Equivalente a `obtenerColoresDisponibles` (método `@Query` en Java).
     * @param productoId El ID del producto.
     * @returns Una lista de Colores (directamente los valores del enum).
     */
    obtenerColoresDisponibles: async (productoId: number): Promise<Color[]> => {
        const detalles = await prisma.productoDetalle.findMany({
            where: {
                productoId,
                activo: true,
               
            },
            distinct: ['color'],
            select: {
                color: true,
            },
        });
        // Mapea y luego filtra para asegurar que TypeScript infiera el tipo correcto después del filtro
        return detalles.map(d => d.color).filter((color): color is Color => color !== null);
    },


    /**
     * Descuenta el stock de un ProductoDetalle de forma transaccional.
     * @param productoDetalleId El ID del ProductoDetalle.
     * @param cantidad La cantidad a descontar.
     * @throws Error si el detalle no se encuentra, no está activo, o el stock es insuficiente.
     */
    descontarStock: async (productoDetalleId: number, cantidad: number): Promise<void> => {
        // Usamos una transacción para asegurar la atomicidad de la operación
        await prisma.$transaction(async (tx) => {
            // findUnique es suficiente, no hay necesidad de un bloqueo explícito en Prisma
            const detalle = await tx.productoDetalle.findUnique({
                where: {
                    id: productoDetalleId,
                    activo: true,
                },
            });

            if (!detalle) {
                throw new Error(`ProductoDetalle no encontrado o inactivo con ID: ${productoDetalleId}`);
            }
            if (detalle.stockActual < cantidad) {
                throw new Error(`Stock insuficiente para el ProductoDetalle ID: ${productoDetalleId}. Stock actual: ${detalle.stockActual}, Cantidad solicitada: ${cantidad}`);
            }

            await tx.productoDetalle.update({
                where: {
                    id: productoDetalleId,
                },
                data: {
                    stockActual: detalle.stockActual - cantidad,
                },
            });
        });
    },

    /**
     * Verifica si un ProductoDetalle específico está disponible (existe y tiene stock > 0).
     * @param productoId El ID del producto.
     * @param talle El talle del detalle.
     * @param color El color del detalle.
     * @returns `true` si está disponible y tiene stock, `false` en caso contrario.
     */
    estaDisponible: async (productoId: number, talle: Talle, color: Color): Promise<boolean> => {
        const detalle = await prisma.productoDetalle.findFirst({
            where: {
                productoId,
                talle,
                color,
                activo: true,
                stockActual: {
                    gt: 0, // Stock mayor que 0
                },
            },
        });
        return !!detalle; // Convierte el resultado (ProductoDetalle | null) a booleano
    },
};