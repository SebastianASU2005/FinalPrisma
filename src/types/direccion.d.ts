
export type CreateDireccionPayload = {
    calle: string;
    numero: number;
    piso?: string | null;
    departamento?: string | null;
    cp: number;
    localidadId: number;
    usuarioId?: number | null;
    activo?: boolean; 
};

export type UpdateDireccionPayload = Partial<CreateDireccionPayload>; 