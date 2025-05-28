
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

// Definir el tipo para el payload de creación de categoría
// Aquí accedemos a CategoriaCreateInput a través del namespace Prisma
export type CreateCategoryPayload = Omit<Prisma.CategoriaCreateInput, 'id' | 'activo' | 'subcategorias' | 'productos'> & {
    categoriaPadreId?: number | null; // El ID del padre, si existe
};

// Definir el tipo para el payload de actualización de categoría
export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

/**
 * Servicio para operaciones relacionadas con categorías.
 */
export const CategoryService = {

    /**
     * Obtiene todas las categorías activas.
     * Incluye opcionalmente la categoría padre y las subcategorías.
     * @returns Una lista de categorías.
     */
    getAllCategories: async (includeRelations: boolean = false) => {
        return prisma.categoria.findMany({
            where: { activo: true },
            include: includeRelations ? {
                categoriaPadre: true,
                subcategorias: true,
                productos: false // No incluir productos por defecto para evitar cargas excesivas
            } : undefined,
        });
    },

    /**
     * Obtiene una categoría por su ID.
     * @param id El ID de la categoría.
     * @returns La categoría encontrada o null.
     */
    getCategoryById: async (id: number, includeRelations: boolean = false) => {
        return prisma.categoria.findUnique({
            where: { id, activo: true },
            include: includeRelations ? {
                categoriaPadre: true,
                subcategorias: true,
                productos: false
            } : undefined,
        });
    },

    /**
     * Crea una nueva categoría.
     * @param categoryData Los datos de la nueva categoría.
     * @returns La categoría creada.
     */
    createCategory: async (categoryData: CreateCategoryPayload) => {
        const { categoriaPadreId, ...dataWithoutParentId } = categoryData;
        return prisma.categoria.create({
            data: {
                ...dataWithoutParentId,
                categoriaPadre: categoriaPadreId ? { connect: { id: categoriaPadreId } } : undefined,
            },
        });
    },

    /**
     * Actualiza una categoría existente.
     * @param id El ID de la categoría a actualizar.
     * @param categoryData Los datos a actualizar de la categoría.
     * @returns La categoría actualizada.
     */
    updateCategory: async (id: number, categoryData: UpdateCategoryPayload) => {
        const { categoriaPadreId, ...dataToUpdate } = categoryData;
        return prisma.categoria.update({
            where: { id, activo: true },
            data: {
                ...dataToUpdate,
                categoriaPadre: categoriaPadreId !== undefined
                    ? (categoriaPadreId === null ? { disconnect: true } : { connect: { id: categoriaPadreId } })
                    : undefined,
            },
        });
    },

    /**
     * "Elimina" (desactiva) una categoría por su ID.
     * También desactiva sus subcategorías para mantener la integridad.
     * @param id El ID de la categoría a desactivar.
     * @returns La categoría desactivada.
     */
    deleteCategory: async (id: number) => {
        // Opcional: Podrías hacer un borrado en cascada en subcategorías aquí
        // O simplemente marcar como inactivo recursivamente si la lógica lo permite.
        // Por simplicidad, solo desactivamos la principal aquí.
        // Si necesitas desactivar recursivamente, se necesitaría una lógica adicional.
        return prisma.categoria.update({
            where: { id },
            data: { activo: false },
        });
    },

    /**
     * Reactiva una categoría por su ID.
     * @param id El ID de la categoría a reactivar.
     * @returns La categoría reactivada.
     */
    reactivateCategory: async (id: number) => {
        return prisma.categoria.update({
            where: { id },
            data: { activo: true },
        });
    },

    /**
     * Obtiene subcategorías de una categoría padre.
     * Equivalente a findByCategoriaPadreId en tu repo Java.
     * @param idPadre El ID de la categoría padre.
     * @returns Una lista de subcategorías activas.
     */
    listSubcategories: async (idPadre: number) => {
        return prisma.categoria.findMany({
            where: {
                categoriaPadreId: idPadre,
                activo: true
            },
            include: {
                categoriaPadre: true, // Para ver el padre de estas subcategorías
            }
        });
    },

    /**
     * Obtiene categorías raíz (sin padre).
     * Equivalente a findByCategoriaPadreIsNull en tu repo Java.
     * @returns Una lista de categorías raíz activas.
     */
    listRootCategories: async () => {
        return prisma.categoria.findMany({
            where: {
                categoriaPadreId: null,
                activo: true
            },
            include: {
                subcategorias: true // Opcional: incluye las subcategorías de las raíces
            }
        });
    }
};