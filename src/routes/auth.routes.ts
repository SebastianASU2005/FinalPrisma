// src/routes/auth.routes.ts

import { Router } from 'express';
import { AuthService } from '../services/auth.service';
// CORREGIDO: Cambiado a user.service para que coincida con el nombre de archivo probable
import { UserService } from '../services/user.service'; // Para operaciones de perfil que no son de credenciales
import { RegisterRequest, LoginRequest } from '../types/auth.d';
// CORREGIDO: Cambiado UserProfileUpdateDTO a UpdateUserProfilePayload
import { UpdateCredentialsPayload, UpdateUserProfilePayload } from '../types/usuario.d';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware'; // Importar los middlewares
import { Rol } from '@prisma/client'; // CORREGIDO: Importar Rol directamente, no Prisma.Rol
import multer from 'multer';

const router = Router();

// Configuración de Multer para la subida de archivos (imagen de perfil)
const upload = multer({
    storage: multer.memoryStorage(), // Almacena el archivo en memoria como un buffer
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB (igual que en tu Java)
});

// =========================================================================================
// Rutas de Autenticación (Públicas)
// =========================================================================================

// POST /auth/register - Registrar un nuevo usuario
router.post('/register', async (req, res) => {
    try {
        const registerRequest: RegisterRequest = req.body;

        // Validaciones básicas (pueden ser más robustas con librerías como Zod/Joi)
        if (!registerRequest.email || !registerRequest.password || !registerRequest.firstname || !registerRequest.lastname) {
            return res.status(400).json({ message: 'Email, contraseña, nombre y apellido son obligatorios para el registro.' });
        }
        if (!/\S+@\S+\.\S+/.test(registerRequest.email)) {
            return res.status(400).json({ message: 'Formato de email inválido.' });
        }

        const authResponse = await AuthService.register(registerRequest);
        res.status(201).json(authResponse); // 201 Created
    } catch (error: any) {
        console.error('Error en /auth/register:', error.message);
        if (error.message.includes('ya está en uso')) {
            return res.status(409).json({ message: error.message }); // 409 Conflict
        }
        res.status(500).json({ message: 'Error interno del servidor al registrar usuario.' });
    }
});

// POST /auth/login - Iniciar sesión de usuario
router.post('/login', async (req, res) => {
    try {
        const loginRequest: LoginRequest = req.body;

        if (!loginRequest.email || !loginRequest.password) {
            return res.status(400).json({ message: 'Email y contraseña son obligatorios para iniciar sesión.' });
        }

        const authResponse = await AuthService.login(loginRequest);
        res.status(200).json(authResponse);
    } catch (error: any) {
        console.error('Error en /auth/login:', error.message);
        if (error.message.includes('Credenciales inválidas')) {
            return res.status(401).json({ message: error.message }); // 401 Unauthorized
        }
        res.status(500).json({ message: 'Error interno del servidor al iniciar sesión.' });
    }
});

// =========================================================================================
// Rutas de Perfil de Usuario (Protegidas con JWT)
// Todas estas rutas requieren `verifyJWT`
// =========================================================================================

// GET /auth/me - Obtener el perfil del usuario autenticado
router.get('/me', verifyJWT, async (req, res) => {
    try {
        // `req.user` se llena con el usuario autenticado por el middleware `verifyJWT`
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' }); // Esto es un fallback, verifyJWT ya lo manejaría
        }
        // No es necesario llamar a findById de nuevo si el middleware ya cargó el user completo
        // Pero si UserResponseDTO requiere relaciones que no carga el middleware, se puede hacer:
        const user = await UserService.findById(req.user.id);
        if (!user) { // Esto debería ser poco probable si verifyJWT ya validó la existencia
            return res.status(404).json({ message: 'Perfil de usuario no encontrado o inactivo.' });
        }
        res.status(200).json(UserService.mapToUserDTO(user));
    } catch (error: any) {
        console.error('Error en /auth/me:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener perfil.' });
    }
});

// PUT /auth/profile - Actualizar el perfil del usuario autenticado
router.put('/profile', verifyJWT, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }
        // CORREGIDO: Usado UpdateUserProfilePayload
        const userProfileUpdateDTO: UpdateUserProfilePayload = req.body;
        // El `UsuarioService.updateProfile` se encarga de la lógica de actualización
        const updatedUser = await UserService.updateProfile(req.user.id, userProfileUpdateDTO);
        res.status(200).json(updatedUser);
    } catch (error: any) {
        console.error('Error en /auth/profile (PUT):', error.message);
        if (error.message.includes('Usuario no encontrado') || error.message.includes('desactivada')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Localidad con ID')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al actualizar perfil.' });
    }
});

// POST /auth/profile/upload-image - Subir/actualizar imagen de perfil para el usuario autenticado
router.post('/profile/upload-image', verifyJWT, upload.single('file'), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No se proporcionó archivo de imagen.' });
        }

        const updatedUser = await UserService.uploadProfileImage(req.user.id, {
            buffer: req.file.buffer,
            originalname: req.file.originalname
        });
        res.status(200).json(updatedUser);
    } catch (error: any) {
        console.error('Error en /auth/profile/upload-image:', error.message);
        if (error.message.includes('Usuario no encontrado') || error.message.includes('desactivada')) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al subir imagen.' });
    }
});

// PATCH /auth/update-credentials - Actualizar email y/o contraseña del usuario autenticado
router.patch('/update-credentials', verifyJWT, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }
        const updateCredentialsPayload: UpdateCredentialsPayload = req.body;

        // Validaciones básicas del payload
        if (!updateCredentialsPayload.currentPassword) {
            return res.status(400).json({ message: 'La contraseña actual es requerida.' });
        }
        if (!updateCredentialsPayload.newEmail && !updateCredentialsPayload.newPassword) {
            return res.status(400).json({ message: 'Se debe proporcionar un nuevo email o una nueva contraseña.' });
        }
        if (updateCredentialsPayload.newEmail && !/\S+@\S+\.\S+/.test(updateCredentialsPayload.newEmail)) {
            return res.status(400).json({ message: 'Formato de nuevo email inválido.' });
        }

        // Delegar la lógica de validación de contraseña actual y hasheo a AuthService
        const updatedUser = await AuthService.updateCredentials(
            req.user.id,
            updateCredentialsPayload.currentPassword,
            updateCredentialsPayload
        );
        res.status(200).json(updatedUser);
    } catch (error: any) {
        console.error('Error en /auth/update-credentials:', error.message);
        if (error.message.includes('Usuario no encontrado') || error.message.includes('desactivada')) {
            return res.status(404).json({ message: error.message });
        }
        // Errores específicos del AuthService.updateCredentials
        if (error.message.includes('contraseña actual es incorrecta') ||
            error.message.includes('ya está en uso') ||
            error.message.includes('nueva contraseña no puede ser igual')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al actualizar credenciales.' });
    }
});

// DELETE /auth/deactivate - Desactivar la cuenta del usuario autenticado
router.delete('/desactivate', verifyJWT, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }
        await UserService.deactivateAccount(req.user.id);
        // Devolver 200 OK con un mensaje o 204 No Content
        res.status(200).json({ message: 'Cuenta desactivada exitosamente. La sesión ha sido invalidada.' });
    } catch (error: any) {
        console.error('Error en /auth/deactivate:', error.message);
        if (error.message.includes('Usuario no encontrado')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('cuenta ya está desactivada')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al desactivar cuenta.' });
    }
});

// PUT /auth/reactivate - Reactivar la cuenta del usuario autenticado
router.put('/reactivate', verifyJWT, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }

        const newEmail = req.body.email;

        if (!newEmail) {
            return res.status(400).json({ message: 'Se requiere un nuevo email para reactivar la cuenta.' });
        }

        if (!/\S+@\S+\.\S+/.test(newEmail)) {
            return res.status(400).json({ message: 'Formato de nuevo email inválido.' });
        }

        // Usamos el email tanto como email como username
        const reactivatedUser = await UserService.reactivateAccount(req.user.id, newEmail);

        res.status(200).json({
            message: 'Cuenta reactivada exitosamente.',
            user: reactivatedUser
        });

    } catch (error: any) {
        console.error('Error en /auth/reactivate:', error.message);

        if (error.message.includes('Usuario no encontrado')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('cuenta ya está activa') || error.message.includes('ya está en uso')) {
            return res.status(400).json({ message: error.message });
        }

        res.status(500).json({ message: 'Error interno del servidor al reactivar cuenta.' });
    }
});

export default router;