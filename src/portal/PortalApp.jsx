/**
 * PortalApp.jsx — Portal entry point at /portal/*
 *
 * Auth flow:
 *   1. User visits /portal → LoginPage shown
 *   2. LoginPage POSTs to /api/auth/login → receives { token, user }
 *   3. token stored in sessionStorage('cp_token'), user in sessionStorage('cp_user')
 *   4. onLogin(user) called → PortalApp hydrates store + shows dashboard
 *   5. Page refresh → session restored from sessionStorage
 *   6. Logout → clears sessionStorage + back to LoginPage
 */
import { useState, useEffect } from 'react';
import { Sidebar }       from './components/layout/Sidebar';
import { Header }        from './components/layout/Header';
import { LoginPage }     from './components/auth/LoginPage';
import { OverviewTab }   from './components/overview/OverviewTab';
import { CandidatesTab } from './components/candidates/CandidatesTab';
import { JobsTab }       from './components/jobs/JobsTab';
import { ScoringTab }    from './components/scoring/ScoringTab';
import { EventsTab }     from './components/events/EventsTab';
import { AuditTab }      from './components/audit/AuditTab';
import { TeamTab }       from './components/team/TeamTab';
import { PermissionsTab } from './components/permissions/PermissionsTab';
import useStore, { PERMISSIONS } from './store/useStore';

/**
 * Maps the backend user object shape → the portal store's user shape.
 * Backend returns: { _id, name, email, role, avatar }
 * Store expects:   { id, name, email, role, avatar }
 */
function normalizeUser(apiUser) {
  return {
    id:     apiUser._id  || apiUser.id,
    name:   apiUser.name,
    email:  apiUser.email,
    role:   apiUser.role,
    avatar: apiUser.avatar || apiUser.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
  };
}

function restoreSession() {
  try {
    const raw = sessionStorage.getItem('cp_user');
    if (!raw) return null;
    return normalizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

export default function PortalApp() {
  const { activeTab, currentUser, setCurrentUser } = useStore();

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const user = restoreSession();
    if (user) {
      // Hydrate store immediately during init
      useStore.getState().setCurrentUser(user);
      return true;
    }
    return false;
  });

  // On mount, make sure store is synced if session exists (handles hot reload)
  useEffect(() => {
    if (isAuthenticated && !currentUser) {
      const user = restoreSession();
      if (user) setCurrentUser(user);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = (apiUser) => {
    const user = normalizeUser(apiUser);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('cp_token');
    sessionStorage.removeItem('cp_user');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const safeTab = currentUser && PERMISSIONS.canViewTab(currentUser.role, activeTab)
    ? activeTab
    : 'overview';

  return (
    <div
      className="flex min-h-screen transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg-base)', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <Sidebar onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto" role="main">
          {safeTab === 'overview'     && <OverviewTab />}
          {safeTab === 'candidates'   && <CandidatesTab />}
          {safeTab === 'jobs'         && currentUser && PERMISSIONS.canViewJobs(currentUser.role)        && <JobsTab />}
          {safeTab === 'scoring'      && currentUser && PERMISSIONS.canViewScoring(currentUser.role)     && <ScoringTab />}
          {safeTab === 'events'       && currentUser && PERMISSIONS.canViewEvents(currentUser.role)      && <EventsTab />}
          {safeTab === 'team'         && currentUser && PERMISSIONS.canManageTeam(currentUser.role)      && <TeamTab />}
          {safeTab === 'permissions'  && currentUser && PERMISSIONS.canViewPermissions(currentUser.role) && <PermissionsTab />}
          {safeTab === 'audit'        && currentUser && PERMISSIONS.canViewAudit(currentUser.role)       && <AuditTab />}
        </main>
      </div>
    </div>
  );
}
