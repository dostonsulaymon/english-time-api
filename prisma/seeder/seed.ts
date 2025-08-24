import { PlanName, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: PlanName.BASIC,
      price: 10000, // example amount
      duration: 30,
    },
    {
      name: PlanName.GOLD,
      price: 25000,
      duration: 90,
    },
    {
      name: PlanName.PRO,
      price: 80000,
      duration: 365,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {}, 
      create: plan,
    });
  }

  console.log('✅ Plans seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
