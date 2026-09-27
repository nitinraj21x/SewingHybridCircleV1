/**
 * seedFromExcel.js — seeds candidates from the Excel workbook into MongoDB.
 *
 * Usage (from backend/ folder):
 *   node src/scripts/seedFromExcel.js                    ← skip if data exists
 *   node src/scripts/seedFromExcel.js --replace          ← wipe existing & re-seed
 *   node src/scripts/seedFromExcel.js --dry-run          ← preview without writing
 *
 * Source: SewingCircle/Resources/Talent Resource Consolidation_2026.xlsx
 * Sheet:  "NA Candidates"
 */
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mongoose from 'mongoose';
import XLSX from 'xlsx';
import User from '../models/User.js';
import Candidate from '../models/Candidate.js';

// ── Path to the workbook (relative to this script's location) ─────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKBOOK_PATH = path.resolve(
  __dirname,
  '../../../../../Resources/Talent Resource Consolidation_2026.xlsx'
);
const SHEET_NAME = 'NA Candidates';

// ── Column → field mapping ────────────────────────────────────────────────────
// Headers from the sheet (exact strings):
// S.No | Candidate Name | Source | Candidate Spoken to | City | State | Country |
// Contact Number | Email ID | Exp in Yrs | Exp in Months | Certifications |
// Designa tion/Role | Primary Skills | Secondary Skills | AI Experience |
// IT  Capability | Community | SP Reference | Other Technical Skills |
// Current Employer | Expected Salary | Discussion Stage | Vendor Name | Status |
// Comments | Prefer Work Location | Referred By | Selected | LinkedIn Profile |
// Seniority Level | Open to Work (As From LinkedIn) | IT/Non-IT | Domain Experience

function str(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function num(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// Parse "Candidate Name" into first/last
function parseName(fullName) {
  const parts = str(fullName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Unknown', lastName: 'Unknown' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

// Build a location string from city/state/country columns
function buildLocation(city, state, country) {
  const parts = [str(city), str(state), str(country)].filter(Boolean);
  return parts.join(', ');
}

// Generate a placeholder email if missing (required field in schema)
function resolveEmail(raw, firstName, lastName, index) {
  const cleaned = str(raw).toLowerCase();
  if (cleaned && cleaned.includes('@')) return cleaned;
  // Generate a unique placeholder so unique index constraints don't fire
  const slug = `${str(firstName).toLowerCase().replace(/\s+/g, '')}.${str(lastName).toLowerCase().replace(/\s+/g, '') || index}`;
  return `${slug}.noemail${index}@placeholder.sewingcircle.internal`;
}

// Map a raw Excel row object to a Candidate document shape
function rowToCandidate(row, addedById, index) {
  const { firstName, lastName } = parseName(row['Candidate Name']);
  const city    = str(row['City']);
  const state   = str(row['State']);
  const country = str(row['Country']);
  const location = buildLocation(city, state, country);

  // Build skills array from primary + secondary + other technical skills
  const skillParts = [
    str(row['Primary Skills']),
    str(row['Secondary Skills']),
    str(row['Other Technical Skills']),
  ]
    .filter(Boolean)
    .join(', ')
    .split(/[,;\/]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const uniqueSkills = [...new Set(skillParts)];

  const currentRole = str(row['Designa tion/Role']) || str(row['Designation/Role']) || 'Not Specified';
  const statusRaw   = str(row['Status']).toLowerCase();

  // Map Excel status values to schema enum
  let status = 'Active';
  if (statusRaw.includes('selected'))   status = 'Placed';
  else if (statusRaw.includes('place')) status = 'Placed';
  else if (statusRaw.includes('reject')) status = 'Rejected';
  else if (statusRaw.includes('inactiv')) status = 'Inactive';
  else if (statusRaw.includes('interview')) status = 'Interviewing';

  const expYrs = num(row['Exp in Yrs']);
  const expMonths = num(row['Exp in Months']);
  // Use expInYrs as totalExperience; if 0 try to derive from months
  const totalExperience = expYrs || Math.floor(expMonths / 12) || 0;

  return {
    firstName,
    lastName,
    email:           resolveEmail(row['Email ID'], firstName, lastName, index),
    phone:           str(row['Contact Number']),
    location,
    city,
    state,
    country,
    source:          str(row['Source']),
    candidateSpokenTo: str(row['Candidate Spoken to']),
    expInYrs:        expYrs,
    expInMonths:     expMonths,
    currentRole,
    currentCompany:  str(row['Current Employer']),
    totalExperience,
    primarySkill:    str(row['Primary Skills']),
    secondarySkill:  str(row['Secondary Skills']),
    skills:          uniqueSkills,
    certifications:  str(row['Certifications']),
    designationRole: currentRole,
    aiExperience:    str(row['AI Experience']),
    itCapability:    str(row['IT  Capability']),
    community:       str(row['Community']),
    spReference:     str(row['SP Reference']),
    otherTechnicalSkills: str(row['Other Technical Skills']),
    expectedSalary:  str(row['Expected Salary']),
    discussionStage: str(row['Discussion Stage']),
    vendorName:      str(row['Vendor Name']),
    workAuthorization: str(row['Status']), // "US Citizen", "H1B", etc. stored here too
    comments:        str(row['Comments']),
    preferredWorkLocation: str(row['Prefer Work Location']),
    referredBy:      str(row['Referred By']),
    selected:        str(row['Selected']),
    linkedIn:        str(row['LinkedIn Profile']),
    seniorityLevel:  str(row['Seniority Level']),
    openToWork:      str(row['Open to Work (As From LinkedIn)']),
    itNonIT:         str(row['IT/Non-IT']),
    domainExperience: str(row['Domain Experience']),
    status,
    addedBy: addedById,
    notes: `Imported from Excel workbook (row ${index + 2}).`,
  };
}

async function run() {
  const args    = process.argv.slice(2);
  const replace = args.includes('--replace');
  const dryRun  = args.includes('--dry-run');

  // ── Load workbook ──────────────────────────────────────────────────────────
  console.log(`[excel] Reading: ${WORKBOOK_PATH}`);
  let wb;
  try {
    wb = XLSX.readFile(WORKBOOK_PATH);
  } catch (err) {
    console.error(`[excel] Failed to read workbook: ${err.message}`);
    console.error(`        Make sure the file exists at:\n        ${WORKBOOK_PATH}`);
    process.exit(1);
  }

  if (!wb.SheetNames.includes(SHEET_NAME)) {
    console.error(`[excel] Sheet "${SHEET_NAME}" not found. Available: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }

  const ws   = wb.Sheets[SHEET_NAME];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`[excel] Found ${rows.length} data rows in "${SHEET_NAME}"`);

  if (dryRun) {
    console.log('[dry-run] First 3 rows mapped:');
    rows.slice(0, 3).forEach((row, i) => {
      const { firstName, lastName } = parseName(row['Candidate Name']);
      console.log(`  ${i + 1}. ${firstName} ${lastName} | ${row['City']}, ${row['Country']} | ${row['Primary Skills']}`);
    });
    console.log('[dry-run] No changes written.');
    return;
  }

  // ── Connect to MongoDB ─────────────────────────────────────────────────────
  if (!process.env.MONGODB_URI) {
    console.error('[db] MONGODB_URI is not set in .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[db] Connected to MongoDB Atlas');

  // ── Resolve addedBy — use first t-1 admin user ───────────────────────────
  const adminUser = await User.findOne({ role: 't-1' });
  if (!adminUser) {
    console.error('[seed] No t-1 admin user found. Run `npm run seed` first to create users.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`[seed] Using addedBy: ${adminUser.email}`);

  // ── Handle --replace ──────────────────────────────────────────────────────
  if (replace) {
    const deleted = await Candidate.deleteMany({});
    console.log(`[seed] Cleared ${deleted.deletedCount} existing candidates.`);
  } else {
    const existing = await Candidate.countDocuments();
    if (existing > 0) {
      console.log(`[seed] Collection already has ${existing} candidates. Use --replace to overwrite.`);
      await mongoose.disconnect();
      return;
    }
  }

  // ── Build documents ───────────────────────────────────────────────────────
  const docs = rows
    .filter((row) => str(row['Candidate Name']))  // skip blank rows
    .map((row, i) => rowToCandidate(row, adminUser._id, i));

  console.log(`[seed] Inserting ${docs.length} candidates...`);

  // Insert in batches of 50 to avoid hitting document size limits
  const BATCH = 50;
  let inserted = 0;
  let skipped  = 0;

  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    try {
      const result = await Candidate.insertMany(batch, { ordered: false });
      inserted += result.length;
    } catch (err) {
      // ordered:false means valid docs still insert even if some fail
      if (err.insertedDocs) inserted += err.insertedDocs.length;
      if (err.writeErrors)  skipped  += err.writeErrors.length;
    }
  }

  console.log(`[seed] Done. Inserted: ${inserted}, Skipped (duplicates/errors): ${skipped}`);
  await mongoose.disconnect();
}

// ── Entry point ───────────────────────────────────────────────────────────────
const invokedDirectly = process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  run().catch(async (err) => {
    console.error('[seed] Fatal error:', err.message);
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
    process.exit(1);
  });
}

export { run as seedFromExcel };
