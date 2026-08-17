import { useState, useMemo } from 'react';
import { ShieldCheck, Clock, CheckCircle, XCircle, History, ChevronDown, ChevronUp, User, Calendar } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import useStore from '../../store/useStore';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

function StatusBadgeReq({ status }) {
  const map = {
    pending:  { variant: 'warning', label: 'Pending' },
    approved: { variant: 'success', label: 'Approved' },
    denied:   { variant: 'danger',  label: 'Denied' },
  };
  const { variant, label } = map[status] || { variant: 'default', label: status };
  return <Badge variant={variant} size="sm">{label}</Badge>;
}

function RequestCard({ request, onApprove, onDeny }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = request.status === 'pending';
  const ts = request.createdAt ? new Date(request.createdAt) : null;

  return (
    <div
      className="rounded-xl border transition-colors"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: isPending ? 'rgba(245,158,11,0.3)' : 'var(--border-subtle)',
      }}
    >
      {/* Summary row */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)' }}
        >
          {request.requestedByName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {request.requestedByName}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {request.requestedByEmail}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Requested contact details for{' '}
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {request.candidateName}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusBadgeReq status={request.status} />
          {ts && (
            <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-ghost)' }}>
              {formatDistanceToNow(ts, { addSuffix: true })}
            </span>
          )}
          {request.note && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1 rounded"
              style={{ color: 'var(--text-faint)' }}
              title={expanded ? 'Hide note' : 'Show note'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="success" size="xs" icon={CheckCircle} onClick={() => onApprove(request._id || request.id)}>
              Approve
            </Button>
            <Button variant="danger" size="xs" icon={XCircle} onClick={() => onDeny(request._id || request.id)}>
              Deny
            </Button>
          </div>
        )}
      </div>

      {/* Expanded note */}
      {expanded && request.note && (
        <div
          className="px-4 pb-3 border-t text-xs"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        >
          <p className="mt-2 italic">"{request.note}"</p>
        </div>
      )}

      {/* Review info for resolved requests */}
      {!isPending && request.reviewedByName && (
        <div
          className="px-4 pb-3 text-xs flex items-center gap-1.5"
          style={{ color: 'var(--text-ghost)' }}
        >
          <User size={10} />
          Reviewed by {request.reviewedByName}
          {request.reviewedAt && (
            <span> · {format(new Date(request.reviewedAt), 'MMM d, yyyy HH:mm')}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function PermissionsTab() {
  const { contactAccessRequests, reviewContactRequest } = useStore();
  const [showPast, setShowPast] = useState(false);

  const pending  = useMemo(() => contactAccessRequests.filter((r) => r.status === 'pending'),  [contactAccessRequests]);
  const resolved = useMemo(() => contactAccessRequests.filter((r) => r.status !== 'pending').sort(
    (a, b) => new Date(b.reviewedAt || b.createdAt) - new Date(a.reviewedAt || a.createdAt)
  ), [contactAccessRequests]);

  const handleApprove = (id) => reviewContactRequest(id, 'approved');
  const handleDeny    = (id) => reviewContactRequest(id, 'denied');

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
          Contact Access Permissions
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
          Manage client requests to view candidate contact details.
        </p>
      </div>

      {/* ── Pending requests ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock size={15} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Pending Requests
          </h3>
          {pending.length > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div
            className="rounded-xl flex flex-col items-center justify-center py-10 text-center"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <CheckCircle size={24} className="mb-2" style={{ color: 'var(--text-ghost)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No pending requests</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>
              Contact access requests from clients will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <RequestCard key={r._id || r.id} request={r} onApprove={handleApprove} onDeny={handleDeny} />
            ))}
          </div>
        )}
      </section>

      {/* ── Past requests ── */}
      <section className="space-y-3">
        <button
          onClick={() => setShowPast((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <History size={15} style={{ color: 'var(--text-faint)' }} />
          Past Requests
          {resolved.length > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-faint)', border: '1px solid var(--border-default)' }}
            >
              {resolved.length}
            </span>
          )}
          {showPast ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showPast && (
          <>
            {resolved.length === 0 ? (
              <div
                className="rounded-xl flex flex-col items-center justify-center py-8 text-center"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                <History size={20} className="mb-2" style={{ color: 'var(--text-ghost)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No past requests</p>
              </div>
            ) : (
              <div className="space-y-2">
                {resolved.map((r) => (
                  <RequestCard key={r._id || r.id} request={r} onApprove={handleApprove} onDeny={handleDeny} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
