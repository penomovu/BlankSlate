import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireModerator } from '../middleware/auth';
import { createAbuseReportSchema } from '../utils/validation';
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

router.post('/abuse-reports', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = createAbuseReportSchema.parse(req.body);

    if (!data.conversationId && !data.messageId) {
      return res.status(400).json({ error: 'conversationId ou messageId requis' });
    }

    const report = await prisma.abuseReport.create({
      data: {
        reporterId: userId,
        conversationId: data.conversationId,
        messageId: data.messageId,
        reason: data.reason,
        description: data.description,
      },
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId: 'admin-notification',
        type: 'ABUSE_REPORT',
        title: 'Nouveau signalement',
        message: `Nouveau signalement de ${report.reporter.firstName} ${report.reporter.lastName}`,
      },
    });

    res.status(201).json({
      id: report.id,
      reporterId: report.reporterId,
      conversationId: report.conversationId,
      messageId: report.messageId,
      reason: report.reason,
      description: report.description,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Create abuse report error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/reports', authenticate, requireModerator, async (req, res) => {
  try {
    const reports = await prisma.abuseReport.findMany({
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        conversation: {
          include: {
            participant1: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            participant2: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      reports: reports.map(report => ({
        id: report.id,
        reporter: {
          id: report.reporter.id,
          firstName: report.reporter.firstName,
          lastName: report.reporter.lastName,
          email: report.reporter.email,
        },
        conversationId: report.conversationId,
        messageId: report.messageId,
        reason: report.reason,
        description: report.description,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
        conversation: report.conversation ? {
          id: report.conversation.id,
          participant1: report.conversation.participant1,
          participant2: report.conversation.participant2,
        } : null,
      })),
    });
  } catch (error) {
    logger.error('Get reports error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/conversations/:id', authenticate, requireModerator, async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participant1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            classLevel: true,
          },
        },
        participant2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            classLevel: true,
          },
        },
        request: {
          select: {
            id: true,
            subject: true,
            level: true,
            slotId: true,
            status: true,
          },
        },
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    res.json({
      id: conversation.id,
      participant1: conversation.participant1,
      participant2: conversation.participant2,
      request: conversation.request,
      messages: conversation.messages.map((msg: any) => ({
        id: msg.id,
        senderId: msg.senderId,
        sender: msg.sender,
        content: msg.content,
        read: msg.read,
        createdAt: msg.createdAt.toISOString(),
      })),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    });
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.patch('/reports/:id', authenticate, requireModerator, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['OPEN', 'REVIEWING', 'CLOSED'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const report = await prisma.abuseReport.update({
      where: { id: id as string },
      data: { status },
    });

    res.json({
      id: report.id,
      status: report.status,
      updatedAt: report.updatedAt.toISOString(),
    });
  } catch (error) {
    logger.error('Update report error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
