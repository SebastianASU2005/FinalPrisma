
import { Color, Talle } from '@prisma/client';

// Tipo para el payload de creación de un ProductoDetalle
// Omitimos 'id' y 'activo' porque se generan o se establecen por defecto en la creación.
export type CreateProductoDetallePayload = {
    productoId: number;
    precioCompra: number;
    stockActual: number;
    cantidad: number; // Tu schema indica que 'cantidad' es Int, no Int? (no nulo)
    stockMaximo: number;
    color: Color; // Tu schema indica que 'color' es Color, no Color? (no nulo)
    talle: Talle; // Tu schema indica que 'talle' es Talle, no Talle? (no nulo)
};

// Tipo para el payload de actualización de un ProductoDetalle
// Todas las propiedades son opcionales (Partial) para permitir actualizaciones parciales.
export type UpdateProductoDetallePayload = Partial<CreateProductoDetallePayload>;

// No necesitamos una interfaz ProductoDetalle aparte porque los tipos de Prisma
// son nuestra "entidad" principal aquí, por ejemplo: `Prisma.ProductoDetalleGetPayload<any>`.