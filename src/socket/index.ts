import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { logger } from '../utils/logger';

let ioInstance: SocketIOServer | null = null;

export function initializeSocket(httpServer: HTTPServer) {
  const socketIO = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  ioInstance = socketIO;

  socketIO.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return next(new Error('Invalid or expired token'));
    }

    (socket as any).user = payload;
    next();
  });

  socketIO.on('connection', (socket) => {
    const userId = (socket as any).user.userId;
    logger.info(`User ${userId} connected via socket`);

    socket.join(`user:${userId}`);

    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logger.info(`User ${userId} joined conversation ${conversationId}`);
    });

    socket.on('leave-conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.info(`User ${userId} left conversation ${conversationId}`);
    });

    socket.on('new-message', (data: { conversationId: string; message: any }) => {
      socket.to(`conversation:${data.conversationId}`).emit('message-received', data.message);
    });

    socket.on('notification', (data: { userId: string; notification: any }) => {
      socketIO.to(`user:${data.userId}`).emit('notification-received', data.notification);
    });

    socket.on('typing', (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user-typing', {
        userId,
        isTyping: data.isTyping,
      });
    });

    socket.on('disconnect', () => {
      logger.info(`User ${userId} disconnected from socket`);
    });
  });

  return socketIO;
}

export function broadcastNotification(userId: string, notification: any) {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit('notification-received', notification);
  }
}

export function broadcastNewMessage(conversationId: string, message: any) {
  if (ioInstance) {
    ioInstance.to(`conversation:${conversationId}`).emit('message-received', message);
  }
}
