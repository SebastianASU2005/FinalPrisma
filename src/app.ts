// src/app.ts

import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';

// Importar el router principal que centraliza todas las rutas
import apiRoutes from './routes/index';

dotenv.config();

const app = express(); // La instancia de Express

// =========================================================================
// Configuración de Middlewares Globales
// =========================================================================

app.use(cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

app.use(express.json());

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR));


// =========================================================================
// Configuración de Rutas de la API
// =========================================================================

app.use('/api', apiRoutes);


// Ruta de prueba inicial
app.get('/', (req: Request, res: Response) => {
    res.send('API de E-commerce funcionando! 🚀');
});


// =========================================================================
// Manejo Centralizado de Errores
// =========================================================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error global de la aplicación:', err.stack);
    res.status(500).json({
        message: 'Ocurrió un error inesperado en el servidor.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ¡¡¡IMPORTANTE!!! Exportar la instancia de 'app' por defecto
export default app;