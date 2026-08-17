/**
 * ResumeViewer.jsx — Client (t-3) full-page profile popup.
 *
 * Three tabs (reordered):
 *  Tab 1 "Operator Profile" — Sewing Circle operator profile (default)
 *  Tab 2 "Overview"         — standard candidate info
 *  Tab 3 "Contact"          — gated behind admin-granted access
 *
 * Left expand panel — slides out from under the popup showing all raw
 * field data in a labelled list (matches the admin form layout).
 */
import { useState } from 'react';
import useStore from '../../store/useStore';

/* ── CSS ──────────────────────────────────────────────────────────────────── */
const CSS = `
/* overlay */
.scrv-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.72);
  backdrop-filter:blur(3px);display:flex;align-items:stretch;justify-content:center;
  overflow:hidden}

/* wrapper holds expand-panel + sheet side by side */
.scrv-wrapper{display:flex;align-items:stretch;width:100%;max-width:1280px;
  position:relative;transition:none}

/* ── Left expand panel ── */
.scrv-expand-panel{width:0;min-width:0;overflow:hidden;flex-shrink:0;
  background:#faf9f6;border-right:.5px solid #e2e0d8;
  transition:width .28s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column}
.scrv-expand-panel.open{width:300px;min-width:300px}
.dark .scrv-expand-panel{background:#0a0f1a;border-right-color:#1a2236}
.scrv-panel-inner{width:300px;overflow-y:auto;padding:1.25rem 1rem;flex:1}
.scrv-panel-title{font-size:10px;font-weight:700;letter-spacing:.12em;
  text-transform:uppercase;color:#B5651D;margin-bottom:1rem;padding-bottom:.5rem;
  border-bottom:.5px solid #e2e0d8}
.dark .scrv-panel-title{border-bottom-color:#1a2236}
.scrv-panel-field{margin-bottom:.9rem}
.scrv-panel-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;
  color:#999;margin-bottom:3px;display:flex;align-items:center;gap:4px}
.scrv-panel-req{font-size:9px;color:#B5651D;font-weight:500}
.scrv-panel-value{font-size:12.5px;color:#1a1a1a;line-height:1.55;white-space:pre-wrap;
  word-break:break-word}
.dark .scrv-panel-value{color:#e8edf5}
.scrv-panel-empty{font-size:12px;color:#ccc;font-style:italic}
.dark .scrv-panel-empty{color:#2e3f5c}
.scrv-panel-tag{display:inline-flex;font-size:11px;padding:2px 9px;border-radius:20px;
  font-weight:500;margin:2px;background:#F5E6D8;color:#712B13}
.scrv-panel-skill{display:inline-flex;font-size:11px;padding:2px 8px;border-radius:6px;
  font-weight:500;border:.5px solid;margin:2px}
.scrv-swatch{width:18px;height:18px;border-radius:50%;display:inline-block;
  border:.5px solid rgba(0,0,0,.15);vertical-align:middle;margin-right:4px}

/* ── Expand toggle button ── */
.scrv-expand-btn{position:absolute;left:0;top:50%;transform:translateY(-50%);
  z-index:10;width:22px;height:52px;
  background:#fff;border:.5px solid #e2e0d8;border-left:none;
  border-radius:0 8px 8px 0;cursor:pointer;display:flex;align-items:center;
  justify-content:center;transition:background .15s,left .28s cubic-bezier(.4,0,.2,1)}
.scrv-expand-btn.panel-open{left:300px}
.dark .scrv-expand-btn{background:#0f1623;border-color:#1a2236}
.scrv-expand-btn:hover{background:#f0ede8}
.dark .scrv-expand-btn:hover{background:#161e2e}
.scrv-expand-btn svg{transition:transform .2s}
.scrv-expand-btn.panel-open svg{transform:rotate(180deg)}

/* ── Sheet ── */
.scrv-sheet{display:flex;flex-direction:column;flex:1;height:100%;
  background:#fff;overflow:hidden;min-width:0}
.dark .scrv-sheet{background:#0f1623}

/* topbar */
.scrv-topbar{display:flex;align-items:center;justify-content:space-between;
  padding:.75rem 1.25rem;border-bottom:.5px solid #e2e0d8;background:#faf9f6;flex-shrink:0}
.dark .scrv-topbar{border-bottom-color:#1a2236;background:#0a0f1a}
.scrv-badge{display:inline-flex;align-items:center;gap:5px;font-size:10px;
  background:#F5E6D8;color:#712B13;padding:3px 10px;border-radius:20px;font-weight:500}
.scrv-close{padding:6px 8px;border-radius:6px;border:none;cursor:pointer;
  background:transparent;font-size:18px;line-height:1;color:#888;
  transition:background .15s;font-family:inherit}
.dark .scrv-close{color:#6b7fa3}
.scrv-close:hover{background:rgba(0,0,0,0.07)}
.dark .scrv-close:hover{background:rgba(255,255,255,0.07)}

/* tabs */
.scrv-tabs{display:flex;border-bottom:.5px solid #e2e0d8;background:#faf9f6;
  flex-shrink:0;gap:0}
.dark .scrv-tabs{border-bottom-color:#1a2236;background:#0a0f1a}
.scrv-tab{padding:.75rem 1.25rem;font-size:13px;cursor:pointer;border:none;
  border-bottom:2px solid transparent;color:#777;font-weight:400;background:transparent;
  transition:color .15s;font-family:inherit;white-space:nowrap;
  display:flex;align-items:center;gap:6px}
.dark .scrv-tab{color:#6b7fa3}
.scrv-tab.active{color:#1a1a1a;border-bottom-color:#B5651D;font-weight:500}
.dark .scrv-tab.active{color:#e8edf5}
.scrv-tab-icon{flex-shrink:0;display:flex;align-items:center}

/* body */
.scrv-body{flex:1;overflow-y:auto;padding:1.75rem;background:#fff}
.dark .scrv-body{background:#0f1623}

/* dividers & section titles shared */
.scrv-section-title{font-size:10px;font-weight:600;letter-spacing:.1em;
  text-transform:uppercase;color:#B5651D;margin-bottom:.6rem;margin-top:1.25rem}
.scrv-divider{border:none;border-top:.5px solid #e8e5e0;margin:1.25rem 0}
.dark .scrv-divider{border-top-color:#1a2236}
.scrv-skill-tag{display:inline-flex;font-size:11px;padding:3px 8px;border-radius:6px;
  font-weight:500;border:.5px solid;margin:2px}
.scrv-work-item{padding:.75rem;border-radius:8px;background:#faf9f6;
  border:.5px solid #ece9e4;margin-bottom:.6rem}
.dark .scrv-work-item{background:#161e2e;border-color:#1a2236}
.scrv-work-title{font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:2px}
.dark .scrv-work-title{color:#e8edf5}
.scrv-work-sub{font-size:12px;color:#777}
.dark .scrv-work-sub{color:#6b7fa3}
.scrv-work-desc{font-size:12px;color:#555;margin-top:4px;line-height:1.5}
.dark .scrv-work-desc{color:#b8c4d8}

/* operator profile */
.scrv-wp{max-width:600px}
.scrv-wp-hero{border-left:3px solid #B5651D;padding-left:1.25rem;margin-bottom:1.5rem}
.scrv-wp-quote{font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.5;
  color:#1a1a1a;font-style:italic;margin-bottom:.75rem}
.dark .scrv-wp-quote{color:#e8edf5}
.scrv-wp-name{font-size:20px;font-weight:500;color:#1a1a1a;margin-bottom:2px}
.dark .scrv-wp-name{color:#e8edf5}
.scrv-wp-role{font-size:13px;color:#B5651D;font-weight:500;margin-bottom:4px}
.scrv-wp-loc{font-size:12px;color:#666;display:flex;align-items:center;gap:4px}
.dark .scrv-wp-loc{color:#b8c4d8}
.scrv-wp-tags{display:flex;flex-wrap:wrap;gap:6px;margin:1rem 0}
.scrv-wp-tag{font-size:11px;padding:3px 10px;border-radius:20px;font-weight:500}
.scrv-tag-fn{background:#E6F1FB;color:#0C447C}
.scrv-tag-geo{background:#F1EFE8;color:#444441}
.scrv-wp-story{font-size:13.5px;line-height:1.75;color:#1a1a1a;white-space:pre-wrap}
.dark .scrv-wp-story{color:#e8edf5}
.scrv-proof-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:0 0 1rem}
.scrv-proof-card{background:#faf9f6;border-radius:6px;padding:.75rem;
  border:.5px solid #ece9e4;border-left-width:2px;border-left-color:#B5651D}
.dark .scrv-proof-card{background:#161e2e;border-color:#1a2236;border-left-color:#B5651D}
.scrv-proof-num{font-size:18px;font-weight:500;color:#B5651D;line-height:1}
.scrv-proof-desc{font-size:11px;color:#666;margin-top:3px;line-height:1.4}
.dark .scrv-proof-desc{color:#b8c4d8}
.scrv-dim-row{display:flex;gap:8px;margin-bottom:.75rem}
.scrv-dim-box{flex:1;background:#faf9f6;border-radius:6px;padding:.75rem;border-top:2px solid}
.dark .scrv-dim-box{background:#161e2e}
.scrv-dim-title{font-size:11px;font-weight:500;margin-bottom:4px}
.scrv-dim-text{font-size:11px;color:#666;line-height:1.5;white-space:pre-wrap}
.dark .scrv-dim-text{color:#b8c4d8}
.scrv-avail-tag{font-size:11px;padding:3px 10px;border-radius:20px;font-weight:500}

/* contact */
.scrv-contact-card{background:#faf9f6;border:.5px solid #ece9e4;border-radius:12px;
  padding:1.25rem;max-width:480px}
.dark .scrv-contact-card{background:#161e2e;border-color:#1a2236}
.scrv-contact-row{display:flex;align-items:center;gap:.75rem;padding:.75rem 0;
  border-bottom:.5px solid #ece9e4}
.dark .scrv-contact-row{border-bottom-color:#1a2236}
.scrv-contact-row:last-child{border-bottom:none}
.scrv-contact-icon{width:36px;height:36px;border-radius:8px;background:#f0ede8;
  display:flex;align-items:center;justify-content:center;flex-shrink:0}
.dark .scrv-contact-icon{background:#1e2a3d}
.scrv-contact-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;
  color:#999;margin-bottom:2px}
.scrv-contact-value{font-size:13px;color:#1a1a1a;font-weight:500}
.dark .scrv-contact-value{color:#e8edf5}
.scrv-contact-value a{color:#B5651D;text-decoration:none}
.scrv-contact-value a:hover{text-decoration:underline}
.scrv-masked{font-family:monospace;font-size:13px;color:#ccc;letter-spacing:.1em;user-select:none}
.dark .scrv-masked{color:#2e3f5c}
.scrv-lock-notice{padding:.75rem 1rem;border-radius:8px;background:rgba(239,68,68,0.06);
  border:.5px solid rgba(239,68,68,0.2);font-size:12px;color:#f87171;margin-bottom:1rem}
.scrv-request-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;
  border-radius:8px;border:none;cursor:pointer;font-size:12px;font-weight:500;
  background:#B5651D;color:white;font-family:inherit;transition:opacity .15s;margin-top:1rem}
.scrv-request-btn:hover{opacity:.88}
.scrv-pending-badge{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;
  border-radius:8px;font-size:12px;font-weight:500;background:rgba(245,158,11,.12);
  color:#fbbf24;border:.5px solid rgba(245,158,11,.25);margin-top:1rem}
.scrv-granted-badge{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;
  border-radius:8px;font-size:12px;font-weight:500;background:rgba(16,185,129,.12);
  color:#34d399;border:.5px solid rgba(16,185,129,.25);margin-top:.5rem}

/* request form */
.scrv-req-overlay{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;
  justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(2px)}
.scrv-req-box{background:#fff;border-radius:12px;padding:1.5rem;width:100%;max-width:400px;
  box-shadow:0 20px 40px rgba(0,0,0,.25)}
.scrv-req-title{font-size:15px;font-weight:600;margin-bottom:.5rem;color:#1a1a1a}
.scrv-req-sub{font-size:12px;color:#666;margin-bottom:1rem;line-height:1.5}
.scrv-req-ta{width:100%;font-size:12px;padding:8px;border-radius:6px;resize:none;
  border:.5px solid #ccc;font-family:inherit;color:#1a1a1a;background:#fafafa;margin-bottom:1rem;
  box-sizing:border-box}
.scrv-req-actions{display:flex;gap:8px}
.scrv-req-send{flex:1;padding:9px 16px;border-radius:6px;border:none;cursor:pointer;
  font-size:12px;font-weight:500;background:#B5651D;color:white;font-family:inherit}
.scrv-req-cancel{padding:9px 16px;border-radius:6px;border:none;cursor:pointer;
  font-size:12px;background:#f0f0f0;color:#555;font-family:inherit}
`;

if (typeof document !== 'undefined' && !document.getElementById('scrv-styles')) {
  const el = document.createElement('style');
  el.id = 'scrv-styles';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
function splitDots(str) {
  return (str || '').split('·').map(s => s.trim()).filter(Boolean);
}
function mask(str) {
  if (!str) return '— —';
  return '⬛●◉⬤◆⬟◦◈▪◎◾◉'.slice(0, Math.min(str.length, 12)).padEnd(str.length, '◈');
}
function getAccentLight(hex) {
  const m = { '#B5651D':'#F5E6D8','#C9A84C':'#F5F0DC','#4A7C59':'#E4EDE7',
               '#2B3A4A':'#E8ECF0','#5E35B1':'#EDE7F6' };
  return m[(hex||'').toUpperCase()] ?? '#F5E6D8';
}

/* ── SVG icons (inline, no extra dep) ───────────────────────────────────── */
function IconUser({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function IconBriefcase({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}
function IconLock({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
function IconPhone({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07
        A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.64 3.28 2 2 0 0 1
        3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45
        2.11L7.91 8.59a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45
        c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}
function IconChevronRight({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}
function IconListDetails({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}

/* ── Left expand panel content ──────────────────────────────────────────── */
function DataPanel({ c }) {
  const accent      = c.accentColor || '#B5651D';
  const accentLight = getAccentLight(accent);
  const skills      = c.skills || [];
  const work        = c.workHistory || [];
  const edu         = c.education   || [];

  function Field({ label, value, req, children }) {
    return (
      <div className="scrv-panel-field">
        <div className="scrv-panel-label">
          {label}
          {req && <span className="scrv-panel-req">req</span>}
        </div>
        {children ? children : (
          value
            ? <div className="scrv-panel-value">{value}</div>
            : <div className="scrv-panel-empty">—</div>
        )}
      </div>
    );
  }

  return (
    <div className="scrv-panel-inner">
      <div className="scrv-panel-title">Field Data</div>

      <Field label="Function" req value={c.currentRole} />
      <Field label="City" req value={c.location} />
      <Field label="Experience" value={c.totalExperience ? `${c.totalExperience} years` : null} />
      <Field label="Notice Period" value={c.noticePeriod} />
      <Field label="Status" value={c.status} />
      <Field label="Headline quote" req value={c.headline} />
      <Field label="Narrative (2–3 lines)" req value={c.notes} />
      <Field label="Culture" req value={c.culture} />
      <Field label="Performance" req value={c.performance} />
      <Field label="Capability" req value={c.capability} />

      <div className="scrv-panel-field">
        <div className="scrv-panel-label">Metric 1 <span className="scrv-panel-req">req</span></div>
        {c.metric1Num
          ? <div className="scrv-panel-value">{c.metric1Num}{c.metric1Desc ? <><br /><span style={{color:'#999',fontSize:'11px'}}>{c.metric1Desc}</span></> : null}</div>
          : <div className="scrv-panel-empty">—</div>}
      </div>
      <div className="scrv-panel-field">
        <div className="scrv-panel-label">Metric 2 <span className="scrv-panel-req">req</span></div>
        {c.metric2Num
          ? <div className="scrv-panel-value">{c.metric2Num}{c.metric2Desc ? <><br /><span style={{color:'#999',fontSize:'11px'}}>{c.metric2Desc}</span></> : null}</div>
          : <div className="scrv-panel-empty">—</div>}
      </div>
      <div className="scrv-panel-field">
        <div className="scrv-panel-label">Metric 3 <span className="scrv-panel-req">req</span></div>
        {c.metric3Num
          ? <div className="scrv-panel-value">{c.metric3Num}{c.metric3Desc ? <><br /><span style={{color:'#999',fontSize:'11px'}}>{c.metric3Desc}</span></> : null}</div>
          : <div className="scrv-panel-empty">—</div>}
      </div>

      <Field label="Available for" req value={c.availableFor} />
      <Field label="Industries" value={c.industries} />

      {/* Accent colour */}
      <div className="scrv-panel-field">
        <div className="scrv-panel-label">Accent colour</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
          {['#B5651D','#C9A84C','#4A7C59','#2B3A4A','#5E35B1'].map(col => (
            <span key={col} className="scrv-swatch"
              style={{ background: col, outline: accent === col ? `2px solid ${col}` : 'none',
                outlineOffset: '2px' }} />
          ))}
        </div>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="scrv-panel-field">
          <div className="scrv-panel-label">Skills</div>
          <div style={{ marginTop: '4px' }}>
            {skills.map(s => (
              <span key={s} className="scrv-panel-skill"
                style={{ background: accentLight, color: accent, borderColor: accent + '55' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Work history compact */}
      {work.length > 0 && (
        <div className="scrv-panel-field">
          <div className="scrv-panel-label">Work History</div>
          {work.map((j, i) => (
            <div key={i} style={{ marginTop: '6px', paddingLeft: '8px',
              borderLeft: `2px solid ${accent}55` }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--scrv-text, #1a1a1a)' }}
                className="scrv-panel-value">{j.role}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>
                {j.company}{j.from ? ` · ${j.from}${j.to ? `–${j.to}` : ''}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Education compact */}
      {edu.length > 0 && (
        <div className="scrv-panel-field">
          <div className="scrv-panel-label">Education</div>
          {edu.map((e, i) => (
            <div key={i} style={{ marginTop: '6px', paddingLeft: '8px',
              borderLeft: `2px solid ${accent}55` }}>
              <div className="scrv-panel-value" style={{ fontSize: '12px', fontWeight: 600 }}>{e.degree}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>
                {e.institution}{e.year ? ` · ${e.year}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tab 2: Overview ─────────────────────────────────────────────────────── */
function OverviewTab({ c }) {
  const skills  = c.skills       || [];
  const work    = c.workHistory  || [];
  const edu     = c.education    || [];
  const accent  = c.accentColor  || '#B5651D';
  const skillBg = getAccentLight(accent);

  return (
    <div style={{ maxWidth: '680px' }}>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {[
          { label: 'Current Role',  value: c.currentRole },
          { label: 'Experience',    value: `${c.totalExperience || 0} years` },
          { label: 'Location',      value: c.location },
          { label: 'Notice Period', value: c.noticePeriod },
          { label: 'Status',        value: c.status },
        ].filter(r => r.value).map(({ label, value }) => (
          <div key={label} style={{ minWidth: '120px' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.08em',
              color: '#999', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '13px', fontWeight: 500,
              color: 'var(--text-primary,#1a1a1a)' }}>{value}</div>
          </div>
        ))}
      </div>

      <hr className="scrv-divider" />

      {skills.length > 0 && (
        <>
          <div className="scrv-section-title">Skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '1rem' }}>
            {skills.map(s => (
              <span key={s} className="scrv-skill-tag"
                style={{ background: skillBg, color: accent, borderColor: accent + '55' }}>
                {s}
              </span>
            ))}
          </div>
        </>
      )}

      {work.length > 0 && (
        <>
          <hr className="scrv-divider" />
          <div className="scrv-section-title">Work History</div>
          {work.map((j, i) => (
            <div key={i} className="scrv-work-item">
              <div className="scrv-work-title">{j.role}</div>
              <div className="scrv-work-sub">
                {j.company}{j.from ? ` · ${j.from}${j.to ? ` – ${j.to}` : ''}` : ''}
              </div>
              {j.description && <div className="scrv-work-desc">{j.description}</div>}
            </div>
          ))}
        </>
      )}

      {edu.length > 0 && (
        <>
          <hr className="scrv-divider" />
          <div className="scrv-section-title">Education</div>
          {edu.map((e, i) => (
            <div key={i} className="scrv-work-item">
              <div className="scrv-work-title">{e.degree}</div>
              <div className="scrv-work-sub">
                {e.institution}{e.year ? ` · ${e.year}` : ''}
              </div>
            </div>
          ))}
        </>
      )}

      {c.notes && (
        <>
          <hr className="scrv-divider" />
          <div className="scrv-section-title">Notes</div>
          <div style={{ fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap',
            color: 'var(--text-primary,#1a1a1a)' }}>{c.notes}</div>
        </>
      )}
    </div>
  );
}

/* ── Tab 1: Operator Profile ────────────────────────────────────────────── */
function ProfileTab({ c }) {
  const accent      = c.accentColor || '#B5651D';
  const accentLight = getAccentLight(accent);
  const roleTags    = (c.currentRole || '').split('/').map(s => s.trim()).filter(Boolean);
  const indTags     = splitDots(c.industries);
  const availTags   = splitDots(c.availableFor);
  const hasProofs   = c.metric1Num || c.metric2Num || c.metric3Num;

  return (
    <div className="scrv-wp">
      <div className="scrv-badge" style={{ display: 'inline-flex', marginBottom: '1rem' }}>
        ◆ Sewing Circle operator
      </div>

      <div className="scrv-wp-hero" style={{ borderLeftColor: accent }}>
        {c.headline && <div className="scrv-wp-quote">"{c.headline}"</div>}
        <div className="scrv-wp-name">{c.firstName} {c.lastName}</div>
        <div className="scrv-wp-role" style={{ color: accent }}>{c.currentRole}</div>
        {c.location && (
          <div className="scrv-wp-loc">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {c.location}
          </div>
        )}
      </div>

      {(roleTags.length > 0 || indTags.length > 0) && (
        <div className="scrv-wp-tags">
          {roleTags.map((t, i) => <span key={i} className="scrv-wp-tag scrv-tag-fn">{t}</span>)}
          {indTags.map((t, i)  => <span key={i} className="scrv-wp-tag scrv-tag-geo">{t}</span>)}
        </div>
      )}

      <hr className="scrv-divider" />

      <div className="scrv-section-title">The operator</div>
      <div className="scrv-wp-story">
        {c.notes || <em style={{ color: '#aaa', fontSize: '13px' }}>No narrative provided.</em>}
      </div>

      <hr className="scrv-divider" />

      <div className="scrv-section-title">Confluence profile</div>

      {hasProofs && (
        <div className="scrv-proof-grid">
          {[[c.metric1Num, c.metric1Desc],[c.metric2Num, c.metric2Desc],
            [c.metric3Num, c.metric3Desc]].map(([num, desc], i) =>
            (num || desc) ? (
              <div key={i} className="scrv-proof-card" style={{ borderLeftColor: accent }}>
                <div className="scrv-proof-num" style={{ color: accent }}>{num || '—'}</div>
                <div className="scrv-proof-desc">{desc}</div>
              </div>
            ) : null
          )}
        </div>
      )}

      <div className="scrv-dim-row">
        {[
          { border: '#B5651D', titleColor: '#712B13', label: 'Culture',     text: c.culture     },
          { border: '#C9A84C', titleColor: '#633806', label: 'Performance', text: c.performance },
          { border: '#4A7C59', titleColor: '#27500A', label: 'Capability',  text: c.capability  },
        ].map(({ border, titleColor, label, text }) => (
          <div key={label} className="scrv-dim-box" style={{ borderTopColor: border }}>
            <div className="scrv-dim-title" style={{ color: titleColor }}>{label}</div>
            <div className="scrv-dim-text">{text || <em style={{ color: '#ccc' }}>—</em>}</div>
          </div>
        ))}
      </div>

      {availTags.length > 0 && (
        <>
          <hr className="scrv-divider" />
          <div className="scrv-section-title">Available for</div>
          <div className="scrv-wp-tags">
            {availTags.map((t, i) => (
              <span key={i} className="scrv-avail-tag"
                style={{ background: accentLight, color: accent }}>{t}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Tab 3: Contact ──────────────────────────────────────────────────────── */
function ContactTab({ c, isUnlocked, isPending, requestDone, onRequestOpen }) {
  const accent = c.accentColor || '#B5651D';

  const rows = [
    { icon: <IconPhone size={16} />, label: 'Phone',    value: c.phone,
      href: `tel:${c.phone}` },
    { icon: '✉',                     label: 'Email',    value: c.email,
      href: `mailto:${c.email}` },
    { icon: '🔗',                    label: 'LinkedIn', value: c.linkedIn,
      href: c.linkedIn
        ? (c.linkedIn.startsWith('http') ? c.linkedIn : `https://${c.linkedIn}`)
        : null },
  ];

  return (
    <div>
      {isUnlocked ? (
        <>
          <div className="scrv-granted-badge">✓ Full contact access granted</div>
          <div className="scrv-contact-card" style={{ marginTop: '1rem' }}>
            {rows.map(({ icon, label, value, href }) => value ? (
              <div key={label} className="scrv-contact-row">
                <div className="scrv-contact-icon">{icon}</div>
                <div>
                  <div className="scrv-contact-label">{label}</div>
                  <div className="scrv-contact-value">
                    <a href={href} target={label === 'LinkedIn' ? '_blank' : undefined}
                      rel="noopener noreferrer">{value}</a>
                  </div>
                </div>
              </div>
            ) : null)}
          </div>
        </>
      ) : (
        <>
          <div className="scrv-lock-notice">
            <strong>🔒 Contact details are restricted.</strong>
            <br />The admin must approve access before you can view this candidate's contact info.
          </div>
          <div className="scrv-contact-card">
            {rows.map(({ icon, label, value }) => (
              <div key={label} className="scrv-contact-row">
                <div className="scrv-contact-icon">{icon}</div>
                <div>
                  <div className="scrv-contact-label">{label}</div>
                  <div><span className="scrv-masked">{mask(value)}</span></div>
                </div>
              </div>
            ))}
          </div>
          {isPending || requestDone ? (
            <div className="scrv-pending-badge">⏳ Access request pending admin approval</div>
          ) : (
            <button className="scrv-request-btn" style={{ background: accent }}
              onClick={onRequestOpen}>
              🔓 Request contact access
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ── Request form ────────────────────────────────────────────────────────── */
function RequestForm({ onSend, onCancel }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="scrv-req-overlay">
      <div className="scrv-req-box">
        <div className="scrv-req-title">Request contact access</div>
        <p className="scrv-req-sub">
          Your request will be reviewed by the Sewing Circle team.
          Add an optional note to help explain your interest.
        </p>
        <textarea className="scrv-req-ta" rows={3}
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="Optional note for the admin…" />
        <div className="scrv-req-actions">
          <button
            className="scrv-req-send"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              const ok = await onSend(note);
              if (!ok) setSubmitting(false);
            }}
          >
            {submitting ? 'Sending…' : 'Send Request'}
          </button>
          <button className="scrv-req-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export function ResumeViewer({ candidateId, onClose }) {
  const { candidates, hasContactAccess, hasPendingContactRequest, requestContactAccess } = useStore();
  const [tab,         setTab]         = useState('profile');   // default: Operator Profile
  const [showForm,    setShowForm]    = useState(false);
  const [requestDone, setRequestDone] = useState(false);
  const [panelOpen,   setPanelOpen]   = useState(false);
  const [requestError, setRequestError] = useState('');

  const candidate = candidates.find(c => (c._id || c.id) === candidateId);
  if (!candidate) return null;

  const isUnlocked = hasContactAccess(candidateId);
  const isPending  = hasPendingContactRequest(candidateId);
  const isDark     = !document.documentElement.classList.contains('light');

  const handleSend = async (note) => {
    setRequestError('');
    const request = await requestContactAccess(
      candidateId,
      `${candidate.firstName} ${candidate.lastName}`,
      note
    );
    if (!request) {
      setRequestError('We could not submit your request. Please try again.');
      return false;
    }
    setShowForm(false);
    setRequestDone(true);
    return true;
  };

  const TABS = [
    {
      id: 'profile',
      label: 'Operator Profile',
      icon: <IconUser size={14} />,
    },
    {
      id: 'overview',
      label: 'Overview',
      icon: <IconBriefcase size={14} />,
    },
    {
      id: 'contact',
      label: 'Contact',
      icon: isUnlocked
        ? <IconPhone size={14} style={{ color: '#22c55e' }} />
        : <IconLock size={14} />,
      labelStyle: isUnlocked ? { color: '#22c55e' } : {},
    },
  ];

  return (
    <>
      <div
        className="scrv-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Candidate profile"
        onKeyDown={e => e.key === 'Escape' && onClose()}
        tabIndex={-1}
      >
        {/* wrapper: expand panel + sheet */}
        <div className="scrv-wrapper" style={{ position: 'relative' }}>

          {/* ── Left expand toggle button ── */}
          <button
            className={`scrv-expand-btn${panelOpen ? ' panel-open' : ''}`}
            onClick={() => setPanelOpen(v => !v)}
            aria-label={panelOpen ? 'Close data panel' : 'Open data panel'}
            title={panelOpen ? 'Close field data' : 'View all field data'}
          >
            <IconChevronRight size={12} />
          </button>

          {/* ── Left sliding data panel ── */}
          <div className={`scrv-expand-panel${panelOpen ? ' open' : ''}${isDark ? ' dark' : ''}`}>
            <DataPanel c={candidate} />
          </div>

          {/* ── Main sheet ── */}
          <div className={`scrv-sheet${isDark ? ' dark' : ''}`}>

            {/* top bar */}
            <div className="scrv-topbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="scrv-badge">◆ Sewing Circle operator</span>
                {/* small hint for expand button */}
                <button
                  onClick={() => setPanelOpen(v => !v)}
                  title={panelOpen ? 'Close field data' : 'View all field data'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '11px', color: '#999', background: 'transparent',
                    border: 'none', cursor: 'pointer', padding: '3px 6px',
                    borderRadius: '5px', fontFamily: 'inherit',
                  }}
                >
                  <IconListDetails size={13} />
                  {panelOpen ? 'Hide data' : 'View data'}
                </button>
              </div>
              <button className="scrv-close" onClick={onClose} aria-label="Close">✕</button>
            </div>

            {/* tabs */}
            <div className="scrv-tabs">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`scrv-tab${tab === t.id ? ' active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <span className="scrv-tab-icon" style={t.labelStyle}>{t.icon}</span>
                  <span style={tab === t.id ? {} : t.labelStyle}>{t.label}</span>
                </button>
              ))}
            </div>

            {/* body */}
            <div className="scrv-body">
              {requestError && (
                <div className="scrv-lock-notice" style={{ marginBottom: '1rem' }}>
                  {requestError}
                </div>
              )}
              {tab === 'profile'  && <ProfileTab  c={candidate} />}
              {tab === 'overview' && <OverviewTab c={candidate} />}
              {tab === 'contact'  && (
                <ContactTab
                  c={candidate}
                  isUnlocked={isUnlocked}
                  isPending={isPending}
                  requestDone={requestDone}
                  onRequestOpen={() => setShowForm(true)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <RequestForm onSend={handleSend} onCancel={() => setShowForm(false)} />
      )}
    </>
  );
}
