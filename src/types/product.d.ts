// src/types/product.d.ts

import { Sexo, Color, Talle } from '@prisma/client'; // Importa los enums de Prisma necesarios

// DTOs para las entidades relacionadas que se anidan en ProductoDTO
export interface CategoriaDTO {
  id: number;
  denominacion: string;
  subcategorias?: CategoriaDTO[]; // Opcional, si quieres incluir subcategorías anidadas
}

export interface ImagenDTO {
  id: number;
  denominacion: string; // Asumiendo que 'denominacion' es la URL o un nombre descriptivo
}

export interface ProductoDetalleDTO {
  id: number;
  precioCompra: number;
  stockActual: number;
  cantidad: number; // ¿Es un alias para stockActual o un campo diferente? Revisa tu esquema.
  stockMaximo: number;
  color: string | null; // El enum Color convertido a string
  talle: string | null; // El enum Talle convertido a string
}

// DTO principal para el producto
export interface ProductoDTO {
  id: number;
  denominacion: string;
  precioOriginal: number;
  precioFinal: number;
  tienePromocion: boolean;
  sexo: Sexo;
  categorias: CategoriaDTO[];
  imagenes: ImagenDTO[];
  productos_detalles: ProductoDetalleDTO[];
}


// Payload para crear un nuevo producto
// Refleja la estructura que esperas en el cuerpo de la solicitud POST
export type CreateProductPayload = {
  denominacion: string;
  precioVenta: number; // Usa 'precioVenta' para la creación
  sexo: Sexo;
  tienePromocion: boolean;
  categoriaIds?: number[];
  descuentoIds?: number[];
  imagenes?: { denominacion: string }[]; // Para crear nuevas imágenes
  productos_detalles?: Array<{
    precioCompra: number;
    stockActual: number;
    cantidad: number;
    stockMaximo: number;
    color: Color; // Espera el enum Color para la creación
    talle: Talle; // Espera el enum Talle para la creación
  }>;
};

// Payload para actualizar un producto existente
// Partial hace que todas las propiedades sean opcionales
export type UpdateProductPayload = Partial<CreateProductPayload>;