// src/services/province.service.ts

import { Prisma, Provincia } from '@prisma/client';
import prisma from '../config/prisma'; // Asegúrate de que esta ruta sea correcta
import { CreateProvinciaPayload, UpdateProvinciaPayload, ProvinciaDTO } from '../types/provincia.d';

// ==============================================================================
// SERVICIO DE PROVINCIA
// ==============================================================================

export const ProvinceService = {

    // ==============================================================================
    // Métodos de Mapeo a DTOs (opcional, si necesitas un DTO más simple)
    // ==============================================================================
    // En este caso, el DTO es casi idéntico a la entidad Prisma, pero lo mantenemos
    // por consistencia y para futuras expansiones (ej. campos calculados, omisión de campos).
    mapearProvinciaADTO: (provincia: Provincia): ProvinciaDTO => {
        if (!provincia) {
            // Esto es más un caso de uso defensivo, el servicio no debería recibir 'null' si es una función de mapeo
            throw new Error("Provincia no encontrada para mapeo DTO.");
        }
        return {
            id: provincia.id,
            nombre: provincia.nombre,
            activo: provincia.activo,
        };
    },

    // ==============================================================================
    // Operaciones CRUD
    // ==============================================================================

    /**
     * Crea una nueva provincia.
     * @param provinciaData Los datos para crear la provincia.
     * @returns La provincia creada.
     */
    create: async (provinciaData: CreateProvinciaPayload): Promise<Provincia> => {
        try {
            return await prisma.provincia.create({
                data: {
                    ...provinciaData,
                    activo: true, // Por defecto, una nueva provincia es activa
                },
            });
        } catch (error) {
            // Re-lanzar el error para que el controlador pueda manejarlo (ej. P2002 para unique constraint)
            throw error;
        }
    },

    /**
     * Obtiene todas las provincias activas.
     * @returns Un array de provincias.
     */
    findAll: async (): Promise<Provincia[]> => {
        return prisma.provincia.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' }, // Opcional: ordenar por nombre
        });
    },

    /**
     * Obtiene una provincia por su ID.
     * @param id El ID de la provincia.
     * @returns La provincia encontrada o null si no existe o no está activa.
     */
    findById: async (id: number): Promise<Provincia | null> => {
        return prisma.provincia.findUnique({
            where: { id, activo: true },
        });
    },

    /**
     * Obtiene una provincia por su nombre (búsqueda insensible a mayúsculas/minúsculas).
     * @param nombre El nombre de la provincia.
     * @returns La provincia encontrada o null si no existe o no está activa.
     */
    findByNombre: async (nombre: string): Promise<Provincia | null> => {
        return prisma.provincia.findFirst({ // findFirst en lugar de findUnique si el nombre no es único
            where: {
                nombre: {
                    equals: nombre,
                    mode: 'insensitive', // Para búsqueda insensible a mayúsculas/minúsculas
                } as Prisma.StringFilter, // <-- CORRECCIÓN APLICADA AQUÍ
                activo: true,
            },
        });
    },

    /**
     * Actualiza una provincia existente.
     * @param id El ID de la provincia a actualizar.
     * @param provinciaData Los datos a actualizar.
     * @returns La provincia actualizada o null si no se encontró.
     */
    update: async (id: number, provinciaData: UpdateProvinciaPayload): Promise<Provincia | null> => {
        try {
            return await prisma.provincia.update({
                where: { id, activo: true },
                data: provinciaData,
            });
        } catch (error) {
            // PrismaClientKnownRequestError con código P2025 para "record not found"
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return null; // No se encontró la provincia activa
            }
            throw error; // Re-lanza otros errores que no son de "not found"
        }
    },

    /**
     * Desactiva (soft delete) una provincia.
     * @param id El ID de la provincia a desactivar.
     * @returns La provincia desactivada o null si no se encontró.
     */
    delete: async (id: number): Promise<Provincia | null> => {
        try {
            return await prisma.provincia.update({
                where: { id, activo: true }, // Solo desactiva si está activa
                data: { activo: false },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return null; // No se encontró la provincia activa
            }
            throw error;
        }
    },

    /**
     * Reactiva una provincia previamente desactivada.
     * @param id El ID de la provincia a reactivar.
     * @returns La provincia reactivada o null si no se encontró.
     */
    reactivate: async (id: number): Promise<Provincia | null> => {
        try {
            // Encuentra la provincia, incluso si está inactiva, para reactivar
            const provincia = await prisma.provincia.findUnique({ where: { id } });
            if (!provincia) {
                return null; // La provincia no existe en absoluto
            }
            if (provincia.activo) {
                // Si ya está activa, no hace falta actualizar la DB de nuevo.
                // Podrías devolver la provincia existente o null si prefieres una indicación de que no hubo cambio.
                return provincia;
            }

            return await prisma.provincia.update({
                where: { id }, // No verificamos `activo: false` aquí, ya que el `findUnique` previo ya lo hizo
                data: { activo: true },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return null; // Esto no debería ocurrir si se encontró previamente, pero es una buena práctica
            }
            throw error;
        }
    },
};