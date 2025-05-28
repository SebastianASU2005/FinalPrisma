// src/types/auth.d.ts

import { UserResponseDTO } from './usuario.d'; // Importamos el DTO de usuario existente
import { Rol, Sexo } from '@prisma/client'; // Importar enums de Prisma

// ESTA ES LA INTERFAZ QUE FALTABA Y NECESITAS EXPORTAR
export interface AuthUser {
    id: number;
    email: string;
    rol: Rol;
    // Puedes añadir otras propiedades del usuario que sean relevantes para la autenticación
    // Por ejemplo:
    // nombre: string;
    // apellido: string;
}

// Request para registro de usuario (RegisterRequest en Java)
export type RegisterRequest = {
    firstname: string; // nombre
    lastname: string;  // apellido
    email: string;
    password: string;
    dni?: number | null;
    sexo?: Sexo | null;
    fechaNacimiento?: string | null; // "YYYY-MM-DD"
    telefono?: string | null;
    rol?: Rol; // El rol se asignará por defecto a CLIENTE en el backend,
               // pero el frontend podría enviarlo si se permite (ej. para admins).
};

// Request para login de usuario (LoginRequest en Java)
export type LoginRequest = {
    email: string; // En tu Java, el username para login es el email
    password: string;
};

// Response de autenticación (AuthResponse en Java)
export type AuthResponse = {
    token: string;
    user: UserResponseDTO;
};

// Extender el Request de Express para que TypeScript sepa que req.user existe
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser; // Aquí se hace uso de AuthUser
        }
    }
}