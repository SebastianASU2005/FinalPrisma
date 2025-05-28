// src/routes/descuento.routes.ts

import { Router, Request, Response } from 'express';
import { CreateDescuentoPayload, UpdateDescuentoPayload } from '../types/descuento.d'; // Asegúrate de que la ruta sea correcta
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { DiscountService } from '../services/discount.service'; // Asegúrate de que la ruta sea correcta

// Importar middlewares de autenticación y autorización
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware'; // Ajusta la ruta si es necesario
import { Rol } from '@prisma/client'; // Importa el enum Rol de Prisma si lo usas para los roles

const router = Router();

// ======================================================================================
// Helper para manejo de errores
// ======================================================================================
const handleDiscountError = (res: Response, error: any) => {
    console.error('Error en la ruta de descuentos:', error);
    if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') { // Registro no encontrado para update/delete/findById
            return res.status(404).json({ message: 'Descuento no encontrado o inactivo.', error: error.message });
        }
        if (error.code === 'P2003') { // Foreign key constraint failed (ej. productoIds no existen)
            return res.status(400).json({ message: `Violación de restricción de clave externa. Verifica los IDs de productos.`, error: error.message });
        }
        if (error.code === 'P2002') { // Violación de unicidad (ej. denominación si fuera única)
            return res.status(409).json({ message: 'Ya existe un descuento con esos datos.', error: error.message });
        }
    }
    // Errores de validación o lógicos desde el servicio
    if (error.message.includes('Missing required fields')) {
        return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('no encontrado')) {
        return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('already deactivated') || error.message.includes('ya desactivado') || error.message.includes('already active')) {
        return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('No data provided')) {
        return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error interno del servidor.', error: error.message });
};


// ======================================================================================
// Rutas de Lectura (GET) - Generalmente públicas
// ======================================================================================

// GET /api/descuentos - Obtener todos los Descuentos activos
router.get('/', async (req: Request, res: Response) => {
    try {
        const descuentos = await DiscountService.findAll(); // Asumo que este servicio ya filtra por activo: true
        return res.status(200).json(descuentos);
    } catch (error: any) {
        handleDiscountError(res, error);
    }
});

// GET /api/descuentos/:id - Obtener un Descuento por ID
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de descuento inválido.' });
        }
        const descuento = await DiscountService.findById(id);
        if (!descuento || !descuento.activo) { // Asumo que tienes un campo 'activo'
            return res.status(404).json({ message: 'Discount not found or not active' });
        }
        return res.status(200).json(descuento);
    } catch (error: any) {
        handleDiscountError(res, error);
    }
});


// ======================================================================================
// Rutas de Escritura (POST, PUT, DELETE, PATCH) - Requieren ADMIN
// NOTA: 'PATCH /reactivate/:id' va antes de '/:id' para evitar conflictos de enrutamiento.
// ======================================================================================

// PATCH /api/descuentos/reactivate/:id - Reactivar un Descuento (ADMIN)
router.patch('/reactivate/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de descuento inválido.' });
        }
        const reactivatedDescuento = await DiscountService.reactivate(id);
        if (!reactivatedDescuento) {
            return res.status(404).json({ message: 'Discount not found or already active.' });
        }
        return res.status(200).json({ message: 'Discount reactivated successfully', discount: reactivatedDescuento });
    } catch (error: any) {
        handleDiscountError(res, error);
    }
});

// POST /api/descuentos - Crear un nuevo Descuento (ADMIN)
router.post('/', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{}, {}, CreateDescuentoPayload>, res: Response) => {
    try {
        const descuentoData: CreateDescuentoPayload = req.body;

        if (!descuentoData.denominacion || descuentoData.fechaDesde === undefined || descuentoData.fechaHasta === undefined ||
            descuentoData.horaDesde === undefined || descuentoData.horaHasta === undefined || descuentoData.precioPromocional === undefined) {
            return res.status(400).json({ message: 'Missing required fields for discount: denominacion, fechaDesde, fechaHasta, horaDesde, horaHasta, precioPromocional.' });
        }

        const newDescuento = await DiscountService.create(descuentoData);
        return res.status(201).json(newDescuento);
    } catch (error: any) {
        handleDiscountError(res, error);
    }
});

// PUT /api/descuentos/:id - Actualizar un Descuento (ADMIN)
router.put('/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }, {}, UpdateDescuentoPayload>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de descuento inválido.' });
        }
        const descuentoData: UpdateDescuentoPayload = req.body;

        if (Object.keys(descuentoData).length === 0) {
            return res.status(400).json({ message: 'No data provided for update.' });
        }

        const updatedDescuento = await DiscountService.update(id, descuentoData);
        if (!updatedDescuento) {
            return res.status(404).json({ message: 'Discount not found or not active.' });
        }
        return res.status(200).json(updatedDescuento);
    } catch (error: any) {
        handleDiscountError(res, error);
    }
});

// DELETE /api/descuentos/:id - Desactivar (soft delete) un Descuento (ADMIN)
router.delete('/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de descuento inválido.' });
        }
        const deactivatedDescuento = await DiscountService.delete(id);
        if (!deactivatedDescuento) {
            return res.status(404).json({ message: 'Discount not found or already deactivated.' });
        }
        return res.status(200).json({ message: 'Discount deactivated successfully', discount: deactivatedDescuento });
    } catch (error: any) {
        handleDiscountError(res, error);
    }
});


export default router;