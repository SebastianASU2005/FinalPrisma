// src/middlewares/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwt.service';
import { Prisma, Usuario, Rol } from '@prisma/client';
import { UserService } from '../services/user.service'; 

// Extender el tipo Request de Express para incluir la propiedad 'user'
// Esto permite que TypeScript sepa que `req.user` existe y cuál es su tipo.
declare global {
    namespace Express {
        interface Request {
            user?: Usuario; // CORREGIDO: Usa Usuario directamente (sin Prisma.)
        }
    }
}

/**
 * Middleware para verificar un token JWT y autenticar al usuario.
 * Coloca el objeto Usuario cargado desde la DB en `req.user`.
 * @param req Objeto Request de Express.
 * @param res Objeto Response de Express.
 * @param next Función para pasar al siguiente middleware.
 */
export const verifyJWT = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No autorizado: Token no proporcionado o formato inválido.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = JwtService.verifyToken(token); // Esto también verifica la expiración y la firma
        const userId = payload.id;
        const userEmail = payload.email; // El email en el token debería coincidir con el email del usuario en DB

        // Buscar el usuario en la base de datos para asegurarse de que existe y está activo
        // Es importante cargar el usuario desde la DB para tener la información más reciente y sus roles.
        const user = await UserService.findById(userId); // Por defecto busca usuarios activos

        if (!user || user.email !== userEmail || user.id !== userId) {
            // El usuario no existe, está inactivo, o los datos del token no coinciden con el usuario real
            return res.status(401).json({ message: 'No autorizado: Usuario no encontrado, inactivo, o token inválido.' });
        }

        // Inyectar el objeto usuario en el request para que los controladores puedan acceder a él
        req.user = user;
        next(); // Pasar al siguiente middleware/controlador
    } catch (error: any) {
        if (error.message.includes('expirado')) {
            return res.status(401).json({ message: 'No autorizado: Token expirado.' });
        }
        if (error.message.includes('inválido')) {
            return res.status(401).json({ message: 'No autorizado: Token inválido.' });
        }
        console.error('Error de autenticación JWT:', error.message);
        return res.status(500).json({ message: 'Error interno de autenticación.' });
    }
};

/**
 * Middleware para autorizar el acceso basado en roles del usuario.
 * Debe usarse DESPUÉS de `verifyJWT` en la cadena de middlewares para una ruta.
 * @param allowedRoles Array de roles permitidos (ej. [Rol.ADMIN, Rol.MODERADOR]).
 */
export const authorizeRoles = (allowedRoles: Rol[]) => { // CORREGIDO: Usa Rol directamente
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            // Esto no debería ocurrir si verifyJWT se ejecuta correctamente antes
            return res.status(403).json({ message: 'Acceso denegado: Usuario no autenticado (problema de middleware).' });
        }

        // Verificar si el rol del usuario está en la lista de roles permitidos
        if (!allowedRoles.includes(req.user.rol)) {
            return res.status(403).json({ message: 'Acceso denegado: No tiene los permisos necesarios para esta acción.' });
        }
        next(); // El usuario tiene el rol permitido, pasar al siguiente middleware/controlador
    };
};