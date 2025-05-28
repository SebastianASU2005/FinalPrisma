// src/types/orden_compra.d.ts

import { ProductoDetalle } from '@prisma/client';

// Payload para crear un detalle de orden de compra anidado
export interface CreateOrdenCompraDetalleNestedPayload {
    productoDetalleId: number;
    cantidad: number;
    // subTotal se calculará en el servicio, no se envía en el payload
}

// Payload principal para crear una nueva Orden de Compra
export interface CreateOrdenCompraPayload {
    direccionEnvio: string;
    detalles: CreateOrdenCompraDetalleNestedPayload[];
    userId: number; // <-- ¡NUEVO! El ID del usuario que realiza la compra
}

// Payload para actualizar una Orden de Compra existente
export type UpdateOrdenCompraPayload = Partial<CreateOrdenCompraPayload>;

// DTO para la respuesta de Orden de Compra (si lo usas)
export interface OrdenCompraDTO {
    id: number;
    total: number;
    fechaCompra: Date;
    direccionEnvio: string;
    activo: boolean;
    // usuario: UsuarioDTO; // Si quieres incluir el usuario completo
    detalles: OrdenCompraDetalleDTO[];
}

export interface OrdenCompraDetalleDTO {
    id: number;
    cantidad: number;
    subtotal: number;
    activo: boolean;
    productoDetalle: ProductoDetalle; // Asumiendo que quieres el detalle completo del producto
}