// src/routes/imagen.routes.ts

import { Router, Request, Response } from 'express';
import { ImagenService } from '../services/imagen.service'; // Asegúrate de que la ruta sea correcta
import { CreateImagenPayload, UpdateImagenPayload } from '../types/imagen.d'; // Asegúrate de que la ruta sea correcta
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Importar middlewares de autenticación y autorización
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware'; // Ajusta la ruta si es necesario
import { Rol } from '@prisma/client'; // Importa el enum Rol de Prisma si lo usas para los roles

const router = Router();

// ======================================================================================
// Helper para manejo de errores
// ======================================================================================
const handleImageError = (res: Response, error: any) => {
    console.error('Error en la ruta de imágenes:', error);
    if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') { // Registro no encontrado para update/delete/findById
            return res.status(404).json({ message: 'Imagen no encontrada o inactiva.', error: error.message });
        }
        if (error.code === 'P2003') { // Foreign key constraint failed (ej. productoId no existe)
            return res.status(400).json({ message: `Violación de restricción de clave externa. Verifica los IDs relacionados (e.g., productoId).`, error: error.message });
        }
        if (error.code === 'P2002') { // Violación de unicidad (ej. si 'denominacion' URL debe ser única)
            return res.status(409).json({ message: 'Ya existe una imagen con esa denominación (URL).', error: error.message });
        }
    }
    // Errores de validación o lógicos desde el servicio
    if (error.message.includes('Missing required field')) {
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

// GET /api/imagen - Obtener todas las Imágenes (Solo ADMINS para listar todas, o públicas si solo son activas)
// Si solo queremos listar imágenes activas y que sea público:
router.get('/', async (req: Request, res: Response) => {
    try {
        
        const includeInactive = req.query.includeInactive === 'true'; // Opcional, solo si tu service lo soporta
        const images = await ImagenService.findAll(includeInactive); // Asumiendo que ImagenService.findAll existe y filtra por activo por defecto
        return res.status(200).json(images);
    } catch (error: any) {
        handleImageError(res, error);
    }
});


// GET /api/imagen/:id - Obtener una Imagen por ID
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de imagen inválido.' });
        }
        const image = await ImagenService.findById(id);
        if (!image || !image.activo) { // Asumo que tienes un campo 'activo' en tu modelo Imagen
            return res.status(404).json({ message: 'Image not found or not active.' });
        }
        return res.status(200).json(image);
    } catch (error: any) {
        handleImageError(res, error);
    }
});

// ======================================================================================
// Rutas de Escritura (POST, PUT, DELETE, PATCH) - Requieren ADMIN
// NOTA: 'PATCH /reactivate/:id' va antes de '/:id' para evitar conflictos de enrutamiento.
// ======================================================================================

// PATCH /api/imagen/reactivate/:id - Reactivar una Imagen (ADMIN)
router.patch('/reactivate/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de imagen inválido.' });
        }
        const reactivatedImage = await ImagenService.reactivate(id);
        if (!reactivatedImage) {
            return res.status(404).json({ message: 'Image not found or already active.' });
        }
        return res.status(200).json({ message: 'Image reactivated successfully', image: reactivatedImage });
    } catch (error: any) {
        handleImageError(res, error);
    }
});

// POST /api/imagen - Crear una nueva Imagen (ADMIN)
router.post('/', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{}, {}, CreateImagenPayload>, res: Response) => {
    try {
        const imageData: CreateImagenPayload = req.body;
        if (!imageData.denominacion) {
            return res.status(400).json({ message: 'Missing required field: denominacion (image URL).' });
        }
        const newImage = await ImagenService.create(imageData);
        return res.status(201).json(newImage);
    } catch (error: any) {
        handleImageError(res, error);
    }
});

// PUT /api/imagen/:id - Actualizar una Imagen (ADMIN)
router.put('/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }, {}, UpdateImagenPayload>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de imagen inválido.' });
        }
        const imageData: UpdateImagenPayload = req.body;
        if (Object.keys(imageData).length === 0) {
            return res.status(400).json({ message: 'No data provided for update.' });
        }
        const updatedImage = await ImagenService.update(id, imageData);
        if (!updatedImage) {
            return res.status(404).json({ message: 'Image not found or not active.' });
        }
        return res.status(200).json(updatedImage);
    } catch (error: any) {
        handleImageError(res, error);
    }
});

// DELETE /api/imagen/:id - Desactivar (soft delete) una Imagen (ADMIN)
router.delete('/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de imagen inválido.' });
        }
        const deletedImage = await ImagenService.delete(id);
        if (!deletedImage) {
            return res.status(404).json({ message: 'Image not found or already deactivated.' });
        }
        return res.status(200).json({ message: 'Image deactivated successfully', image: deletedImage });
    } catch (error: any) {
        handleImageError(res, error);
    }
});

export default router;