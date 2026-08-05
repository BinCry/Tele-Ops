import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function seedOwner() {
  const telegramOwnerUserId = process.env.TELEGRAM_OWNER_USER_ID?.trim();

  if (!telegramOwnerUserId) {
    console.info(
      'Skipping owner seed because TELEGRAM_OWNER_USER_ID is not set.',
    );
    return;
  }

  await prisma.user.upsert({
    where: {
      telegramUserId: telegramOwnerUserId,
    },
    update: {
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    },
    create: {
      telegramUserId: telegramOwnerUserId,
      displayName: 'TeleOps Owner',
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    },
  });

  console.info(`Ensured owner user ${telegramOwnerUserId} exists.`);
}

async function main() {
  await seedOwner();
}

void main()
  .catch((error: unknown) => {
    console.error('Prisma seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
