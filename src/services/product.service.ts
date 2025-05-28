// src/services/product.service.ts

import { Prisma, Color, Sexo, Talle, Categoria, Descuento, Imagen, ProductoDetalle } from '@prisma/client';
import prisma from '../config/prisma';
import { ProductoDTO, CategoriaDTO, ImagenDTO, ProductoDetalleDTO, CreateProductPayload, UpdateProductPayload } from '../types/product.d';
import { ProductFilters } from '../types/baseDTO';

// ==============================================================================
// SERVICIO DE PRODUCTO
// ==============================================================================

export const ProductService = {

    // ==============================================================================
    // Métodos de Mapeo a DTOs (adaptados de Java)
    // ==============================================================================

    mapearProductoADTO: async (producto: Prisma.ProductoGetPayload<{
        include: {
            categorias: { include: { subcategorias: true } };
            imagenes: true;
            productos_detalles: true;
            descuentos: true;
        }
    }>): Promise<ProductoDTO> => {
        if (!producto) {
            throw new Error("Producto no encontrado para mapeo DTO.");
        }

        const productoDTO: ProductoDTO = {
            id: producto.id,
            denominacion: producto.denominacion,
            precioOriginal: producto.precioVenta,
            precioFinal: await ProductService.calcularPrecioFinal(producto),
            tienePromocion: producto.tienePromocion,
            sexo: producto.sexo,
            categorias: producto.categorias.map(cat => ProductService.mapearCategoriaADTO(cat)),
            imagenes: producto.imagenes.map(img => ({ id: img.id, denominacion: img.denominacion })),
            productos_detalles: producto.productos_detalles.map(pd => ({
                id: pd.id,
                precioCompra: pd.precioCompra,
                stockActual: pd.stockActual,
                cantidad: pd.cantidad,
                stockMaximo: pd.stockMaximo,
                color: pd.color as unknown as string, // Ajuste para mapear el enum a string en el DTO
                talle: pd.talle as unknown as string, // Ajuste para mapear el enum a string en el DTO
            })),
        };
        return productoDTO;
    },

    mapearCategoriaADTO: (categoriaEntity: Categoria & { subcategorias?: Categoria[] }): CategoriaDTO => {
        if (!categoriaEntity) {
            throw new Error("Categoría no encontrada para mapeo DTO.");
        }
        const categoriaDTO: CategoriaDTO = {
            id: categoriaEntity.id,
            denominacion: categoriaEntity.denominacion,
        };
        if (categoriaEntity.subcategorias && categoriaEntity.subcategorias.length > 0) {
            categoriaDTO.subcategorias = categoriaEntity.subcategorias.map(subcat => ProductService.mapearCategoriaADTO(subcat));
        }
        return categoriaDTO;
    },

    // ==============================================================================
    // Lógica de Negocio (adaptada de Java)
    // ==============================================================================

    calcularPrecioFinal: async (producto: { precioVenta: number; tienePromocion: boolean; descuentos: Descuento[] }): Promise<number> => {
        let precioActual = producto.precioVenta;

        if (!producto.tienePromocion || !producto.descuentos || producto.descuentos.length === 0) {
            return precioActual;
        }

        const hoy = new Date();
        const hoySoloFecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
        const horaActualSegundos = hoy.getHours() * 3600 + hoy.getMinutes() * 60 + hoy.getSeconds();

        let precioConDescuentoMasAlto = precioActual;

        for (const descuento of producto.descuentos) {
            const fechaDesde = descuento.fechaDesde ? new Date(descuento.fechaDesde).setUTCHours(0, 0, 0, 0) : null;
            const fechaHasta = descuento.fechaHasta ? new Date(descuento.fechaHasta).setUTCHours(23, 59, 59, 999) : null;

            const horaDesdeSegundos = descuento.horaDesde ? (new Date(descuento.horaDesde).getUTCHours() * 3600 + new Date(descuento.horaDesde).getUTCMinutes() * 60 + new Date(descuento.horaDesde).getUTCSeconds()) : null;
            const horaHastaSegundos = descuento.horaHasta ? (new Date(descuento.horaHasta).getUTCHours() * 3600 + new Date(descuento.horaHasta).getUTCMinutes() * 60 + new Date(descuento.horaHasta).getUTCSeconds()) : null;

            const fechaValida = (!fechaDesde || hoySoloFecha >= fechaDesde) &&
                                 (!fechaHasta || hoySoloFecha <= fechaHasta);
            const horaValida = (!horaDesdeSegundos || horaActualSegundos >= horaDesdeSegundos) &&
                                 (!horaHastaSegundos || horaActualSegundos <= horaHastaSegundos);

            if (fechaValida && horaValida) {
                const precioAplicandoEsteDescuento = precioActual * (1 - descuento.precioPromocional);

                // ¡ERROR DE TIPEO CORREGIDO AQUÍ!
                if (precioAplicandoEsteDescuento < precioConDescuentoMasAlto) {
                    precioConDescuentoMasAlto = precioAplicandoEsteDescuento;
                }
            }
        }
        return precioConDescuentoMasAlto;
    },

    // ==============================================================================
    // Operaciones CRUD y Búsqueda (adaptadas de Java)
    // ==============================================================================

    obtenerTodosLosProductosDTO: async (): Promise<ProductoDTO[]> => {
        const todosLosProductos = await prisma.producto.findMany({
            where: { activo: true },
            include: {
                categorias: { include: { subcategorias: true } },
                imagenes: true,
                productos_detalles: true,
                descuentos: true,
            }
        });
        return Promise.all(todosLosProductos.map(p => ProductService.mapearProductoADTO(p)));
    },

    obtenerProductosPromocionalesDTO: async (): Promise<ProductoDTO[]> => {
        const productosPromocionales = await prisma.producto.findMany({
            where: {
                activo: true,
                tienePromocion: true
            },
            include: {
                categorias: { include: { subcategorias: true } },
                imagenes: true,
                productos_detalles: true,
                descuentos: true,
            }
        });
        const productosFiltradosPorPromocionActiva = await Promise.all(
            productosPromocionales.map(async p => {
                const precioFinal = await ProductService.calcularPrecioFinal(p);
                if (precioFinal < p.precioVenta) {
                    return ProductService.mapearProductoADTO(p);
                }
                return null;
            })
        );
        return productosFiltradosPorPromocionActiva.filter(p => p !== null) as ProductoDTO[];
    },

    obtenerProductoDTOPorId: async (id: number): Promise<ProductoDTO | null> => {
        const producto = await prisma.producto.findUnique({
            where: { id, activo: true },
            include: {
                categorias: { include: { subcategorias: true } },
                imagenes: true,
                productos_detalles: true,
                descuentos: true,
            }
        });
        if (!producto) {
            return null;
        }
        return ProductService.mapearProductoADTO(producto);
    },

    createProduct: async (productData: CreateProductPayload) => {
        const { categoriaIds, descuentoIds, imagenes, productos_detalles, ...dataWithoutRelations } = productData;

        // Mapea los productos_detalles para que los colores y talles sean enums de Prisma
        const createProductoDetalles = productos_detalles?.map(pd => ({
            ...pd,
            color: pd.color, // Ya es Color (enum)
            talle: pd.talle, // Ya es Talle (enum)
        }));

        return prisma.producto.create({
            data: {
                ...dataWithoutRelations,
                activo: true,
                categorias: {
                    connect: categoriaIds?.map(id => ({ id })) || [],
                },
                descuentos: {
                    connect: descuentoIds?.map(id => ({ id })) || [],
                },
                imagenes: {
                    create: imagenes || [],
                },
                productos_detalles: {
                    create: createProductoDetalles || [],
                },
            },
            include: {
                categorias: true,
                imagenes: true,
                productos_detalles: true,
                descuentos: true,
            }
        });
    },

    updateProduct: async (id: number, productData: UpdateProductPayload) => {
        const { categoriaIds, descuentoIds, imagenes, productos_detalles, ...dataToUpdate } = productData;

        const updateData: Prisma.ProductoUpdateInput = {
            ...dataToUpdate,
        };

        if (categoriaIds !== undefined) {
            updateData.categorias = {
                set: categoriaIds.map(catId => ({ id: catId }))
            };
        }
        if (descuentoIds !== undefined) {
            updateData.descuentos = {
                set: descuentoIds.map(descId => ({ id: descId }))
            };
        }

        return prisma.producto.update({
            where: { id, activo: true },
            data: updateData,
            include: {
                categorias: true,
                imagenes: true,
                productos_detalles: true,
                descuentos: true,
            }
        });
    },

    deleteProduct: async (id: number) => {
        const product = await prisma.producto.findUnique({ where: { id } });
        if (!product) {
            return null;
        }
        return prisma.producto.update({
            where: { id },
            data: { activo: false },
        });
    },

    reactivateProduct: async (id: number) => {
        const product = await prisma.producto.findUnique({ where: { id } });
        if (!product) {
            return null;
        }
        return prisma.producto.update({
            where: { id },
            data: { activo: true },
        });
    },

    getAllAvailableCategories: async (): Promise<string[]> => {
        const categories = await prisma.categoria.findMany({
            where: { activo: true },
            select: { denominacion: true },
            distinct: ['denominacion']
        });
        return categories.map(c => c.denominacion).sort();
    },

    getAllAvailableColors: async (): Promise<string[]> => {
        const colors = await prisma.productoDetalle.findMany({
            // Eliminado where: { color: { not: null } } si el campo 'color' no es nullable en schema.prisma
            // Si 'color' es nullable (Color?), podrías dejarlo para asegurar que solo obtienes valores no nulos de la DB
            where: { activo: true },
            select: { color: true },
            distinct: ['color']
        });
        return colors
            .map(pd => pd.color)
            .filter((c): c is Color => c !== null) // Este filtro es clave si 'color' es nullable en tu DB
            .map(c => c.toString())
            .sort();
    },

    getAllAvailableTalles: async (): Promise<string[]> => {
        const talles = await prisma.productoDetalle.findMany({
            // Eliminado where: { talle: { not: null } } si el campo 'talle' no es nullable en schema.prisma
            // Si 'talle' es nullable (Talle?), podrías dejarlo para asegurar que solo obtienes valores no nulos de la DB
            where: { activo: true },
            select: { talle: true },
            distinct: ['talle']
        });
        return talles
            .map(pd => pd.talle)
            .filter((t): t is Talle => t !== null) // Este filtro es clave si 'talle' es nullable en tu DB
            .map(t => t.toString())
            .sort();
    },

    filtrarYOrdenarProductos: async (filters: ProductFilters): Promise<ProductoDTO[]> => {
        const {
            denominacion,
            categorias,
            sexo,
            tienePromocion,
            minPrice,
            maxPrice,
            colores,
            talles,
            stockMinimo,
            orderBy,
            orderDirection
        } = filters;

        const where: Prisma.ProductoWhereInput = {
            activo: true,
        };

        const productoDetalleSomeFilter: Prisma.ProductoDetalleWhereInput = {
            activo: true // Siempre filtramos por detalles activos
        };

        if (denominacion) {
            where.denominacion = {
                contains: denominacion,
                mode: 'insensitive'
            } as Prisma.StringFilter;
        }
        if (sexo) {
            where.sexo = sexo;
        }
        if (tienePromocion !== undefined) {
            where.tienePromocion = tienePromocion;
        }
        if (minPrice !== undefined || maxPrice !== undefined) {
            where.precioVenta = {};
            if (minPrice !== undefined) (where.precioVenta as Prisma.FloatFilter).gte = minPrice;
            if (maxPrice !== undefined) (where.precioVenta as Prisma.FloatFilter).lte = maxPrice;
        }

        if (categorias && categorias.length > 0) {
            where.categorias = {
                some: {
                    denominacion: { in: categorias },
                    activo: true
                }
            };
        }

        if (colores && colores.length > 0) {
            const validEnumColors = colores
                .map(c => c.toUpperCase())
                .filter((c): c is Color => Object.values(Color).includes(c as Color));

            if (validEnumColors.length > 0) {
                productoDetalleSomeFilter.color = { in: validEnumColors };
            }
        }

        if (talles && talles.length > 0) {
            const validEnumTalles = talles
                .map(t => t.toUpperCase())
                .filter((t): t is Talle => Object.values(Talle).includes(t as Talle));

            if (validEnumTalles.length > 0) {
                productoDetalleSomeFilter.talle = { in: validEnumTalles };
            }
        }

        if (stockMinimo !== undefined) {
            productoDetalleSomeFilter.stockActual = { gte: stockMinimo };
        }

        const hasSpecificProductDetailFilters = Object.keys(productoDetalleSomeFilter).some(key =>
            key !== 'activo' || (key === 'activo' && Object.keys(productoDetalleSomeFilter).length > 1)
        );

        if (hasSpecificProductDetailFilters) {
            where.productos_detalles = {
                some: productoDetalleSomeFilter
            };
        }

        const orderByOption: Prisma.ProductoOrderByWithRelationInput | undefined = orderBy ? {
            [orderBy]: orderDirection || 'asc'
        } : undefined;

        const productosFiltradosYOrdenados = await prisma.producto.findMany({
            where,
            orderBy: orderByOption,
            include: {
                categorias: { include: { subcategorias: true } },
                imagenes: true,
                productos_detalles: true,
                descuentos: true,
            }
        });

        return Promise.all(productosFiltradosYOrdenados.map(p => ProductService.mapearProductoADTO(p)));
    },
};