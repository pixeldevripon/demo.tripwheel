import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import 'dotenv/config';
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

  const existingAdmin = await prisma.user.findUnique({ where: { email } });

  if (existingAdmin) {
    console.log(`Admin user ${email} already exists. Skipping.`);
    return;
  }

  console.log(`Creating admin user ${email}...`);

  // Step 1: Create user via Better Auth so the password is properly hashed.
  // role is not sent — role.input=false means it's ignored anyway. User is
  // created with the default TOUR_OPERATOR role.
  await auth.api.signUpEmail({
    body: { email, password, name: 'System Admin' },
  });

  // Step 2: Elevate to ADMIN directly via Prisma. This bypasses the public
  // sign-up hook which only blocks ADMIN creation through self-registration.
  await prisma.user.update({
    where: { email },
    data: { role: Role.ADMIN, emailVerified: true, hasPassword: true },
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
