// src/server.ts
import app from './app'; // Importa la aplicación Express
import prisma from './config/prisma'; // Importa el cliente de Prisma

const PORT = process.env.PORT || 3000; // Puedes definir el puerto en tu .env

// Función para iniciar el servidor
async function startServer() {
    try {
        // Conectar Prisma a la base de datos (opcional, Prisma lo hace automáticamente en la primera consulta)
        // Pero es buena práctica para verificar la conexión al inicio.
        await prisma.$connect();
        console.log('Conexión a la base de datos establecida exitosamente.');

        app.listen(PORT, () => {
            console.log(`Servidor escuchando en el puerto ${PORT}`);
            console.log(`Accede a http://localhost:${PORT}`);
            console.log(`Prueba la ruta de usuarios: http://localhost:${PORT}/api/users`);
        });
    } catch (error) {
        console.error('Error al iniciar el servidor o conectar a la base de datos:', error);
        process.exit(1); // Sale de la aplicación si hay un error crítico
    } finally {
        // Asegúrate de desconectar Prisma si la aplicación se cierra
        process.on('beforeExit', async () => {
            await prisma.$disconnect();
            console.log('Desconexión de la base de datos.');
        });
    }
}

// Inicia el servidor
startServer();