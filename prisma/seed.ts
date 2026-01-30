import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SUBJECTS = ['Mathématiques', 'Physique-Chimie', 'Français', 'Anglais', 'Histoire-Géo', 'SVT'];
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const TIME_SLOTS = ['M1', 'M2', 'M3', 'M4', 'S1', 'S2', 'S3', 'S4'];

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up existing data
  await prisma.abuseReport.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.tutoringRequest.deleteMany();
  await prisma.availabilityException.deleteMany();
  await prisma.weeklyAvailabilitySlot.deleteMany();
  await prisma.tutorantPreference.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('demo123', 10);

  // Create Moderator
  const moderator = await prisma.user.create({
    data: {
      email: 'admin@lycee.fr',
      password: hashedPassword,
      firstName: 'M.',
      lastName: 'Directeur',
      classLevel: 'TERMINALE',
      specialties: '[]',
      options: '[]',
      role: 'MODERATOR',
      emailVerified: true,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
    },
  });

  console.log('✅ Created moderator:', moderator.email);

  // Create Tutorants (one per level)
  const tutorant2nde = await prisma.user.create({
    data: {
      email: 'lucas@lycee.fr',
      password: hashedPassword,
      firstName: 'Lucas',
      lastName: 'Bernard',
      classLevel: 'SECONDE',
      specialties: JSON.stringify(['Maths', 'Physique']),
      options: '[]',
      role: 'STUDENT',
      emailVerified: true,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas',
    },
  });

  await prisma.tutorantPreference.create({
    data: {
      userId: tutorant2nde.id,
      subjects: JSON.stringify(['Mathématiques', 'Physique-Chimie']),
      levels: JSON.stringify(['2nde']),
      enabled: true,
      availableOutsideHours: false,
    },
  });

  await prisma.weeklyAvailabilitySlot.createMany({
    data: [
      { userId: tutorant2nde.id, day: 'Lundi', slotId: 'S3' },
      { userId: tutorant2nde.id, day: 'Mardi', slotId: 'M4' },
      { userId: tutorant2nde.id, day: 'Mercredi', slotId: 'S1' },
    ],
  });

  console.log('✅ Created tutorant (2nde):', tutorant2nde.email);

  const tutorant1ere = await prisma.user.create({
    data: {
      email: 'emma@lycee.fr',
      password: hashedPassword,
      firstName: 'Emma',
      lastName: 'Petit',
      classLevel: 'PREMIERE',
      specialties: JSON.stringify(['SVT', 'Anglais']),
      options: '[]',
      role: 'STUDENT',
      emailVerified: true,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
    },
  });

  await prisma.tutorantPreference.create({
    data: {
      userId: tutorant1ere.id,
      subjects: JSON.stringify(['SVT', 'Anglais']),
      levels: JSON.stringify(['2nde', '1ère']),
      enabled: true,
      availableOutsideHours: true,
    },
  });

  await prisma.weeklyAvailabilitySlot.createMany({
    data: [
      { userId: tutorant1ere.id, day: 'Lundi', slotId: 'S3' },
      { userId: tutorant1ere.id, day: 'Jeudi', slotId: 'S2' },
      { userId: tutorant1ere.id, day: 'Vendredi', slotId: 'M3' },
    ],
  });

  console.log('✅ Created tutorant (1ère):', tutorant1ere.email);

  const tutorantTerm = await prisma.user.create({
    data: {
      email: 'hugo@lycee.fr',
      password: hashedPassword,
      firstName: 'Hugo',
      lastName: 'Leroy',
      classLevel: 'TERMINALE',
      specialties: JSON.stringify(['Maths', 'NSI']),
      options: '[]',
      role: 'STUDENT',
      emailVerified: true,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hugo',
    },
  });

  await prisma.tutorantPreference.create({
    data: {
      userId: tutorantTerm.id,
      subjects: JSON.stringify(['Mathématiques']),
      levels: JSON.stringify(['2nde', '1ère', 'Terminale']),
      enabled: true,
      availableOutsideHours: false,
    },
  });

  await prisma.weeklyAvailabilitySlot.createMany({
    data: [
      { userId: tutorantTerm.id, day: 'Lundi', slotId: 'S3' },
      { userId: tutorantTerm.id, day: 'Mardi', slotId: 'S4' },
      { userId: tutorantTerm.id, day: 'Vendredi', slotId: 'S4' },
    ],
  });

  console.log('✅ Created tutorant (Terminale):', tutorantTerm.email);

  // Create Tutorés (students)
  const tutore1 = await prisma.user.create({
    data: {
      email: 'thomas@lycee.fr',
      password: hashedPassword,
      firstName: 'Thomas',
      lastName: 'Dubois',
      classLevel: 'SECONDE',
      specialties: '[]',
      options: '[]',
      role: 'STUDENT',
      emailVerified: true,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Thomas',
    },
  });

  console.log('✅ Created tutoré:', tutore1.email);

  const tutore2 = await prisma.user.create({
    data: {
      email: 'sophie@lycee.fr',
      password: hashedPassword,
      firstName: 'Sophie',
      lastName: 'Martin',
      classLevel: 'SECONDE',
      specialties: '[]',
      options: '[]',
      role: 'STUDENT',
      emailVerified: true,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie',
    },
  });

  console.log('✅ Created tutoré:', tutore2.email);

  // Create one unverified user for testing
  const unverified = await prisma.user.create({
    data: {
      email: 'unverified@lycee.fr',
      password: hashedPassword,
      firstName: 'Jean',
      lastName: 'NonVérifié',
      classLevel: 'SECONDE',
      specialties: '[]',
      options: '[]',
      role: 'STUDENT',
      emailVerified: false,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jean',
    },
  });

  console.log('✅ Created unverified user:', unverified.email);

  console.log('\n🎉 Seed completed!\n');
  console.log('Demo credentials:');
  console.log('─────────────────────────────────────');
  console.log('Moderator:');
  console.log('  Email: admin@lycee.fr');
  console.log('  Password: demo123');
  console.log('\nTutorants:');
  console.log('  Lucas (2nde): lucas@lycee.fr');
  console.log('  Emma (1ère): emma@lycee.fr');
  console.log('  Hugo (Term): hugo@lycee.fr');
  console.log('  Password: demo123');
  console.log('\nTutorés:');
  console.log('  Thomas: thomas@lycee.fr');
  console.log('  Sophie: sophie@lycee.fr');
  console.log('  Password: demo123');
  console.log('\nUnverified (for testing):');
  console.log('  Jean: unverified@lycee.fr');
  console.log('  Password: demo123');
  console.log('─────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
