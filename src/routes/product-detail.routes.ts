// src/routes/product_detail.routes.ts

import { Router, Request, Response, NextFunction } from 'express';
import { ProductDetailService } from '../services/product-detail.service';
// Importa los enums directamente de @prisma/client
import { Color, Talle } from '@prisma/client';
import { CreateProductoDetallePayload, UpdateProductoDetallePayload } from '../types/product_detail.d';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const router = Router();

// ==============================================================================
// Tipos auxiliares para manejadores de ruta asíncronos (para tipado correcto)
// ==============================================================================
type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithParams<P> = (req: Request<P>, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithBody<B> = (req: Request<{}, {}, B>, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithParamsAndBody<P, B> = (req: Request<P, {}, B>, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithQuery<Q> = (req: Request<{}, {}, {}, Q>, res: Response, next: NextFunction) => Promise<Response | void>;

// ==============================================================================
// Rutas CRUD Básicas (replicando BaseController)
// ==============================================================================

// POST /api/product_details - Crear un nuevo ProductoDetalle
router.post('/', (async (req, res) => {
    const productDetailData: CreateProductoDetallePayload = req.body;

    // Validaciones básicas de los enums si vienen en el body
    if (!Object.values(Color).includes(productDetailData.color)) {
        return res.status(400).json({ message: `Valor inválido para color: ${productDetailData.color}. Debe ser uno de ${Object.values(Color).join(', ')}` });
    }
    if (!Object.values(Talle).includes(productDetailData.talle)) {
        return res.status(400).json({ message: `Valor inválido para talle: ${productDetailData.talle}. Debe ser uno de ${Object.values(Talle).join(', ')}` });
    }

    try {
        const newProductoDetalle = await ProductDetailService.create(productDetailData);
        return res.status(201).json(newProductoDetalle);
    } catch (error: any) {
        console.error('Error al crear el detalle del producto:', error);
        if (error instanceof PrismaClientKnownRequestError) {
            if (error.code === 'P2003') { // Falla de la restricción de clave externa (productoId no existe)
                return res.status(400).json({ message: 'Producto relacionado no encontrado. Asegúrese de que el productoId sea válido.', error: error.message });
            }
        }
        // Captura general para otros errores
        return res.status(500).json({ message: 'Error al crear el detalle del producto', error: error.message });
    }
}) as AsyncRouteHandlerWithBody<CreateProductoDetallePayload>);

// GET /api/product_details/:id - Obtener un ProductoDetalle por ID
router.get('/:id', (async (req, res) => {
    const { id } = req.params;
    // Validación de entrada para el ID
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
        return res.status(400).json({ message: 'ID de detalle de producto inválido proporcionado.' });
    }

    try {
        const productoDetalle = await ProductDetailService.findById(parsedId);
        if (!productoDetalle) {
            return res.status(404).json({ message: 'Detalle de producto no encontrado o no activo' });
        }
        return res.status(200).json(productoDetalle);
    } catch (error: any) {
        console.error('Error al obtener el detalle del producto por ID:', error);
        return res.status(500).json({ message: 'Error al obtener el detalle del producto por ID', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);

// PUT /api/product_details/:id - Actualizar un ProductoDetalle
router.put('/:id', (async (req, res) => {
    const { id } = req.params;
    const productDetailData: UpdateProductoDetallePayload = req.body;

    // Validación de entrada para el ID
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
        return res.status(400).json({ message: 'ID de detalle de producto inválido proporcionado.' });
    }

    if (Object.keys(productDetailData).length === 0) {
        return res.status(400).json({ message: 'No se proporcionaron datos para la actualización.' });
    }

    // Validaciones básicas de los enums en la actualización, si se proporcionan
    if (productDetailData.color && !Object.values(Color).includes(productDetailData.color)) {
        return res.status(400).json({ message: `Valor inválido para color: ${productDetailData.color}. Debe ser uno de ${Object.values(Color).join(', ')}` });
    }
    if (productDetailData.talle && !Object.values(Talle).includes(productDetailData.talle)) {
        return res.status(400).json({ message: `Valor inválido para talle: ${productDetailData.talle}. Debe ser uno de ${Object.values(Talle).join(', ')}` });
    }

    try {
        const updatedProductoDetalle = await ProductDetailService.update(parsedId, productDetailData);
        return res.status(200).json(updatedProductoDetalle);
    } catch (error: any) {
        console.error('Error al actualizar el detalle del producto:', error);
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') { // Registro a actualizar no encontrado (o no activo)
            return res.status(404).json({ message: 'Detalle de producto no encontrado o no activo.', error: error.message });
        }
        return res.status(500).json({ message: 'Error al actualizar el detalle del producto', error: error.message });
    }
}) as AsyncRouteHandlerWithParamsAndBody<{ id: string }, UpdateProductoDetallePayload>);

// DELETE /api/product_details/:id - Desactivar (soft delete) un ProductoDetalle
router.delete('/:id', (async (req, res) => {
    const { id } = req.params;
    // Validación de entrada para el ID
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
        return res.status(400).json({ message: 'ID de detalle de producto inválido proporcionado.' });
    }

    try {
        const deletedProductoDetalle = await ProductDetailService.delete(parsedId);
        if (!deletedProductoDetalle) { // Esto solo ocurriría si el ID no existe en absoluto
            return res.status(404).json({ message: 'Detalle de producto no encontrado.' });
        }
        return res.status(200).json({ message: 'Detalle de producto desactivado exitosamente', productDetail: deletedProductoDetalle });
    } catch (error: any) {
        console.error('Error al desactivar el detalle del producto:', error);
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') { // Registro a eliminar no encontrado
            return res.status(404).json({ message: 'Detalle de producto no encontrado.', error: error.message });
        }
        return res.status(500).json({ message: 'Error al desactivar el detalle del producto', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);

// PATCH /api/product_details/reactivate/:id - Reactivar un ProductoDetalle
router.patch('/reactivate/:id', (async (req, res) => {
    const { id } = req.params;
    // Validación de entrada para el ID
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
        return res.status(400).json({ message: 'ID de detalle de producto inválido proporcionado.' });
    }

    try {
        const reactivatedProductDetail = await ProductDetailService.reactivate(parsedId);
        if (!reactivatedProductDetail) {
            return res.status(404).json({ message: 'Detalle de producto no encontrado' });
        }
        return res.status(200).json({ message: 'Detalle de producto reactivado exitosamente', productDetail: reactivatedProductDetail });
    } catch (error: any) {
        console.error('Error al reactivar el detalle del producto:', error);
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({ message: 'Detalle de producto no encontrado.', error: error.message });
        }
        return res.status(500).json({ message: 'Error al reactivar el detalle del producto', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);


// ==============================================================================
// Rutas de Búsqueda Específicas (replicando métodos del servicio de Java)
// ==============================================================================

// GET /api/product_details/producto/:productoId - Buscar detalles por ID de Producto
router.get('/producto/:productoId', (async (req, res) => {
    const { productoId } = req.params;
    // Validación de entrada para el ID
    const parsedProductoId = parseInt(productoId);
    if (isNaN(parsedProductoId)) {
        return res.status(400).json({ message: 'ID de producto inválido proporcionado.' });
    }

    try {
        const detalles = await ProductDetailService.findAllByProductoId(parsedProductoId);
        return res.status(200).json(detalles);
    } catch (error: any) {
        console.error('Error al obtener los detalles del producto por ID de producto:', error);
        return res.status(500).json({ message: 'Error al obtener los detalles del producto', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ productoId: string }>);

// GET /api/product_details/buscar - Buscar un detalle específico por ID de Producto, Talle y Color
router.get('/buscar', (async (req, res) => {
    const { productoId, talle, color } = req.query;

    if (!productoId || !talle || !color) {
        return res.status(400).json({ message: 'Faltan parámetros de consulta requeridos: productoId, talle, color' });
    }

    // Convertir y validar 'productoId'
    const parsedProductoId = parseInt(productoId as string);
    if (isNaN(parsedProductoId)) {
        return res.status(400).json({ message: 'productoId inválido proporcionado.' });
    }

    // Validar que los valores de talle y color son válidos para los enums
    if (!Object.values(Talle).includes(talle as Talle) || !Object.values(Color).includes(color as Color)) {
        return res.status(400).json({ message: `Valor de talle o color inválido. El talle debe ser uno de ${Object.values(Talle).join(', ')} y el color debe ser uno de ${Object.values(Color).join(', ')}` });
    }

    try {
        const detalle = await ProductDetailService.findByProductoIdAndTalleAndColor(
            parsedProductoId,
            talle as Talle,
            color as Color
        );
        if (!detalle) {
            return res.status(404).json({ message: 'ProductoDetalle no encontrado para los criterios dados o no activo' });
        }
        return res.status(200).json(detalle);
    } catch (error: any) {
        console.error('Error al obtener ProductoDetalle por ID de Producto, Talle, Color:', error);
        return res.status(500).json({ message: 'Error al obtener ProductoDetalle', error: error.message });
    }
}) as AsyncRouteHandlerWithQuery<{ productoId: string, talle: Talle, color: Color }>);


// GET /api/product_details/stock-mayor-a/:stockMinimo - Buscar detalles con stock mayor a un mínimo
router.get('/stock-mayor-a/:stockMinimo', (async (req, res) => {
    const { stockMinimo } = req.params;
    // Validación de entrada para stockMinimo
    const parsedStockMinimo = parseInt(stockMinimo);
    if (isNaN(parsedStockMinimo) || parsedStockMinimo < 0) {
        return res.status(400).json({ message: 'stockMinimo inválido proporcionado. Debe ser un número no negativo.' });
    }

    try {
        const detalles = await ProductDetailService.findAllByStockActualGreaterThan(parsedStockMinimo);
        return res.status(200).json(detalles);
    } catch (error: any) {
        console.error('Error al obtener ProductoDetalles con stock mayor que:', error);
        return res.status(500).json({ message: 'Error al obtener ProductoDetalles', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ stockMinimo: string }>);

// GET /api/product_details/filtrar - Filtrar detalles por múltiples opciones
router.get('/filtrar', (async (req, res) => {
    const { productoId, color, talle, stockMin } = req.query;

    // Convertir a los tipos correctos y manejar opcionales
    const parsedProductoId = productoId ? parseInt(productoId as string) : undefined;
    const parsedColor = color ? (color as Color) : undefined;
    const parsedTalle = talle ? (talle as Talle) : undefined;
    const parsedStockMin = stockMin ? parseInt(stockMin as string) : undefined;

    // Opcional: Validar si los enums son válidos si no son undefined
    if (parsedColor && !Object.values(Color).includes(parsedColor)) {
        return res.status(400).json({ message: `Valor inválido para color: ${parsedColor}.` });
    }
    if (parsedTalle && !Object.values(Talle).includes(parsedTalle)) {
        return res.status(400).json({ message: `Valor inválido para talle: ${parsedTalle}.` });
    }
    if (parsedStockMin !== undefined && isNaN(parsedStockMin)) {
        return res.status(400).json({ message: 'stockMin inválido proporcionado. Debe ser un número.' });
    }
    if (parsedProductoId !== undefined && isNaN(parsedProductoId)) {
        return res.status(400).json({ message: 'productoId inválido proporcionado. Debe ser un número.' });
    }

    try {
        const detalles = await ProductDetailService.filtrarPorOpciones(
            parsedProductoId,
            parsedColor,
            parsedTalle,
            parsedStockMin
        );
        return res.status(200).json(detalles);
    } catch (error: any) {
        console.error('Error al filtrar ProductoDetalles por opciones:', error);
        return res.status(500).json({ message: 'Error al filtrar ProductoDetalles', error: error.message });
    }
}) as AsyncRouteHandlerWithQuery<{ productoId?: string, color?: string, talle?: string, stockMin?: string }>);


// GET /api/product_details/talles/:productoId - Obtener talles disponibles para un producto
router.get('/talles/:productoId', (async (req, res) => {
    const { productoId } = req.params;
    // Validación de entrada para el ID
    const parsedProductoId = parseInt(productoId);
    if (isNaN(parsedProductoId)) {
        return res.status(400).json({ message: 'ID de producto inválido proporcionado.' });
    }

    try {
        const talles = await ProductDetailService.obtenerTallesDisponibles(parsedProductoId);
        return res.status(200).json(talles);
    } catch (error: any) {
        console.error('Error al obtener talles disponibles:', error);
        return res.status(500).json({ message: 'Error al obtener talles', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ productoId: string }>);

// GET /api/product_details/colores/:productoId - Obtener colores disponibles para un producto
router.get('/colores/:productoId', (async (req, res) => {
    const { productoId } = req.params;
    // Validación de entrada para el ID
    const parsedProductoId = parseInt(productoId);
    if (isNaN(parsedProductoId)) {
        return res.status(400).json({ message: 'ID de producto inválido proporcionado.' });
    }

    try {
        const colores = await ProductDetailService.obtenerColoresDisponibles(parsedProductoId);
        return res.status(200).json(colores);
    } catch (error: any) {
        console.error('Error al obtener colores disponibles:', error);
        return res.status(500).json({ message: 'Error al obtener colores', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ productoId: string }>);

// POST /api/product_details/descontar-stock - Descontar stock de un detalle de producto
router.post('/descontar-stock', (async (req, res) => {
    const { productoDetalleId, cantidad } = req.body;

    if (!productoDetalleId || !cantidad) {
        return res.status(400).json({ message: 'Faltan campos requeridos: productoDetalleId, cantidad' });
    }
    // Convertir a número y validar
    const parsedProductoDetalleId = parseInt(productoDetalleId as string);
    const parsedCantidad = parseInt(cantidad as string);

    if (isNaN(parsedProductoDetalleId)) {
        return res.status(400).json({ message: 'productoDetalleId inválido proporcionado. Debe ser un número.' });
    }
    if (isNaN(parsedCantidad) || parsedCantidad <= 0) {
        return res.status(400).json({ message: 'La cantidad debe ser un número positivo.' });
    }

    try {
        await ProductDetailService.descontarStock(parsedProductoDetalleId, parsedCantidad);
        return res.status(200).json({ message: 'Stock descontado correctamente' });
    } catch (error: any) {
        console.error('Error al descontar stock:', error);
        // Manejo específico para errores de stock insuficiente
        if (error.message.includes('Stock insuficiente')) {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: 'Error al descontar stock', error: error.message });
    }
}) as AsyncRouteHandlerWithBody<{ productoDetalleId: string; cantidad: string }>);

// GET /api/product_details/disponible - Verificar disponibilidad de un detalle específico
router.get('/disponible', (async (req, res) => {
    const { productoId, talle, color } = req.query;

    if (!productoId || !talle || !color) {
        return res.status(400).json({ message: 'Faltan parámetros de consulta requeridos: productoId, talle, color' });
    }

    // Convertir y validar 'productoId'
    const parsedProductoId = parseInt(productoId as string);
    if (isNaN(parsedProductoId)) {
        return res.status(400).json({ message: 'productoId inválido proporcionado.' });
    }

    // Validar que los valores de talle y color sean válidos para los enums
    if (!Object.values(Talle).includes(talle as Talle) || !Object.values(Color).includes(color as Color)) {
        return res.status(400).json({ message: `Valor de talle o color inválido. El talle debe ser uno de ${Object.values(Talle).join(', ')} y el color debe ser uno de ${Object.values(Color).join(', ')}` });
    }

    try {
        const disponible = await ProductDetailService.estaDisponible(
            parsedProductoId,
            talle as Talle,
            color as Color
        );
        return res.status(200).json({ disponible });
    } catch (error: any) {
        console.error('Error al verificar disponibilidad:', error);
        return res.status(500).json({ message: 'Error al verificar disponibilidad', error: error.message });
    }
}) as AsyncRouteHandlerWithQuery<{ productoId: string, talle: Talle, color: Color }>);

export default router;