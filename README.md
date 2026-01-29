# Agora - Plateforme de Tutorat Scolaire

Agora est une plateforme de tutorat entre élèves permettant aux étudiants de demander de l'aide et aux tuteurs de proposer leurs services.

## Stack Technique

### Backend
- **Node.js** + **TypeScript**
- **Express** - Framework web
- **Prisma ORM** - ORM pour la base de données
- **SQLite** - Base de données (développement)
- **Socket.io** - Communication temps réel
- **JWT** - Authentification (access + refresh tokens)
- **bcrypt** - Hashage des mots de passe
- **Nodemailer** - Envoi d'emails (SMTP ou Ethereal)
- **Zod** - Validation des données

### Frontend
- **React** - Interface utilisateur
- **Tailwind CSS** - Styling
- **Lucide Icons** - Icônes

## Installation

### Prérequis
- Node.js 18+ 
- npm ou yarn

### Étapes

1. Cloner le repository

2. Installer les dépendances:
```bash
npm install
```

3. Configurer les variables d'environnement:
```bash
cp .env.example .env
```

Editer `.env` si nécessaire (valeurs par défaut fournies)

4. Générer le client Prisma:
```bash
npm run prisma:generate
```

5. Créer la base de données et appliquer les migrations:
```bash
npm run prisma:migrate
```

6. Peupler la base de données avec les données de démo:
```bash
npm run seed
```

7. Démarrer le serveur de développement:
```bash
npm run dev
```

Le serveur backend sera disponible sur `http://localhost:3001`

L'interface web est accessible via `index.html` dans votre navigateur

## Comptes de Démo

Après avoir exécuté `npm run seed`, les comptes suivants sont créés:

### Modérateur
- Email: `admin@lycee.fr`
- Mot de passe: `demo123`

### Tuteurs
- Lucas (2nde): `lucas@lycee.fr`
- Emma (1ère): `emma@lycee.fr`
- Hugo (Terminale): `hugo@lycee.fr`
- Mot de passe: `demo123`

### Élèves
- Thomas: `thomas@lycee.fr`
- Sophie: `sophie@lycee.fr`
- Mot de passe: `demo123`

### Compte non vérifié (pour tests)
- Jean: `unverified@lycee.fr`
- Mot de passe: `demo123`

## API Routes

### Authentification (`/api/auth`)
- `POST /register` - Créer un compte
- `POST /login` - Se connecter
- `POST /logout` - Se déconnecter
- `POST /refresh` - Rafraîchir le token
- `GET /me` - Obtenir l'utilisateur actuel
- `POST /verify-email` - Vérifier l'email
- `POST /resend-verification` - Renvoyer l'email de vérification
- `POST /request-password-reset` - Demander une réinitialisation de mot de passe
- `POST /reset-password` - Réinitialiser le mot de passe

### Tutorant (`/api/tutorant`)
- `GET /preferences` - Obtenir les préférences
- `PUT /preferences` - Mettre à jour les préférences
- `GET /availability` - Obtenir les disponibilités
- `PUT /availability` - Mettre à jour les disponibilités
- `POST /exceptions` - Créer une exception de disponibilité
- `PATCH /enabled` - Activer/désactiver le mode tuteur

### Matching & Requêtes
- `GET /match` - Trouver des tuteurs pour un créneau
- `POST /requests` - Créer une demande de tutorat
- `GET /requests` - Lister les demandes (mode=tutore|tutorant)
- `PATCH /requests/:id/status` - Mettre à jour le statut d'une demande
- `POST /calls` - Lancer un appel de tutorat (broadcast)

### Messagerie (`/api`)
- `GET /conversations` - Lister les conversations
- `POST /conversations` - Créer une conversation
- `GET /conversations/:id/messages` - Obtenir les messages d'une conversation
- `POST /conversations/:id/messages` - Envoyer un message

### Modération (`/api/mod`)
- `POST /abuse-reports` - Signaler un abus
- `GET /reports` - Lister les signalements (modérateur)
- `GET /conversations/:id` - Voir une conversation (modérateur)
- `PATCH /reports/:id` - Mettre à jour un signalement

## Règles Métier

### Hiérarchie des classes
- 2nde = 1
- 1ère = 2
- Terminale = 3

### Règles de matching tuteur
Un tuteur peut apparaître dans les recherches SEUL si:
1. Son mode tuteur est activé (`enabled = true`)
2. Il n'est pas l'utilisateur cherchant (pas d'auto-tutorat)
3. Il enseigne la matière sélectionnée
4. Il enseigne le niveau demandé
5. Son niveau est supérieur ou égal à celui de l'élève
6. Il est disponible sur le créneau sélectionné
7. Les exceptions ponctuelles override le planning hebdo

### Restrictions utilisateurs non vérifiés
Les utilisateurs avec `emailVerified = false` peuvent:
- Se connecter
- Voir l'interface

Mais NE PEUVENT PAS:
- Envoyer des demandes de tutorat
- Envoyer des messages
- Apparaître comme tuteur

## Scripts Disponibles

```bash
npm run dev          # Démarrer en mode développement
npm run build        # Compiler TypeScript
npm start            # Démarrer en production
npm run prisma:generate   # Générer le client Prisma
npm run prisma:migrate    # Créer/mettre à jour la DB
npm run prisma:studio     # Ouvrir Prisma Studio
npm run seed         # Peupler la DB avec les données de démo
```

## Structure du Projet

```
agora/
├── prisma/
│   ├── schema.prisma      # Schéma de la base de données
│   └── seed.ts            # Données de démo
├── src/
│   ├── middleware/
│   │   └── auth.ts        # Middleware d'authentification
│   ├── routes/
│   │   ├── auth.ts        # Routes d'authentification
│   │   ├── tutorant.ts    # Routes tuteur
│   │   ├── matching.ts    # Routes matching & demandes
│   │   ├── messaging.ts   # Routes messagerie
│   │   └── moderation.ts  # Routes modération
│   ├── services/
│   │   └── email.ts       # Service d'envoi d'emails
│   ├── socket/
│   │   └── index.ts       # Configuration Socket.io
│   ├── utils/
│   │   ├── jwt.ts         # Utilitaires JWT
│   │   ├── logger.ts      # Logger
│   │   └── validation.ts   # Schémas Zod
│   └── server.ts          # Point d'entrée serveur
├── index.html             # Frontend React
├── agora_v1.html          # Mockup original
├── package.json
├── tsconfig.json
└── .env.example
```

## Configuration Email

Par défaut, si aucune configuration SMTP n'est fournie, le système utilise Ethereal (service de test) et affiche l'URL de prévisualisation dans les logs.

Pour utiliser un vrai SMTP, configurez ces variables dans `.env`:
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@example.com
SMTP_PASSWORD=votre-mot-de-passe
SMTP_FROM=Agora <noreply@agora.fr>
```

## Sécurité

- Les mots de passe sont hashés avec bcrypt (10 rounds)
- Les tokens JWT expirent après 15 minutes (access) et 7 jours (refresh)
- Les cookies sont httpOnly en production
- Protection XSS basique (sanitization HTML des messages)
- Validation stricte des entrées avec Zod

## Développement

Pour voir les logs SQL:
```bash
DEBUG="prisma:query" npm run dev
```

Pour ouvrir l'interface Prisma Studio et explorer la base de données:
```bash
npm run prisma:studio
```

## Licence

Ce projet est créé à des fins éducatives.
