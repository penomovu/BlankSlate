# Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- npm installed

## Installation
```bash
npm install
```

## Database Setup

Generate Prisma client and create database:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

## Seed Database

Populate with demo data:
```bash
npx ts-node prisma/seed.ts
```

## Start Server

Development mode (auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## Access Application

Backend API: http://localhost:3001
Frontend: Open `index.html` in your browser

## Demo Credentials

After running seed, these accounts are available:

### Moderator
- Email: admin@lycee.fr
- Password: demo123

### Tuteurs
- Lucas (2nde): lucas@lycee.fr
- Emma (1ère): emma@lycee.fr
- Hugo (Term): hugo@lycee.fr
- Password: demo123

### Élèves
- Thomas: thomas@lycee.fr
- Sophie: sophie@lycee.fr
- Password: demo123

### Non vérifié (pour tests)
- Jean: unverified@lycee.fr
- Password: demo123

## Features Implemented

✅ Authentication (JWT access + refresh tokens)
✅ Email verification system
✅ Password reset functionality
✅ Tutorant preferences management
✅ Availability scheduling (weekly + exceptions)
✅ Matching system with all business rules
✅ Request creation and management
✅ Messaging system
✅ Real-time notifications (Socket.io)
✅ Moderation panel
✅ Abuse reporting
✅ Full frontend integration

## API Endpoints

All endpoints are prefixed with `/api`:

### Auth
- POST `/auth/register` - Create account
- POST `/auth/login` - Login
- POST `/auth/logout` - Logout
- POST `/auth/refresh` - Refresh token
- GET `/auth/me` - Get current user
- POST `/auth/verify-email` - Verify email
- POST `/auth/resend-verification` - Resend verification email
- POST `/auth/request-password-reset` - Request password reset
- POST `/auth/reset-password` - Reset password

### Tutorant
- GET `/tutorant/preferences` - Get preferences
- PUT `/tutorant/preferences` - Update preferences
- GET `/tutorant/availability` - Get availability
- PUT `/tutorant/availability` - Update availability
- POST `/tutorant/exceptions` - Create exception
- PATCH `/tutorant/enabled` - Toggle tutorant mode

### Matching & Requests
- GET `/match` - Find matching tutors
- POST `/requests` - Create tutoring request
- GET `/requests?mode=tutore|tutorant` - List requests
- PATCH `/requests/:id/status` - Update request status
- POST `/calls` - Broadcast tutoring call

### Messaging
- GET `/conversations` - List conversations
- POST `/conversations` - Create conversation
- GET `/conversations/:id/messages` - Get messages
- POST `/conversations/:id/messages` - Send message

### Moderation
- POST `/abuse-reports` - Report abuse
- GET `/mod/reports` - List reports (moderator)
- GET `/mod/conversations/:id` - View conversation (moderator)
- PATCH `/mod/reports/:id` - Update report status

## Business Rules Enforced

1. **Class Hierarchy**: 2nde < 1ère < Terminale
2. **Tutor Matching**: 
   - Tutorant must have enabled mode
   - Cannot self-tutor
   - Must teach the selected subject
   - Must teach the requested level
   - Tutor level >= student level
   - Must be available on selected time slot
3. **Unverified Users**: 
   - Can login
   - Cannot send tutoring requests
   - Cannot send messages
   - Cannot appear as tutorant
4. **Moderators**:
   - Can read all messages
   - Can access abuse reports
   - Cannot tutor or be tutored
