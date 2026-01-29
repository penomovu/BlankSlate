import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireVerified } from '../middleware/auth';
import { 
  tutorantPreferencesSchema, 
  tutorantEnabledSchema,
  weeklyAvailabilitySchema,
  availabilityExceptionSchema,
  CLASS_LEVELS,
  SUBJECTS
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
  return levelMap[level] || level;
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

router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const preferences = await prisma.tutorantPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      return res.json({
        subjects: [],
        levels: [],
        availableOutsideHours: false,
        enabled: false,
      });
    }

    res.json({
      subjects: JSON.parse(preferences.subjects),
      levels: JSON.parse(preferences.levels).map((l: string) => getClassLevelFromDb(l)),
      availableOutsideHours: preferences.availableOutsideHours,
      enabled: preferences.enabled,
    });
  } catch (error) {
    logger.error('Get preferences error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = tutorantPreferencesSchema.parse(req.body);

    const levelsDb = data.levels.map(l => getClassLevel(l));

    const preferences = await prisma.tutorantPreference.upsert({
      where: { userId },
      create: {
        userId,
        subjects: JSON.stringify(data.subjects),
        levels: JSON.stringify(levelsDb),
        availableOutsideHours: data.availableOutsideHours,
        enabled: false,
      },
      update: {
        subjects: JSON.stringify(data.subjects),
        levels: JSON.stringify(levelsDb),
        availableOutsideHours: data.availableOutsideHours,
      },
    });

    res.json({
      subjects: JSON.parse(preferences.subjects),
      levels: JSON.parse(preferences.levels).map((l: string) => getClassLevelFromDb(l)),
      availableOutsideHours: preferences.availableOutsideHours,
      enabled: preferences.enabled,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Update preferences error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/availability', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const slots = await prisma.weeklyAvailabilitySlot.findMany({
      where: { userId },
    });

    const exceptions = await prisma.availabilityException.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    res.json({
      availableSlots: slots.map(s => `${s.day}_${s.slotId}`),
      exceptions: exceptions.map(e => ({
        id: e.id,
        date: e.date.toISOString(),
        isAvailable: e.isAvailable,
        reason: e.reason,
      })),
    });
  } catch (error) {
    logger.error('Get availability error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/availability', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { availableSlots } = weeklyAvailabilitySchema.parse(req.body);

    await prisma.weeklyAvailabilitySlot.deleteMany({
      where: { userId },
    });

    const slotData = availableSlots.map(slotId => {
      const [day, slot] = slotId.split('_');
      return { userId, day, slotId: slot };
    });

    await prisma.weeklyAvailabilitySlot.createMany({
      data: slotData,
    });

    res.json({
      availableSlots,
      exceptions: [],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Update availability error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/exceptions', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = availabilityExceptionSchema.parse(req.body);

    const date = new Date(data.date);
    const exception = await prisma.availabilityException.create({
      data: {
        userId,
        date,
        isAvailable: data.isAvailable,
        reason: data.reason,
      },
    });

    res.json({
      id: exception.id,
      date: exception.date.toISOString(),
      isAvailable: exception.isAvailable,
      reason: exception.reason,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Create exception error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.patch('/enabled', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { enabled } = tutorantEnabledSchema.parse(req.body);

    await prisma.tutorantPreference.upsert({
      where: { userId },
      create: {
        userId,
        subjects: '[]',
        levels: '[]',
        availableOutsideHours: false,
        enabled,
      },
      update: {
        enabled,
      },
    });

    res.json({ enabled });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Update enabled error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
