// src/routes/orden_compra.routes.ts

import { Router, Request, Response, NextFunction } from 'express';
import { CreateOrdenCompraPayload, UpdateOrdenCompraPayload } from '../types/orden_compra.d';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { OrderService } from 'services/order.service';

const router = Router();

// ==============================================================================
// Tipos auxiliares para manejadores de ruta asíncronos
// ==============================================================================
type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithParams<P> = (req: Request<P>, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithBody<B> = (req: Request<{}, {}, B>, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithParamsAndBody<P, B> = (req: Request<P, {}, B>, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithQuery<Q> = (req: Request<{}, {}, {}, Q>, res: Response, next: NextFunction) => Promise<Response | void>;

// ==============================================================================
// Rutas de OrdenCompra
// ==============================================================================

// POST /api/orden_compra - Crear una nueva Orden de Compra
router.post('/', (async (req, res) => {
    const ordenCompraData: CreateOrdenCompraPayload = req.body;

    if (!ordenCompraData.direccionEnvio || !ordenCompraData.detalles || ordenCompraData.detalles.length === 0) {
        return res.status(400).json({ message: 'Missing required fields: direccionEnvio and at least one detalle.' });
    }

    try {
        const newOrdenCompra = await OrderService.crear(ordenCompraData);
        return res.status(201).json(newOrdenCompra);
    } catch (error: any) {
        console.error('Error creating purchase order:', error);
        if (error instanceof PrismaClientKnownRequestError) {
            if (error.code === 'P2003') { // Foreign key constraint failed (ej. productoDetalleId no existe)
                return res.status(400).json({ message: `Foreign key constraint failed. Check if related IDs (e.g., productoDetalleId) exist.`, error: error.message });
            }
        }
        return res.status(500).json({ message: 'Error creating purchase order', error: error.message });
    }
}) as AsyncRouteHandlerWithBody<CreateOrdenCompraPayload>);

// GET /api/orden_compra/:id - Obtener una Orden de Compra por ID
router.get('/:id', (async (req, res) => {
    const { id } = req.params;
    try {
        const ordenCompra = await OrderService.findById(parseInt(id));
        if (!ordenCompra) {
            return res.status(404).json({ message: 'Purchase order not found or not active' });
        }
        return res.status(200).json(ordenCompra);
    } catch (error: any) {
        console.error('Error fetching purchase order by ID:', error);
        return res.status(500).json({ message: 'Error fetching purchase order by ID', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);

// PUT /api/orden_compra/:id - Actualizar una Orden de Compra
router.put('/:id', (async (req, res) => {
    const { id } = req.params;
    const ordenCompraData: UpdateOrdenCompraPayload = req.body;

    if (Object.keys(ordenCompraData).length === 0) {
        return res.status(400).json({ message: 'No data provided for update.' });
    }

    try {
        const updatedOrdenCompra = await OrderService.update(parseInt(id), ordenCompraData);
        if (!updatedOrdenCompra) {
            return res.status(404).json({ message: 'Purchase order not found or not active' });
        }
        return res.status(200).json(updatedOrdenCompra);
    } catch (error: any) {
        console.error('Error updating purchase order:', error);
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({ message: 'Purchase order not found or not active.', error: error.message });
        }
        return res.status(500).json({ message: 'Error updating purchase order', error: error.message });
    }
}) as AsyncRouteHandlerWithParamsAndBody<{ id: string }, UpdateOrdenCompraPayload>);

// DELETE /api/orden_compra/:id - Desactivar (soft delete) una Orden de Compra
router.delete('/:id', (async (req, res) => {
    const { id } = req.params;
    try {
        const deletedOrdenCompra = await OrderService.delete(parseInt(id));
        if (!deletedOrdenCompra) {
            return res.status(404).json({ message: 'Purchase order not found' });
        }
        return res.status(200).json({ message: 'Purchase order deactivated successfully', order: deletedOrdenCompra });
    } catch (error: any) {
        console.error('Error deactivating purchase order:', error);
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({ message: 'Purchase order not found.', error: error.message });
        }
        return res.status(500).json({ message: 'Error deactivating purchase order', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);

// PATCH /api/orden_compra/reactivate/:id - Reactivar una Orden de Compra
router.patch('/reactivate/:id', (async (req, res) => {
    const { id } = req.params;
    try {
        const reactivatedOrdenCompra = await OrderService.reactivate(parseInt(id));
        if (!reactivatedOrdenCompra) {
            return res.status(404).json({ message: 'Purchase order not found' });
        }
        return res.status(200).json({ message: 'Purchase order reactivated successfully', order: reactivatedOrdenCompra });
    } catch (error: any) {
        console.error('Error reactivating purchase order:', error);
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({ message: 'Purchase order not found.', error: error.message });
        }
        return res.status(500).json({ message: 'Error reactivating purchase order', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);

// GET /api/orden_compra/fecha - Obtener Ordenes de Compra por fecha
router.get('/fecha', (async (req, res) => {
    const { fecha } = req.query; // Fecha se espera como string en formato ISO (ej. "YYYY-MM-DD")

    if (!fecha || typeof fecha !== 'string') {
        return res.status(400).json({ message: 'Query parameter "fecha" is required and must be a string (YYYY-MM-DD).' });
    }

    try {
        // Intentar parsear la fecha. Date.parse() es robusto para ISO strings.
        const parsedDate = new Date(fecha);
        if (isNaN(parsedDate.getTime())) { // Comprobar si la fecha es inválida
            return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
        }

        const ordenes = await OrderService.obtenerPorFecha(parsedDate);
        return res.status(200).json(ordenes);
    } catch (error: any) {
        console.error('Error fetching purchase orders by date:', error);
        return res.status(500).json({ message: 'Error fetching purchase orders by date', error: error.message });
    }
}) as AsyncRouteHandlerWithQuery<{ fecha: string }>);

export default router;