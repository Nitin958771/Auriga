import { PrismaClient, SpotType, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Admin
  const adminPassword = await argon2.hash('admin123');
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  // Create Attendant
  const attendantPassword = await argon2.hash('attendant123');
  await prisma.user.upsert({
    where: { username: 'attendant' },
    update: {},
    create: {
      username: 'attendant',
      passwordHash: attendantPassword,
      role: UserRole.ATTENDANT,
    },
  });

  // Create Garage
  let garage = await prisma.garage.findFirst();
  if (!garage) {
    garage = await prisma.garage.create({
      data: {
        name: 'Main Downtown Garage',
        description: 'Central parking facility with EV support',
      },
    });

    // Create Levels
    for (let i = 1; i <= 3; i++) {
      const level = await prisma.level.create({
        data: {
          garageId: garage.id,
          levelNumber: i,
          name: `Level ${i}`,
        },
      });

      // Create Spots
      const spotTypes = [SpotType.COMPACT, SpotType.STANDARD, SpotType.EV];
      for (let j = 1; j <= 15; j++) {
        let type = SpotType.STANDARD;
        if (i === 1 && j <= 5) type = SpotType.EV; // Level 1 has EV spots
        else if (j > 10) type = SpotType.COMPACT; // Some compact spots

        await prisma.parkingSpot.create({
          data: {
            levelId: level.id,
            spotNumber: `L${i}-${j.toString().padStart(2, '0')}`,
            spotType: type,
          },
        });
      }
    }
  }

  // Create initial RateCards
  const existingRates = await prisma.rateCard.count();
  if (existingRates === 0) {
    await prisma.rateCard.createMany({
      data: [
        {
          spotType: SpotType.COMPACT,
          firstHourRate: 10.0,
          additionalHourRate: 5.0,
          dailyCap: 50.0,
        },
        {
          spotType: SpotType.STANDARD,
          firstHourRate: 12.0,
          additionalHourRate: 6.0,
          dailyCap: 60.0,
        },
        {
          spotType: SpotType.EV,
          firstHourRate: 15.0,
          additionalHourRate: 8.0,
          dailyCap: 80.0,
        },
      ],
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
