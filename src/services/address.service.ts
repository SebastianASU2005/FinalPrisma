

import prisma from '../config/prisma'; // Importa la instancia de PrismaClient
import { Prisma } from '@prisma/client'; // Importa el namespace Prisma para tipos
import { CreateDireccionPayload, UpdateDireccionPayload } from '../types/direccion.d';

export const AddressService = {

    /**
     * Crea una nueva Direccion.
     * @param data Los datos para crear la Direccion.
     * @returns La Direccion creada.
     */
    create: async (data: CreateDireccionPayload) => {
        // Validar que la Localidad exista
        const localidad = await prisma.localidad.findUnique({ where: { id: data.localidadId, activo: true } });
        if (!localidad) {
            throw new Error(`Localidad con ID ${data.localidadId} no encontrada o inactiva.`);
        }

        // Validar que el Usuario exista si se proporciona
        if (data.usuarioId) {
            const usuario = await prisma.usuario.findUnique({ where: { id: data.usuarioId, activo: true } });
            if (!usuario) {
                throw new Error(`Usuario con ID ${data.usuarioId} no encontrado o inactivo.`);
            }
        }

        return prisma.direccion.create({
            data: {
                calle: data.calle,
                numero: data.numero,
                piso: data.piso,
                departamento: data.departamento,
                cp: data.cp,
                activo: true, // Se crea como activa por defecto
                localidad: {
                    connect: { id: data.localidadId }
                },
                ...(data.usuarioId !== undefined && data.usuarioId !== null && { // Si usuarioId existe y no es null, conecta
                    usuario: {
                        connect: { id: data.usuarioId }
                    }
                }),
                // La lógica 'disconnect' no va en 'create'.
                // Un usuario puede ser opcional (null) al crear, pero no se "desconecta".
                // Si 'usuarioId' puede ser null al crear, simplemente no lo incluyas en 'connect'.
            },
            include: { // Incluir las relaciones para la respuesta
                localidad: true,
                usuario: true,
            }
        });
    },

    /**
     * Busca una Direccion por su ID.
     * @param id El ID de la Direccion.
     * @returns La Direccion encontrada o null.
     */
    findById: async (id: number) => {
        return prisma.direccion.findUnique({
            where: {
                id,
                activo: true,
            },
            include: {
                localidad: true,
                usuario: true,
            }
        });
    },

    /**
     * Actualiza una Direccion existente.
     * @param id El ID de la Direccion a actualizar.
     * @param data Los datos a actualizar.
     * @returns La Direccion actualizada.
     */
    update: async (id: number, data: UpdateDireccionPayload) => {
        // Inicializa updateData con los campos que pueden venir en el payload y son opcionales
        const updateData: Prisma.DireccionUpdateInput = {
            // Solo incluye las propiedades si están definidas en 'data'
            ...(data.calle !== undefined && { calle: data.calle }),
            ...(data.numero !== undefined && { numero: data.numero }),
            ...(data.piso !== undefined && { piso: data.piso }),
            ...(data.departamento !== undefined && { departamento: data.departamento }),
            ...(data.cp !== undefined && { cp: data.cp }),
            ...(data.activo !== undefined && { activo: data.activo }), // Ahora 'activo' se maneja correctamente
        };

        // Manejo de la relación con Localidad
        if (data.localidadId !== undefined) {
            const localidad = await prisma.localidad.findUnique({ where: { id: data.localidadId, activo: true } });
            if (!localidad) {
                throw new Error(`Localidad con ID ${data.localidadId} no encontrada o inactiva.`);
            }
            updateData.localidad = { connect: { id: data.localidadId } };
        }

        // Manejo de la relación con Usuario (permite conectar, desconectar o dejar como está)
        if (data.usuarioId !== undefined) { // Check if usuarioId is provided at all
            if (data.usuarioId === null) {
                updateData.usuario = { disconnect: true }; // Desconectar si se envía null
            } else {
                const usuario = await prisma.usuario.findUnique({ where: { id: data.usuarioId, activo: true } });
                if (!usuario) {
                    throw new Error(`Usuario con ID ${data.usuarioId} no encontrado o inactivo.`);
                }
                updateData.usuario = { connect: { id: data.usuarioId } };
            }
        }

        return prisma.direccion.update({
            where: {
                id,
                activo: true, // Solo permite actualizar si está activa
            },
            data: updateData,
            include: {
                localidad: true,
                usuario: true,
            }
        });
    },

    /**
     * Desactiva (soft delete) una Direccion.
     * @param id El ID de la Direccion a desactivar.
     * @returns La Direccion desactivada.
     */
    delete: async (id: number) => {
        return prisma.direccion.update({
            where: { id },
            data: { activo: false },
        });
    },

    /**
     * Reactiva una Direccion previamente desactivada.
     * @param id El ID de la Direccion a reactivar.
     * @returns La Direccion reactivada.
     */
    reactivate: async (id: number) => {
        return prisma.direccion.update({
            where: { id },
            data: { activo: true },
        });
    },

    /**
     * Obtiene una lista de Direcciones por el ID de la Localidad.
     * @param idLocalidad El ID de la Localidad.
     * @returns Una lista de Direccion.
     */
    listarPorLocalidad: async (idLocalidad: number) => {
        return prisma.direccion.findMany({
            where: {
                localidadId: idLocalidad,
                activo: true,
            },
            include: {
                localidad: true,
                usuario: true,
            }
        });
    },

    /**
     * Obtiene una lista de Direcciones por el ID del Usuario.
     * Reemplaza `findAllByClientesAndId` para ser coherente con la entidad `Usuario`.
     * @param idUsuario El ID del Usuario.
     * @returns Una lista de Direccion.
     */
    listarPorUsuarioId: async (idUsuario: number) => {
        return prisma.direccion.findMany({
            where: {
                usuarioId: idUsuario,
                activo: true,
            },
            include: {
                localidad: true,
                usuario: true,
            }
        });
    },
     findAll: async (includeInactive: boolean = false) => {
        return prisma.direccion.findMany({
            where: {
                activo: includeInactive ? undefined : true, // Si includeInactive es true, no filtra por activo
            },
            include: {
                localidad: true,
                usuario: true,
            },
        });
    },
};