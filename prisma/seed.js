/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL environment variable is required to run the seed script.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Seed Accounts (Combo Box Items)
  const defaultAccounts = [
    { code: '6001', name: 'Travel & Transport' },
    { code: '6002', name: 'Entertainment & Meals' },
    { code: '6003', name: 'Office Supplies & Stationery' },
    { code: '6004', name: 'Telephone & Internet' },
    { code: '6005', name: 'Staff Welfare' },
    { code: '6006', name: 'Medical Expenses' },
    { code: '6007', name: 'Miscellaneous Expenses' },
  ];

  for (const acc of defaultAccounts) {
    await prisma.account.upsert({
      where: { code: acc.code },
      update: { name: acc.name, isActive: true },
      create: { code: acc.code, name: acc.name, isActive: true },
    });
  }
  console.log(`Seeded ${defaultAccounts.length} default accounts.`);

  // 2. Seed Admin User
  const adminPasswordHash = await bcrypt.hash('adminpassword', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      name: 'Administrator',
    },
  });
  console.log('Seeded admin user (username: "admin", password: "adminpassword").');

  // 3. Seed Staff User
  const staffPasswordHash = await bcrypt.hash('staffpassword', 10);
  await prisma.user.upsert({
    where: { username: 'staff' },
    update: {},
    create: {
      username: 'staff',
      passwordHash: staffPasswordHash,
      role: 'STAFF',
      name: 'Staff User',
    },
  });
  console.log('Seeded staff user (username: "staff", password: "staffpassword").');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
