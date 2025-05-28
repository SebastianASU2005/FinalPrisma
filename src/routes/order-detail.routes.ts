// src/routes/orden_compra_detalle.routes.ts

import { Router, Request, Response } from 'express';
import { CreateOrdenCompraDetallePayload, UpdateOrdenCompraDetallePayload } from '../types/orden_compra_detalle.d';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { OrderDetailService } from '../services/order-detail.service'; // Ruta corregida

// Importar middlewares de autenticación y autorización
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware'; // Ajusta la ruta si es necesario
import { Rol } from '@prisma/client'; // Importa el enum Rol de Prisma si lo usas para los roles

const router = Router();

// ======================================================================================
// Helper para manejo de errores
// ======================================================================================
const handleOrderDetailError = (res: Response, error: any) => {
    console.error('Error en la ruta de detalle de orden de compra:', error);
    if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') { // Registro no encontrado para update/delete/findById
            return res.status(404).json({ message: 'Detalle de orden no encontrado o inactivo.', error: error.message });
        }
        if (error.code === 'P2003') { // Foreign key constraint failed (ej. ordenCompraId o productoDetalleId no existe)
            return res.status(400).json({ message: `Violación de restricción de clave externa. Verifica el ID de la orden de compra o del detalle del producto.`, error: error.message });
        }
        if (error.code === 'P2002') { // Violación de unicidad (si aplicara)
            return res.status(409).json({ message: 'Conflicto de datos.', error: error.message });
        }
    }
    // Errores de validación o lógicos desde el servicio
    if (error.message.includes('Missing required fields') || error.message.includes('ID inválido') || error.message.includes('No data provided')) {
        return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('no encontrado') || error.message.includes('no existe')) {
        return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('already deactivated') || error.message.includes('ya desactivado') || error.message.includes('already active')) {
        return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error interno del servidor.', error: error.message });
};

// ======================================================================================
// Rutas de Lectura (GET) - Con consideración de roles
// NOTA: Las rutas con parámetros fijos van antes de las rutas con parámetros dinámicos (/:id)
// ======================================================================================

// GET /api/orden_compra_detalle/ordenCompra/:idOrdenCompra - Obtener detalles por ID de Orden de Compra
// Un CLIENTE puede ver sus propias órdenes. Un ADMIN puede ver cualquiera.
router.get('/ordenCompra/:idOrdenCompra', verifyJWT, async (req: Request<{ idOrdenCompra: string }>, res: Response) => {
    try {
        const idOrdenCompra = parseInt(req.params.idOrdenCompra, 10);
        if (isNaN(idOrdenCompra)) {
            return res.status(400).json({ message: 'ID de orden de compra inválido.' });
        }

        const detalles = await OrderDetailService.findByOrderId(idOrdenCompra, req.user); // Pasa el usuario para verificación
        return res.status(200).json(detalles);
    } catch (error: any) {
        handleOrderDetailError(res, error);
    }
});

// GET /api/orden_compra_detalle/productoDetalle/:idProductoDetalle - Obtener detalles por ID de ProductoDetalle (ADMIN)
router.get('/productoDetalle/:idProductoDetalle', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ idProductoDetalle: string }>, res: Response) => {
    try {
        const idProductoDetalle = parseInt(req.params.idProductoDetalle, 10);
        if (isNaN(idProductoDetalle)) {
            return res.status(400).json({ message: 'ID de detalle de producto inválido.' });
        }
        const detalles = await OrderDetailService.findByProductDetailId(idProductoDetalle);
        return res.status(200).json(detalles);
    } catch (error: any) {
        handleOrderDetailError(res, error);
    }
});

// GET /api/orden_compra_detalle/:id - Obtener un OrdenCompraDetalle por ID
// Un CLIENTE puede ver sus propios detalles de orden. Un ADMIN puede ver cualquiera.
router.get('/:id', verifyJWT, async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de detalle de orden inválido.' });
        }
        const detalle = await OrderDetailService.findById(id, req.user); // Pasa el usuario para verificación
        if (!detalle || !detalle.activo) {
            return res.status(404).json({ message: 'Order detail not found or not active.' });
        }
        return res.status(200).json(detalle);
    } catch (error: any) {
        handleOrderDetailError(res, error);
    }
});

// GET /api/orden_compra_detalle - Obtener todos los detalles (ADMIN)
// Este método no estaba en tu routes.ts, pero es un GET / que devuelve todo.
router.get('/', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request, res: Response) => {
    try {
        const includeInactive = req.query.includeInactive === 'true'; // Opcional: para que el admin pueda ver inactivas
        const detalles = await OrderDetailService.findAll(includeInactive);
        return res.status(200).json(detalles);
    } catch (error: any) {
        handleOrderDetailError(res, error);
    }
});

// ======================================================================================
// Rutas de Escritura (POST, PUT, DELETE, PATCH) - Requieren ADMIN (o CLIENTE bajo ciertas condiciones)
// ======================================================================================

// POST /api/orden_compra_detalle - Crear un nuevo OrdenCompraDetalle (CLIENTE/ADMIN)
// Generalmente, los detalles se crean junto con la orden de compra.
// Aquí asumimos que un cliente puede crear sus propios detalles (ligados a su orden)
// y un admin puede crear cualquier detalle.
router.post('/', verifyJWT, authorizeRoles([Rol.CLIENTE, Rol.ADMIN]), async (req: Request<{}, {}, CreateOrdenCompraDetallePayload>, res: Response) => {
    try {
        const detalleData: CreateOrdenCompraDetallePayload = req.body;
        if (!detalleData.ordenCompraId || !detalleData.productoDetalleId || detalleData.cantidad === undefined) {
            return res.status(400).json({ message: 'Missing required fields: ordenCompraId, productoDetalleId, and cantidad.' });
        }
        const newDetalle = await OrderDetailService.create(detalleData, req.user); // Pasa el usuario para verificación
        return res.status(201).json(newDetalle);
    } catch (error: any) {
        handleOrderDetailError(res, error);
    }
});

// PUT /api/orden_compra_detalle/:id - Actualizar un OrdenCompraDetalle (ADMIN)
router.put('/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }, {}, UpdateOrdenCompraDetallePayload>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de detalle de orden inválido.' });
        }
        const detalleData: UpdateOrdenCompraDetallePayload = req.body;
        if (Object.keys(detalleData).length === 0) {
            return res.status(400).json({ message: 'No data provided for update.' });
        }
        const updatedDetalle = await OrderDetailService.update(id, detalleData);
        return res.status(200).json(updatedDetalle);
    } catch (error: any) {
        handleOrderDetailError(res, error);
    }
});

// PATCH /api/orden_compra_detalle/reactivate/:id - Reactivar un OrdenCompraDetalle (ADMIN)
router.patch('/reactivate/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de detalle de orden inválido.' });
        }
        const reactivatedDetalle = await OrderDetailService.reactivate(id);
        return res.status(200).json({ message: 'Order detail reactivated successfully', detail: reactivatedDetalle });
    } catch (error: any) {
        handleOrderDetailError(res, error);
    }
});

// DELETE /api/orden_compra_detalle/:id - Desactivar (soft delete) un OrdenCompraDetalle (ADMIN)
router.delete('/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de detalle de orden inválido.' });
        }
        const deletedDetalle = await OrderDetailService.delete(id);
        return res.status(200).json({ message: 'Order detail deactivated successfully', detail: deletedDetalle });
    } catch (error: any) {
        handleOrderDetailError(res, error);
    }
});


export default router;