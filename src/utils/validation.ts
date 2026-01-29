import { z } from 'zod';

export const CLASS_LEVELS = ['2nde', '1ère', 'Terminale'] as const;
export const SUBJECTS = ['Mathématiques', 'Physique-Chimie', 'Français', 'Anglais', 'Histoire-Géo', 'SVT'] as const;
export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'] as const;
export const TIME_SLOTS = ['M1', 'M2', 'M3', 'M4', 'S1', 'S2', 'S3', 'S4'] as const;
export const REQUEST_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'HONORED', 'CANCELLED'] as const;

export const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  classLevel: z.enum(CLASS_LEVELS),
  specialties: z.array(z.string()).default([]),
  options: z.array(z.string()).default([]),
  avatar: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Le token est requis'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Email invalide'),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email('Email invalide'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Le token est requis'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export const tutorantPreferencesSchema = z.object({
  subjects: z.array(z.enum(SUBJECTS)),
  levels: z.array(z.enum(CLASS_LEVELS)),
  availableOutsideHours: z.boolean(),
});

export const tutorantEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const weeklyAvailabilitySchema = z.object({
  availableSlots: z.array(z.string()),
});

export const availabilityExceptionSchema = z.object({
  date: z.string().datetime(),
  isAvailable: z.boolean(),
  reason: z.string().optional(),
});

export const matchQuerySchema = z.object({
  subject: z.enum(SUBJECTS),
  level: z.enum(CLASS_LEVELS),
  slotId: z.string(),
});

export const createRequestSchema = z.object({
  tutorId: z.string().optional(),
  subject: z.enum(SUBJECTS),
  level: z.enum(CLASS_LEVELS),
  slotId: z.string(),
  date: z.string().datetime(),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(REQUEST_STATUSES),
});

export const broadcastCallSchema = z.object({
  subject: z.enum(SUBJECTS),
  level: z.enum(CLASS_LEVELS),
  slotId: z.string(),
  date: z.string().datetime(),
});

export const createConversationSchema = z.object({
  participantId: z.string(),
  requestId: z.string().optional(),
});

export const createMessageSchema = z.object({
  content: z.string().min(1).max(2000).transform(val => val.replace(/<[^>]*>/g, '').trim()),
});

export const createAbuseReportSchema = z.object({
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  reason: z.string().min(1, 'La raison est requise'),
  description: z.string().min(1, 'La description est requise'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TutorantPreferencesInput = z.infer<typeof tutorantPreferencesSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type CreateAbuseReportInput = z.infer<typeof createAbuseReportSchema>;
