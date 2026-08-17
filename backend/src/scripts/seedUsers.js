/**
 * seedUsers.js — run once to create initial users in MongoDB
 * Usage: node src/scripts/seedUsers.js
 *
 * Requires MONGODB_URI in .env
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt   from 'bcryptjs';
import User     from '../models/User.js';

const SEED = [
  { name: 'Alice Admin',     email: 'alice@sewingcircle.io', password: 'Admin@2025!',   role: 't-1', avatar: 'AA' },
  { name: 'Bob Recruiter',   email: 'bob@sewingcircle.io',   password: 'Recruit@2025!', role: 't-2', avatar: 'BR' },
  { name: 'Carol Recruiter', email: 'carol@sewingcircle.io', password: 'Recruit@2025!', role: 't-2', avatar: 'CR' },
  { name: 'Dave Client',     email: 'dave@client.com',       password: 'Client@2025!',  role: 't-3', avatar: 'DC' },
  { name: 'Eve Client',      email: 'eve@client.com',        password: 'Client@2025!',  role: 't-3', avatar: 'EC' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[db] Connected');

  for (const u of SEED) {
    const exists = await User.findOne({ email: u.email });
    if (exists) { console.log(`[skip] ${u.email} already exists`); continue; }
    const passwordHash = await bcrypt.hash(u.password, 12);
    await User.create({ name: u.name, email: u.email, passwordHash, role: u.role, avatar: u.avatar });
    console.log(`[created] ${u.email} (${u.role})`);
  }

  await mongoose.disconnect();
  console.log('[done]');
}

seed().catch((err) => { console.error(err); process.exit(1); });
