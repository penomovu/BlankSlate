import { Router } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  TokenPayload
} from '../utils/jwt';
import { 
  registerSchema, 
  loginSchema, 
  verifyEmailSchema,
  resendVerificationSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  CLASS_LEVELS
} from '../utils/validation';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';
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

router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        classLevel: getClassLevel(data.classLevel) as any,
        specialties: JSON.stringify(data.specialties),
        options: JSON.stringify(data.options),
        avatar: data.avatar,
        emailVerified: false,
        emailVerificationTokens: {
          create: {
            token: verificationToken,
            expiresAt: tokenExpiresAt,
          },
        },
      },
    });

    await sendVerificationEmail(data.email, verificationToken);

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        classLevel: getClassLevelFromDb(user.classLevel),
        specialties: JSON.parse(user.specialties),
        options: JSON.parse(user.options),
        avatar: user.avatar,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      accessToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Register error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        tutorantPreferences: true,
      },
    });

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        classLevel: getClassLevelFromDb(user.classLevel),
        specialties: JSON.parse(user.specialties),
        options: JSON.parse(user.options),
        avatar: user.avatar,
        role: user.role,
        emailVerified: user.emailVerified,
        isTutorantEnabled: user.tutorantPreferences?.enabled || false,
      },
      accessToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Déconnexion réussie' });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token manquant' });
  }

  const payload = verifyRefreshToken(refreshToken);

  if (!payload) {
    res.clearCookie('refreshToken');
    return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      tutorantPreferences: true,
    },
  });

  if (!user) {
    return res.status(401).json({ error: 'Utilisateur non trouvé' });
  }

  const newPayload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ accessToken });
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Token invalide' });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      tutorantPreferences: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      classLevel: getClassLevelFromDb(user.classLevel),
      specialties: JSON.parse(user.specialties),
      options: JSON.parse(user.options),
      avatar: user.avatar,
      role: user.role,
      emailVerified: user.emailVerified,
      isTutorantEnabled: user.tutorantPreferences?.enabled || false,
    },
  });
});

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verificationToken) {
      return res.status(400).json({ error: 'Token invalide' });
    }

    if (verificationToken.expiresAt < new Date()) {
      await prisma.emailVerificationToken.delete({ where: { token } });
      return res.status(400).json({ error: 'Token expiré' });
    }

    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    });

    await prisma.emailVerificationToken.delete({ where: { token } });

    res.json({ message: 'Email vérifié avec succès' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Verify email error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = resendVerificationSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email déjà vérifié' });
    }

    await prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    const newToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: {
        token: newToken,
        userId: user.id,
        expiresAt: tokenExpiresAt,
      },
    });

    await sendVerificationEmail(user.email, newToken);

    res.json({ message: 'Email de vérification envoyé' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Resend verification error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = requestPasswordResetSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
    }

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt: tokenExpiresAt,
      },
    });

    await sendPasswordResetEmail(user.email, resetToken);

    res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Request password reset error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'Token invalide' });
    }

    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { token } });
      return res.status(400).json({ error: 'Token expiré' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.delete({ where: { token } });

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
