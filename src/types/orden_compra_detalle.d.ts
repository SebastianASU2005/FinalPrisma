
export type CreateOrdenCompraDetallePayload = {
    ordenCompraId: number;
    productoDetalleId: number;
    cantidad: number;
};


export type UpdateOrdenCompraDetallePayload = Partial<Omit<CreateOrdenCompraDetallePayload, 'ordenCompraId'>>;
