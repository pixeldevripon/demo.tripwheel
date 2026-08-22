// globalSetup runs in Jest's main CJS process — must be plain JS, not ts-jest ESM.
const dotenv = require('dotenv');
const path = require('path');
const { existsSync } = require('fs');
const { execSync } = require('child_process');

module.exports = async function globalSetup() {
  const envPath = path.resolve(__dirname, '../.env.test');

  if (!existsSync(envPath)) {
    throw new Error(
      '\n\n.env.test not found.\n' +
        'Run: cp backend/.env.test.example backend/.env.test\n' +
        'Then set DATABASE_URL to your test database (e.g. island_tours_test).\n',
    );
  }

  dotenv.config({ path: envPath });

  if (!process.env.DATABASE_URL) {
    throw new Error('.env.test is missing DATABASE_URL');
  }

  // Apply all pending migrations to the test database before the suite starts.
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env },
    stdio: 'inherit',
  });
};
