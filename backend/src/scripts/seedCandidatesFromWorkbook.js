import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import Candidate from '../models/Candidate.js';

const SEED_FILE = new URL('../../../src/portal/data/candidateSeed.json', import.meta.url);

function stripSeedMeta(candidate) {
  const rest = { ...candidate };
  delete rest.id;
  delete rest._id;
  return rest;
}

async function loadSeedCandidates() {
  const raw = await readFile(SEED_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

export async function seedCandidatesFromWorkbook({ replace = false } = {}) {
  if (!globalThis.process?.env?.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set.');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(globalThis.process.env.MONGODB_URI);
  }

  const seed = await loadSeedCandidates();
  if (!replace) {
    const existingCount = await Candidate.countDocuments();
    if (existingCount > 0) {
      return { inserted: 0, skipped: true, total: existingCount };
    }
  } else {
    await Candidate.deleteMany({});
  }

  const docs = seed.map(stripSeedMeta);
  const inserted = docs.length > 0 ? await Candidate.insertMany(docs, { ordered: false }) : [];
  return { inserted: inserted.length, skipped: false, total: inserted.length };
}

const invokedDirectly = globalThis.process?.argv?.[1]
  && fileURLToPath(import.meta.url) === path.resolve(globalThis.process.argv[1]);

if (invokedDirectly) {
  const replace = globalThis.process.argv.includes('--replace');
  seedCandidatesFromWorkbook({ replace })
    .then((result) => {
      console.log(`[seed] candidates ${result.skipped ? 'skipped' : 'seeded'} (${result.total || result.inserted} records)`);
      if (mongoose.connection.readyState === 1) {
        return mongoose.disconnect();
      }
      return null;
    })
    .catch(async (error) => {
      console.error('[seed] candidate seeding failed:', error.message);
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect().catch(() => {});
      }
      globalThis.process.exitCode = 1;
    });
}
