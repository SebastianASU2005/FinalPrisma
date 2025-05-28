// src/services/usuario.service.ts

import prisma from '../config/prisma'; // Asegúrate de que tu instancia de Prisma esté configurada
import { Prisma } from '@prisma/client'; // Importa tipos de Prisma
import {
    CreateUsuarioPayload,
    UpdateUserProfilePayload,
    UpdateCredentialsPayload,
    AddressPayload,
    UserResponseDTO,
    AddressResponseDTO,
    LocalidadResponseDTO,
    ProvinciaResponseDTO,
    ImagenResponseDTO,
    UsuarioWithRelations,
    UsuarioWithEmail // Para tipos de datos específicos
} from '../types/usuario.d';
// IMPORTANTE: NO HAY bcrypt NI jsonwebtoken AQUÍ TODAVÍA.
// Esto se manejará en una capa de autenticación o en el controlador/middleware específico.

import path from 'path'; // Para manejar rutas de archivos
import fs from 'fs/promises'; // Para operaciones de sistema de archivos asíncronas
import { v4 as uuidv4 } from 'uuid'; // Para generar IDs únicos

// Directorio de subida de imágenes y URL base.
// Estos deberían ser configurables a través de variables de entorno.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'; // Asegúrate de que esta URL sea correcta para tu servidor web


export const UserService = {

    // =========================================================================================
    // Métodos Auxiliares de Mapeo
    // =========================================================================================

    /**
     * Mapea un objeto Usuario (con relaciones) de Prisma a un UserResponseDTO.
     * Esto asegura que la API devuelva una estructura consistente y oculte campos sensibles.
     * @param usuario El objeto Usuario de Prisma con sus relaciones.
     * @returns El DTO de respuesta.
     */
    mapToUserDTO: (usuario: UsuarioWithRelations): UserResponseDTO => {
        // Asegúrate de que el objeto usuario no sea null o undefined antes de intentar mapear
        if (!usuario) {
            throw new Error("No se puede mapear un usuario nulo a DTO.");
        }

        // Mapeo de direcciones
        const direccionesDTOs: AddressResponseDTO[] = usuario.direcciones.map(dir => ({
            id: dir.id,
            calle: dir.calle,
            numero: dir.numero,
            piso: dir.piso,
            departamento: dir.departamento,
            cp: dir.cp,
            localidad: {
                id: dir.localidad.id,
                nombre: dir.localidad.nombre,
                // Si la provincia está incluida, la mapeamos
                provincia: dir.localidad.provincia ? {
                    id: dir.localidad.provincia.id,
                    nombre: dir.localidad.provincia.nombre,
                } : undefined, // Si no hay provincia, no se incluye
            },
        }));

        // Mapeo de imagen de perfil
        const imagenDTO: ImagenResponseDTO | null = usuario.imagenUser ? {
            id: usuario.imagenUser.id,
            url: usuario.imagenUser.denominacion, // 'denominacion' es la URL en tu entidad Imagen de Java
        } : null;

        // Construcción del DTO final
        return {
            id: usuario.id,
            username: usuario.userName,
            firstname: usuario.nombre,
            lastname: usuario.apellido,
            email: usuario.email,
            dni: usuario.dni,
            sexo: usuario.sexo,
            // Formatear la fecha a "YYYY-MM-DD" si existe
            fechaNacimiento: usuario.fechaNacimiento ? usuario.fechaNacimiento.toISOString().split('T')[0] : null,
            telefono: usuario.telefono,
            addresses: direccionesDTOs,
            role: usuario.rol,
            profileImage: imagenDTO,
            activo: usuario.activo // Incluir el estado activo
        };
    },

    /**
     * Mapea un objeto Direccion de Prisma a un DomicilioDTO.
     * @param direccion El objeto Direccion de Prisma con sus relaciones.
     * @returns El DTO de respuesta de la dirección.
     */
    mapToDomicilioDTO: (direccion: Prisma.DireccionGetPayload<{ include: { localidad: { include: { provincia: true } } } }>): AddressResponseDTO => {
        if (!direccion) {
            throw new Error("No se puede mapear una dirección nula a DTO.");
        }

        const localidadDTO: LocalidadResponseDTO = {
            id: direccion.localidad.id,
            nombre: direccion.localidad.nombre,
            provincia: direccion.localidad.provincia ? {
                id: direccion.localidad.provincia.id,
                nombre: direccion.localidad.provincia.nombre,
            } : undefined,
        };

        return {
            id: direccion.id,
            calle: direccion.calle,
            numero: direccion.numero,
            piso: direccion.piso,
            departamento: direccion.departamento,
            cp: direccion.cp,
            localidad: localidadDTO,
        };
    },

    // =========================================================================================
    // Métodos CRUD Básicos para Usuario
    // =========================================================================================

    /**
     * Crea un nuevo Usuario.
     * Nota: La encriptación de la contraseña (si se usa) y la validación de unicidad
     * se manejarán en la capa superior (ej. en el controlador o un servicio de autenticación).
     * @param data Los datos para crear el Usuario.
     * @returns El Usuario creado con sus relaciones.
     */
    create: async (data: CreateUsuarioPayload): Promise<UsuarioWithRelations> => {
        // Validación de unicidad aquí es importante, incluso si se hace en una capa superior
        // para asegurar la integridad de la base de datos.
        const existingUserByUsername = await prisma.usuario.findFirst({
            where: { userName: data.userName, activo: true }
        });
        if (existingUserByUsername) {
            throw new Error(`El nombre de usuario '${data.userName}' ya está en uso por una cuenta activa.`);
        }

        const existingUserByEmail = await prisma.usuario.findFirst({
            where: { email: data.email, activo: true }
        });
        if (existingUserByEmail) {
            throw new Error(`El email '${data.email}' ya está en uso por una cuenta activa.`);
        }

        // Convertir fechaNacimiento a Date si existe
        const fechaNacimientoDate = data.fechaNacimiento ? new Date(data.fechaNacimiento) : null;

        return prisma.usuario.create({
            data: {
                auth0Id: data.auth0Id,
                userName: data.userName,
                password: data.password || '', // Asume que la contraseña se manejará. Podría ser hasheada aquí.
                nombre: data.nombre,
                apellido: data.apellido,
                email: data.email,
                dni: data.dni,
                sexo: data.sexo,
                fechaNacimiento: fechaNacimientoDate,
                telefono: data.telefono,
                rol: data.rol,
                activo: data.activo ?? true, // Por defecto true
            },
            include: { // Incluir relaciones comunes para DTO de respuesta
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Busca un Usuario por su ID.
     * @param id El ID del Usuario.
     * @param includeInactive Si es true, busca usuarios inactivos también. Por defecto false.
     * @returns El Usuario encontrado o null.
     */
    findById: async (id: number, includeInactive: boolean = false): Promise<UsuarioWithRelations | null> => {
        const whereClause: Prisma.UsuarioWhereUniqueInput & Prisma.UsuarioWhereInput = { id: id };
        if (!includeInactive) {
            whereClause.activo = true;
        }

        return prisma.usuario.findUnique({
            where: whereClause,
            include: {
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Obtiene todos los Usuarios.
     * @param includeInactive Si es true, incluye usuarios inactivos. Por defecto false.
     * @returns Una lista de Usuarios.
     */
    findAll: async (includeInactive: boolean = false): Promise<UsuarioWithRelations[]> => {
        const whereClause: Prisma.UsuarioWhereInput = {};
        if (!includeInactive) {
            whereClause.activo = true;
        }

        return prisma.usuario.findMany({
            where: whereClause,
            include: {
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Busca un usuario por su nombre de usuario.
     * @param userName El nombre de usuario.
     * @param includeInactive Si es true, busca usuarios inactivos también. Por defecto false.
     * @returns El usuario encontrado o null.
     */
    findByUserName: async (userName: string, includeInactive: boolean = false): Promise<UsuarioWithRelations | null> => {
        const whereClause: Prisma.UsuarioWhereInput = { userName: userName };
        if (!includeInactive) {
            whereClause.activo = true;
        }
        return prisma.usuario.findFirst({
            where: whereClause,
            include: {
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Busca un usuario por su email.
     * @param email El email del usuario.
     * @param includeInactive Si es true, busca usuarios inactivos también. Por defecto false.
     * @returns El usuario encontrado o null.
     */
    findByEmail: async (email: string, includeInactive: boolean = false): Promise<UsuarioWithRelations | null> => {
        const whereClause: Prisma.UsuarioWhereInput = { email: email };
        if (!includeInactive) {
            whereClause.activo = true;
        }
        return prisma.usuario.findFirst({
            where: whereClause,
            include: {
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Cuenta el número de usuarios activos con un email específico.
     * Útil para validar unicidad al registrar.
     * @param email El email a buscar.
     * @returns El número de usuarios.
     */
    countByEmailAndActivoTrue: async (email: string): Promise<number> => {
        return prisma.usuario.count({
            where: {
                email: email,
                activo: true
            }
        });
    },

    /**
     * Actualiza el perfil de un Usuario existente.
     * @param userId El ID del Usuario a actualizar.
     * @param data Los datos a actualizar.
     * @returns El Usuario actualizado.
     */
    updateProfile: async (userId: number, data: UpdateUserProfilePayload): Promise<UserResponseDTO> => {
        // Primero, obtener el usuario para verificar el estado activo y las direcciones existentes
        const usuario = await prisma.usuario.findUnique({
            where: { id: userId },
            include: {
                direcciones: {
                    include: {
                        localidad: true // Necesitamos la localidad para la relación
                    }
                },
                imagenUser: true, // Incluir la imagen para el mapeo final
            },
        });

        if (!usuario) {
            throw new Error(`Usuario con ID ${userId} no encontrado.`);
        }
        if (!usuario.activo) {
            throw new Error("La cuenta está desactivada y no puede ser modificada.");
        }

        const updateData: Prisma.UsuarioUpdateInput = {
            nombre: data.nombre,
            apellido: data.apellido,
            dni: data.dni,
            sexo: data.sexo,
            fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : undefined,
            telefono: data.telefono,
            fechaModificacion: new Date(), // Agregar fecha de modificación
        };

        // --- Manejo de direcciones anidadas ---
        if (data.addresses !== undefined) {
            // Si el array de direcciones está vacío, borra todas las direcciones existentes del usuario
            if (data.addresses.length === 0) {
                // Elimina todas las direcciones asociadas al usuario
                await prisma.direccion.deleteMany({
                    where: { usuarioId: userId },
                });
            } else {
                // 1. Identificar direcciones existentes que ya no están en el payload (para eliminar)
                const idsToKeep = data.addresses.filter(addr => addr.id).map(addr => addr.id!); // IDs que se enviaron y tienen ID
                const idsToDelete = usuario.direcciones
                    .filter(existingAddr => !idsToKeep.includes(existingAddr.id)) // Direcciones existentes que no están en el payload
                    .map(addr => addr.id);

                if (idsToDelete.length > 0) {
                    await prisma.direccion.deleteMany({
                        where: {
                            id: { in: idsToDelete },
                            usuarioId: userId, // Asegurarse de que pertenecen a este usuario
                        },
                    });
                }

                // 2. Procesar direcciones en el payload (crear nuevas o actualizar existentes)
                for (const addressPayload of data.addresses) {
                    if (addressPayload.id) {
                        // Es una actualización de dirección existente
                        await prisma.direccion.update({
                            where: { id: addressPayload.id, usuarioId: userId },
                            data: {
                                calle: addressPayload.calle,
                                numero: typeof addressPayload.numero === 'string' ? parseInt(addressPayload.numero) : addressPayload.numero,
                                piso: addressPayload.piso,
                                departamento: addressPayload.departamento,
                                cp: typeof addressPayload.cp === 'string' ? parseInt(addressPayload.cp) : addressPayload.cp,
                                localidad: { connect: { id: addressPayload.localidad.id } }, // Conectar la localidad por ID
                            },
                        });
                    } else {
                        // Es una nueva dirección para crear
                        await prisma.direccion.create({
                            data: {
                                calle: addressPayload.calle,
                                numero: typeof addressPayload.numero === 'string' ? parseInt(addressPayload.numero) : addressPayload.numero,
                                piso: addressPayload.piso,
                                departamento: addressPayload.departamento,
                                cp: typeof addressPayload.cp === 'string' ? parseInt(addressPayload.cp) : addressPayload.cp,
                                localidad: { connect: { id: addressPayload.localidad.id } }, // Conectar la localidad por ID
                                usuario: { connect: { id: userId } }, // Conectar al usuario
                            },
                        });
                    }
                }
            }
        }

        const updatedUsuario = await prisma.usuario.update({
            where: { id: userId },
            data: updateData,
            include: { // Incluir relaciones para el DTO de respuesta
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });

        return UserService.mapToUserDTO(updatedUsuario);
    },

    /**
     * Sube y asocia una imagen de perfil al Usuario.
     * @param userId El ID del Usuario.
     * @param fileData El buffer del archivo y el nombre original del archivo.
     * @returns El DTO del Usuario actualizado.
     */
    uploadProfileImage: async (userId: number, fileData: { buffer: Buffer; originalname: string }): Promise<UserResponseDTO> => {
        const usuario = await prisma.usuario.findUnique({
            where: { id: userId },
            include: { imagenUser: true }
        });

        if (!usuario) {
            throw new Error(`Usuario con ID ${userId} no encontrado.`);
        }
        if (!usuario.activo) {
            throw new Error("La cuenta está desactivada y no puede subir imágenes.");
        }

        const { buffer, originalname } = fileData;
        const fileExtension = path.extname(originalname);
        const uniqueFilename = `${uuidv4()}${fileExtension}`;
        const filePath = path.join(UPLOAD_DIR, uniqueFilename);
        const imageUrl = `${BASE_URL}/uploads/${uniqueFilename}`;

        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        await fs.writeFile(filePath, buffer);

        // Lógica para actualizar o crear la entidad Imagen
        if (usuario.imagenUser) {
            // Si ya tiene una imagen, la actualizamos
            await prisma.imagen.update({
                where: { id: usuario.imagenUser.id },
                data: {
                    denominacion: imageUrl,
                },
            });
        } else {
            // Si no tiene imagen, creamos una nueva y la conectamos al usuario
            const newImagen = await prisma.imagen.create({
                data: {
                    denominacion: imageUrl,
                }
            });
            await prisma.usuario.update({
                where: { id: userId },
                data: { imagenUser: { connect: { id: newImagen.id } } }
            });
        }

        // Obtener el usuario actualizado con todas las relaciones para el DTO
        const updatedUsuario = await prisma.usuario.findUnique({
            where: { id: userId },
            include: {
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });

        if (!updatedUsuario) {
            throw new Error(`Usuario con ID ${userId} no encontrado después de actualizar imagen.`);
        }

        return UserService.mapToUserDTO(updatedUsuario);
    },

    /**
     * Actualiza las credenciales de un Usuario (email y/o contraseña).
     * Nota: La comparación/hasheo de contraseñas se hará en la capa superior o un servicio de autenticación.
     * @param userId El ID del Usuario.
     * @param data Los datos de la solicitud (currentPassword, newEmail, newPassword).
     * @returns El DTO del Usuario actualizado.
     */
    updateCredentials: async (userId: number, data: UpdateCredentialsPayload): Promise<UserResponseDTO> => {
        const usuario = await prisma.usuario.findUnique({
            where: { id: userId },
            include: {
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });

        if (!usuario) {
            throw new Error(`Usuario con ID ${userId} no encontrado.`);
        }
        if (!usuario.activo) {
            throw new Error("La cuenta está desactivada y no puede actualizar credenciales.");
        }

        const updateData: Prisma.UsuarioUpdateInput = {
            fechaModificacion: new Date(), // Siempre actualizar la fecha de modificación al intentar actualizar credenciales
        };
        let changesMade = false;

        if (data.newEmail && data.newEmail.trim() !== '' && data.newEmail !== usuario.email) {
            // Validar unicidad del nuevo email para cuentas activas (si no es el mismo usuario)
            const existingUserWithNewEmail = await prisma.usuario.findFirst({
                where: { email: data.newEmail, activo: true }
            });
            if (existingUserWithNewEmail && existingUserWithNewEmail.id !== userId) {
                throw new Error("El nuevo correo electrónico ya está en uso por otra cuenta activa.");
            }
            updateData.email = data.newEmail;
            updateData.userName = data.newEmail; // Actualizar username también si es el email
            changesMade = true;
        }

        if (data.newPassword && data.newPassword.trim() !== '') {
            // Aquí se esperaría que data.newPassword ya esté hasheada si es un servicio puro,
            // o se indique que el hasheo ocurrirá en la capa superior.
            // Para mantener el servicio "agnóstico" al hasheo, simplemente asignamos:
            updateData.password = data.newPassword; // ¡IMPORTANTE! Esto sería una contraseña sin hashear si no se procesa antes.
                                                  // Se requiere que la capa que llama a este método hashee la password.
            changesMade = true;
        }

        if (!changesMade) {
            // Si no hay cambios en email o password, devuelve el usuario original (o lanza un error si se prefiere)
            return UserService.mapToUserDTO(usuario);
        }

        const updatedUsuario = await prisma.usuario.update({
            where: { id: userId },
            data: updateData,
            include: {
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });

        return UserService.mapToUserDTO(updatedUsuario);
    },

    /**
     * Desactiva una cuenta de usuario, anonimizando el email y nombre de usuario para liberar estos identificadores.
     * También establece la cuenta como inactiva.
     * @param userId El ID del usuario a desactivar.
     * @returns El usuario actualizado con sus relaciones.
     */
    deactivateAccount: async (userId: number): Promise<UsuarioWithRelations> => {
        const usuario = await prisma.usuario.findUnique({
            where: { id: userId },
            include: {
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });

        if (!usuario) {
            throw new Error(`Usuario con ID ${userId} no encontrado.`);
        }
        if (!usuario.activo) {
            throw new Error("La cuenta ya está desactivada.");
        }

        const uniqueId = uuidv4();
        const deactivatedEmail = `deactivated_${uniqueId}@ecommerce.com`;
        const deactivatedUserName = `deactivated_${uniqueId}`;

        const updatedUsuario: UsuarioWithRelations = await prisma.usuario.update({ // Explicitly type
            where: { id: userId },
            data: {
                activo: false,
                email: deactivatedEmail,
                userName: deactivatedUserName,
                fechaBaja: new Date(), // Esto funcionará después de la actualización del esquema y 'prisma generate'
                fechaModificacion: new Date(), // Registrar la fecha de modificación
            },
            include: {
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });
        return updatedUsuario;
    },

    /**
     * Reactiva una cuenta de usuario, permitiendo un nuevo correo electrónico y nombre de usuario.
     * @param userId El ID del usuario a reactivar.
     * @param newEmail El nuevo correo electrónico para la cuenta reactivada.
     * @param newUserName El nuevo nombre de usuario para la cuenta reactivada.
     * @returns El usuario actualizado con sus relaciones.
     */
    reactivateAccount: async (userId: number, newEmail: string, newUserName: string): Promise<UsuarioWithRelations> => {
        const usuario = await prisma.usuario.findUnique({
            where: { id: userId },
            include: {
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });

        if (!usuario) {
            throw new Error(`Usuario con ID ${userId} no encontrado.`);
        }
        if (usuario.activo) {
            throw new Error("La cuenta ya está activa.");
        }

        const existingUserByEmail = await prisma.usuario.findFirst({
            where: { email: newEmail, activo: true }
        });
        if (existingUserByEmail && existingUserByEmail.id !== userId) {
            throw new Error('El nuevo email ya está en uso por otra cuenta activa.');
        }

        const existingUserByUsername = await prisma.usuario.findFirst({
            where: { userName: newUserName, activo: true }
        });
        if (existingUserByUsername && existingUserByUsername.id !== userId) {
            throw new Error('El nuevo nombre de usuario ya está en uso por otra cuenta activa.');
        }

        const reactivatedUser: UsuarioWithRelations = await prisma.usuario.update({ // Explicitly type
            where: { id: userId },
            data: {
                activo: true,
                fechaBaja: null, // Limpiar la fecha de baja
                email: newEmail,
                userName: newUserName,
                fechaModificacion: new Date(), // Registrar la fecha de modificación
            },
            include: {
                imagenUser: true,
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });
        return reactivatedUser;
    },

    // =========================================================================================
    // Métodos para Direcciones de un Usuario (Gestionadas por el UsuarioService)
    // =========================================================================================

    /**
     * Obtiene las direcciones de un usuario.
     * @param userId El ID del usuario.
     * @returns Lista de DTOs de direcciones del usuario.
     */
    getDireccionesByUserId: async (userId: number): Promise<AddressResponseDTO[]> => {
        const usuario = await prisma.usuario.findUnique({
            where: { id: userId, activo: true }, // Asegura que el usuario esté activo
            include: {
                direcciones: {
                    include: {
                        localidad: {
                            include: {
                                provincia: true
                            }
                        }
                    }
                }
            }
        });
        if (!usuario) {
            throw new Error(`Usuario con ID ${userId} no encontrado o inactivo.`);
        }
        return usuario.direcciones.map(UserService.mapToDomicilioDTO);
    },

    /**
     * Añade una nueva dirección a un usuario.
     * @param userId El ID del usuario.
     * @param domicilioData Los datos de la nueva dirección.
     * @returns La dirección creada mapeada a DTO.
     */
    addDireccionToUser: async (userId: number, domicilioData: AddressPayload): Promise<AddressResponseDTO> => {
        const usuario = await prisma.usuario.findUnique({ where: { id: userId, activo: true } });
        if (!usuario) {
            throw new Error(`Usuario con ID ${userId} no encontrado o inactivo.`);
        }

        if (!domicilioData.localidad || !domicilioData.localidad.id) {
            throw new Error("La dirección debe tener una Localidad válida con ID.");
        }

        const localidad = await prisma.localidad.findUnique({ where: { id: domicilioData.localidad.id } });
        if (!localidad) {
            throw new Error(`Localidad con ID ${domicilioData.localidad.id} no encontrada.`);
        }

        const newDireccion = await prisma.direccion.create({
            data: {
                calle: domicilioData.calle,
                numero: typeof domicilioData.numero === 'string' ? parseInt(domicilioData.numero) : domicilioData.numero, // Convertir a number si viene como string
                piso: domicilioData.piso,
                departamento: domicilioData.departamento,
                cp: typeof domicilioData.cp === 'string' ? parseInt(domicilioData.cp) : domicilioData.cp, // Convertir a number si viene como string
                localidad: { connect: { id: localidad.id } },
                usuario: { connect: { id: userId } }, // Conectar la dirección al usuario
            },
            include: {
                localidad: {
                    include: {
                        provincia: true
                    }
                }
            }
        });

        return UserService.mapToDomicilioDTO(newDireccion);
    },

    /**
     * Actualiza una dirección específica de un usuario.
     * @param userId El ID del usuario.
     * @param direccionId El ID de la dirección a actualizar.
     * @param updatedDomicilioData Los datos de la dirección actualizada.
     * @returns La dirección actualizada mapeada a DTO.
     */
    updateDireccionForUser: async (userId: number, direccionId: number, updatedDomicilioData: AddressPayload): Promise<AddressResponseDTO> => {
        const usuario = await prisma.usuario.findUnique({ where: { id: userId, activo: true } });
        if (!usuario) {
            throw new Error(`Usuario con ID ${userId} no encontrado o inactivo.`);
        }

        // Verifica que la dirección pertenezca al usuario
        const existingDireccion = await prisma.direccion.findUnique({
            where: { id: direccionId, usuarioId: userId }
        });
        if (!existingDireccion) {
            throw new Error(`Dirección con ID ${direccionId} no encontrada para el usuario ${userId}.`);
        }

        if (!updatedDomicilioData.localidad || !updatedDomicilioData.localidad.id) {
            throw new Error("La dirección debe tener una Localidad válida con ID.");
        }

        const localidad = await prisma.localidad.findUnique({ where: { id: updatedDomicilioData.localidad.id } });
        if (!localidad) {
            throw new Error(`Localidad con ID ${updatedDomicilioData.localidad.id} no encontrada.`);
        }

        const updatedDireccion = await prisma.direccion.update({
            where: { id: direccionId },
            data: {
                calle: updatedDomicilioData.calle,
                numero: typeof updatedDomicilioData.numero === 'string' ? parseInt(updatedDomicilioData.numero) : updatedDomicilioData.numero, // Convertir a number
                piso: updatedDomicilioData.piso,
                departamento: updatedDomicilioData.departamento,
                cp: typeof updatedDomicilioData.cp === 'string' ? parseInt(updatedDomicilioData.cp) : updatedDomicilioData.cp, // Convertir a number
                localidad: { connect: { id: localidad.id } },
            },
            include: {
                localidad: {
                    include: {
                        provincia: true
                    }
                }
            }
        });

        return UserService.mapToDomicilioDTO(updatedDireccion);
    },

    /**
     * Elimina una dirección específica de un usuario.
     * @param userId El ID del usuario.
     * @param direccionId El ID de la dirección a eliminar.
     */
    removeDireccionFromUser: async (userId: number, direccionId: number): Promise<void> => {
        const usuario = await prisma.usuario.findUnique({ where: { id: userId, activo: true } });
        if (!usuario) {
            throw new Error(`Usuario con ID ${userId} no encontrado o inactivo.`);
        }

        // Verifica que la dirección pertenezca al usuario antes de eliminar
        const existingDireccion = await prisma.direccion.findUnique({
            where: { id: direccionId, usuarioId: userId }
        });
        if (!existingDireccion) {
            throw new Error(`Dirección con ID ${direccionId} no encontrada para el usuario ${userId}.`);
        }

        await prisma.direccion.delete({ where: { id: direccionId } });
    },
};