import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pricing = await prisma.modelPricing.findMany();
  console.log('Current Model Pricing:');
  console.dir(pricing, { depth: null });
  
  const users = await prisma.user.findMany({
    select: { id: true, email: true, coinBalance: true, role: true }
  });
  console.log('\nUsers:');
  console.dir(users, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
