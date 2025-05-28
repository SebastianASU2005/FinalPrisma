// src/types/express.d.ts

import { Request } from 'express';
import { Usuario } from '@prisma/client'; // Importa el modelo de Usuario de Prisma

declare global {
  namespace Express {
    interface Request {
      user?: Usuario; // Define que req.user puede ser un objeto Usuario o undefined
    }
  }
}