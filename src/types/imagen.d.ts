
export type CreateImagenPayload = {
    denominacion: string; 
    productoId?: number; 
};


export type UpdateImagenPayload = Partial<CreateImagenPayload>;