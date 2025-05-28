// src/routes/category.routes.ts

import { Router, Request, Response } from 'express';
import { CategoryService, CreateCategoryPayload, UpdateCategoryPayload } from '../services/category.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'; // Importado correctamente

// Importar middlewares de autenticación y autorización
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware'; // Ajusta la ruta si es necesario
import { Rol } from '@prisma/client'; // Importa el enum Rol de Prisma si lo usas para los roles


const router = Router();

// ======================================================================================
// Helper para manejo de errores (similar al de direcciones para consistencia)
// ======================================================================================
const handleCategoryError = (res: Response, error: any) => {
    console.error('Error en la ruta de categorías:', error);
    if (error instanceof PrismaClientKnownRequestError) {
        // Errores específicos de Prisma
        if (error.code === 'P2025') { // Registro no encontrado para update/delete o relación no encontrada
            return res.status(404).json({ message: 'Categoría o relación asociada no encontrada.', error: error.message });
        }
        if (error.code === 'P2002') { // Violación de restricción única (ej. denominación duplicada)
            return res.status(409).json({ message: 'La categoría con esa denominación ya existe.', error: error.message });
        }
        // Puedes añadir más códigos de error de Prisma si los necesitas
    }
    // Errores personalizados o genéricos del servicio
    if (error.message.includes('not found') || error.message.includes('no encontrada')) {
        return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('inválido') || error.message.includes('Missing required field') || error.message.includes('No data provided')) {
        return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('already deactivated') || error.message.includes('already active')) {
        return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error interno del servidor.', error: error.message });
};

// ======================================================================================
// Rutas de Lectura (GET) - Generalmente públicas en un e-commerce
// ======================================================================================

// GET /api/categories - Listar todas las categorías
router.get('/', async (req: Request, res: Response) => {
    try {
        const includeRelations = req.query.include === 'true';
        const categories = await CategoryService.getAllCategories(includeRelations);
        return res.status(200).json(categories);
    } catch (error: any) {
        handleCategoryError(res, error);
    }
});

// GET /api/categories/:id - Obtener una categoría por ID
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de categoría inválido.' });
        }
        const includeRelations = req.query.include === 'true';
        const category = await CategoryService.getCategoryById(id, includeRelations);
        if (!category || !category.activo) { // Suponiendo que tienes un campo 'activo' en Category
            return res.status(404).json({ message: 'Category not found or inactive.' });
        }
        return res.status(200).json(category);
    } catch (error: any) {
        handleCategoryError(res, error);
    }
});

// GET /api/categories/root - Listar categorías raíz
// NOTA: Colocada antes de /:id para que no sea interpretada como un ID.
router.get('/root', async (req: Request, res: Response) => {
    try {
        const rootCategories = await CategoryService.listRootCategories();
        return res.status(200).json(rootCategories);
    } catch (error: any) {
        handleCategoryError(res, error);
    }
});

// GET /api/categories/:id/subcategories - Listar subcategorías de una categoría
router.get('/:id/subcategories', async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de categoría inválido.' });
        }
        const subcategories = await CategoryService.listSubcategories(id);
        return res.status(200).json(subcategories);
    } catch (error: any) {
        handleCategoryError(res, error);
    }
});

// ======================================================================================
// Rutas de Escritura (POST, PUT, DELETE, PATCH) - Requieren ADMIN
// ======================================================================================

// POST /api/categories - Crear una nueva categoría
router.post('/', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{}, {}, CreateCategoryPayload>, res: Response) => {
    try {
        const categoryData: CreateCategoryPayload = req.body;
        if (!categoryData.denominacion) {
            return res.status(400).json({ message: 'Missing required field: denominacion.' });
        }
        const newCategory = await CategoryService.createCategory(categoryData);
        return res.status(201).json(newCategory);
    } catch (error: any) {
        handleCategoryError(res, error);
    }
});

// PUT /api/categories/:id - Actualizar una categoría
router.put('/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }, {}, UpdateCategoryPayload>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de categoría inválido.' });
        }
        const categoryData: UpdateCategoryPayload = req.body;
        if (Object.keys(categoryData).length === 0) {
            return res.status(400).json({ message: 'No data provided for update.' });
        }
        const updatedCategory = await CategoryService.updateCategory(id, categoryData);
        if (!updatedCategory) {
            return res.status(404).json({ message: 'Category not found or not active.' });
        }
        return res.status(200).json(updatedCategory);
    } catch (error: any) {
        handleCategoryError(res, error);
    }
});

// DELETE (soft delete) /api/categories/:id - Desactivar una categoría
router.delete('/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de categoría inválido.' });
        }
        const deactivatedCategory = await CategoryService.deleteCategory(id);
        if (!deactivatedCategory) {
            return res.status(404).json({ message: 'Category not found or already deactivated.' });
        }
        return res.status(200).json({ message: 'Category deactivated successfully', category: deactivatedCategory });
    } catch (error: any) {
        handleCategoryError(res, error);
    }
});

// PATCH /api/categories/reactivate/:id - Reactivar una categoría
// NOTA: Colocada antes de /:id para que no sea interpretada como un ID.
router.patch('/reactivate/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID de categoría inválido.' });
        }
        const reactivatedCategory = await CategoryService.reactivateCategory(id);
        if (!reactivatedCategory) {
            return res.status(404).json({ message: 'Category not found or already active.' });
        }
        return res.status(200).json({ message: 'Category reactivated successfully', category: reactivatedCategory });
    } catch (error: any) {
        handleCategoryError(res, error);
    }
});


export default router;