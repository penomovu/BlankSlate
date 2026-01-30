import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireVerified } from '../middleware/auth';
import { 
  matchQuerySchema,
  createRequestSchema,
  updateRequestStatusSchema,
  broadcastCallSchema,
  REQUEST_STATUSES,
  CLASS_LEVELS
} from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

function getClassLevel(level: string): string {
  const levelMap: Record<string, string> = {
    '2nde': 'SECONDE',
    '1ère': 'PREMIERE',
    'Terminale': 'TERMINALE',
  };
  return levelMap[level] || 'SECONDE';
}

function getClassLevelValue(level: string): number {
  const levelMap: Record<string, number> = {
    'SECONDE': 1,
    'PREMIERE': 2,
    'TERMINALE': 3,
  };
  return levelMap[level] || 1;
}

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

router.get('/match', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { subject, level, slotId } = matchQuerySchema.parse(req.query);

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const levelValue = getClassLevelValue(getClassLevel(level));

    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        role: 'STUDENT',
        tutorantPreferences: {
          enabled: true,
        },
      },
      include: {
        tutorantPreferences: true,
        weeklyAvailabilitySlots: true,
        availabilityExceptions: true,
      },
    });

    const matchingTutors = users.filter(user => {
      const prefs = user.tutorantPreferences;
      if (!prefs) return false;

      const teachesSubject = JSON.parse(prefs.subjects).includes(subject);
      const teachesLevel = JSON.parse(prefs.levels).includes(getClassLevelFromDb(user.classLevel));
      const isSuperiorOrEqual = getClassLevelValue(user.classLevel) >= levelValue;
      const isAvailable = user.weeklyAvailabilitySlots.some(
        slot => slot.day === slotId.split('_')[0] && slot.slotId === slotId.split('_')[1]
      );

      return teachesSubject && teachesLevel && isSuperiorOrEqual && isAvailable;
    });

    res.json({
      tutors: matchingTutors.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar,
        classLevel: getClassLevelFromDb(user.classLevel),
        specialties: JSON.parse(user.specialties),
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Match error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/requests', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = createRequestSchema.parse(req.body);

    if (data.tutorId === userId) {
      return res.status(400).json({ error: 'Impossible de créer une demande pour vous-même' });
    }

    let conversationId: string | null = null;

    if (data.tutorId) {
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { participant1Id: userId, participant2Id: data.tutorId },
            { participant1Id: data.tutorId, participant2Id: userId },
          ],
        },
      });

      if (!existingConversation) {
        const conversation = await prisma.conversation.create({
          data: {
            participant1Id: userId,
            participant2Id: data.tutorId,
          },
        });
        conversationId = conversation.id;
      } else {
        conversationId = existingConversation.id;
      }
    }

    const request = await prisma.tutoringRequest.create({
      data: {
        studentId: userId,
        tutorId: data.tutorId,
        subject: data.subject,
        level: data.level,
        slotId: data.slotId,
        date: new Date(data.date),
        conversationId,
      },
    });

    if (data.tutorId) {
      const student = await prisma.user.findUnique({
        where: { id: userId },
      });
      await prisma.notification.create({
        data: {
          userId: data.tutorId,
          type: 'NEW_REQUEST',
          title: 'Nouvelle demande de tutorat',
          message: `${student?.firstName} ${student?.lastName} demande de l'aide en ${data.subject}`,
        },
      });
    }

    res.status(201).json({
      id: request.id,
      studentId: request.studentId,
      tutorId: request.tutorId,
      subject: request.subject,
      level: request.level,
      slotId: request.slotId,
      date: request.date.toISOString(),
      status: request.status,
      isBroadcast: request.isBroadcast,
      conversationId: request.conversationId,
      createdAt: request.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Create request error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { mode } = req.query;

    if (mode !== 'tutore' && mode !== 'tutorant') {
      return res.status(400).json({ error: 'Mode doit être "tutore" ou "tutorant"' });
    }

    const isTutorant = mode === 'tutorant';
    const field = isTutorant ? 'tutorId' : 'studentId';

    const requests = await prisma.tutoringRequest.findMany({
      where: {
        [field]: userId,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            classLevel: true,
            avatar: true,
          },
        },
        tutor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            classLevel: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      requests: requests.map(req => ({
        id: req.id,
        studentId: req.studentId,
        tutorId: req.tutorId,
        subject: req.subject,
        level: req.level,
        slotId: req.slotId,
        date: req.date.toISOString(),
        status: req.status,
        isBroadcast: req.isBroadcast,
        conversationId: req.conversationId,
        createdAt: req.createdAt.toISOString(),
        student: req.student ? {
          id: req.student.id,
          firstName: req.student.firstName,
          lastName: req.student.lastName,
          classLevel: getClassLevelFromDb(req.student.classLevel),
          avatar: req.student.avatar,
        } : null,
        tutor: req.tutor ? {
          id: req.tutor.id,
          firstName: req.tutor.firstName,
          lastName: req.tutor.lastName,
          classLevel: getClassLevelFromDb(req.tutor.classLevel),
          avatar: req.tutor.avatar,
        } : null,
      })),
    });
  } catch (error) {
    logger.error('Get requests error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.patch('/requests/:id/status', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { status } = updateRequestStatusSchema.parse(req.body);

    const request = await prisma.tutoringRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({ error: 'Demande non trouvée' });
    }

    if (request.tutorId !== userId) {
      return res.status(403).json({ error: 'Vous n\'êtes pas autorisé à modifier cette demande' });
    }

    const updated = await prisma.tutoringRequest.update({
      where: { id },
      data: { status },
    });

    if (status === 'ACCEPTED') {
      await prisma.notification.create({
        data: {
          userId: request.studentId,
          type: 'REQUEST_ACCEPTED',
          title: 'Demande acceptée',
          message: `Votre demande de tutorat en ${request.subject} a été acceptée`,
        },
      });

      if (!updated.conversationId) {
        const conversation = await prisma.conversation.create({
          data: {
            participant1Id: request.studentId,
            participant2Id: userId,
            requestId: id,
          },
        });
      }
    }

    res.json({
      id: updated.id,
      status: updated.status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Update request status error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/calls', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = broadcastCallSchema.parse(req.body);

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const levelValue = getClassLevelValue(getClassLevel(data.level));
    const slotDay = data.slotId.split('_')[0];
    const slotTime = data.slotId.split('_')[1];

    const tutors = await prisma.user.findMany({
      where: {
        id: { not: userId },
        role: 'STUDENT',
        tutorantPreferences: {
          enabled: true,
        },
      },
      include: {
        tutorantPreferences: true,
        weeklyAvailabilitySlots: true,
      },
    });

    const matchingTutors = tutors.filter(user => {
      const prefs = user.tutorantPreferences;
      if (!prefs) return false;

      const teachesSubject = JSON.parse(prefs.subjects).includes(data.subject);
      const teachesLevel = JSON.parse(prefs.levels).includes(getClassLevelFromDb(user.classLevel));
      const isSuperiorOrEqual = getClassLevelValue(user.classLevel) >= levelValue;
      const isAvailable = user.weeklyAvailabilitySlots.some(
        (slot: any) => slot.day === slotDay && slot.slotId === slotTime
      );

      return teachesSubject && teachesLevel && isSuperiorOrEqual && isAvailable;
    });

    if (matchingTutors.length === 0) {
      return res.status(404).json({ error: 'Aucun tuteur disponible pour ce créneau' });
    }

    const requests = await prisma.tutoringRequest.createMany({
      data: matchingTutors.map(tutor => ({
        studentId: userId,
        tutorId: tutor.id,
        subject: data.subject,
        level: data.level,
        slotId: data.slotId,
        date: new Date(data.date),
        isBroadcast: true,
      })),
    });

    for (const tutor of matchingTutors) {
      await prisma.notification.create({
        data: {
          userId: tutor.id,
          type: 'BROADCAST_CALL',
          title: 'Appel de tutorat',
          message: `Un étudiant recherche de l'aide en ${data.subject} pour le créneau ${data.slotId}`,
        },
      });
    }

    res.json({
      message: `Appel envoyé à ${requests.count} tuteurs`,
      count: requests.count,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Broadcast call error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
