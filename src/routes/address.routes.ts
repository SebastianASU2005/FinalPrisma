import { Router } from 'express';
import { AddressService } from '../services/address.service'; // Asegúrate de que la ruta sea correcta
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware'; // Asumiendo que tienes estos middlewares
import { Rol } from '@prisma/client'; // Importa el enum Rol

const router = Router();

// Middleware de manejo de errores genérico para las rutas de dirección
const handleAddressError = (res: any, error: any) => {
    console.error('Error en la ruta de dirección:', error);
    if (error.message.includes('no encontrada') || error.message.includes('no existe')) {
        return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('inválido')) {
        return res.status(400).json({ message: error.message });
    }
    // Para otros errores que provengan del servicio (ej. conflicto de datos, "ya desactivada")
    if (error.message.includes('ya está en uso') || error.message.includes('ya desactivada') || error.message.includes('ya activa')) {
        return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error interno del servidor.' });
};

// ======================================================================================
// Rutas de Administración (requieren rol ADMIN)
// NOTA: Colocadas primero para evitar que rutas con parámetros como '/:id' intercepten '/admin'
// o la ruta raíz '/' si no se tiene cuidado con el orden.
// ======================================================================================

// GET /api/direcciones - Listar todas las direcciones (Solo para ADMINS)
// Permite un query param 'includeInactive=true' para ver direcciones inactivas.
router.get('/', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === 'true'; // Convierte el string a booleano
        const direcciones = await AddressService.findAll(includeInactive);
        res.status(200).json(direcciones);
    } catch (error) {
        handleAddressError(res, error);
    }
});

// GET /api/direcciones/localidad/:localidadId - Obtener todas las direcciones de una localidad específica
// Solo para ADMINS, ya que expone datos de múltiples usuarios.
router.get('/localidad/:localidadId', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req, res) => {
    try {
        const localidadId = parseInt(req.params.localidadId, 10);
        if (isNaN(localidadId)) {
            return res.status(400).json({ message: 'ID de localidad inválido.' });
        }
        const direcciones = await AddressService.listarPorLocalidad(localidadId);
        res.status(200).json(direcciones);
    } catch (error) {
        handleAddressError(res, error);
    }
});

// PUT /api/direcciones/desactivate/:id - Desactivar (soft delete) una dirección (solo ADMIN)
router.put('/desactivate/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req, res) => {
    try {
        const direccionId = parseInt(req.params.id, 10);
        if (isNaN(direccionId)) {
            return res.status(400).json({ message: 'ID de dirección inválido.' });
        }

        const deactivatedAddress = await AddressService.delete(direccionId); // Usando 'delete' como tu servicio lo nombró
        if (!deactivatedAddress) { // Si tu servicio devuelve null para no encontrado (aunque tu 'delete' hace update y siempre devuelve algo)
             return res.status(404).json({ message: 'Dirección no encontrada.' });
        }
        res.status(200).json({ message: `Dirección ${direccionId} desactivada exitosamente.`, direccion: deactivatedAddress });
    } catch (error) {
        handleAddressError(res, error);
    }
});

// PUT /api/direcciones/reactivate/:id - Reactivar una dirección (solo ADMIN)
router.put('/reactivate/:id', verifyJWT, authorizeRoles([Rol.ADMIN]), async (req, res) => {
    try {
        const direccionId = parseInt(req.params.id, 10);
        if (isNaN(direccionId)) {
            return res.status(400).json({ message: 'ID de dirección inválido.' });
        }

        const reactivatedAddress = await AddressService.reactivate(direccionId);
         if (!reactivatedAddress) { // Si tu servicio devuelve null para no encontrado
             return res.status(404).json({ message: 'Dirección no encontrada.' });
        }
        res.status(200).json({ message: `Dirección ${direccionId} reactivada exitosamente.`, direccion: reactivatedAddress });
    } catch (error) {
        handleAddressError(res, error);
    }
});


// ======================================================================================
// Rutas para Usuarios (CLIENTE o ADMIN, con restricciones de acceso a datos propios/ajenos)
// ======================================================================================

// POST /api/direcciones - Crear una nueva dirección
// Un usuario puede crear una dirección. Un admin también.
// Si no se proporciona usuarioId en el body, se asigna al usuario del token.
router.post('/', verifyJWT, async (req, res) => {
    try {
        const { usuarioId, ...restOfData } = req.body;
        const authenticatedUser = (req as any).user; // Obtenemos el usuario del token (asegúrate de que 'verifyJWT' adjunte 'req.user')

        let finalUsuarioId = usuarioId;

        // Si el usuario autenticado no es ADMIN y proporciona un usuarioId diferente al suyo, denegar
        if (authenticatedUser.rol !== Rol.ADMIN && usuarioId && usuarioId !== authenticatedUser.id) {
            return res.status(403).json({ message: 'Acceso denegado. No puedes crear direcciones para otros usuarios.' });
        }
        // Si no se proporciona usuarioId (en el body) y el usuario autenticado no es ADMIN, asignar el ID del usuario del token
        if (usuarioId === undefined && authenticatedUser.rol !== Rol.ADMIN) { // Use undefined para distinguir si no se envía o se envía null/0
             finalUsuarioId = authenticatedUser.id;
        }

        const newAddress = await AddressService.create({ ...restOfData, usuarioId: finalUsuarioId });
        res.status(201).json(newAddress);
    } catch (error) {
        handleAddressError(res, error);
    }
});

// GET /api/direcciones/:id - Obtener una dirección por ID
// Un usuario puede ver su propia dirección. Un admin puede ver cualquier dirección.
router.get('/:id', verifyJWT, async (req, res) => {
    try {
        const direccionId = parseInt(req.params.id, 10);
        if (isNaN(direccionId)) {
            return res.status(400).json({ message: 'ID de dirección inválido.' });
        }

        const authenticatedUser = (req as any).user; // Obtenemos el usuario del token
        const direccion = await AddressService.findById(direccionId);

        if (!direccion || !direccion.activo) {
            return res.status(404).json({ message: 'Dirección no encontrada o inactiva.' });
        }

        // Si el usuario no es ADMIN, solo puede ver sus propias direcciones
        if (authenticatedUser.rol !== Rol.ADMIN && direccion.usuarioId !== authenticatedUser.id) {
            return res.status(403).json({ message: 'Acceso denegado. No tienes permiso para ver esta dirección.' });
        }

        res.status(200).json(direccion);
    } catch (error) {
        handleAddressError(res, error);
    }
});

// PUT /api/direcciones/:id - Actualizar una dirección
// Un usuario solo puede actualizar sus propias direcciones. Un admin puede actualizar cualquier dirección.
router.put('/:id', verifyJWT, async (req, res) => {
    try {
        const direccionId = parseInt(req.params.id, 10);
        if (isNaN(direccionId)) {
            return res.status(400).json({ message: 'ID de dirección inválido.' });
        }

        const authenticatedUser = (req as any).user;
        const existingAddress = await AddressService.findById(direccionId); // Obtener para verificar propiedad

        if (!existingAddress || !existingAddress.activo) {
            return res.status(404).json({ message: 'Dirección no encontrada o inactiva.' });
        }

        // Si el usuario no es ADMIN, solo puede actualizar sus propias direcciones
        if (authenticatedUser.rol !== Rol.ADMIN && existingAddress.usuarioId !== authenticatedUser.id) {
            return res.status(403).json({ message: 'Acceso denegado. No tienes permiso para actualizar esta dirección.' });
        }

        // Validar si el usuario CLIENTE intenta cambiar el usuarioId de la dirección
        // Un ADMIN podría tener permitido reasignar, pero un CLIENTE no.
        if (req.body.usuarioId && req.body.usuarioId !== existingAddress.usuarioId && authenticatedUser.rol !== Rol.ADMIN) {
             return res.status(403).json({ message: 'Acceso denegado. No puedes reasignar esta dirección a otro usuario.' });
        }


        const updatedAddress = await AddressService.update(direccionId, req.body);
        res.status(200).json(updatedAddress);
    } catch (error) {
        handleAddressError(res, error);
    }
});

// GET /api/direcciones/usuario/:userId - Obtener todas las direcciones de un usuario específico
// Solo un ADMIN puede ver las direcciones de cualquier usuario. Un CLIENTE solo puede ver las suyas.
router.get('/usuario/:userId', verifyJWT, async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.userId, 10);
        if (isNaN(targetUserId)) {
            return res.status(400).json({ message: 'ID de usuario inválido.' });
        }

        const authenticatedUser = (req as any).user;

        // Si el usuario no es ADMIN, solo puede ver sus propias direcciones
        if (authenticatedUser.rol !== Rol.ADMIN && targetUserId !== authenticatedUser.id) {
            return res.status(403).json({ message: 'Acceso denegado. No tienes permiso para ver las direcciones de otros usuarios.' });
        }

        const direcciones = await AddressService.listarPorUsuarioId(targetUserId);
        res.status(200).json(direcciones);
    } catch (error) {
        handleAddressError(res, error);
    }
});


export default router;