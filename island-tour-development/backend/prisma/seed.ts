import 'dotenv/config';
// Enable seeding bypass for auth.instance.ts hooks
process.env.IS_SEEDING = 'true';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import { auth } from '../src/auth/auth.instance';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      'Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment variables',
    );
    process.exit(1);
  }

  console.log(`Checking if admin user ${email} exists...`);

  const existingAdmin = await prisma.user.findUnique({
    where: { email },
  });

  if (existingAdmin) {
    console.log(`Admin user ${email} already exists. Skipping.`);
    return;
  }

  console.log(`Creating admin user ${email}...`);

  // We use Better Auth's signUpEmail to properly hash the password
  // and create credentials. The 'before' hook will allow this because
  // we set process.env.IS_SEEDING = 'true' at the top of this script.
  await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: 'System Admin',
      role: Role.ADMIN,
    },
  });

  console.log(`Successfully created admin user ${email}!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
