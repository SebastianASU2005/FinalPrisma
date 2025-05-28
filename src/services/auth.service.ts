// src/services/auth.service.ts

import prisma from '../config/prisma';
import { Prisma, Rol } from '@prisma/client'; 
import { RegisterRequest, LoginRequest, AuthResponse } from '../types/auth.d';
import { JwtService } from './jwt.service';

import bcrypt from 'bcryptjs';

// Importar los tipos de usuario existentes
import {
    UsuarioWithRelations,
    UserResponseDTO,
    UpdateCredentialsPayload,
} from '../types/usuario.d';
import { UserService } from './user.service';

export const AuthService = {
    /**
     * Registra un nuevo usuario en el sistema.
     * @param request Los datos de registro del usuario.
     * @returns Un objeto AuthResponse con el token JWT y los datos del usuario.
     * @throws Error si el email o username ya están en uso.
     */
    register: async (request: RegisterRequest): Promise<AuthResponse> => {
        // Validar si el email ya está en uso
        const existingUserByEmail = await prisma.usuario.findFirst({
            where: { email: request.email },
        });
        if (existingUserByEmail) {
            throw new Error(`El email '${request.email}' ya está en uso.`);
        }

        // Hashear la contraseña
        const hashedPassword = await bcrypt.hash(request.password, 10); // 10 es el costo del hash (salt rounds)

        // Crear el usuario. Nota: en Java, el `userName` se establece con el `email` en `AuthService.register`.
        const newUser = await prisma.usuario.create({
            data: {
                email: request.email,
                userName: request.email, // Coincide con tu Java
                password: hashedPassword,
                nombre: request.firstname,
                apellido: request.lastname,
                dni: request.dni,
                sexo: request.sexo,
                fechaNacimiento: request.fechaNacimiento ? new Date(request.fechaNacimiento) : null,
                telefono: request.telefono,
                rol: request.rol || Rol.CLIENTE, // CORREGIDO: Usa Rol directamente
                activo: true
            },
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

        const jwtToken = JwtService.generateToken(newUser);
        const userDto = UserService.mapToUserDTO(newUser);

        return {
            token: jwtToken,
            user: userDto,
        };
    },

    /**
     * Autentica a un usuario existente.
     * @param request Los datos de login del usuario.
     * @returns Un objeto AuthResponse con el token JWT y los datos del usuario.
     * @throws Error si las credenciales son inválidas o el usuario no existe.
     */
    login: async (request: LoginRequest): Promise<AuthResponse> => {
        const user = await prisma.usuario.findFirst({
            where: {
                email: request.email,
                activo: true
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

        if (!user) {
            throw new Error('Credenciales inválidas. Usuario no encontrado o inactivo.');
        }

        const isPasswordValid = await bcrypt.compare(request.password, user.password);

        if (!isPasswordValid) {
            throw new Error('Credenciales inválidas. Contraseña incorrecta.');
        }

        const jwtToken = JwtService.generateToken(user);
        const userDto = UserService.mapToUserDTO(user);

        return {
            token: jwtToken,
            user: userDto,
        };
    },

    /**
     * Actualiza las credenciales de un usuario (email y/o contraseña).
     * @param userId El ID del usuario que se va a actualizar.
     * @param currentPassword La contraseña actual del usuario (para validación).
     * @param payload Los nuevos datos (newEmail, newPassword).
     * @returns El DTO del usuario actualizado.
     * @throws Error si la contraseña actual es incorrecta o el nuevo email ya está en uso.
     */
    updateCredentials: async (userId: number, currentPassword: string, payload: UpdateCredentialsPayload): Promise<UserResponseDTO> => {
        const user = await prisma.usuario.findUnique({
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

        if (!user) {
            throw new Error(`Usuario con ID ${userId} no encontrado.`);
        }
        if (!user.activo) {
            throw new Error("La cuenta está desactivada y no puede actualizar credenciales.");
        }

        // 1. Validar la contraseña actual
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new Error("La contraseña actual es incorrecta.");
        }

        // 2. Preparar los datos para la actualización
        const updateData: Prisma.UsuarioUpdateInput = {};
        let changesMade = false;

        // Actualizar email
        if (payload.newEmail && payload.newEmail.trim() !== '' && payload.newEmail !== user.email) {
            const existingUserWithNewEmail = await prisma.usuario.findFirst({
                where: { email: payload.newEmail, activo: true }
            });
            if (existingUserWithNewEmail && existingUserWithNewEmail.id !== userId) {
                throw new Error("El nuevo correo electrónico ya está en uso por otra cuenta activa.");
            }
            updateData.email = payload.newEmail;
            updateData.userName = payload.newEmail; // También actualiza el userName
            changesMade = true;
        }

        // Actualizar contraseña
        if (payload.newPassword && payload.newPassword.trim() !== '') {
            const isNewPasswordSameAsCurrent = await bcrypt.compare(payload.newPassword, user.password);
            if (isNewPasswordSameAsCurrent) {
                throw new Error("La nueva contraseña no puede ser igual a la actual.");
            }
            updateData.password = await bcrypt.hash(payload.newPassword, 10);
            changesMade = true;
        }

        if (!changesMade) {
            return UserService.mapToUserDTO(user);
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
};