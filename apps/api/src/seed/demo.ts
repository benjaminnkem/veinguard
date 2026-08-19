import 'dotenv/config';
import mongoose from 'mongoose';
import {
  MODEL_NAMES,
  OrganizationSchema,
  UserSchema,
  newId,
  normalizeEmail,
} from '@repo/persistence';
import { parseApiEnv } from '@repo/config';
import { hashPassword } from '../auth/password';

async function main(): Promise<void> {
  const env = parseApiEnv(process.env);
  const email = process.env.DEMO_USER_EMAIL ?? 'demo@veinguard.local';
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      'Set DEMO_USER_PASSWORD to at least 12 characters. Do not commit it.',
    );
  }
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME });
  const Org = mongoose.model(MODEL_NAMES.Organization, OrganizationSchema);
  const User = mongoose.model(MODEL_NAMES.User, UserSchema);
  const slug = 'veinguard-demo';
  let org = await Org.findOne({ slug });
  if (!org) {
    org = await Org.create({
      _id: newId(),
      name: 'VeinGuard Demo',
      slug,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  const emailNormalized = normalizeEmail(email);
  const existing = await User.findOne({
    organizationId: org._id,
    emailNormalized,
  });
  const passwordHash = await hashPassword(password);
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = 'ADMIN';
    existing.updatedAt = new Date();
    await existing.save();
  } else {
    await User.create({
      _id: newId(),
      organizationId: org._id,
      emailNormalized,
      passwordHash,
      displayName: 'Demo Admin',
      role: 'ADMIN',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  await mongoose.disconnect();
  process.stdout.write(`Seeded org ${slug} user ${emailNormalized}\n`);
}

void main();
