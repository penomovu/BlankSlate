import express, { Application } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { initializeSocket } from './socket';
import { initializeEmail } from './services/email';
import { logger } from './utils/logger';
import authRoutes from './routes/auth';
import tutorantRoutes from './routes/tutorant';
import matchingRoutes from './routes/matching';
import messagingRoutes from './routes/messaging';
import moderationRoutes from './routes/moderation';

dotenv.config();

const prisma = new PrismaClient();

const app: Application = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/tutorant', tutorantRoutes);
app.use('/api', matchingRoutes);
app.use('/api', messagingRoutes);
app.use('/api/mod', moderationRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

const server = http.createServer(app);

async function startServer() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    await initializeEmail();
    
    initializeSocket(server);

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

export { app, server };
