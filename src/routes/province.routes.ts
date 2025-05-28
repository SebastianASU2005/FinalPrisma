// src/routes/provincia.routes.ts

import { Router, Request, Response, NextFunction } from 'express';
import { CreateProvinciaPayload, UpdateProvinciaPayload } from '../types/provincia.d';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ProvinceService } from 'services/province.service'; // <<-- POSIBLE ERROR DE RUTA RELATIVA AQUÍ

const router = Router();

// ==============================================================================
// Tipos auxiliares para manejadores de ruta asíncronos (repetidos para modularidad)
// ==============================================================================
type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithParams<P> = (req: Request<P>, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithBody<B> = (req: Request<{}, {}, B>, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithParamsAndBody<P, B> = (req: Request<P, {}, B>, res: Response, next: NextFunction) => Promise<Response | void>;

// ==============================================================================
// Rutas de Provincia
// ==============================================================================

// POST /api/provincias - Crear una nueva Provincia
router.post('/', (async (req, res) => {
    const provinciaData: CreateProvinciaPayload = req.body;

    if (!provinciaData.nombre) {
        return res.status(400).json({ message: 'Missing required field: nombre.' });
    }

    try {
        const newProvincia = await ProvinceService.create(provinciaData);
        return res.status(201).json(newProvincia);
    } catch (error: any) {
        console.error('Error creating province:', error);
        return res.status(500).json({ message: 'Error creating province', error: error.message });
    }
}) as AsyncRouteHandlerWithBody<CreateProvinciaPayload>);

// GET /api/provincias - Obtener todas las Provincias activas
router.get('/', (async (req, res) => {
    try {
        const provincias = await ProvinceService.findAll();
        return res.status(200).json(provincias);
    } catch (error: any) {
        console.error('Error fetching all provinces:', error);
        return res.status(500).json({ message: 'Error fetching all provinces', error: error.message });
    }
}) as AsyncRouteHandler);

// GET /api/provincias/:id - Obtener una Provincia por ID
router.get('/:id', (async (req, res) => {
    const { id } = req.params;
    try {
        const provincia = await ProvinceService.findById(parseInt(id));
        if (!provincia) {
            return res.status(404).json({ message: 'Province not found or not active' });
        }
        return res.status(200).json(provincia);
    } catch (error: any) {
        console.error('Error fetching province by ID:', error);
        return res.status(500).json({ message: 'Error fetching province by ID', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);

// PUT /api/provincias/:id - Actualizar una Provincia
router.put('/:id', (async (req, res) => {
    const { id } = req.params;
    const provinciaData: UpdateProvinciaPayload = req.body;

    if (Object.keys(provinciaData).length === 0) {
        return res.status(400).json({ message: 'No data provided for update.' });
    }

    try {
        const updatedProvincia = await ProvinceService.update(parseInt(id), provinciaData);
        if (!updatedProvincia) {
            return res.status(404).json({ message: 'Province not found or not active' });
        }
        return res.status(200).json(updatedProvincia);
    } catch (error: any) {
        console.error('Error updating province:', error);
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({ message: 'Province not found or not active.', error: error.message });
        }
        return res.status(500).json({ message: 'Error updating province', error: error.message });
    }
}) as AsyncRouteHandlerWithParamsAndBody<{ id: string }, UpdateProvinciaPayload>);

// DELETE /api/provincias/:id - Desactivar (soft delete) una Provincia
router.delete('/:id', (async (req, res) => {
    const { id } = req.params;
    try {
        const deletedProvincia = await ProvinceService.delete(parseInt(id));
        if (!deletedProvincia) {
            return res.status(404).json({ message: 'Province not found' });
        }
        return res.status(200).json({ message: 'Province deactivated successfully', province: deletedProvincia });
    } catch (error: any) {
        console.error('Error deactivating province:', error);
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({ message: 'Province not found.', error: error.message });
        }
        return res.status(500).json({ message: 'Error deactivating province', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);

// PATCH /api/provincias/reactivate/:id - Reactivar una Provincia
router.patch('/reactivate/:id', (async (req, res) => {
    const { id } = req.params;
    try {
        const reactivatedProvincia = await ProvinceService.reactivate(parseInt(id));
        if (!reactivatedProvincia) {
            return res.status(404).json({ message: 'Province not found' });
        }
        return res.status(200).json({ message: 'Province reactivated successfully', province: reactivatedProvincia });
    } catch (error: any) {
        console.error('Error reactivating province:', error);
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({ message: 'Province not found.', error: error.message });
        }
        return res.status(500).json({ message: 'Error reactivating province', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);

// GET /api/provincias/by-nombre/:nombre - Buscar Provincia por nombre (case-insensitive)
router.get('/by-nombre/:nombre', (async (req, res) => {
    const { nombre } = req.params;
    try {
        const provincia = await ProvinceService.findByNombre(nombre);
        if (!provincia) {
            return res.status(404).json({ message: 'Province not found by name or not active' });
        }
        return res.status(200).json(provincia);
    } catch (error: any) {
        console.error('Error fetching province by name:', error);
        return res.status(500).json({ message: 'Error fetching province by name', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ nombre: string }>);

export default router;