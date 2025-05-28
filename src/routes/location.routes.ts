// src/routes/localidad.routes.ts

import { Router, Request, Response } from 'express'; // Eliminamos NextFunction si no se usa explícitamente en el manejador
import { CreateLocalidadPayload, UpdateLocalidadPayload } from '../types/localidad.d'; // Asegúrate de que la ruta sea correcta
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { LocationService } from '../services/location.service'; // Ajusta la ruta si es necesario

// Importar middlewares de autenticación y autorización
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware'; // Ajusta la ruta si es necesario
import { Rol } from '@prisma/client'; // Importa el enum Rol de Prisma si lo usas para los roles

const router = Router();

// ======================================================================================
// Helper para manejo de errores
// ======================================================================================
const handleLocalityError = (res: Response, error: any) => {
    console.error('Error en la ruta de localidades:', error);
    if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') { // Registro no encontrado para update/delete/findById
            return res.status(404).json({ message: 'Localidad no encontrada o inactiva.', error: error.message });
        }
        if (error.code === 'P2003') { // Foreign key constraint failed (ej. provinciaId no existe)
            return res.status(400).json({ message: `Violación de restricción de clave externa. Verifica el ID de la provincia.`, error: error.message });
        }
        if (error.code === 'P2002') { // Violación de unicidad (ej. nombre de localidad si fuera única por provincia)
            return res.status(409).json({ message: 'Ya existe una localidad con ese nombre en esta provincia.', error: error.message });
        }
    }
    // Errores de validación o lógicos desde el servicio
    if (error.message.includes('Missing required fields') || error.message.includes('ID de provincia inválido')) {
        return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('no encontrada')) {
        return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('already deactivated') || error.message.includes('ya desactivada') || error.message.includes('already active')) {
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

// GET /api/localidades - Obtener todas las Localidades activas
router.get('/', async (req: Request, res: Response) => {
    try {
        const includeInactive = req.query.includeInactive === 'true'; // Opcional: para que el admin pueda ver inactivas
        const localidades = await LocationService.findAll(includeInactive); // Asumo que este servicio ya filtra por activo: true
        return res.status(200).json(localidades);
    } catch (error: any) {
        handleLocalityError(res, error);
    }
});

// GET /api/localidades/por-provincia/:provinciaId - Obtener localidades por ID de provincia
// NOTA: Colocada antes de /:id para evitar conflictos de enrutamiento.
router.get('/por-provincia/:provinciaId', async (req: Request<{ provinciaId: string }>, res: Response) => {
    try {
        const provinciaId = parseInt(req.params.provinciaId, 10);
        if (isNaN(provinciaId)) {
            return res.status(400).json({ message: 'ID de provincia inválido.' });
        }
        const localidades = await LocationService.findByProvinciaId(provinciaId);
        return res.status(200).json(localidades);
    } catch (error: any) {
        handleLocalityError(res, error);
    }
});

// GET /api/localidades/:id - Obtener una Localidad por ID
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de localidad inválido.' });
        }
        const localidad = await LocationService.findById(id);
        if (!localidad || !localidad.activo) { // Asumo que tienes un campo 'activo'
            return res.status(404).json({ message: 'Locality not found or not active.' });
        }
        return res.status(200).json(localidad);
    } catch (error: any) {
        handleLocalityError(res, error);
    }
});


// ======================================================================================
// Rutas de Escritura (POST, PUT, DELETE, PATCH) - Requieren ADMIN
// NOTA: 'PATCH /reactivate/:id' va antes de '/:id' para evitar conflictos de enrutamiento.
// ======================================================================================

// PATCH /api/localidades/reactivate/:id - Reactivar una Localidad (ADMIN)
router.patch('/reactivate/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de localidad inválido.' });
        }
        const reactivatedLocalidad = await LocationService.reactivate(id);
        if (!reactivatedLocalidad) {
            return res.status(404).json({ message: 'Locality not found or already active.' });
        }
        return res.status(200).json({ message: 'Locality reactivated successfully', locality: reactivatedLocalidad });
    } catch (error: any) {
        handleLocalityError(res, error);
    }
});

// POST /api/localidades - Crear una nueva Localidad (ADMIN)
router.post('/', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{}, {}, CreateLocalidadPayload>, res: Response) => {
    try {
        const localidadData: CreateLocalidadPayload = req.body;
        if (!localidadData.nombre || localidadData.provinciaId === undefined) {
            return res.status(400).json({ message: 'Missing required fields: nombre and provinciaId.' });
        }
        const newLocalidad = await LocationService.create(localidadData);
        return res.status(201).json(newLocalidad);
    } catch (error: any) {
        handleLocalityError(res, error);
    }
});

// PUT /api/localidades/:id - Actualizar una Localidad (ADMIN)
router.put('/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }, {}, UpdateLocalidadPayload>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de localidad inválido.' });
        }
        const localidadData: UpdateLocalidadPayload = req.body;
        if (Object.keys(localidadData).length === 0) {
            return res.status(400).json({ message: 'No data provided for update.' });
        }
        const updatedLocalidad = await LocationService.update(id, localidadData);
        if (!updatedLocalidad) {
            return res.status(404).json({ message: 'Locality not found or not active.' });
        }
        return res.status(200).json(updatedLocalidad);
    } catch (error: any) {
        handleLocalityError(res, error);
    }
});

// DELETE /api/localidades/:id - Desactivar (soft delete) una Localidad (ADMIN)
router.delete('/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de localidad inválido.' });
        }
        const deletedLocalidad = await LocationService.delete(id);
        if (!deletedLocalidad) {
            return res.status(404).json({ message: 'Locality not found or already deactivated.' });
        }
        return res.status(200).json({ message: 'Locality deactivated successfully', locality: deletedLocalidad });
    } catch (error: any) {
        handleLocalityError(res, error);
    }
});


export default router;