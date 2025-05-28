// src/services/imagen.service.ts

import prisma from '../config/prisma'; // Importa la instancia de PrismaClient
import { Prisma } from '@prisma/client'; // Importa el namespace Prisma para tipos
import { CreateImagenPayload, UpdateImagenPayload } from '../types/imagen.d';

export const ImagenService = {

    /**
     * Crea una nueva Imagen.
     * @param data Los datos para crear la Imagen.
     * @returns La Imagen creada (tipo de Prisma).
     */
    create: async (data: CreateImagenPayload) => {
        return prisma.imagen.create({
            data: {
                denominacion: data.denominacion,
                activo: true, // Asegura que se crea como activo
                // Si productoId está presente, conecta la imagen con el producto
                ...(data.productoId && {
                    producto: {
                        connect: { id: data.productoId }
                    }
                }),
            },
        });
    },

    /**
     * Busca una Imagen por su ID.
     * @param id El ID de la Imagen.
     * @returns La Imagen encontrada (tipo de Prisma) o null si no existe o no está activa.
     */
    findById: async (id: number) => {
        return prisma.imagen.findUnique({
            where: {
                id,
                activo: true, // Solo busca activos
            },
            include: {
                producto: true, // Opcional: Incluir el producto asociado
                usuario: true, // Opcional: Incluir el usuario asociado (si la FK de usuario apunta a esta imagen)
            }
        });
    },

    /**
     * Obtiene una lista de todas las Imágenes activas (o todas si se especifica).
     * @param includeInactive Si es true, incluye imágenes inactivas. Por defecto es false.
     * @returns Una lista de Imágenes.
     */
    findAll: async (includeInactive: boolean = false) => { // <--- ¡MÉTODO AÑADIDO AQUÍ!
        return prisma.imagen.findMany({
            where: {
                activo: includeInactive ? undefined : true, // Si includeInactive es true, no filtra por activo
            },
            include: {
                producto: true, // Incluir el producto asociado
                usuario: true, // Incluir el usuario asociado (si la FK de usuario apunta a esta imagen)
            }
        });
    },

    /**
     * Actualiza una Imagen existente.
     * @param id El ID de la Imagen a actualizar.
     * @param data Los datos a actualizar.
     * @returns La Imagen actualizada (tipo de Prisma).
     */
    update: async (id: number, data: UpdateImagenPayload) => {
        const updateData: Prisma.ImagenUpdateInput = {
            denominacion: data.denominacion,
        };

        // Si se proporciona productoId en la actualización:
        if (data.productoId !== undefined) {
            updateData.producto = data.productoId === null // Si se pasa null, desconectar
                ? { disconnect: true }
                : { connect: { id: data.productoId } };
        } else if (data.productoId === null) {
            // Esto permite explícitamente desconectar el producto si se envía productoId: null
            updateData.producto = { disconnect: true };
        }


        return prisma.imagen.update({
            where: {
                id,
                activo: true, // Solo permite actualizar si está activa
            },
            data: updateData,
        });
    },

    /**
     * Desactiva (soft delete) una Imagen.
     * @param id El ID de la Imagen a desactivar.
     * @returns La Imagen desactivada (tipo de Prisma).
     */
    delete: async (id: number) => {
        return prisma.imagen.update({
            where: {
                id,
            },
            data: {
                activo: false,
            },
        });
    },

    /**
     * Reactiva una Imagen previamente desactivada.
     * @param id El ID de la Imagen a reactivar.
     * @returns La Imagen reactivada (tipo de Prisma).
     */
    reactivate: async (id: number) => {
        return prisma.imagen.update({
            where: { id },
            data: { activo: true },
        });
    },

    // Métodos de búsqueda específicos (si los hubiera en el repositorio Java)
    // Ya que el repo Java era básico, no hay métodos específicos aquí más allá del CRUD.
};