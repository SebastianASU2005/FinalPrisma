// src/types/descuento.d.ts

export type CreateDescuentoPayload = {
    denominacion: string;
    fechaDesde: string; // "YYYY-MM-DD"
    fechaHasta: string; // "YYYY-MM-DD"
    horaDesde: string; // "HH:MM:SS" (string de entrada de la API)
    horaHasta: string; // "HH:MM:SS" (string de entrada de la API)
    descripcionDescuento?: string | null; // Ahora coincide con el schema.prisma nullable
    precioPromocional: number;
    productoIds?: number[];
    activo?: boolean;
};

export type UpdateDescuentoPayload = {
    denominacion?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    horaDesde?: string; // Debe ser string o undefined
    horaHasta?: string; // Debe ser string o undefined
    descripcionDescuento?: string | null; // Puede ser string, null o undefined
    precioPromocional?: number;
    productoIds?: number[];
    activo?: boolean;
};