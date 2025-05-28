// src/types/baseDTO.d.ts

import { Sexo, Color, Talle } from '@prisma/client';

export interface ProductFilters {
  denominacion?: string;
  categorias?: string[]; // <--- Usar 'categorias' para un array de nombres de categorías
  sexo?: Sexo;
  tienePromocion?: boolean;
  minPrice?: number;
  maxPrice?: number;
  colores?: string[]; // <--- Usar 'colores' para un array de nombres de colores
  talles?: string[]; // <--- Usar 'talles' para un array de nombres de talles
  stockMinimo?: number; // <--- Re-incluido ya que el servicio lo está usando

  // Opciones de ordenamiento
  orderBy?: 'denominacion' | 'precioVenta' | 'sexo' | 'tienePromocion' | 'id';
  orderDirection?: 'asc' | 'desc';
}