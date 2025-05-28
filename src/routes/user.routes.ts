// src/routes/usuario.routes.ts (MODIFICADO)

import { Router } from 'express';
// CORREGIDO: Cambiado a user.service para que coincida con el nombre de archivo probable
import { UserService } from '../services/user.service';
// import multer from 'multer'; // Multer ya no es necesario aquí si solo /auth/profile/upload-image lo usa
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware'; // Importar los middlewares
// CORREGIDO: Importado Rol directamente de @prisma/client
import { Rol } from '@prisma/client'; // Para acceder a los roles de Prisma (ADMIN, CLIENTE, etc.)

import {
    // CreateUsuarioPayload, // El registro se hace ahora via /auth/register
    AddressPayload
} from '../types/usuario.d';

const router = Router();



// GET /api/usuarios/by-username/{username} - Puede ser público (ej. para verificar existencia de username)
router.get('/by-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const usuario = await UserService.findByUserName(username); // Por defecto busca activos

        if (!usuario) {
            return res.status(404).json({ message: `Usuario con username '${username}' no encontrado.` });
        }
        res.status(200).json(UserService.mapToUserDTO(usuario));
    } catch (error: any) {
        console.error(`Error al obtener usuario por username ${req.params.username}:`, error.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener usuario.' });
    }
});

// =========================================================================================
// Rutas de Direcciones de Usuario (Protegidas)
// Estas rutas son para que un usuario (CLIENTE) gestione sus propias direcciones,
// o para que un ADMIN gestione direcciones de cualquier usuario.
// =========================================================================================

// GET /api/usuarios/{userId}/direcciones
router.get('/:userId/direcciones', verifyJWT, authorizeRoles([Rol.ADMIN, Rol.CLIENTE]), async (req, res) => { // CORREGIDO: Usado Rol directamente
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'ID de usuario inválido.' });
        }

        // CORREGIDO: Usado operador '!' para afirmar que req.user no es undefined aquí
        // Un CLIENTE solo puede ver sus propias direcciones, un ADMIN puede ver cualquiera
        if (req.user!.rol === Rol.CLIENTE && req.user!.id !== userId) { // CORREGIDO: Usado Rol directamente
            return res.status(403).json({ message: 'Acceso denegado: No tiene permisos para ver las direcciones de otro usuario.' });
        }

        const direcciones = await UserService.getDireccionesByUserId(userId);
        res.status(200).json(direcciones);
    } catch (error: any) {
        console.error(`Error al obtener direcciones para el usuario ${req.params.userId}:`, error.message);
        if (error.message.includes('Usuario no encontrado') || error.message.includes('inactivo')) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al obtener direcciones.' });
    }
});

// POST /api/usuarios/{userId}/direcciones
router.post('/:userId/direcciones', verifyJWT, authorizeRoles([Rol.ADMIN, Rol.CLIENTE]), async (req, res) => { // CORREGIDO: Usado Rol directamente
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'ID de usuario inválido.' });
        }

        // CORREGIDO: Usado operador '!' para afirmar que req.user no es undefined aquí
        if (req.user!.rol === Rol.CLIENTE && req.user!.id !== userId) { // CORREGIDO: Usado Rol directamente
            return res.status(403).json({ message: 'Acceso denegado: No tiene permisos para añadir direcciones a otro usuario.' });
        }

        const domicilioDTO: AddressPayload = req.body;
        if (!domicilioDTO.calle || !domicilioDTO.numero || !domicilioDTO.cp || !domicilioDTO.localidad?.id) {
            return res.status(400).json({ message: 'Faltan campos obligatorios para la dirección (calle, numero, cp, localidad.id).' });
        }

        const newDireccion = await UserService.addDireccionToUser(userId, domicilioDTO);
        res.status(201).json(newDireccion);
    } catch (error: any) {
        console.error(`Error al añadir dirección para el usuario ${req.params.userId}:`, error.message);
        if (error.message.includes('Usuario no encontrado') || error.message.includes('inactivo')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Localidad con ID')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al añadir dirección.' });
    }
});


// PUT /api/usuarios/{userId}/direcciones/{direccionId}
router.put('/:userId/direcciones/:direccionId', verifyJWT, authorizeRoles([Rol.ADMIN, Rol.CLIENTE]), async (req, res) => { // CORREGIDO: Usado Rol directamente
    try {
        const userId = parseInt(req.params.userId, 10);
        const direccionId = parseInt(req.params.direccionId, 10);
        if (isNaN(userId) || isNaN(direccionId)) {
            return res.status(400).json({ message: 'ID de usuario o dirección inválido.' });
        }

        // CORREGIDO: Usado operador '!' para afirmar que req.user no es undefined aquí
        if (req.user!.rol === Rol.CLIENTE && req.user!.id !== userId) { // CORREGIDO: Usado Rol directamente
            return res.status(403).json({ message: 'Acceso denegado: No tiene permisos para actualizar direcciones de otro usuario.' });
        }

        const updatedDomicilioDTO: AddressPayload = req.body;
        if (!updatedDomicilioDTO.calle || !updatedDomicilioDTO.numero || !updatedDomicilioDTO.cp || !updatedDomicilioDTO.localidad?.id) {
            return res.status(400).json({ message: 'Faltan campos obligatorios para la dirección (calle, numero, cp, localidad.id).' });
        }

        const savedDireccion = await UserService.updateDireccionForUser(userId, direccionId, updatedDomicilioDTO);
        res.status(200).json(savedDireccion);
    } catch (error: any) {
        console.error(`Error al actualizar dirección ${req.params.direccionId} para el usuario ${req.params.userId}:`, error.message);
        if (error.message.includes('Usuario no encontrado') || error.message.includes('inactivo') || error.message.includes('Dirección con ID')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Localidad con ID')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al actualizar dirección.' });
    }
});


// DELETE /api/usuarios/{userId}/direcciones/{direccionId}
router.delete('/:userId/direcciones/:direccionId', verifyJWT, authorizeRoles([Rol.ADMIN, Rol.CLIENTE]), async (req, res) => { // CORREGIDO: Usado Rol directamente
    try {
        const userId = parseInt(req.params.userId, 10);
        const direccionId = parseInt(req.params.direccionId, 10);
        if (isNaN(userId) || isNaN(direccionId)) {
            return res.status(400).json({ message: 'ID de usuario o dirección inválido.' });
        }

        // CORREGIDO: Usado operador '!' para afirmar que req.user no es undefined aquí
        if (req.user!.rol === Rol.CLIENTE && req.user!.id !== userId) { // CORREGIDO: Usado Rol directamente
            return res.status(403).json({ message: 'Acceso denegado: No tiene permisos para eliminar direcciones de otro usuario.' });
        }

        await UserService.removeDireccionFromUser(userId, direccionId);
        res.status(204).send(); // No Content
    } catch (error: any) {
        console.error(`Error al eliminar dirección ${req.params.direccionId} para el usuario ${req.params.userId}:`, error.message);
        if (error.message.includes('Usuario no encontrado') || error.message.includes('inactivo') || error.message.includes('Dirección con ID')) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al eliminar dirección.' });
    }
});


// =========================================================================================
// Rutas de Administración de Usuarios (Protegidas con JWT y Rol ADMIN)
// =========================================================================================

// GET /api/usuarios - Obtener todos los usuarios
router.get('/', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req, res) => { // CORREGIDO: Usado Rol directamente
    try {
        const users = await UserService.findAll(); // Por defecto busca activos
        res.status(200).json(users.map(UserService.mapToUserDTO));
    } catch (error: any) {
        console.error('Error al obtener todos los usuarios:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener usuarios.' });
    }
});

// GET /api/usuarios/:id - Obtener un usuario por ID
router.get('/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req, res) => { // CORREGIDO: Usado Rol directamente
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'ID de usuario inválido.' });
        }
        const user = await UserService.findById(userId); // Por defecto busca activos
        if (!user) {
            return res.status(404).json({ message: `Usuario con ID ${userId} no encontrado.` });
        }
        res.status(200).json(UserService.mapToUserDTO(user));
    } catch (error: any) {
        console.error(`Error al obtener usuario con ID ${req.params.id}:`, error.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener usuario.' });
    }
});

// PUT /api/usuarios/admin/deactivate/:userId - Admin desactiva cualquier cuenta
router.put('/admin/deactivate/:userId', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req, res) => { // CORREGIDO: Usado Rol directamente
    const targetUserId = parseInt(req.params.userId, 10);
    if (isNaN(targetUserId)) {
        return res.status(400).json({ message: 'ID de usuario inválido.' });
    }
    try {
        const deactivatedUser = await UserService.deactivateAccount(targetUserId);
        res.status(200).json({ message: `Cuenta de usuario ${targetUserId} desactivada exitosamente.`, user: UserService.mapToUserDTO(deactivatedUser) });
    } catch (error: any) {
        console.error(`Error al desactivar cuenta de usuario ${req.params.userId}:`, error.message);
        if (error.message.includes('Usuario no encontrado')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('cuenta ya está desactivada')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al desactivar cuenta.' });
    }
});

// PUT /api/usuarios/admin/reactivate/:userId - Admin reactiva cualquier cuenta
router.put('/admin/reactivate/:userId', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req, res) => { // CORREGIDO: Usado Rol directamente
    const targetUserId = parseInt(req.params.userId, 10);
    if (isNaN(targetUserId)) {
        return res.status(400).json({ message: 'ID de usuario inválido.' });
    }
    const { newEmail, newUserName } = req.body;

    if (!newEmail || !newUserName) {
        return res.status(400).json({ message: 'Se requieren un nuevo email y nombre de usuario para reactivar la cuenta.' });
    }
    if (!/\S+@\S+\.\S+/.test(newEmail)) {
        return res.status(400).json({ message: 'Formato de nuevo email inválido.' });
    }

    try {
        const reactivatedUser = await UserService.reactivateAccount(targetUserId, newEmail, newUserName);
        res.status(200).json({ message: `Cuenta de usuario ${targetUserId} reactivada exitosamente.`, user: UserService.mapToUserDTO(reactivatedUser) });
    } catch (error: any) {
        console.error(`Error al reactivar cuenta de usuario ${req.params.userId}:`, error.message);
        if (error.message.includes('Usuario no encontrado')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('cuenta ya está activa') || error.message.includes('ya está en uso')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al reactivar cuenta.' });
    }
});
// PUT /api/usuarios/deactivate - Usuario desactiva su propia cuenta
router.put('/deactivate', verifyJWT, async (req, res) => {
    try {
        // El ID del usuario se obtiene directamente del token JWT verificado
        // Asumiendo que verifyJWT añade el user (o userId) a req.user
        const userId = (req as any).user.id; // Asegúrate de que tu middleware verifyJWT adjunta el ID del usuario

        const deactivatedUser = await UserService.deactivateAccount(userId);
        res.status(200).json({
            message: `Tu cuenta ha sido desactivada exitosamente.`,
            user: UserService.mapToUserDTO(deactivatedUser)
        });
    } catch (error: any) {
        console.error(`Error al desactivar la propia cuenta de usuario:`, error.message);
        if (error.message.includes('Usuario no encontrado')) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('cuenta ya está desactivada')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al desactivar tu cuenta.' });
    }
});


export default router;