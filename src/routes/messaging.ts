import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireVerified } from '../middleware/auth';
import { createConversationSchema, createMessageSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

function getClassLevelFromDb(level: string): string {
  const levelMap: Record<string, string> = {
    'SECONDE': '2nde',
    'PREMIERE': '1ère',
    'TERMINALE': 'Terminale',
  };
  return levelMap[level] || level;
}

router.use(authenticate);
router.use(requireVerified);

router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participant1Id: userId },
          { participant2Id: userId },
        ],
      },
      include: {
        participant1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        participant2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        request: {
          select: {
            id: true,
            subject: true,
            slotId: true,
            status: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: userId },
                read: false,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      conversations: conversations.map(conv => {
        const partner = conv.participant1Id === userId ? conv.participant2 : conv.participant1;
        const lastMessage = conv.messages[0];
        
        return {
          id: conv.id,
          participant: {
            id: partner.id,
            firstName: partner.firstName,
            lastName: partner.lastName,
            avatar: partner.avatar,
          },
          requestId: conv.requestId,
          request: conv.request,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt.toISOString(),
          } : null,
          unreadCount: conv._count.messages,
          updatedAt: conv.updatedAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/conversations', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { participantId, requestId } = createConversationSchema.parse(req.body);

    if (participantId === userId) {
      return res.status(400).json({ error: 'Impossible de créer une conversation avec vous-même' });
    }

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { participant1Id: userId, participant2Id: participantId },
          { participant1Id: participantId, participant2Id: userId },
        ],
      },
    });

    if (existingConversation) {
      return res.json({
        id: existingConversation.id,
        participant1Id: existingConversation.participant1Id,
        participant2Id: existingConversation.participant2Id,
        requestId: existingConversation.requestId,
        createdAt: existingConversation.createdAt.toISOString(),
      });
    }

    const conversation = await prisma.conversation.create({
      data: {
        participant1Id: userId,
        participant2Id: participantId,
        requestId,
      },
    });

    res.status(201).json({
      id: conversation.id,
      participant1Id: conversation.participant1Id,
      participant2Id: conversation.participant2Id,
      requestId: conversation.requestId,
      createdAt: conversation.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Create conversation error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      messages: messages.map(msg => ({
        id: msg.id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        sender: {
          id: msg.sender.id,
          firstName: msg.sender.firstName,
          lastName: msg.sender.lastName,
          avatar: msg.sender.avatar,
        },
        content: msg.content,
        read: msg.read,
        createdAt: msg.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { content } = createMessageSchema.parse(req.body);

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: userId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      sender: {
        id: message.sender.id,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        avatar: message.sender.avatar,
      },
      content: message.content,
      read: message.read,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Create message error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
