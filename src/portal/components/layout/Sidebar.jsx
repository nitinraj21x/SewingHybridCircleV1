import { LayoutDashboard, Users, ClipboardList, Briefcase, Target, ChevronRight, CalendarDays, LogOut, UserCog, ShieldCheck } from 'lucide-react';
import useStore, { PERMISSIONS } from '../../store/useStore';
import { RoleBadge } from '../ui/Badge';

const ALL_NAV_ITEMS = [
  { id: 'overview',     label: 'Overview',     icon: LayoutDashboard },
  { id: 'candidates',   label: 'Candidates',   icon: Users },
  { id: 'jobs',         label: 'Jobs',         icon: Briefcase },
  { id: 'scoring',      label: 'Scoring',      icon: Target },
  { id: 'events',       label: 'Events',       icon: CalendarDays },
  { id: 'team',         label: 'Team',         icon: UserCog },
  { id: 'permissions',  label: 'Permissions',  icon: ShieldCheck },
  { id: 'audit',        label: 'Audit Logs',   icon: ClipboardList },
];

export function Sidebar({ onLogout }) {
  const { activeTab, setActiveTab, currentUser, contactAccessRequests, getPendingEventReviewCount } = useStore();

  const navItems = ALL_NAV_ITEMS.filter(({ id }) =>
    PERMISSIONS.canViewTab(currentUser.role, id)
  );

  const pendingCount = currentUser?.role === 't-1'
    ? (contactAccessRequests || []).filter((r) => r.status === 'pending').length
    : 0;
  const pendingEventReviews = currentUser?.role === 't-1'
    ? getPendingEventReviewCount()
    : 0;

  return (
    <aside
      className="w-56 shrink-0 flex flex-col h-screen sticky top-0 border-r"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
        backgroundImage: 'linear-gradient(180deg, var(--bg-surface) 0%, color-mix(in srgb, var(--bg-surface) 95%, var(--bg-base)) 100%)',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)', boxShadow: '0 2px 10px rgba(6,182,212,0.3)' }}
          >
            <Users size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>CandidatePortal</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)', letterSpacing: '0.03em' }}>IT Recruitment</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Main navigation">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative"
              style={isActive ? {
                backgroundColor: 'var(--accent-dim)',
                color: 'var(--accent-light)',
                border: '1px solid var(--accent-border)',
              } : {
                color: 'var(--text-faint)',
                border: '1px solid transparent',
              }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--text-faint)'; } }}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r" style={{ backgroundColor: 'var(--accent)' }} />
              )}
              <Icon size={15} style={{ color: isActive ? 'var(--accent)' : 'var(--text-faint)' }} />
              <span className="flex-1 text-left">{label}</span>
              {id === 'permissions' && pendingCount > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: 'rgba(245,158,11,0.25)', color: '#fbbf24', minWidth: '18px', textAlign: 'center' }}
                >
                  {pendingCount}
                </span>
              )}
              {id === 'events' && pendingEventReviews > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: 'rgba(239,68,68,0.18)', color: '#fca5a5', minWidth: '18px', textAlign: 'center' }}
                >
                  {pendingEventReviews}
                </span>
              )}
              {isActive && <ChevronRight size={13} style={{ color: 'var(--accent)' }} />}
            </button>
          );
        })}
      </nav>

      {/* Current user + logout */}
      <div className="px-3 py-4 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
        {/* User info */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)', boxShadow: '0 1px 6px rgba(6,182,212,0.3)' }}
          >
            {currentUser.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{currentUser.name}</p>
            <RoleBadge role={currentUser.role} />
          </div>
        </div>

        {/* Sign out button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all"
            style={{ backgroundColor: 'transparent', borderColor: 'var(--border-default)', color: 'var(--text-faint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-faint)'; }}
          >
            <LogOut size={13} /> Sign out
          </button>
        )}
      </div>
    </aside>
  );
}
