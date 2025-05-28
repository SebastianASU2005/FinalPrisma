// src/services/jwt.service.ts

import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client'; // CORREGIDO: Importa Rol directamente
import { config } from 'dotenv';

config();

// Definir una interfaz para el payload del JWT
interface JwtPayload {
    id: number;
    email: string;
    rol: Rol; // CORREGIDO: Usa Rol directamente
    iat?: number; // Issued at
    exp?: number; // Expiration
}

export const JwtService = {
    /**
     * Genera un token JWT para un usuario dado.
     * @param user El objeto Usuario de Prisma.
     * @returns El token JWT generado.
     * @throws Error si JWT_SECRET o JWT_EXPIRATION no están configurados.
     */
    generateToken: (user: { id: number; email: string; rol: Rol }): string => { // CORREGIDO: Usa Rol directamente
        const secret = process.env.JWT_SECRET;
        const expirationInHours = parseInt(process.env.JWT_EXPIRATION_HOURS || '1', 10); // Expira en 1 hora por defecto
        const expirationInSeconds = expirationInHours * 60 * 60; // Convertir a segundos

        if (!secret) {
            throw new Error('JWT_SECRET no está configurado en las variables de entorno.');
        }

        const payload: JwtPayload = {
            id: user.id,
            email: user.email,
            rol: user.rol,
        };

        return jwt.sign(
            payload,
            secret,
            { expiresIn: expirationInSeconds }
        );
    },

    /**
     * Extrae el payload de un token JWT.
     * @param token El token JWT a verificar.
     * @returns El payload del token decodificado.
     * @throws Error si el token es inválido o JWT_SECRET no está configurado.
     */
    verifyToken: (token: string): JwtPayload => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET no está configurado en las variables de entorno.');
        }
        try {
            const decoded = jwt.verify(token, secret) as JwtPayload;
            return decoded;
        } catch (error: any) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token JWT expirado.');
            }
            if (error.name === 'JsonWebTokenError') {
                throw new Error('Token JWT inválido.');
            }
            throw new Error(`Error al verificar el token: ${error.message}`);
        }
    },

    /**
     * Extrae el email (subject) del token JWT sin verificar su validez (solo decodifica).
     * Esto es útil para obtener el subject antes de la validación completa del token.
     * Corresponde a `extractUsername` en tu Java.
     * @param token El token JWT.
     * @returns El email (username) del token o null si no se puede extraer.
     */
    extractUsername: (token: string): string | null => {
        try {
            const decoded = jwt.decode(token) as JwtPayload;
            return decoded ? decoded.email : null;
        } catch (error) {
            console.error('Error al decodificar token para extraer username:', error);
            return null;
        }
    },

    /**
     * Verifica si un token JWT es válido para un email de usuario específico.
     * Corresponde a `isTokenValid` en tu Java.
     * @param token El token JWT.
     * @param userEmail El email del usuario con el que se compara el token.
     * @returns true si el token es válido y no ha expirado para el email dado, false en caso contrario.
     */
    isTokenValid: (token: string, userEmail: string): boolean => {
        try {
            const payload = JwtService.verifyToken(token); // Verifica la firma y expiración
            return payload.email === userEmail; // Compara el email del token con el del usuario
        } catch (error) {
            return false; // El token no es válido (expirado, inválido, email no coincide, etc.)
        }
    },

    /**
     * Extrae la fecha de expiración de un token JWT.
     * Corresponde a `extractExpiration` en tu Java.
     * @param token El token JWT.
     * @returns La fecha de expiración como objeto Date, o null si el token es inválido.
     */
    extractExpiration: (token: string): Date | null => {
        try {
            const decoded = jwt.decode(token) as JwtPayload;
            if (decoded && decoded.exp) {
                return new Date(decoded.exp * 1000); // JWT exp está en segundos, el constructor de Date espera milisegundos
            }
            return null;
        } catch (error) {
            console.error('Error al extraer expiración del token:', error);
            return null;
        }
    },

    /**
     * Verifica si un token JWT ha expirado.
     * Corresponde a `isTokenExpired` en tu Java.
     * @param token El token JWT a verificar.
     * @returns true si el token ha expirado, false de lo contrario.
     */
    isTokenExpired: (token: string): boolean => {
        const expirationDate = JwtService.extractExpiration(token);
        // CORREGIDO: Compara fechas usando operadores de comparación estándar de JavaScript
        return expirationDate ? expirationDate.getTime() < new Date().getTime() : true;
    }
};