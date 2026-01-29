import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

let transporter: nodemailer.Transporter | null = null;

export async function initializeEmail() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    logger.info('SMTP email service initialized');
  } else {
    logger.warn('SMTP not configured, using Ethereal for testing');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.info('Ethereal email service initialized');
    } catch (error) {
      logger.error('Failed to initialize Ethereal email service:', error);
    }
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  if (!transporter) {
    logger.warn('Email service not available, verification link:', `${process.env.FRONTEND_URL}/verify-email?token=${token}`);
    return;
  }

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  const from = process.env.SMTP_FROM || 'Agora <noreply@agora.fr>';

  try {
    const info = await transporter.sendMail({
      from,
      to: email,
      subject: 'Vérifiez votre email - Agora',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Bienvenue sur Agora !</h2>
          <p>Merci de vous être inscrit. Pour activer votre compte, veuillez vérifier votre adresse email.</p>
          <p style="margin: 20px 0;">
            <a href="${verificationUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Vérifier mon email
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">Ce lien expire dans 24 heures.</p>
          <p style="color: #666; font-size: 14px;">Si vous n'avez pas créé de compte Agora, ignorez cet email.</p>
        </div>
      `,
    });

    logger.info('Verification email sent:', info.messageId);
    if (process.env.SMTP_HOST) {
      logger.info('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    logger.error('Failed to send verification email:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  if (!transporter) {
    logger.warn('Email service not available, reset link:', `${process.env.FRONTEND_URL}/reset-password?token=${token}`);
    return;
  }

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const from = process.env.SMTP_FROM || 'Agora <noreply@agora.fr>';

  try {
    const info = await transporter.sendMail({
      from,
      to: email,
      subject: 'Réinitialisation de votre mot de passe - Agora',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Réinitialisation de mot de passe</h2>
          <p>Vous avez demandé la réinitialisation de votre mot de passe Agora.</p>
          <p style="margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">Ce lien expire dans 1 heure.</p>
          <p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        </div>
      `,
    });

    logger.info('Password reset email sent:', info.messageId);
    if (!process.env.SMTP_HOST) {
      logger.info('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    throw error;
  }
}
