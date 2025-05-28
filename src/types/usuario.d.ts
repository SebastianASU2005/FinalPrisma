// src/types/usuario.d.ts

// Asegúrate de que tus enums 'Rol' y 'Sexo' estén definidos en tu schema.prisma
// y que Prisma los haya generado. Si no, necesitarás definirlos manualmente aquí.
import { Rol, Sexo, Prisma } from '@prisma/client';

// --- Nuevo tipo: Para la subida de imagen de perfil ---
export type ProfileImageUpload = {
    buffer: Buffer; // El contenido binario de la imagen
    originalname: string; // El nombre original del archivo (ej. "mi_foto.jpg")
    // mimetype?: string; // Opcional: tipo MIME (ej. "image/jpeg")
    // size?: number;     // Opcional: tamaño del archivo
};

// --- DTOs de Entrada (Payloads) ---

// Tipo para crear un nuevo usuario (registro)
export type CreateUsuarioPayload = {
    auth0Id?: string; // Opcional
    userName: string;
    password?: string; // Haremos el password opcional aquí si Auth0 lo maneja,
    // pero si el registro es "local", sería requerido.
    // Por ahora, lo dejamos opcional para flexibilidad.
    nombre: string;
    apellido: string;
    email: string;
    dni?: number | null;
    sexo?: Sexo | null;
    fechaNacimiento?: string | null; // Formato "YYYY-MM-DD"
    telefono?: string | null;
    rol: Rol;
    activo?: boolean; // Por defecto true
};

// Tipo para actualizar el perfil del usuario (UserProfileUpdateDTO en Java)
export type UpdateUserProfilePayload = {
    nombre?: string;
    apellido?: string;
    dni?: number | null;
    sexo?: Sexo | null;
    fechaNacimiento?: string | null; // Formato "YYYY-MM-DD"
    telefono?: string | null;
    // Las direcciones se manejan anidadas. Cada AddressPayload puede tener un ID para actualización.
    addresses?: AddressPayload[]; // Array de direcciones (DomicilioDTO)
};

// Tipo para actualizar credenciales (UpdateCredentialsRequest en Java)
// NOTA: La lógica de `currentPassword` y hasheo se manejará en el servicio,
// pero el tipo de la solicitud es así.
export type UpdateCredentialsPayload = {
    currentPassword: string;
    newEmail?: string;
    newPassword?: string;
};

// Tipo para añadir/actualizar una dirección (DomicilioDTO en Java)
export type AddressPayload = {
    id?: number; // Opcional, para identificar si es una actualización o una nueva dirección
    calle: string;
    numero: number;
    piso?: string | null; // <-- CAMBIADO: de number a string
    departamento?: string | null;
    cp: number; // <-- CAMBIADO: de string a number
    localidad: {
        id: number;
    };
};

// --- DTOs de Salida (lo que devuelve la API) ---

// Corresponde a UserDTO en Java
export type UserResponseDTO = {
    id: number;
    username: string | null;
    firstname: string;
    lastname: string;
    email: string | null;
    dni: number | null;
    sexo: Sexo | null;
    fechaNacimiento: string | null;
    telefono: string | null;
    addresses?: AddressResponseDTO[];
    role: Rol;
    profileImage?: ImagenResponseDTO | null;
    activo: boolean;
};

// Corresponde a DomicilioDTO en Java para la salida
export type AddressResponseDTO = {
    id: number;
    calle: string;
    numero: number;
    piso: string | null; // <-- CAMBIADO: de number a string
    departamento: string | null;
    cp: number; // <-- CAMBIADO: de string a number
    localidad: LocalidadResponseDTO;
};

// Corresponde a LocalidadDTO en Java para la salida
export type LocalidadResponseDTO = {
    id: number;
    nombre: string;
    provincia?: ProvinciaResponseDTO; // Opcional si la provincia no siempre se incluye
};

// Corresponde a ProvinciaDTO en Java para la salida
export type ProvinciaResponseDTO = {
    id: number;
    nombre: string;
};

// Corresponde a ImagenDTO en Java para la salida
export type ImagenResponseDTO = {
    id: number;
    url: string; // `denominacion` en Java
};

// --- Tipos Auxiliares para Prisma ---

// Este tipo combina la entidad Usuario de Prisma con sus relaciones comunes.
// Es útil para definir el tipo de retorno de las consultas de Prisma en el servicio.
export type UsuarioWithRelations = Prisma.UsuarioGetPayload<{
    include: {
        imagenUser: true;
        direcciones: {
            include: {
                localidad: {
                    include: {
                        provincia: true;
                    };
                };
            };
        };
    };
}>;

// Para la operación de desactivar cuenta, podríamos querer el usuario solo con el email
export type UsuarioWithEmail = Prisma.UsuarioGetPayload<{
    select: {
        id: true;
        email: true;
        userName: true;
        activo: true;
    };
}>;