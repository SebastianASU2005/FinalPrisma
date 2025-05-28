// src/services/location.service.ts

import prisma from '../config/prisma'; // Asegúrate de que la ruta a tu instancia de PrismaClient sea correcta
import { Prisma } from '@prisma/client'; // Importa el namespace Prisma para tipos específicos
import { CreateLocalidadPayload, UpdateLocalidadPayload } from '../types/localidad.d'; // Asegúrate de que la ruta sea correcta

export const LocationService = {

    /**
     * Crea una nueva Localidad.
     * Valida que la provinciaId exista antes de crear.
     * @param data Los datos para crear la Localidad (nombre, provinciaId).
     * @returns La Localidad creada (tipo de Prisma).
     * @throws Error si la provincia no es encontrada.
     */
    create: async (data: CreateLocalidadPayload) => {
        // Validación adicional: asegurar que la provinciaId existe
        const provinciaExists = await prisma.provincia.findUnique({ where: { id: data.provinciaId } });
        if (!provinciaExists) {
            throw new Error('Provincia no encontrada.'); // Lanza un error que el manejador de rutas pueda capturar
        }

        return prisma.localidad.create({
            data: {
                nombre: data.nombre,
                activo: true, // Siempre se crea como activo
                provincia: {
                    connect: { id: data.provinciaId } // Conecta con la provincia existente
                }
            },
        });
    },

    /**
     * Busca una Localidad por su ID.
     * @param id El ID de la Localidad.
     * @returns La Localidad encontrada (tipo de Prisma) o null si no existe o no está activa.
     */
    findById: async (id: number) => {
        return prisma.localidad.findUnique({
            where: {
                id,
                activo: true, // Solo busca localidades activas
            },
            include: {
                provincia: true, // Incluir la provincia asociada
            }
        });
    },

    /**
     * Obtiene una lista de todas las Localidades.
     * Opcionalmente puede incluir localidades inactivas.
     * @param includeInactive Si es true, incluye imágenes inactivas. Por defecto es false.
     * @returns Una lista de Localidades.
     */
    findAll: async (includeInactive: boolean = false) => {
        return prisma.localidad.findMany({
            where: {
                activo: includeInactive ? undefined : true, // Filtra por activo a menos que se pida incluir inactivos
            },
            include: {
                provincia: true, // Incluir la provincia asociada
            }
        });
    },

    /**
     * Obtiene una lista de Localidades por ID de Provincia.
     * Solo devuelve localidades activas.
     * @param provinciaId El ID de la Provincia.
     * @returns Una lista de Localidades activas de esa provincia.
     * @throws Error si la provincia no es encontrada.
     */
    findByProvinciaId: async (provinciaId: number) => {
        // Opcional: Verificar si la provincia existe primero para un error más claro
        const provinciaExists = await prisma.provincia.findUnique({ where: { id: provinciaId } });
        if (!provinciaExists) {
            throw new Error('Provincia no encontrada.');
        }

        return prisma.localidad.findMany({
            where: {
                provinciaId: provinciaId,
                activo: true, // Solo localidades activas de esa provincia
            },
            include: {
                provincia: true, // Incluir la provincia asociada
            }
        });
    },

    /**
     * Actualiza una Localidad existente.
     * Permite actualizar el nombre y/o reasignar a una nueva provincia.
     * @param id El ID de la Localidad a actualizar.
     * @param data Los datos a actualizar (nombre, provinciaId).
     * @returns La Localidad actualizada (tipo de Prisma).
     * @throws Error si la localidad no es encontrada/activa o si la nueva provincia no existe.
     */
    update: async (id: number, data: UpdateLocalidadPayload) => {
        const updateData: Prisma.LocalidadUpdateInput = {}; // Objeto para construir los datos de actualización

        // Solo actualiza 'nombre' si está presente en el payload
        if (data.nombre !== undefined) {
            updateData.nombre = data.nombre;
        }

        // Maneja la actualización de 'provinciaId' si está presente en el payload
        if (data.provinciaId !== undefined) {
            // Dado que 'provinciaId' es un campo REQUERIDO en tu schema.prisma,
            // no se puede asignar un valor nulo.
            if (data.provinciaId === null) {
                // Si se intenta pasar null, lanzamos un error explícito.
                throw new Error('No se puede asignar un valor nulo a la provincia, ya que es un campo requerido para la Localidad.');
            } else {
                // Si se proporciona un ID de provincia, verificar que exista.
                const newProvinciaExists = await prisma.provincia.findUnique({ where: { id: data.provinciaId } });
                if (!newProvinciaExists) {
                    throw new Error('Nueva provincia no encontrada para actualizar.');
                }
                updateData.provincia = { connect: { id: data.provinciaId } }; // Conecta a la nueva provincia
            }
        }

        try {
            return await prisma.localidad.update({
                where: {
                    id,
                    activo: true, // Solo permite actualizar si la localidad está activa
                },
                data: updateData,
            });
        } catch (error) {
            // Captura errores específicos de Prisma, como si el registro no es encontrado
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new Error('Localidad no encontrada o inactiva para actualizar.');
            }
            throw error; // Re-lanza cualquier otro error inesperado
        }
    },

    /**
     * Desactiva (realiza un borrado lógico) una Localidad.
     * Solo desactiva si la localidad está actualmente activa.
     * @param id El ID de la Localidad a desactivar.
     * @returns La Localidad desactivada (tipo de Prisma).
     * @throws Error si la localidad no es encontrada o ya está inactiva.
     */
    delete: async (id: number) => {
        try {
            return await prisma.localidad.update({
                where: {
                    id,
                    activo: true, // Solo permite desactivar si está activa
                },
                data: {
                    activo: false, // Establece 'activo' a false
                },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new Error('Localidad no encontrada o ya desactivada.');
            }
            throw error;
        }
    },

    /**
     * Reactiva una Localidad previamente desactivada.
     * Solo reactiva si la localidad está actualmente inactiva.
     * @param id El ID de la Localidad a reactivar.
     * @returns La Localidad reactivada (tipo de Prisma).
     * @throws Error si la localidad no es encontrada o ya está activa.
     */
    reactivate: async (id: number) => {
        try {
            return await prisma.localidad.update({
                where: {
                    id,
                    activo: false, // Solo permite reactivar si está inactiva
                },
                data: { activo: true }, // Establece 'activo' a true
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new Error('Localidad no encontrada o ya está activa.');
            }
            throw error;
        }
    },
};