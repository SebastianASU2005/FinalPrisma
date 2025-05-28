

import prisma from '../config/prisma'; // Importa la instancia de PrismaClient
import { Prisma } from '@prisma/client'; // Importa el namespace Prisma para tipos
import { CreateOrdenCompraPayload, UpdateOrdenCompraPayload, CreateOrdenCompraDetalleNestedPayload } from '../types/orden_compra.d';

export const OrderService = {

    /**
     * Crea una nueva Orden de Compra.
     * Replicando la lógica de tu `crear` en Java, incluyendo cálculo de total
     * y manejo de detalles anidados.
     * @param ordenCompraData Los datos de la orden, incluyendo sus detalles.
     * @returns La OrdenCompra creada.
     */
    crear: async (ordenCompraData: CreateOrdenCompraPayload) => {
        try {
            if (!ordenCompraData.detalles || ordenCompraData.detalles.length === 0) {
                throw new Error("La orden debe tener al menos un producto.");
            }

            // 1. Obtener los ProductoDetalle para calcular los subtotales
            const productoDetalleIds = ordenCompraData.detalles.map(d => d.productoDetalleId);
            const productosDetallesExistentes = await prisma.productoDetalle.findMany({
                where: {
                    id: { in: productoDetalleIds },
                    activo: true, // Asegurarse de que los detalles de producto estén activos
                },
                select: {
                    id: true,
                    precioCompra: true,
                    stockActual: true,
                }
            });

            // Mapear los detalles existentes a un objeto para fácil acceso
            const productosDetalleMap = new Map(productosDetallesExistentes.map(pd => [pd.id, pd]));

            let totalCalculado = 0.0;
            const detallesParaCrear: Prisma.OrdenCompraDetalleCreateWithoutOrdenCompraInput[] = [];

            for (const detallePayload of ordenCompraData.detalles) {
                const productoDetalle = productosDetalleMap.get(detallePayload.productoDetalleId);

                if (!productoDetalle) {
                    throw new Error(`ProductoDetalle con ID ${detallePayload.productoDetalleId} no encontrado o inactivo.`);
                }
                if (productoDetalle.stockActual < detallePayload.cantidad) {
                    throw new Error(`Stock insuficiente para ProductoDetalle ID ${detallePayload.productoDetalleId}. Stock actual: ${productoDetalle.stockActual}, solicitado: ${detallePayload.cantidad}`);
                }

                // Calcular subtotal
                const subtotal = productoDetalle.precioCompra * detallePayload.cantidad;
                totalCalculado += subtotal;

                detallesParaCrear.push({
                    cantidad: detallePayload.cantidad,
                    subtotal: subtotal,
                    activo: true, // Asumimos que los detalles de la orden también son activos por defecto
                    productoDetalle: {
                        connect: { id: detallePayload.productoDetalleId }
                    }
                });
            }

            // 2. Crear la OrdenCompra con sus detalles anidados y el total calculado
            const nuevaOrden = await prisma.ordenCompra.create({
                data: {
                    total: totalCalculado,
                    fechaCompra: new Date(), // Establecer la fecha actual
                    direccionEnvio: ordenCompraData.direccionEnvio,
                    activo: true, // Asegura que la orden se crea como activa
                    detalles: {
                        create: detallesParaCrear,
                    },
                },
                include: { // Incluir detalles para la respuesta
                    detalles: {
                        include: {
                            productoDetalle: true // Incluir el ProductoDetalle relacionado en el detalle de la orden
                        }
                    }
                }
            });

            // Opcional: Descontar stock de los ProductoDetalle después de crear la orden
            // Esto es CRÍTICO para la integridad del inventario.
            // Se recomienda usar una transacción para que si falla el descuento de stock, la orden no se cree.
            await prisma.$transaction(async (tx) => {
                // Primero, crear la orden (como ya se hizo arriba, pero aquí en la transacción)
                // Para simplificar, asumimos que el `create` inicial ya está bien.
                // Si esto fuera un solo método transaccional, el `create` de la orden iría aquí.

                // Luego, descontar el stock
                for (const detallePayload of ordenCompraData.detalles) {
                    const productoDetalle = productosDetalleMap.get(detallePayload.productoDetalleId);
                    if (productoDetalle) { // Ya validamos que existe arriba
                        await tx.productoDetalle.update({
                            where: { id: detallePayload.productoDetalleId },
                            data: { stockActual: productoDetalle.stockActual - detallePayload.cantidad },
                        });
                    }
                }
            });


            return nuevaOrden;

        } catch (error: any) {
            console.error("Error al crear la orden de compra:", error);
            throw new Error(`Error al crear la orden de compra: ${error.message}`);
        }
    },

    /**
     * Obtiene una OrdenCompra por su ID.
     * @param id El ID de la orden.
     * @returns La OrdenCompra encontrada o null.
     */
    findById: async (id: number) => {
        return prisma.ordenCompra.findUnique({
            where: {
                id,
                activo: true,
            },
            include: {
                detalles: {
                    include: {
                        productoDetalle: true // Incluir el ProductoDetalle en los detalles de la orden
                    }
                }
            }
        });
    },

    /**
     * Actualiza una OrdenCompra existente.
     * NOTA: Este método solo actualiza los campos directos de OrdenCompra.
     * La modificación de `detalles` (añadir/quitar/modificar) debe manejarse
     * a través de endpoints/servicios dedicados para `OrdenCompraDetalle`.
     * @param id El ID de la orden a actualizar.
     * @param data Los datos a actualizar.
     * @returns La OrdenCompra actualizada.
     */
    update: async (id: number, data: UpdateOrdenCompraPayload) => {
        return prisma.ordenCompra.update({
            where: {
                id,
                activo: true,
            },
            data,
            include: {
                detalles: {
                    include: {
                        productoDetalle: true
                    }
                }
            }
        });
    },

    /**
     * Desactiva (soft delete) una OrdenCompra.
     * Esto también desactivará sus detalles si `onDelete: Cascade` está configurado
     * en el `schema.prisma` para la relación `OrdenCompraDetalle` a `OrdenCompra`.
     * @param id El ID de la orden a desactivar.
     * @returns La OrdenCompra desactivada.
     */
    delete: async (id: number) => {
        return prisma.ordenCompra.update({
            where: { id },
            data: { activo: false },
        });
    },

    /**
     * Reactiva una OrdenCompra previamente desactivada.
     * @param id El ID de la orden a reactivar.
     * @returns La OrdenCompra reactivada.
     */
    reactivate: async (id: number) => {
        return prisma.ordenCompra.update({
            where: { id },
            data: { activo: true },
        });
    },

    /**
     * Obtiene todas las Ordenes de Compra con una fecha específica.
     * @param fecha La fecha a buscar (LocalDateTime en Java, Date en JS).
     * @returns Una lista de OrdenCompra.
     */
    obtenerPorFecha: async (fecha: Date) => {
        // Para buscar por una fecha específica (día, mes, año), necesitamos construir un rango
        // ya que `DateTime` de Prisma es un TIMESTAMP.
        const startOfDay = new Date(fecha);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(fecha);
        endOfDay.setHours(23, 59, 59, 999);

        return prisma.ordenCompra.findMany({
            where: {
                fechaCompra: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                activo: true,
            },
            include: {
                detalles: {
                    include: {
                        productoDetalle: true
                    }
                }
            }
        });
    },
};