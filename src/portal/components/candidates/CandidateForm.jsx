/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, AlertTriangle, Plus, Trash2, X, CheckCircle } from 'lucide-react';
import useStore from '../../store/useStore';
import { Input, Textarea, Select } from '../ui/Input';
import { SkillInput } from '../ui/SkillTag';
import { Button } from '../ui/Button';
import { Modal, ConfirmModal } from '../ui/Modal';

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', phone: '',
  location: '', city: '', state: '', country: '', source: '', candidateSpokenTo: '',
  expInYrs: '', expInMonths: '',
  workAuthorization: '', preferredWorkLocation: '', referredBy: '', selected: '',
  seniorityLevel: '', openToWork: '', itNonIT: '', comments: '',
  locationOptions: [],
  noticePeriod: '2 weeks',
  currentRole: '', currentCompany: '',
  totalExperience: '',
  designationRole: '',
  primarySkill: '',
  secondarySkill: '',
  skills: [],
  certifications: '',
  aiExperience: '',
  itCapability: '',
  community: '',
  spReference: '',
  otherTechnicalSkills: '',
  expectedSalary: '',
  discussionStage: '',
  vendorName: '',
  domainExperience: '',
  education: [{ degree: '', institution: '', year: '' }],
  workHistory: [{ company: '', role: '', from: '', to: '', description: '' }],
  status: 'Active',
  notes: '',
  linkedIn: '',
  headline: '',
  culture: '',
  performance: '',
  capability: '',
  metric1Num: '',
  metric1Desc: '',
  metric2Num: '',
  metric2Desc: '',
  metric3Num: '',
  metric3Desc: '',
  availableFor: '',
  industries: '',
  accentColor: '#B5651D',
  _resumeUploaded: false,
  _resumeFileName: '',
  _resumeExtractionStatus: 'idle',
  _resumeWarnings: [],
  _resumeConfidence: {},
  _resumeStructured: null,
};

function freshForm(existing) {
  return existing
    ? JSON.parse(JSON.stringify(existing))   // deep clone — no reference sharing
    : JSON.parse(JSON.stringify(EMPTY_FORM)); // deep clone — no reference sharing
}

function joinLocationParts(city, state, country) {
  return [city, state, country].map((part) => String(part || '').trim()).filter(Boolean).join(', ');
}

export function CandidateForm({ isOpen, onClose, editingId }) {
  const { addCandidate, updateCandidate, candidates } = useStore();

  const existing = editingId ? candidates.find((c) => (c._id || c.id) === editingId) : null;

  const [form, setForm] = useState(() => freshForm(existing));
  const [resumeFile, setResumeFile] = useState(null);
  const [resumePreviewUrl, setResumePreviewUrl] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [splitMode, setSplitMode] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ── Reset ALL form state whenever the modal opens or switches candidate ────
  useEffect(() => {
    if (!isOpen) return;
    const candidate = editingId ? candidates.find((c) => (c._id || c.id) === editingId) : null;
    setForm(freshForm(candidate));
    setResumeFile(null);
    setResumePreviewUrl(null);
    setIsParsing(false);
    setParseError(null);
    setSplitMode(false);
    setShowConfirm(false);
    setErrors({});
    setIsDragging(false);
    // Reset the file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [isOpen, editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const normalizeSkillFocus = (draft) => {
    const skills = Array.isArray(draft.skills) ? draft.skills : [];
    const derivedLocation = draft.location?.trim() || joinLocationParts(draft.city, draft.state, draft.country);
    return {
      ...draft,
      primarySkill: draft.primarySkill?.trim() || skills[0] || '',
      secondarySkill: draft.secondarySkill?.trim() || skills[1] || '',
      designationRole: draft.designationRole?.trim() || draft.currentRole?.trim() || '',
      location: derivedLocation || draft.location || '',
      linkedIn: draft.linkedIn?.trim() || '',
    };
  };

  // ── Resume Upload ──────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx|doc)$/i)) {
      setParseError('Please upload a PDF or Word document.');
      return;
    }

    // Reset everything before parsing the new file
    setForm(freshForm(null));
    setParseError(null);
    setErrors({});
    setResumeFile(file);
    setSplitMode(true);

    // Create preview URL for PDF
    if (file.type === 'application/pdf') {
      // Revoke any previous object URL to avoid memory leaks
      setResumePreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    } else {
      setResumePreviewUrl(null);
    }

    // Parse
    setIsParsing(true);
    try {
      const { parseResume } = await import('../../utils/resumeParser');
      const parsed = await parseResume(file);
      // Replace form entirely with parsed data — no merging with stale state
      setForm({
        ...freshForm(null),
        ...parsed,
        _resumeUploaded: true,
        _resumeFileName: file.name,
      });
    } catch {
      setParseError('Resume parsing failed. Please fill in the fields manually.');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required';
    if (!form.email.trim())     errs.email     = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    if (!form.currentRole.trim()) errs.currentRole = 'Current role is required';
    if (!form.totalExperience)    errs.totalExperience = 'Experience is required';
    if (form.skills.length === 0) errs.skills = 'At least one skill is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmitClick = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setShowConfirm(true);
  };

  const handleConfirmedSubmit = () => {
    const payload = normalizeSkillFocus(form);
    if (editingId) {
      updateCandidate(editingId, payload);
    } else {
      addCandidate(payload);
    }
    onClose();
  };

  // ── Work History helpers ───────────────────────────────────────────────────
  const addWorkEntry = () => set('workHistory', [...form.workHistory, { company: '', role: '', from: '', to: '', description: '' }]);
  const removeWorkEntry = (i) => set('workHistory', form.workHistory.filter((_, idx) => idx !== i));
  const updateWork = (i, field, value) => {
    const updated = [...form.workHistory];
    updated[i] = { ...updated[i], [field]: value };
    set('workHistory', updated);
  };

  const addEduEntry = () => set('education', [...form.education, { degree: '', institution: '', year: '' }]);
  const removeEduEntry = (i) => set('education', form.education.filter((_, idx) => idx !== i));
  const updateEdu = (i, field, value) => {
    const updated = [...form.education];
    updated[i] = { ...updated[i], [field]: value };
    set('education', updated);
  };

  const locationSuggestions = Array.from(new Set([
    ...(Array.isArray(form.locationOptions) ? form.locationOptions : []),
    form.location,
    joinLocationParts(form.city, form.state, form.country),
  ].map((value) => String(value || '').trim()).filter(Boolean)));
  const skillSuggestions = Array.from(new Set([
    ...(Array.isArray(form.skills) ? form.skills : []),
    form.primarySkill,
    form.secondarySkill,
  ].map((value) => String(value || '').trim()).filter(Boolean)));

  const formContent = (
    <div className="space-y-6 p-6">
      {/* Parse status banner */}
      {isParsing && (
        <div className="flex items-center gap-3 px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
          <Loader2 size={16} className="text-cyan-400 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-cyan-300">Parsing resume...</p>
            <p className="text-xs text-cyan-400/70">Resume extraction in progress. Fields will auto-populate shortly.</p>
          </div>
        </div>
      )}
      {parseError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{parseError}</p>
        </div>
      )}
      {form._resumeUploaded && !isParsing && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
          form._resumeExtractionStatus === 'complete'
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <CheckCircle size={16} className={form._resumeExtractionStatus === 'complete' ? 'text-emerald-400 shrink-0 mt-0.5' : 'text-amber-400 shrink-0 mt-0.5'} />
          <div className="space-y-1">
            <p className={`text-sm font-medium ${form._resumeExtractionStatus === 'complete' ? 'text-emerald-300' : 'text-amber-300'}`}>
              Resume parsed: {form._resumeFileName}
            </p>
            <p className={`text-xs ${form._resumeExtractionStatus === 'complete' ? 'text-emerald-400/70' : 'text-amber-400/70'}`}>
              {form._resumeExtractionStatus === 'complete'
                ? 'Fields auto-populated. Please review and correct any errors.'
                : 'Extraction completed with warnings. Please review carefully before saving.'}
            </p>
            {Array.isArray(form._resumeWarnings) && form._resumeWarnings.length > 0 && (
              <ul className="text-xs space-y-1 mt-2" style={{ color: 'var(--text-faint)' }}>
                {form._resumeWarnings.slice(0, 3).map((warning) => (
                  <li key={warning} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Personal Details */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider pb-2 border-b w-full" style={{ color: 'var(--text-faint)', borderColor: 'var(--border-subtle)' }}>Personal Details</legend>
        <div className="grid grid-cols-2 gap-4">
          <Input label="First Name" required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} error={errors.firstName} placeholder="Jane" />
          <Input label="Last Name"  required value={form.lastName}  onChange={(e) => set('lastName', e.target.value)}  error={errors.lastName}  placeholder="Smith" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} placeholder="jane@email.com" />
          <Input label="Phone / Contact Number" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+1-555-0000" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Location"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="San Francisco, CA"
            list="candidate-location-suggestions"
          />
          <Select label="Notice Period" value={form.noticePeriod} onChange={(e) => set('noticePeriod', e.target.value)}>
            {['Immediate', '2 weeks', '1 month', '3 months'].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        <datalist id="candidate-location-suggestions">
          {locationSuggestions.map((location) => <option key={location} value={location} />)}
        </datalist>
        <div className="grid grid-cols-3 gap-4">
          <Input label="City" value={form.city || ''} onChange={(e) => set('city', e.target.value)} placeholder="Dallas" />
          <Input label="State" value={form.state || ''} onChange={(e) => set('state', e.target.value)} placeholder="Texas" />
          <Input label="Country" value={form.country || ''} onChange={(e) => set('country', e.target.value)} placeholder="United States" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Source" value={form.source || ''} onChange={(e) => set('source', e.target.value)}>
            <option value="">—</option>
            {['Resume', 'LinkedIn', 'Contact', 'June Meetup'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select label="Candidate Spoken To" value={form.candidateSpokenTo || ''} onChange={(e) => set('candidateSpokenTo', e.target.value)}>
            <option value="">—</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </Select>
        </div>
        {form.linkedIn !== undefined && (
          <Input label="LinkedIn Profile URL" type="url" value={form.linkedIn} onChange={(e) => set('linkedIn', e.target.value)} placeholder="https://linkedin.com/in/..." />
        )}
      </fieldset>

      {/* Professional Details */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider pb-2 border-b w-full" style={{ color: 'var(--text-faint)', borderColor: 'var(--border-subtle)' }}>Professional Details</legend>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Current Role / Designation" required value={form.currentRole} onChange={(e) => set('currentRole', e.target.value)} error={errors.currentRole} placeholder="Senior Engineer" />
          <Input label="Current Company / Employer" value={form.currentCompany} onChange={(e) => set('currentCompany', e.target.value)} placeholder="Acme Corp" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Primary Skill"
            value={form.primarySkill || ''}
            onChange={(e) => set('primarySkill', e.target.value)}
            placeholder="React"
            hint="Suggested from the parsed skill list."
            list="candidate-skill-suggestions"
          />
          <Input
            label="Secondary Skill"
            value={form.secondarySkill || ''}
            onChange={(e) => set('secondarySkill', e.target.value)}
            placeholder="TypeScript"
            hint="Suggested from the parsed skill list."
            list="candidate-skill-suggestions"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Exp in Yrs" type="number" min="0" max="50" value={form.expInYrs || ''} onChange={(e) => set('expInYrs', e.target.value)} placeholder="5" />
          <Input label="Exp in Months" type="number" min="0" max="11" value={form.expInMonths || ''} onChange={(e) => set('expInMonths', e.target.value)} placeholder="6" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Total Experience (years)" required type="number" min="0" max="50" value={form.totalExperience} onChange={(e) => set('totalExperience', Number(e.target.value))} error={errors.totalExperience} placeholder="5" />
          <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {['Active', 'Interviewing', 'Placed', 'Inactive', 'Rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </fieldset>

      {/* Skills */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider pb-2 border-b w-full" style={{ color: 'var(--text-faint)', borderColor: 'var(--border-subtle)' }}>Skills</legend>
        <SkillInput skills={form.skills} onChange={(skills) => set('skills', skills)} />
        {errors.skills && <p className="text-xs text-red-400">{errors.skills}</p>}
        <datalist id="candidate-skill-suggestions">
          {skillSuggestions.map((skill) => <option key={skill} value={skill} />)}
        </datalist>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider pb-2 border-b w-full" style={{ color: 'var(--text-faint)', borderColor: 'var(--border-subtle)' }}>Talent Sheet Fields</legend>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Preferred Work Location" value={form.preferredWorkLocation || ''} onChange={(e) => set('preferredWorkLocation', e.target.value)} placeholder="Remote / Hybrid / Dallas" />
          <Input label="Seniority Level" value={form.seniorityLevel || ''} onChange={(e) => set('seniorityLevel', e.target.value)} placeholder="Senior" />
          <Input label="Open To Work" value={form.openToWork || ''} onChange={(e) => set('openToWork', e.target.value)} placeholder="Open to Work" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Select label="AI Experience" value={form.aiExperience || ''} onChange={(e) => set('aiExperience', e.target.value)}>
            <option value="">—</option>
            {['Yes', 'No', 'NA'].map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
          <Input label="IT Capability" value={form.itCapability || ''} onChange={(e) => set('itCapability', e.target.value)} placeholder="Project and Portfolio Management" />
          <Select label="IT / Non-IT" value={form.itNonIT || ''} onChange={(e) => set('itNonIT', e.target.value)}>
            <option value="">—</option>
            {['IT', 'Non-IT'].map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Community" value={form.community || ''} onChange={(e) => set('community', e.target.value)} placeholder="Digital Engineering Network" />
          <Input label="Vendor Name" value={form.vendorName || ''} onChange={(e) => set('vendorName', e.target.value)} placeholder="Revature" />
          <Input label="Referred By" value={form.referredBy || ''} onChange={(e) => set('referredBy', e.target.value)} placeholder="Referral name" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Expected Salary" value={form.expectedSalary || ''} onChange={(e) => set('expectedSalary', e.target.value)} placeholder="$120k" />
          <Input label="Discussion Stage" value={form.discussionStage || ''} onChange={(e) => set('discussionStage', e.target.value)} placeholder="Initial screen" />
          <Input label="SP Reference" value={form.spReference || ''} onChange={(e) => set('spReference', e.target.value)} placeholder="Reference" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Selected" value={form.selected || ''} onChange={(e) => set('selected', e.target.value)}>
            <option value="">—</option>
            <option value="Selected">Selected</option>
            <option value="Not Selected">Not Selected</option>
          </Select>
          <Input label="Work Authorization" value={form.workAuthorization || ''} onChange={(e) => set('workAuthorization', e.target.value)} placeholder="US Citizen, H1B, GC Holder..." />
        </div>
        <Textarea label="Certifications" value={form.certifications || ''} onChange={(e) => set('certifications', e.target.value)} rows={2} placeholder="AWS, CKA, PMP..." />
        <Textarea label="Other Technical Skills" value={form.otherTechnicalSkills || ''} onChange={(e) => set('otherTechnicalSkills', e.target.value)} rows={2} placeholder="SQL; Kafka; Figma..." />
        <Textarea label="Domain Experience" value={form.domainExperience || ''} onChange={(e) => set('domainExperience', e.target.value)} rows={2} placeholder="Banking, Healthcare, ERP..." />
        <Textarea label="Comments" value={form.comments || ''} onChange={(e) => set('comments', e.target.value)} rows={2} placeholder="Workbook comments or notes from screening." />
      </fieldset>

      {/* Work History */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider pb-2 border-b w-full flex items-center justify-between" style={{ color: 'var(--text-faint)', borderColor: 'var(--border-subtle)' }}>
          Work History
          <button type="button" onClick={addWorkEntry} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-xs font-medium normal-case tracking-normal">
            <Plus size={12} /> Add Entry
          </button>
        </legend>
        {form.workHistory.map((job, i) => (
          <div key={i} className="rounded-lg p-4 border space-y-3" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>Position {i + 1}</span>
              {form.workHistory.length > 1 && (
                <button type="button" onClick={() => removeWorkEntry(i)} className="hover:text-red-400 transition-colors" style={{ color: 'var(--text-ghost)' }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Company" value={job.company} onChange={(e) => updateWork(i, 'company', e.target.value)} />
              <Input placeholder="Role / Title" value={job.role} onChange={(e) => updateWork(i, 'role', e.target.value)} />
              <Input placeholder="From (e.g. 2020)" value={job.from} onChange={(e) => updateWork(i, 'from', e.target.value)} />
              <Input placeholder="To (e.g. Present)" value={job.to} onChange={(e) => updateWork(i, 'to', e.target.value)} />
            </div>
            <Textarea placeholder="Brief description of responsibilities..." rows={2} value={job.description} onChange={(e) => updateWork(i, 'description', e.target.value)} />
          </div>
        ))}
      </fieldset>

      {/* Education */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider pb-2 border-b w-full flex items-center justify-between" style={{ color: 'var(--text-faint)', borderColor: 'var(--border-subtle)' }}>
          Education
          <button type="button" onClick={addEduEntry} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-xs font-medium normal-case tracking-normal">
            <Plus size={12} /> Add Entry
          </button>
        </legend>
        {form.education.map((edu, i) => (
          <div key={i} className="rounded-lg p-4 border space-y-3" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>Degree {i + 1}</span>
              {form.education.length > 1 && (
                <button type="button" onClick={() => removeEduEntry(i)} className="hover:text-red-400 transition-colors" style={{ color: 'var(--text-ghost)' }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input className="col-span-2" placeholder="Degree / Qualification" value={edu.degree} onChange={(e) => updateEdu(i, 'degree', e.target.value)} />
              <Input placeholder="Year" type="number" value={edu.year} onChange={(e) => updateEdu(i, 'year', e.target.value)} />
            </div>
            <Input placeholder="Institution" value={edu.institution} onChange={(e) => updateEdu(i, 'institution', e.target.value)} />
          </div>
        ))}
      </fieldset>

      {/* Notes */}
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider pb-2 border-b w-full" style={{ color: 'var(--text-faint)', borderColor: 'var(--border-subtle)' }}>Resume Profile Visual Fields</legend>
        <Input label="Headline Quote" value={form.headline || ''} onChange={(e) => set('headline', e.target.value)} placeholder="e.g. I don't run HR. I build organisations that perform." />
        <div className="grid grid-cols-3 gap-4">
          <Input label="Culture Dimension" value={form.culture || ''} onChange={(e) => set('culture', e.target.value)} placeholder="Culture details..." />
          <Input label="Performance Dimension" value={form.performance || ''} onChange={(e) => set('performance', e.target.value)} placeholder="Performance details..." />
          <Input label="Capability Dimension" value={form.capability || ''} onChange={(e) => set('capability', e.target.value)} placeholder="Capability details..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Metric 1 Value" value={form.metric1Num || ''} onChange={(e) => set('metric1Num', e.target.value)} placeholder="e.g. 40%" />
          <Input label="Metric 1 Description" value={form.metric1Desc || ''} onChange={(e) => set('metric1Desc', e.target.value)} placeholder="e.g. attrition reduction" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Metric 2 Value" value={form.metric2Num || ''} onChange={(e) => set('metric2Num', e.target.value)} placeholder="e.g. 6,000+" />
          <Input label="Metric 2 Description" value={form.metric2Desc || ''} onChange={(e) => set('metric2Desc', e.target.value)} placeholder="e.g. employees impacted" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Metric 3 Value" value={form.metric3Num || ''} onChange={(e) => set('metric3Num', e.target.value)} placeholder="e.g. 3" />
          <Input label="Metric 3 Description" value={form.metric3Desc || ''} onChange={(e) => set('metric3Desc', e.target.value)} placeholder="e.g. CXO successors built" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Available For" value={form.availableFor || ''} onChange={(e) => set('availableFor', e.target.value)} placeholder="e.g. GCC · Series B+ · PE Portfolio" />
          <Input label="Industries" value={form.industries || ''} onChange={(e) => set('industries', e.target.value)} placeholder="e.g. Tech · Fintech · SaaS" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Accent Color</label>
          <Select value={form.accentColor || '#B5651D'} onChange={(e) => set('accentColor', e.target.value)}>
            <option value="#B5651D">Copper (#B5651D)</option>
            <option value="#C9A84C">Gold (#C9A84C)</option>
            <option value="#4A7C59">Sage (#4A7C59)</option>
            <option value="#2B3A4A">Slate (#2B3A4A)</option>
            <option value="#5E35B1">Violet (#5E35B1)</option>
          </Select>
        </div>
      </fieldset>

      <Textarea label="Internal Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Internal notes about this candidate..." rows={3} />

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
        <Button type="submit" variant="primary" className="flex-1">
          {editingId ? 'Save Changes' : 'Review & Submit'}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editingId ? 'Edit Candidate' : 'Add New Candidate'}
        size={splitMode ? 'full' : 'lg'}
      >
        <form onSubmit={handleSubmitClick} noValidate>
          {splitMode ? (
            <div className="flex h-[80vh]">
              {/* Left: Resume Preview */}
              <div className="w-1/2 border-r flex flex-col" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-2">
                    <FileText size={14} style={{ color: 'var(--text-faint)' }} />
                    <span className="text-sm font-medium truncate max-w-xs" style={{ color: 'var(--text-secondary)' }}>{resumeFile?.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSplitMode(false); setResumeFile(null); setResumePreviewUrl(null); setForm(freshForm(null)); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="p-1 rounded transition-colors"
                    style={{ color: 'var(--text-faint)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
                    aria-label="Close preview"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
                  {resumePreviewUrl ? (
                    <iframe
                      src={resumePreviewUrl}
                      title="Resume preview"
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <FileText size={40} className="mb-3" style={{ color: 'var(--text-ghost)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Preview not available for .docx files.</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>Fields have been auto-populated from the document.</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Right: Form */}
              <div className="w-1/2 overflow-y-auto">
                {formContent}
              </div>
            </div>
          ) : (
            <>
              {/* Upload zone */}
              {!editingId && (
                <div className="px-6 pt-6">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className="border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer"
                    style={{
                      borderColor: isDragging ? 'var(--accent)' : 'var(--border-default)',
                      backgroundColor: isDragging ? 'var(--accent-dim)' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; }}
                    onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                    aria-label="Upload resume"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files[0])}
                    />
                    <Upload size={24} className="mx-auto mb-2" style={{ color: isDragging ? 'var(--accent)' : 'var(--text-faint)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {isDragging ? 'Drop to upload' : 'Upload Resume (Optional)'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>PDF or Word · Drag & drop or click · Auto-fills form fields</p>
                  </div>
                </div>
              )}
              {formContent}
            </>
          )}
        </form>
      </Modal>

      {/* Two-step confirmation */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmedSubmit}
        title="Confirm Candidate Data"
        variant="primary"
        confirmLabel={editingId ? 'Save Changes' : 'Confirm & Save'}
        message={
          form._resumeUploaded
            ? `Please review the extracted data carefully. Confirm that all skills (${form.skills.slice(0, 5).join(', ')}${form.skills.length > 5 ? '...' : ''}) and contact details are accurate before final storage.`
            : `You are about to ${editingId ? 'update' : 'add'} ${form.firstName} ${form.lastName}'s profile. Please confirm all details are correct.`
        }
      />
    </>
  );
}

