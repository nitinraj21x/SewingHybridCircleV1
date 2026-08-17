import { useState, useRef } from 'react';
import {
  X, Upload, FileText, AlertCircle, CheckCircle,
  ChevronDown, ChevronUp, Table2, Info,
} from 'lucide-react';
import { Button } from '../ui/Button';
import useStore from '../../store/useStore';

// ── CSV parser (no external dep) ─────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const result = [];
    let inQuote = false, cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cell += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        result.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    result.push(cell.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const rows    = lines.slice(1).map((line) => {
    const values = parseRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
  return { headers, rows };
}

// ── Column map: CSV header aliases → model fields ────────────────────────────
const FIELD_MAP = {
  firstname:       'firstName',
  first_name:      'firstName',
  lastname:        'lastName',
  last_name:       'lastName',
  email:           'email',
  phone:           'phone',
  location:        'location',
  city:            'city',
  state:           'state',
  country:         'country',
  source:          'source',
  candidatespokento: 'candidateSpokenTo',
  candidate_spoken_to: 'candidateSpokenTo',
  noticeperiod:    'noticePeriod',
  notice_period:   'noticePeriod',
  currentrole:     'currentRole',
  current_role:    'currentRole',
  designationrole: 'designationRole',
  role:            'currentRole',
  currentcompany:  'currentCompany',
  current_company: 'currentCompany',
  currentemployer: 'currentCompany',
  company:         'currentCompany',
  expinyrs:        'expInYrs',
  exp_in_yrs:      'expInYrs',
  expinmonths:     'expInMonths',
  exp_in_months:   'expInMonths',
  totalexperience: 'totalExperience',
  total_experience:'totalExperience',
  experience:      'totalExperience',
  certifications:  'certifications',
  primaryskills:   'primarySkill',
  secondaryskills: 'secondarySkill',
  aiexperience:    'aiExperience',
  itcapability:    'itCapability',
  community:       'community',
  spreference:     'spReference',
  othertechnicalskills: 'otherTechnicalSkills',
  expectedsalary:  'expectedSalary',
  discussionstage: 'discussionStage',
  vendorname:      'vendorName',
  preferredworklocation: 'preferredWorkLocation',
  referredby:      'referredBy',
  selected:        'selected',
  senioritylevel:  'seniorityLevel',
  opentowork:      'openToWork',
  itnonit:         'itNonIT',
  domainexperience:'domainExperience',
  workauthorization:'workAuthorization',
  linkedinprofile: 'linkedIn',
  linked_in:       'linkedIn',
  skills:          'skills',
  comments:        'comments',
  notes:           'notes',
  status:          'status',
  linkedin:        'linkedIn',
};

const PIPELINE_STATUS_VALUES = new Set(['active', 'interviewing', 'placed', 'inactive', 'rejected']);

function splitValues(value) {
  return String(value || '')
    .split(/[;|,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function deriveSkills(row) {
  const skills = [
    ...(Array.isArray(row.skills) ? row.skills : splitValues(row.skills)),
    ...splitValues(row.primarySkill),
    ...splitValues(row.secondarySkill),
    ...splitValues(row.otherTechnicalSkills),
  ];
  return [...new Set(skills.filter(Boolean))];
}

function deriveTotalExperience(row) {
  const direct = Number(row.totalExperience);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const years = Number(row.expInYrs);
  const months = Number(row.expInMonths);
  const total = (Number.isFinite(years) ? years : 0) + ((Number.isFinite(months) ? months : 0) / 12);
  return Number(total.toFixed(2));
}

function mapRow(rawRow) {
  const mapped = {};
  for (const [rawKey, value] of Object.entries(rawRow)) {
    const normalised = rawKey.toLowerCase().replace(/\s+/g, '').replace(/[^a-z_]/g, '');
    const field = FIELD_MAP[normalised];
    if (!field) continue;
    if (field === 'status') {
      const statusValue = String(value || '').trim();
      if (['active', 'interviewing', 'placed', 'inactive', 'rejected'].includes(statusValue.toLowerCase())) {
        mapped.status = statusValue;
      } else if (statusValue) {
        mapped.workAuthorization = statusValue;
      }
      continue;
    }
    mapped[field] = value;
  }

  if (!mapped.currentRole && mapped.designationRole) {
    mapped.currentRole = mapped.designationRole;
  }
  if (!mapped.location) {
    mapped.location = [mapped.city, mapped.state, mapped.country].filter(Boolean).join(', ');
  }
  return mapped;
}

// ── CSV format guide ─────────────────────────────────────────────────────────
const EXAMPLE_CSV = `firstName,lastName,email,phone,city,state,country,source,candidateSpokenTo,currentRole,currentCompany,designationRole,primarySkill,secondarySkill,expInYrs,expInMonths,totalExperience,skills,workAuthorization,selected,openToWork,preferredWorkLocation,comments,linkedIn
Jane,Doe,jane@example.com,+1-555-1234,New York,NY,United States,Resume,Yes,Frontend Engineer,Acme Corp,Frontend Engineer,React,TypeScript,4,0,4,"React;TypeScript;Tailwind CSS",US Citizen,Selected,Open to Work,Hybrid/ Remote,Strong UI skills,https://linkedin.com/in/janedoe
John,Smith,john@example.com,+1-555-5678,Austin,TX,United States,LinkedIn,No,Backend Engineer,StartupXYZ,Backend Engineer,Node.js,Express,6,0,6,"Node.js;PostgreSQL;Docker",H1B,Not Selected,Open to Software Developer Roles,Remote,Open to remote work,https://linkedin.com/in/johnsmith`;

const COLUMNS = [
  { name: 'firstName',       required: true,  example: 'Jane',             note: '' },
  { name: 'lastName',        required: true,  example: 'Doe',              note: '' },
  { name: 'email',           required: true,  example: 'jane@example.com', note: '' },
  { name: 'phone',           required: false, example: '+1-555-1234',      note: '' },
  { name: 'city',            required: false, example: 'New York',         note: '' },
  { name: 'state',           required: false, example: 'NY',               note: '' },
  { name: 'country',         required: false, example: 'United States',    note: '' },
  { name: 'location',        required: false, example: 'New York, NY, United States', note: 'Free text with suggestions' },
  { name: 'source',          required: false, example: 'Resume',           note: '' },
  { name: 'candidateSpokenTo', required: false, example: 'Yes',            note: 'Yes | No' },
  { name: 'currentRole',     required: true,  example: 'Frontend Engineer', note: '' },
  { name: 'designationRole',  required: false, example: 'Frontend Engineer', note: 'Workbook alias for currentRole' },
  { name: 'currentCompany',  required: false, example: 'Acme Corp',         note: '' },
  { name: 'currentEmployer',  required: false, example: 'Acme Corp',         note: 'Workbook alias for currentCompany' },
  { name: 'expInYrs',        required: false, example: '4',                 note: 'Workbook years field' },
  { name: 'expInMonths',     required: false, example: '0',                 note: 'Workbook months field' },
  { name: 'totalExperience', required: false, example: '4',                 note: 'Computed from years + months when omitted' },
  { name: 'primarySkill',    required: false, example: 'React',             note: '' },
  { name: 'secondarySkill',  required: false, example: 'TypeScript',        note: '' },
  { name: 'skills',          required: false, example: 'React;TypeScript',  note: 'Semicolon-separated' },
  { name: 'workAuthorization', required: false, example: 'US Citizen',      note: 'Workbook status field' },
  { name: 'selected',        required: false, example: 'Selected',          note: '' },
  { name: 'openToWork',      required: false, example: 'Open to Work',      note: '' },
  { name: 'preferredWorkLocation', required: false, example: 'Hybrid/ Remote', note: '' },
  { name: 'comments',        required: false, example: 'Strong candidate',  note: '' },
  { name: 'linkedIn',        required: false, example: 'https://...',       note: '' },
];

function GuideSection({ open, onToggle }) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
      >
        <span className="flex items-center gap-2">
          <Table2 size={15} style={{ color: 'var(--accent)' }} />
          CSV Format Guide
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>

          {/* Info notice */}
          <div
            className="flex items-start gap-2 mt-3 text-xs px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--text-muted)' }}
          >
            <Info size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
            <span>
              The CSV must have a header row. Column names are case-insensitive.
              Skills should be separated by semicolons inside a quoted cell.
              Maximum <strong>200 rows</strong> per import.
            </span>
          </div>

          {/* Columns table */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full text-xs" role="table">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Column', 'Required', 'Example', 'Notes'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-faint)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COLUMNS.map((col) => (
                  <tr key={col.name} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-3 py-2 font-mono font-semibold" style={{ color: 'var(--accent-light)' }}>
                      {col.name}
                    </td>
                    <td className="px-3 py-2">
                      {col.required ? (
                        <span className="text-red-400 font-semibold">Yes</span>
                      ) : (
                        <span style={{ color: 'var(--text-ghost)' }}>No</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-muted)' }}>
                      {col.example}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-ghost)' }}>
                      {col.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Example CSV */}
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-faint)' }}>Example CSV</p>
            <pre
              className="text-xs p-3 rounded-lg overflow-x-auto leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
              }}
            >
              {EXAMPLE_CSV}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function BulkImportModal({ isOpen, onClose }) {
  const { addCandidate } = useStore();
  const fileRef = useRef(null);

  const [guideOpen,   setGuideOpen]   = useState(true);
  const [file,        setFile]        = useState(null);
  const [preview,     setPreview]     = useState(null); // { rows, errors }
  const [importing,   setImporting]   = useState(false);
  const [result,      setResult]      = useState(null); // { created, errors }
  const [dragOver,    setDragOver]    = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const processFile = (f) => {
    if (!f || !f.name.endsWith('.csv')) {
      alert('Please upload a .csv file.');
      return;
    }
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { rows } = parseCSV(e.target.result);
      const mapped = rows.map(mapRow);
      const parseErrors = [];
      mapped.forEach((r, i) => {
        if (!r.firstName || !r.lastName || !r.email || !r.currentRole) {
          parseErrors.push({ row: i + 1, error: 'Missing required field(s): firstName, lastName, email, currentRole' });
        }
      });
      setPreview({ rows: mapped, errors: parseErrors });
    };
    reader.readAsText(f);
  };

  const handleFileChange = (e) => { if (e.target.files[0]) processFile(e.target.files[0]); };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  const handleImport = () => {
    if (!preview) return;
    setImporting(true);

    const errors  = [];
    let   created = 0;

    preview.rows.forEach((row, i) => {
      if (!row.firstName || !row.lastName || !row.email || !row.currentRole) {
        errors.push({ row: i + 1, error: 'Skipped: missing required fields.' });
        return;
      }
      const skills = deriveSkills(row);
      const totalExperience = deriveTotalExperience(row);
      const result = addCandidate({
        ...row,
        currentRole: row.currentRole || row.designationRole || '',
        designationRole: row.designationRole || row.currentRole || '',
        totalExperience,
        skills,
        status: PIPELINE_STATUS_VALUES.has(String(row.status || '').toLowerCase())
          ? row.status
          : 'Active',
        noticePeriod: row.noticePeriod || '2 weeks',
        notes: row.notes || row.comments || '',
      });
      if (result) created++;
      else errors.push({ row: i + 1, error: 'Failed to create candidate.' });
    });

    setResult({ created, errors });
    setImporting(false);
  };

  if (!isOpen) return null;

  const validRows   = preview ? preview.rows.filter((_, i) => !preview.errors.find((e) => e.row === i + 1)) : [];
  const previewRows = validRows.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Upload size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Bulk Import Candidates
            </h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.backgroundColor = ''; }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Format guide — always shown first */}
          <GuideSection open={guideOpen} onToggle={() => setGuideOpen((v) => !v)} />

          {/* Result banner */}
          {result && (
            <div
              className="rounded-xl px-4 py-3 flex items-start gap-2 text-sm"
              style={result.errors.length === 0
                ? { backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }
                : { backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }
              }
            >
              {result.errors.length === 0 ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
              <div>
                <p className="font-semibold">
                  {result.created} candidate{result.created !== 1 ? 's' : ''} imported successfully.
                  {result.errors.length > 0 && ` ${result.errors.length} row(s) skipped.`}
                </p>
                {result.errors.map((e) => (
                  <p key={e.row} className="text-xs mt-0.5 opacity-80">Row {e.row}: {e.error}</p>
                ))}
              </div>
            </div>
          )}

          {/* Drop zone */}
          {!result && (
            <div
              className="rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center py-8 cursor-pointer"
              style={{
                borderColor: dragOver ? 'var(--accent)' : 'var(--border-default)',
                backgroundColor: dragOver ? 'rgba(6,182,212,0.05)' : 'var(--bg-elevated)',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              <FileText size={28} className="mb-2" style={{ color: file ? 'var(--accent)' : 'var(--text-ghost)' }} />
              {file ? (
                <>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{file.name}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Click to replace</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Drop a CSV file here</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>or click to browse</p>
                </>
              )}
            </div>
          )}

          {/* Parse errors */}
          {preview && preview.errors.length > 0 && (
            <div className="rounded-xl px-4 py-3 text-xs space-y-1"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <p className="font-semibold flex items-center gap-1"><AlertCircle size={12} /> {preview.errors.length} row(s) have issues:</p>
              {preview.errors.map((e) => (
                <p key={e.row} className="pl-4 opacity-80">Row {e.row}: {e.error}</p>
              ))}
            </div>
          )}

          {/* Preview table */}
          {preview && validRows.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-faint)' }}>
                Preview ({validRows.length} valid row{validRows.length !== 1 ? 's' : ''} · showing first {Math.min(5, validRows.length)}):
              </p>
              <div className="overflow-x-auto rounded-lg border text-xs" style={{ borderColor: 'var(--border-subtle)' }}>
                <table className="w-full">
                  <thead style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <tr>
                      {['Name', 'Email', 'Role', 'Experience', 'Skills'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--text-faint)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {r.firstName} {r.lastName}
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.email}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.currentRole}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.totalExperience || '—'} yrs</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-faint)' }}>
                          {r.skills ? String(r.skills).split(';').slice(0, 3).join(', ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {preview && !result && (
              <span>{validRows.length} of {preview.rows.length} rows ready to import</span>
            )}
          </div>
          <div className="flex gap-2">
            {result ? (
              <>
                <Button variant="secondary" size="sm" onClick={reset}>Import More</Button>
                <Button variant="primary" size="sm" onClick={handleClose}>Done</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={handleClose}>Cancel</Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Upload}
                  disabled={!preview || validRows.length === 0 || importing}
                  onClick={handleImport}
                >
                  {importing ? 'Importing…' : `Import ${validRows.length > 0 ? validRows.length : ''} Candidates`}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
