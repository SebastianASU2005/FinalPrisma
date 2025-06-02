// src/routes/index.ts

import { Router } from 'express';

// Importa todos tus routers individuales
import productoRoutes from './product.routes';
import categoriaRoutes from './category.routes';
import descuentoRoutes from './discount.routes';
import localidadRoutes from './location.routes';
import provinciaRoutes from './province.routes';
import direccionRoutes from './address.routes';
import usuarioRoutes from './user.routes'; // Rutas de gestión de usuarios (no de autenticación)
import authRoutes from './auth.routes';       // Rutas de autenticación y perfil

const router = Router();

// Define las rutas base para cada grupo de endpoints
// Esto mapea la URL base a cada router específico
router.use('/productos', productoRoutes);
router.use('/categorias', categoriaRoutes);
router.use('/descuentos', descuentoRoutes);
router.use('/localidades', localidadRoutes);
router.use('/provincias', provinciaRoutes);
router.use('/direcciones', direccionRoutes);
router.use('/usuarios', usuarioRoutes); // Rutas para operaciones de usuario (ej. admin, direcciones)
router.use('/auth', authRoutes);       // Rutas para autenticación (registro, login, perfil propio)

export default router;


//RUTAS PRINCIPALES TESTEADAS
/*
AUTH
USUARIOS
PROVINCIAS
LOCALIDADES
DIRECCIONES
PRODUCTOS
CATEGORIAS
DESCUENTOS
*/