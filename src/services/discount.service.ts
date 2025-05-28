

import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { CreateDescuentoPayload, UpdateDescuentoPayload } from '../types/descuento.d';

// Helper para formatear una hora de Date a HH:MM:SS string
// Esto es necesario porque Prisma devuelve Date para @db.Time(3)
const formatTimeForValidation = (date: Date): string => {
    // Convierte el objeto Date a un string de hora en formato HH:MM:SS
    // Por ejemplo, de 'Mon May 26 2025 10:30:00 GMT-0300 (Argentina Standard Time)' a '10:30:00'
    return date.toTimeString().split(' ')[0];
};

export const DiscountService = {

    /**
     * Valida los datos de un descuento antes de crear o actualizar.
     * @param data Los datos del descuento.
     * @throws Error con un mensaje descriptivo si la validación falla.
     */
    private_validarDescuento: (data: {
        denominacion?: string;
        fechaDesde?: string;
        fechaHasta?: string;
        horaDesde?: string; // Esperamos string para la validación
        horaHasta?: string; // Esperamos string para la validación
        descripcionDescuento?: string | null; // Acepta string o null
        precioPromocional?: number;
        activo?: boolean;
    }) => {
        if (data.denominacion !== undefined && data.denominacion.trim() === '') {
            throw new Error("La denominación no puede estar vacía.");
        }

        if (data.precioPromocional !== undefined && (data.precioPromocional === null || data.precioPromocional <= 0)) {
            throw new Error("El precio promocional debe ser mayor a 0.");
        }

        // Validación de fechas
        if (data.fechaDesde && data.fechaHasta) {
            const fechaDesde = new Date(data.fechaDesde);
            const fechaHasta = new Date(data.fechaHasta);
            // Asegurarse de comparar solo las fechas, ignorando la hora
            fechaDesde.setHours(0, 0, 0, 0);
            fechaHasta.setHours(0, 0, 0, 0);

            if (fechaDesde.getTime() > fechaHasta.getTime()) {
                throw new Error("La fecha de inicio del descuento no puede ser posterior a la fecha de fin.");
            }
        }

        // Comprobación de horas (como strings HH:MM:SS)
        if (data.horaDesde && data.horaHasta) {
            // La comparación lexicográfica de "HH:MM:SS" funciona correctamente para las horas
            if (data.horaDesde >= data.horaHasta) {
                throw new Error("La hora de inicio del descuento no puede ser igual o posterior a la hora de fin.");
            }
        }
    },

    /**
     * Crea un nuevo Descuento.
     * @param data Los datos para crear el Descuento.
     * @returns El Descuento creado.
     * @throws Error si la validación falla o hay problemas con IDs de productos.
     */
    create: async (data: CreateDescuentoPayload) => {
        // Ejecutar validación con los datos del payload (que son strings para fecha/hora)
        DiscountService.private_validarDescuento(data);

        // Crear objetos Date para los campos fechaDesde y fechaHasta (que son @db.Date en Prisma)
        // Solo la parte de la fecha es relevante para estos campos.
        const prismaFechaDesde = new Date(data.fechaDesde);
        const prismaFechaHasta = new Date(data.fechaHasta);

        // Crear objetos Date para los campos horaDesde y horaHasta (que son @db.Time(3) en Prisma)
        // Se usa una fecha "dummy" (1970-01-01) ya que solo la parte de la hora es relevante.
        const prismaHoraDesde = new Date(`1970-01-01T${data.horaDesde}`);
        const prismaHoraHasta = new Date(`1970-01-01T${data.horaHasta}`);

        // Validar la lógica cruzada de fecha/hora combinada
        // Esto es para asegurar que la fecha y hora de inicio combinada sea anterior a la de fin.
        const startDateTime = new Date(`${data.fechaDesde}T${data.horaDesde}`);
        const endDateTime = new Date(`${data.fechaHasta}T${data.horaHasta}`);
        if (startDateTime.getTime() >= endDateTime.getTime()) {
            throw new Error("La fecha/hora de inicio combinada no puede ser igual o posterior a la fecha/hora de fin combinada.");
        }

        const connectProducts = data.productoIds ? data.productoIds.map(id => ({ id })) : [];

        return prisma.$transaction(async (tx) => {
            const newDescuento = await tx.descuento.create({
                data: {
                    denominacion: data.denominacion,
                    fechaDesde: prismaFechaDesde, // Pasar el objeto Date (solo fecha)
                    fechaHasta: prismaFechaHasta, // Pasar el objeto Date (solo fecha)
                    horaDesde: prismaHoraDesde, // Pasar el objeto Date (solo hora)
                    horaHasta: prismaHoraHasta, // Pasar el objeto Date (solo hora)
                    // Solución para el error: si `descripcionDescuento` es `undefined`, envíale `null` a Prisma.
                    // Si es `string` o `null` explícito, se usará ese valor.
                    descripcionDescuento: data.descripcionDescuento ?? null, 
                    precioPromocional: data.precioPromocional,
                    activo: data.activo ?? true, // Usar 'true' por defecto si 'activo' no se proporciona
                    productos: {
                        connect: connectProducts
                    }
                },
                include: { productos: true } // Incluir productos relacionados en la respuesta
            });
            return newDescuento;
        });
    },

    /**
     * Busca un Descuento por su ID.
     * @param id El ID del Descuento.
     * @returns El Descuento encontrado o null.
     */
    findById: async (id: number) => {
        return prisma.descuento.findUnique({
            where: {
                id,
                activo: true, // Solo buscar descuentos activos
            },
            include: { productos: true } // Incluir productos relacionados
        });
    },

    /**
     * Obtiene todos los Descuentos activos.
     * @returns Una lista de Descuentos.
     */
    findAll: async () => {
        return prisma.descuento.findMany({
            where: { activo: true }, // Solo buscar descuentos activos
            include: { productos: true } // Incluir productos relacionados
        });
    },

    /**
     * Actualiza un Descuento existente.
     * @param id El ID del Descuento a actualizar.
     * @param data Los datos a actualizar.
     * @returns El Descuento actualizado.
     */
    update: async (id: number, data: UpdateDescuentoPayload) => {
        const existingDescuento = await prisma.descuento.findUnique({ where: { id, activo: true } });
        if (!existingDescuento) {
            throw new Error(`Descuento con ID ${id} no encontrado o inactivo.`);
        }

        // --- PREPARAR DATOS PARA LA VALIDACIÓN ---
        // Convierte los objetos Date (fecha y hora) de `existingDescuento` a strings
        // para la validación, ya que `private_validarDescuento` espera strings.
        const existingFechaDesdeStr = existingDescuento.fechaDesde.toISOString().split('T')[0];
        const existingFechaHastaStr = existingDescuento.fechaHasta.toISOString().split('T')[0];
        const existingHoraDesdeStr = formatTimeForValidation(existingDescuento.horaDesde);
        const existingHoraHastaStr = formatTimeForValidation(existingDescuento.horaHasta);

        // Combina los datos existentes con los nuevos para la validación.
        // Usa `??` para preferir el nuevo dato; si es `undefined`, usa el existente.
        const combinedForValidation: {
            denominacion: string;
            fechaDesde: string;
            fechaHasta: string;
            horaDesde: string;
            horaHasta: string;
            descripcionDescuento: string | null; // Coincide con `String?` en Prisma y el payload
            precioPromocional: number;
            activo: boolean;
        } = {
            denominacion: data.denominacion ?? existingDescuento.denominacion,
            fechaDesde: data.fechaDesde ?? existingFechaDesdeStr,
            fechaHasta: data.fechaHasta ?? existingFechaHastaStr,
            horaDesde: data.horaDesde ?? existingHoraDesdeStr,
            horaHasta: data.horaHasta ?? existingHoraHastaStr,
            // Aquí, si `data.descripcionDescuento` es `undefined`, se usa el valor existente.
            // Si `data.descripcionDescuento` es `null`, se usa `null`.
            descripcionDescuento: data.descripcionDescuento ?? existingDescuento.descripcionDescuento, 
            precioPromocional: data.precioPromocional ?? existingDescuento.precioPromocional,
            activo: data.activo ?? existingDescuento.activo,
        };

        // Ejecutar la validación con los datos combinados
        DiscountService.private_validarDescuento(combinedForValidation);

        // --- CONSTRUIR EL OBJETO DE OPERACIONES DE ACTUALIZACIÓN PARA PRISMA ---
        const updateOperations: Prisma.DescuentoUpdateInput = {};

        if (data.denominacion !== undefined) updateOperations.denominacion = data.denominacion;
        
        // Solución para el error: Manejar explícitamente `undefined` y `null` para `descripcionDescuento`
        if (data.descripcionDescuento !== undefined) {
            // Si `data.descripcionDescuento` es un `string` o `null` (valor explícito del payload),
            // lo asignamos directamente. Prisma lo aceptará gracias al `String?` en el schema.
            updateOperations.descripcionDescuento = data.descripcionDescuento;
        } else if ('descripcionDescuento' in data) {
            // Este `else if` maneja el caso donde `data.descripcionDescuento` fue *explícitamente*
            // enviado como `undefined` en el payload (raro, pero posible si lo envían `{ descripcionDescuento: undefined }`).
            // En este escenario, lo tratamos como si se quisiera establecer el campo a `null`.
            updateOperations.descripcionDescuento = null;
        }

        if (data.precioPromocional !== undefined) updateOperations.precioPromocional = data.precioPromocional;
        if (data.activo !== undefined) updateOperations.activo = data.activo;

        let finalFechaDesdeDate: Date;
        let finalFechaHastaDate: Date;
        let finalHoraDesdeDate: Date; // Usaremos Date aquí para el objeto final de Prisma
        let finalHoraHastaDate: Date; // Usaremos Date aquí para el objeto final de Prisma

        // Determinar los valores finales de fecha y hora (como objetos Date)
        // para la comparación combinada y para enviar a Prisma.
        const currentFechaDesdeStr = data.fechaDesde ?? existingFechaDesdeStr;
        const currentHoraDesdeStr = data.horaDesde ?? existingHoraDesdeStr;
        finalFechaDesdeDate = new Date(`${currentFechaDesdeStr}T${currentHoraDesdeStr}`);
        finalHoraDesdeDate = new Date(`1970-01-01T${currentHoraDesdeStr}`); // Para el campo @db.Time(3) de Prisma


        const currentFechaHastaStr = data.fechaHasta ?? existingFechaHastaStr;
        const currentHoraHastaStr = data.horaHasta ?? existingHoraHastaStr;
        finalFechaHastaDate = new Date(`${currentFechaHastaStr}T${currentHoraHastaStr}`);
        finalHoraHastaDate = new Date(`1970-01-01T${currentHoraHastaStr}`); // Para el campo @db.Time(3) de Prisma

        // Asignar los objetos Date a `updateOperations` SÓLO si las propiedades fueron actualizadas
        // (o si se quiere forzar la actualización al enviar undefined para una parte de fecha/hora).
        if (data.fechaDesde !== undefined || data.horaDesde !== undefined) {
            updateOperations.fechaDesde = new Date(currentFechaDesdeStr); // Solo fecha para @db.Date
            updateOperations.horaDesde = finalHoraDesdeDate; // Objeto Date para @db.Time(3)
        }
        if (data.fechaHasta !== undefined || data.horaHasta !== undefined) {
            updateOperations.fechaHasta = new Date(currentFechaHastaStr); // Solo fecha para @db.Date
            updateOperations.horaHasta = finalHoraHastaDate; // Objeto Date para @db.Time(3)
        }

        // --- VALIDAR FECHA/HORA COMBINADA CON LOS VALORES FINALES REALES ---
        // Asegura que la fecha/hora de inicio sea anterior a la de fin.
        if (finalFechaDesdeDate.getTime() >= finalFechaHastaDate.getTime()) {
            throw new Error("La fecha/hora de inicio no puede ser igual o posterior a la fecha/hora de fin en el descuento actualizado.");
        }

        // Manejar la relación Many-to-Many con `productos`
        if (data.productoIds !== undefined) {
            updateOperations.productos = {
                // `set` reemplaza todas las relaciones existentes con las nuevas
                set: data.productoIds.map(id => ({ id }))
            };
        }

        return prisma.$transaction(async (tx) => {
            const updatedDescuento = await tx.descuento.update({
                where: {
                    id,
                    activo: true, // Solo actualizar si el descuento está activo
                },
                data: updateOperations, // Los datos a actualizar
                include: { productos: true } // Incluir productos relacionados en la respuesta
            });
            return updatedDescuento;
        });
    },

    /**
     * Desactiva (soft delete) un Descuento.
     * @param id El ID del Descuento a desactivar.
     * @returns El Descuento desactivado.
     */
    delete: async (id: number) => {
        return prisma.descuento.update({
            where: { id },
            data: { activo: false }, // Cambiar el estado a inactivo
        });
    },

    /**
     * Reactiva un Descuento previamente desactivado.
     * @param id El ID del Descuento a reactivar.
     * @returns El Descuento reactivado.
     */
    reactivate: async (id: number) => {
        return prisma.descuento.update({
            where: { id },
            data: { activo: true }, // Cambiar el estado a activo
        });
    },
};