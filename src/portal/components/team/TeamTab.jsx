/**
 * TeamTab.jsx — Admin-only team management panel
 * Features: invite clients (temp pw + expiry), add staff, extend/deactivate/delete users
 */
import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Mail, Trash2, ShieldCheck, Clock, RefreshCw,
  Copy, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle,
  Users, UserCog, Loader2, X,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Modal, ConfirmModal } from '../ui/Modal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function getAuthHeader() {
  const token = sessionStorage.getItem('cp_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ROLE_LABELS = { 't-1': 'Admin', 't-2': 'Recruiter', 't-3': 'Client' };
const ROLE_COLORS = {
  't-1': { bg: 'rgba(239,68,68,0.12)',  color: '#f87171',  border: 'rgba(239,68,68,0.25)' },
  't-2': { bg: 'rgba(6,182,212,0.12)',  color: '#22d3ee',  border: 'rgba(6,182,212,0.25)' },
  't-3': { bg: 'rgba(168,85,247,0.12)', color: '#c084fc',  border: 'rgba(168,85,247,0.25)' },
};

function RolePill({ role }) {
  const s = ROLE_COLORS[role] || ROLE_COLORS['t-3'];
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded border"
      style={{ backgroundColor: s.bg, color: s.color, borderColor: s.border }}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function SessionTimer({ expiresAt }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const expired = new Date(expiresAt) <= Date.now();
  return (
    <span className="flex items-center gap-1 text-xs"
      style={{ color: expired ? '#f87171' : '#22d3ee' }}>
      <Clock size={10} /> {remaining}
    </span>
  );
}

function TempPasswordBanner({ name, email, password, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: 'rgba(6,182,212,0.06)', borderColor: 'rgba(6,182,212,0.3)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-400 shrink-0" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Invite created for {name}
          </p>
        </div>
        <button onClick={onDismiss} className="p-1 rounded" style={{ color: 'var(--text-faint)' }}>
          <X size={14} />
        </button>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Share these credentials securely. The password will not be shown again.
      </p>
      <div className="rounded-lg p-3 font-mono text-sm space-y-1"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Email: <span style={{ color: 'var(--accent-light)' }}>{email}</span></p>
        <p style={{ color: 'var(--text-secondary)' }}>
          Password:{' '}
          <span style={{ color: '#f0abfc' }}>{show ? password : '••••••••••'}</span>
          <button onClick={() => setShow(s => !s)} className="ml-2 inline-flex" style={{ color: 'var(--text-faint)' }}>
            {show ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </p>
      </div>
      <Button variant="secondary" size="sm" icon={copied ? CheckCircle : Copy} onClick={copy}>
        {copied ? 'Copied!' : 'Copy Credentials'}
      </Button>
    </div>
  );
}

// ── Invite Client Modal ───────────────────────────────────────────────────────
function InviteClientModal({ isOpen, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', expiryHours: 24 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/team/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), expiryHours: Number(form.expiryHours) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send invite.'); return; }
      onSuccess(data);
      onClose();
      setForm({ name: '', email: '', expiryHours: 24 });
    } catch { setError('Cannot reach server.'); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Client" size="sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
        <Input label="Client Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Acme Corp — Jane Smith" />
        <Input label="Email Address" type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@acmecorp.com" />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Access Window
          </label>
          <Select value={form.expiryHours} onChange={e => set('expiryHours', Number(e.target.value))}>
            <option value={6}>6 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
          </Select>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            Client can log in and view shared profiles for this duration.
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
            {loading ? <><Loader2 size={13} className="animate-spin" /> Sending…</> : 'Send Invite'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Add Staff Modal ───────────────────────────────────────────────────────────
function AddStaffModal({ isOpen, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', role: 't-2', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.password) { setError('All fields are required.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/team/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), role: form.role, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add staff.'); return; }
      onSuccess(data);
      onClose();
      setForm({ name: '', email: '', role: 't-2', password: '' });
    } catch { setError('Cannot reach server.'); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Staff Member" size="sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
        <Input label="Full Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Alex Johnson" />
        <Input label="Email Address" type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="alex@sewingcircle.io" />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Role</label>
          <Select value={form.role} onChange={e => set('role', e.target.value)}>
            <option value="t-2">Recruiter (t-2)</option>
            <option value="t-1">Admin (t-1)</option>
          </Select>
        </div>
        <div className="space-y-1.5 relative">
          <Input label="Password" type={showPw ? 'text' : 'password'} required
            value={form.password} onChange={e => set('password', e.target.value)}
            placeholder="Min 8 characters" />
          <button type="button" onClick={() => setShowPw(s => !s)}
            className="absolute right-3 top-8 p-1" style={{ color: 'var(--text-faint)' }}>
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
            {loading ? <><Loader2 size={13} className="animate-spin" /> Adding…</> : 'Add Staff'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Extend Session Modal ─────────────────────────────────────────────────────
function ExtendModal({ user, isOpen, onClose, onSuccess }) {
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/team/${user._id || user.id}/extend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ expiryHours: Number(hours) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed.'); return; }
      onSuccess(user._id || user.id, data.sessionExpiresAt);
      onClose();
    } catch { setError('Cannot reach server.'); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Extend Session — ${user?.name}`} size="sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>New Access Window</label>
          <Select value={hours} onChange={e => setHours(e.target.value)}>
            <option value={6}>6 hours from now</option>
            <option value={12}>12 hours from now</option>
            <option value={24}>24 hours from now</option>
            <option value={48}>48 hours from now</option>
          </Select>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Extend'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main TeamTab ─────────────────────────────────────────────────────────────
export function TeamTab() {
  const { currentUser } = useStore();
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [inviteOpen, setInviteOpen]     = useState(false);
  const [staffOpen, setStaffOpen]       = useState(false);
  const [extendTarget, setExtendTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [banner, setBanner]             = useState(null); // { name, email, password }
  const [tab, setTab]                   = useState('clients'); // 'clients' | 'staff'

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/team`, { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setUsers(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const clients = users.filter(u => u.role === 't-3');
  const staff   = users.filter(u => u.role !== 't-3');

  const handleInviteSuccess = (data) => {
    setBanner({ name: data.user.name, email: data.user.email, password: data.tempPassword });
    fetchUsers();
  };

  const handleStaffSuccess = () => { fetchUsers(); };

  const handleExtendSuccess = (userId, newExpiry) => {
    setUsers(prev => prev.map(u => (u._id === userId || u.id === userId)
      ? { ...u, sessionExpiresAt: newExpiry, active: true } : u));
  };

  const handleToggleActive = async (user) => {
    try {
      const res = await fetch(`${API_BASE}/api/team/${user._id || user.id}/deactivate`, {
        method: 'PATCH', headers: getAuthHeader(),
      });
      const data = await res.json();
      if (!res.ok) return;
      setUsers(prev => prev.map(u =>
        (u._id === (user._id || user.id) || u.id === (user._id || user.id))
          ? { ...u, active: data.active } : u));
    } catch { /* silent */ }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${API_BASE}/api/team/${deleteTarget._id || deleteTarget.id}`, {
        method: 'DELETE', headers: getAuthHeader(),
      });
      setUsers(prev => prev.filter(u => u._id !== (deleteTarget._id || deleteTarget.id) && u.id !== deleteTarget.id));
    } catch { /* silent */ }
    finally { setDeleteTarget(null); }
  };

  const isSelf = (u) => (u._id || u.id) === currentUser?.id;

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Team Management</h2>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {staff.length} staff · {clients.length} clients
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={UserCog} onClick={() => setStaffOpen(true)}>
            Add Staff
          </Button>
          <Button variant="primary" size="sm" icon={Mail} onClick={() => setInviteOpen(true)}>
            Invite Client
          </Button>
        </div>
      </div>

      {/* Temp password banner */}
      {banner && (
        <TempPasswordBanner
          name={banner.name} email={banner.email} password={banner.password}
          onDismiss={() => setBanner(null)}
        />
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1.5">
        {[
          { id: 'clients', label: `Clients (${clients.length})`, icon: Users },
          { id: 'staff',   label: `Staff (${staff.length})`,     icon: ShieldCheck },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={tab === id ? {
              backgroundColor: 'var(--accent-dim)', color: 'var(--accent-light)', borderColor: 'var(--accent-border)',
            } : {
              backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', borderColor: 'var(--border-default)',
            }}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : (
        <div className="space-y-2">
          {(tab === 'clients' ? clients : staff).map(user => {
            const expired = user.isTemporary && user.sessionExpiresAt && new Date(user.sessionExpiresAt) <= Date.now();
            return (
              <div key={user._id || user.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: expired ? 'rgba(239,68,68,0.25)' : 'var(--border-subtle)',
                }}>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))' }}>
                  {user.avatar || user.name?.slice(0,2).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                    <RolePill role={user.role} />
                    {isSelf(user) && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-faint)' }}>you</span>
                    )}
                    {!user.active && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}>inactive</span>
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{user.email}</p>
                  {user.isTemporary && <SessionTimer expiresAt={user.sessionExpiresAt} />}
                </div>
                {/* Actions */}
                {!isSelf(user) && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {user.isTemporary && (
                      <button onClick={() => setExtendTarget(user)} title="Extend session"
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text-faint)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-light)'; e.currentTarget.style.backgroundColor = 'var(--accent-dim)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.backgroundColor = ''; }}>
                        <RefreshCw size={13} />
                      </button>
                    )}
                    <button onClick={() => handleToggleActive(user)}
                      title={user.active ? 'Deactivate' : 'Activate'}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text-faint)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = user.active ? '#fb923c' : '#4ade80'; e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.backgroundColor = ''; }}>
                      {user.active ? <XCircle size={13} /> : <CheckCircle size={13} />}
                    </button>
                    <button onClick={() => setDeleteTarget(user)} title="Delete user"
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text-faint)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.backgroundColor = ''; }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {(tab === 'clients' ? clients : staff).length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <UserPlus size={32} className="mb-3" style={{ color: 'var(--text-ghost)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {tab === 'clients' ? 'No clients invited yet' : 'No staff members yet'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>
                {tab === 'clients' ? 'Use "Invite Client" to grant temporary access.' : 'Use "Add Staff" to create recruiter accounts.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <InviteClientModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} onSuccess={handleInviteSuccess} />
      <AddStaffModal isOpen={staffOpen} onClose={() => setStaffOpen(false)} onSuccess={handleStaffSuccess} />
      {extendTarget && (
        <ExtendModal user={extendTarget} isOpen={!!extendTarget}
          onClose={() => setExtendTarget(null)} onSuccess={handleExtendSuccess} />
      )}
      <ConfirmModal
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} title="Delete User?" variant="danger" confirmLabel="Delete"
        message={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
      />
    </div>
  );
}
