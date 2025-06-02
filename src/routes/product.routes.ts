// src/routes/product.routes.ts

import { Router, Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service'; // Solo importamos el servicio
import { CreateProductPayload, UpdateProductPayload } from '../types/product'; // Asumiendo que definiste estos tipos aquí
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Sexo } from '@prisma/client';
import { ProductFilters } from '../types/baseDTO'; // Asumiendo que ProductFilters está aquí

const router = Router();

// Definir tipos auxiliares para los manejadores de ruta asíncronos
type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithParams<P> = (req: Request<P>, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithBody<B> = (req: Request<{}, {}, B>, res: Response, next: NextFunction) => Promise<Response | void>;
type AsyncRouteHandlerWithParamsAndBody<P, B> = (req: Request<P, {}, B>, res: Response, next: NextFunction) => Promise<Response | void>;

// ==============================================================================
// RUTAS DE PRODUCTO (adaptadas al estilo DTO de Java)
// ==============================================================================

// GET /api/productos/dto - Obtener todos los productos activos (como DTOs)
router.get('/dto', (async (req, res) => {
    try {
        const productsDTO = await ProductService.obtenerTodosLosProductosDTO();
        return res.status(200).json(productsDTO);
    } catch (error: any) {
        console.error('Error fetching all products DTOs:', error);
        return res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
}) as AsyncRouteHandler);

// GET /api/products/dto/promociones - Obtener productos promocionales (como DTOs)
router.get('/dto/promociones', (async (req, res) => {
    try {
        const productsDTO = await ProductService.obtenerProductosPromocionalesDTO();
        return res.status(200).json(productsDTO);
    } catch (error: any) {
        console.error('Error fetching promotional products DTOs:', error);
        return res.status(500).json({ message: 'Error fetching promotional products', error: error.message });
    }
}) as AsyncRouteHandler);

// GET /api/products/dto/:id - Obtener un producto por ID (como DTO)
router.get('/dto/:id', (async (req, res) => {
    const { id } = req.params;
    try {
        const productDTO = await ProductService.obtenerProductoDTOPorId(parseInt(id));
        if (!productDTO) {
            return res.status(404).json({ message: 'Product not found' });
        }
        return res.status(200).json(productDTO);
    } catch (error: any) {
        console.error('Error fetching product DTO by ID:', error);
        return res.status(500).json({ message: 'Error fetching product by ID', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);

// POST /api/products - Crear un nuevo producto (retorna la entidad Prisma, no DTO directamente en creación)
router.post('/', (async (req, res) => {
    const productData: CreateProductPayload = req.body;

    // Validaciones básicas antes de enviar al servicio
    if (!productData.denominacion || productData.precioVenta === undefined || !productData.sexo) {
        return res.status(400).json({ message: 'Missing required fields: denominacion, precioVenta, sexo' });
    }
    // Opcional: Validar que el sexo sea un valor válido del enum Sexo
    if (productData.sexo && !Object.values(Sexo).includes(productData.sexo)) {
        return res.status(400).json({ message: `Invalid value for sexo: ${productData.sexo}. Must be one of ${Object.values(Sexo).join(', ')}` });
    }

    try {
        const newProduct = await ProductService.createProduct(productData);
        return res.status(201).json(newProduct); // Devuelve la entidad Prisma directamente
    } catch (error: any) {
        console.error('Error creating product:', error);
        if (error instanceof PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                return res.status(409).json({ message: 'A product with this unique field already exists.', error: error.message });
            }
            if (error.code === 'P2025') {
                return res.status(400).json({ message: 'One or more related records (category, discount) not found.', error: error.message });
            }
        }
        return res.status(500).json({ message: 'Error creating product', error: error.message });
    }
}) as AsyncRouteHandlerWithBody<CreateProductPayload>);

// PUT /api/products/:id - Actualizar un producto existente (retorna la entidad Prisma)
router.put('/:id', (async (req, res) => {
    const { id } = req.params;
    const productData: UpdateProductPayload = req.body;

    if (Object.keys(productData).length === 0) {
        return res.status(400).json({ message: 'No data provided for update.' });
    }
    // Opcional: Validar que el sexo sea un valor válido del enum Sexo si se proporciona
    if (productData.sexo && !Object.values(Sexo).includes(productData.sexo)) {
        return res.status(400).json({ message: `Invalid value for sexo: ${productData.sexo}. Must be one of ${Object.values(Sexo).join(', ')}` });
    }

    try {
        const updatedProduct = await ProductService.updateProduct(parseInt(id), productData);
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found or not active' });
        }
        return res.status(200).json(updatedProduct); // Devuelve la entidad Prisma directamente
    } catch (error: any) {
        console.error('Error updating product:', error);
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({ message: 'Product not found or related record not found.', error: error.message });
        }
        return res.status(500).json({ message: 'Error updating product', error: error.message });
    }
}) as AsyncRouteHandlerWithParamsAndBody<{ id: string }, UpdateProductPayload>);

// DELETE (soft delete) /api/products/:id - Desactivar un producto
router.delete('/:id', (async (req, res) => {
    const { id } = req.params;
    try {
        const deactivatedProduct = await ProductService.deleteProduct(parseInt(id));
        if (!deactivatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        return res.status(200).json({ message: 'Product deactivated successfully', product: deactivatedProduct });
    } catch (error: any) {
        console.error('Error deactivating product:', error);
        return res.status(500).json({ message: 'Error deactivating product', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);

// PATCH /api/products/reactivate/:id - Reactivar un producto
router.patch('/reactivate/:id', (async (req, res) => {
    const { id } = req.params;
    try {
        const reactivatedProduct = await ProductService.reactivateProduct(parseInt(id));
        if (!reactivatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        return res.status(200).json({ message: 'Product reactivated successfully', product: reactivatedProduct });
    } catch (error: any) {
        console.error('Error reactivating product:', error);
        return res.status(500).json({ message: 'Error reactivating product', error: error.message });
    }
}) as AsyncRouteHandlerWithParams<{ id: string }>);

// --- Endpoints para obtener listas de filtros disponibles (como Strings) ---

router.get('/categorias', (async (req, res) => {
    try {
        const categorias = await ProductService.getAllAvailableCategories();
        return res.status(200).json(categorias);
    } catch (error: any) {
        console.error('Error fetching available categories:', error);
        return res.status(500).json({ message: 'Error fetching categories', error: error.message });
    }
}) as AsyncRouteHandler);

router.get('/colores', (async (req, res) => {
    try {
        const colores = await ProductService.getAllAvailableColors();
        return res.status(200).json(colores);
    } catch (error: any) {
        console.error('Error fetching available colors:', error);
        return res.status(500).json({ message: 'Error fetching colors', error: error.message });
    }
}) as AsyncRouteHandler);

router.get('/talles', (async (req, res) => {
    try {
        const talles = await ProductService.getAllAvailableTalles();
        return res.status(200).json(talles);
    } catch (error: any) {
        console.error('Error fetching available talles:', error);
        return res.status(500).json({ message: 'Error fetching talles', error: error.message });
    }
}) as AsyncRouteHandler);

// POST /api/products/filtrar - Endpoint para filtrar y ordenar productos
router.post('/filtrar', (async (req, res) => {
    const filters: ProductFilters = req.body; // El cuerpo de la solicitud es el objeto de filtros

    try {
        const productsDTO = await ProductService.filtrarYOrdenarProductos(filters);
        return res.status(200).json(productsDTO);
    } catch (error: any) {
        console.error('Error filtering and sorting products:', error);
        return res.status(500).json({ message: 'Error filtering products', error: error.message });
    }
}) as AsyncRouteHandlerWithBody<ProductFilters>);

export default router;