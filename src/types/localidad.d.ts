
export type CreateLocalidadPayload = {
    nombre: string;
    provinciaId: number;
    activo?: boolean; 
};


export type UpdateLocalidadPayload = Partial<CreateLocalidadPayload>;