// src/services/order-detail.service.ts

import prisma from '../config/prisma';
import { Prisma, Rol } from '@prisma/client';
import { CreateOrdenCompraDetallePayload, UpdateOrdenCompraDetallePayload } from '../types/orden_compra_detalle.d';
import { AuthUser } from '../types/auth.d'; // Asegúrate de que AuthUser sea 'export' en auth.d.ts

export const OrderDetailService = {

    /**
     * Crea un nuevo Detalle de Orden de Compra.
     * Calcula el subtotal.
     * Verifica la existencia de la Orden de Compra y el ProductoDetalle.
     * @param data Los datos para crear el Detalle de Orden de Compra.
     * @param currentUser El usuario autenticado que realiza la operación.
     * @returns El Detalle de Orden de Compra creado.
     * @throws Error si la orden de compra o el producto detalle no existen, o si el stock es insuficiente.
     * @throws Error si un CLIENTE intenta crear un detalle para una orden que no le pertenece.
     */
    create: async (data: CreateOrdenCompraDetallePayload, currentUser: AuthUser) => {
        // 1. Verificar existencia de OrdenCompra
        // Incluye el usuario de la Orden de Compra para la validación de autorización
        const ordenCompra = await prisma.ordenCompra.findUnique({
            where: { id: data.ordenCompraId },
            include: { usuario: true } // Asume que OrdenCompra tiene una relación 'usuario' en schema.prisma
        });
        if (!ordenCompra) {
            throw new Error('Orden de compra no encontrada.');
        }

        // 2. Autorización para CLIENTES: Solo pueden agregar a sus propias órdenes
        // La validación de 'ordenCompra.usuario' se maneja mejor si la relación es opcional (Int?)
        // o si garantizas que siempre hay un usuario asociado.
        if (currentUser.rol === Rol.CLIENTE && (!ordenCompra.usuario || ordenCompra.usuario.id !== currentUser.id)) {
            throw new Error('No autorizado para crear detalles en esta orden de compra.');
        }

        // 3. Verificar existencia de ProductoDetalle
        const productoDetalle = await prisma.productoDetalle.findUnique({ where: { id: data.productoDetalleId } });
        if (!productoDetalle) {
            throw new Error('Detalle de producto no encontrado.');
        }

        // 4. Verificar stock disponible
        if (productoDetalle.stockActual < data.cantidad) {
            throw new Error(`Stock insuficiente para el producto: ${productoDetalle.stockActual} disponibles, solicitado: ${data.cantidad}.`);
        }

        // 5. Calcular subtotal (siempre se calcula en la creación)
        const subtotalCalculado = productoDetalle.precioCompra * data.cantidad;

        // 6. Crear el detalle de la orden de compra
        const newDetalle = await prisma.ordenCompraDetalle.create({
            data: {
                ordenCompra: { connect: { id: data.ordenCompraId } },
                productoDetalle: { connect: { id: data.productoDetalleId } },
                cantidad: data.cantidad,
                subtotal: subtotalCalculado, // Usar el subtotal calculado
                activo: true,
            },
        });

        // 7. Actualizar stock del ProductoDetalle
        await prisma.productoDetalle.update({
            where: { id: productoDetalle.id },
            data: { stockActual: { decrement: data.cantidad } },
        });

        return newDetalle;
    },

    /**
     * Busca un Detalle de Orden de Compra por su ID.
     * Un CLIENTE solo puede ver sus propios detalles de orden.
     * @param id El ID del Detalle de Orden de Compra.
     * @param currentUser El usuario autenticado que realiza la operación.
     * @returns El Detalle de Orden de Compra encontrado o null si no existe o no está activo/autorizado.
     * @throws Error si no está autorizado para ver el detalle.
     */
    findById: async (id: number, currentUser: AuthUser) => {
        const detalle = await prisma.ordenCompraDetalle.findUnique({
            where: {
                id,
                activo: true,
            },
            include: {
                ordenCompra: {
                    include: {
                        usuario: true, // Incluir el usuario de la Orden de Compra
                    },
                },
                productoDetalle: true,
            },
        });

        if (!detalle) {
            return null;
        }

        // Validación de autorización para CLIENTES
        if (currentUser.rol === Rol.CLIENTE) {
            // Asegúrate de que 'ordenCompra' y 'ordenCompra.usuario' existan antes de acceder a 'id'
            if (!detalle.ordenCompra || !detalle.ordenCompra.usuario || detalle.ordenCompra.usuario.id !== currentUser.id) {
                throw new Error('No autorizado para ver este detalle de orden de compra.');
            }
        }
        return detalle;
    },

    /**
     * Obtiene una lista de todos los Detalles de Orden de Compra.
     * Solo para ADMIN.
     * @param includeInactive Si es true, incluye detalles inactivos. Por defecto es false.
     * @returns Una lista de Detalles de Orden de Compra.
     */
    findAll: async (includeInactive: boolean = false) => {
        return prisma.ordenCompraDetalle.findMany({
            where: {
                activo: includeInactive ? undefined : true,
            },
            include: {
                ordenCompra: true,
                productoDetalle: true,
            },
        });
    },

    /**
     * Actualiza un Detalle de Orden de Compra existente.
     * No permite cambiar ordenCompraId o productoDetalleId.
     * Si se actualiza la cantidad, ajusta el stock y el subtotal.
     * @param id El ID del Detalle de Orden de Compra a actualizar.
     * @param data Los datos a actualizar (cantidad).
     * @returns El Detalle de Orden de Compra actualizado.
     * @throws Error si el detalle no es encontrado/activo, si el stock es insuficiente, o si se intenta modificar FKs.
     */
    update: async (id: number, data: UpdateOrdenCompraDetallePayload) => {
        const existingDetalle = await prisma.ordenCompraDetalle.findUnique({
            where: { id, activo: true },
            include: { productoDetalle: true } // Necesitamos el productoDetalle para el stock y precio
        });

        if (!existingDetalle) {
            throw new Error('Detalle de orden no encontrado o no activo para actualizar.');
        }

        // La verificación de ordenCompraId y productoDetalleId en el payload
        // ya no es necesaria aquí porque UpdateOrdenCompraDetallePayload
        // los omite por diseño.

        const updateData: Prisma.OrdenCompraDetalleUpdateInput = {};

        if (data.cantidad !== undefined && data.cantidad !== existingDetalle.cantidad) {
            const oldCantidad = existingDetalle.cantidad;
            const newCantidad = data.cantidad;
            const stockDelta = newCantidad - oldCantidad;

            if (!existingDetalle.productoDetalle) {
                throw new Error('Producto detalle asociado no encontrado para verificar stock.');
            }

            // Verificar stock para el nuevo cambio
            if (stockDelta > 0 && existingDetalle.productoDetalle.stockActual < stockDelta) {
                throw new Error(`Stock insuficiente para aumentar la cantidad. Disponible: ${existingDetalle.productoDetalle.stockActual}, Necesario: ${stockDelta}.`);
            }

            // Actualizar stock del ProductoDetalle
            await prisma.productoDetalle.update({
                where: { id: existingDetalle.productoDetalle.id },
                data: { stockActual: { decrement: stockDelta } }, // Resta si aumenta, suma si disminuye
            });

            updateData.cantidad = newCantidad;
            // Recalcular subtotal basado en la nueva cantidad y el precio actual del producto detalle
            updateData.subtotal = existingDetalle.productoDetalle.precioCompra * newCantidad;

        }
        // ELIMINADO: Ya no hay un 'else if (data.subtotal !== undefined)' aquí
        // porque 'subtotal' no forma parte de UpdateOrdenCompraDetallePayload
        // y se calcula automáticamente al cambiar la cantidad.

        try {
            return await prisma.ordenCompraDetalle.update({
                where: {
                    id,
                    activo: true,
                },
                data: updateData,
                include: { productoDetalle: true, ordenCompra: true } // Incluir para la respuesta y para futuras validaciones si es necesario
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new Error('Detalle de orden no encontrado para actualizar.');
            }
            throw error;
        }
    },

    /**
     * Desactiva (soft delete) un Detalle de Orden de Compra.
     * Devuelve el stock al ProductoDetalle.
     * @param id El ID del Detalle de Orden de Compra a desactivar.
     * @returns El Detalle de Orden de Compra desactivado.
     * @throws Error si el detalle no es encontrado o ya está inactivo.
     */
    delete: async (id: number) => {
        const existingDetalle = await prisma.ordenCompraDetalle.findUnique({
            where: { id },
            include: { productoDetalle: true } // Incluir para devolver stock
        });

        if (!existingDetalle || !existingDetalle.activo) {
            throw new Error('Detalle de orden no encontrado o ya desactivado.');
        }

        // Devolver el stock al ProductoDetalle
        if (existingDetalle.productoDetalle) {
            await prisma.productoDetalle.update({
                where: { id: existingDetalle.productoDetalle.id },
                data: { stockActual: { increment: existingDetalle.cantidad } },
            });
        }

        return prisma.ordenCompraDetalle.update({
            where: { id },
            data: { activo: false },
        });
    },

    /**
     * Reactiva un Detalle de Orden de Compra previamente desactivado.
     * Vuelve a descontar el stock del ProductoDetalle.
     * @param id El ID del Detalle de Orden de Compra a reactivar.
     * @returns El Detalle de Orden de Compra reactivado.
     * @throws Error si el detalle no es encontrado o ya está activo, o si no hay stock.
     */
    reactivate: async (id: number) => {
        const existingDetalle = await prisma.ordenCompraDetalle.findUnique({
            where: { id },
            include: { productoDetalle: true } // Incluir para verificar stock
        });

        if (!existingDetalle || existingDetalle.activo) {
            throw new Error('Detalle de orden no encontrado o ya está activo.');
        }

        // Verificar si hay stock para reactivar
        if (existingDetalle.productoDetalle) {
            if (existingDetalle.productoDetalle.stockActual < existingDetalle.cantidad) {
                throw new Error(`Stock insuficiente para reactivar el detalle de orden. Disponible: ${existingDetalle.productoDetalle.stockActual}, Necesario: ${existingDetalle.cantidad}.`);
            }
            // Descontar el stock nuevamente
            await prisma.productoDetalle.update({
                where: { id: existingDetalle.productoDetalle.id },
                data: { stockActual: { decrement: existingDetalle.cantidad } },
            });
        }

        return prisma.ordenCompraDetalle.update({
            where: { id },
            data: { activo: true },
        });
    },

    /**
     * Obtiene una lista de Detalles de Orden de Compra por el ID de la Orden de Compra.
     * Un CLIENTE solo puede ver los detalles de SUS órdenes.
     * @param ordenCompraId El ID de la Orden de Compra.
     * @param currentUser El usuario autenticado que realiza la operación.
     * @returns Una lista de Detalles de Orden de Compra.
     * @throws Error si la orden de compra no existe o no está autorizado.
     */
    findByOrderId: async (ordenCompraId: number, currentUser: AuthUser) => {
        const ordenCompra = await prisma.ordenCompra.findUnique({
            where: { id: ordenCompraId },
            include: {
                usuario: true // DEBE existir en schema.prisma el campo 'usuario' en OrdenCompra
            }
        });

        if (!ordenCompra) {
            throw new Error('Orden de compra no encontrada.');
        }

        // Autorización: Si es CLIENTE, debe ser el dueño de la orden.
        // Asegúrate de que 'ordenCompra.usuario' exista antes de acceder a 'id'
        if (currentUser.rol === Rol.CLIENTE && (!ordenCompra.usuario || ordenCompra.usuario.id !== currentUser.id)) {
            throw new Error('No autorizado para ver detalles de esta orden de compra.');
        }

        return prisma.ordenCompraDetalle.findMany({
            where: {
                ordenCompraId: ordenCompraId,
                activo: true, // Solo detalles activos
            },
            include: {
                productoDetalle: true,
                ordenCompra: true, // También podrías incluir la orden de compra aquí si necesitas sus datos
            },
        });
    },

    /**
     * Obtiene una lista de Detalles de Orden de Compra por el ID del ProductoDetalle.
     * Solo para ADMIN.
     * @param productoDetalleId El ID del ProductoDetalle.
     * @returns Una lista de Detalles de Orden de Compra.
     */
    findByProductDetailId: async (productoDetalleId: number) => {
        // Opcional: Verificar si el ProductoDetalle existe primero
        const productDetailExists = await prisma.productoDetalle.findUnique({ where: { id: productoDetalleId } });
        if (!productDetailExists) {
            throw new Error('Detalle de producto no encontrado.');
        }

        return prisma.ordenCompraDetalle.findMany({
            where: {
                productoDetalleId: productoDetalleId,
                activo: true, // Solo detalles activos
            },
            include: {
                ordenCompra: true,
            },
        });
    },
};