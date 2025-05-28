// src/types/provincia.d.ts

import { Provincia as PrismaProvincia } from '@prisma/client';

// DTO para la entidad Provincia
export interface ProvinciaDTO {
  id: number;
  nombre: string;
  activo: boolean;
  // Si tu entidad Provincia en Prisma tiene más campos, añádelos aquí.
  // Por ejemplo, si tuviera un campo `codigoPostal`, sería:
  // codigoPostal?: string;
}

// Payload para crear una nueva provincia
export type CreateProvinciaPayload = {
  nombre: string;
};

// Payload para actualizar una provincia existente
// Todas las propiedades son opcionales para la actualización
export type UpdateProvinciaPayload = Partial<CreateProvinciaPayload>;

// Tipo auxiliar para el servicio que devuelve la entidad completa de Prisma
// Útil si necesitas la entidad cruda de Prisma en algún lugar
export type ProvinciaPrisma = PrismaProvincia;