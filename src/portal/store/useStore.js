import { create } from 'zustand';
import { DEFAULT_SCORING_CONFIG } from '../utils/scoring';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
function getAuthHeader() {
  const t = sessionStorage.getItem('cp_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const PERMISSIONS = {
  canViewTab: (role, tab) => {
    if (role === 't-1') return true;
    if (role === 't-2') return ['candidates', 'jobs'].includes(tab);
    if (role === 't-3') return tab === 'candidates';
    return false;
  },
  canAddCandidate:    (role) => role === 't-1' || role === 't-2',
  canEditCandidate:   (role, candidate, userId) => {
    if (role === 't-1') return true;
    if (role === 't-2') return String(candidate.addedBy) === String(userId);
    return false;
  },
  canDeleteCandidate: (role) => role === 't-1',
  canShareCandidate:  (role) => role === 't-1' || role === 't-2',
  canBulkEmail:       (role) => role === 't-1' || role === 't-2',
  canExportCSV:       (role) => role === 't-1' || role === 't-2',
  canBulkImport:      (role) => role === 't-1',
  canAddJob:    (role) => role === 't-1',
  canEditJob:   (role) => role === 't-1',
  canDeleteJob: (role) => role === 't-1',
  canViewJobs:  (role) => role === 't-1' || role === 't-2',
  canViewScoring: (role) => role === 't-1',
  canViewAudit:   (role) => role === 't-1',
  canViewEvents:  (role) => role === 't-1',
  canManageEvents:(role) => role === 't-1',
  canManageTeam:  (role) => role === 't-1',
  canViewPermissions: (role) => role === 't-1',
  canViewContactDetails: (role, candidateId, contactRequests, sharedWith = [], currentUserId) => {
    if (role === 't-1' || role === 't-2') return true;
    if (role === 't-3') {
      // If shared with full access, it is visible!
      const shareEntry = sharedWith.find(s => String(s.userId) === String(currentUserId));
      if (shareEntry && shareEntry.accessType === 'full') {
        return true;
      }
      return (contactRequests || []).some(
        (r) => String(r.candidateId) === String(candidateId) && r.status === 'approved'
      );
    }
    return false;
  },
};

const useStore = create((set, get) => ({
  currentUser: null,
  activeTab: 'overview',
  candidates: [],
  contactAccessRequests: [],
  jobs: [],
  auditLogs: [],
  events: [],

  setCurrentUser: (user) => {
    const { activeTab } = get();
    const canSeeCurrentTab = PERMISSIONS.canViewTab(user.role, activeTab);
    const fallbackTab = user.role === 't-3' ? 'candidates'
      : user.role === 't-2' ? 'candidates'
      : 'overview';
    set({
      currentUser: user,
      activeTab: canSeeCurrentTab ? activeTab : fallbackTab,
    });
    // Hydrate everything from backend!
    get().fetchCandidates();
    get().fetchContactRequests();
    get().fetchJobs();
    get().fetchEvents();
    get().fetchAuditLogs();
  },

  setActiveTab: (tab) => {
    const { currentUser } = get();
    if (currentUser && PERMISSIONS.canViewTab(currentUser.role, tab)) {
      set({ activeTab: tab });
    }
  },

  // ─── Backend Fetching ──────────────────────────────────────────────────────
  fetchCandidates: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/candidates`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        set({ candidates: data });
      }
    } catch (err) {
      console.error('Error fetching candidates:', err);
    }
  },

  fetchContactRequests: async () => {
    const { currentUser } = get();
    if (!currentUser) return;
    try {
      const url = currentUser.role === 't-3' 
        ? `${API_BASE}/api/contact-requests/mine`
        : `${API_BASE}/api/contact-requests`;
      const res = await fetch(url, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        set({ contactAccessRequests: data });
      }
    } catch (err) {
      console.error('Error fetching contact requests:', err);
    }
  },

  fetchJobs: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/jobs`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        set({ jobs: data });
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  },

  fetchEvents: async () => {
    try {
      const { currentUser } = get();
      const isAdmin = currentUser?.role === 't-1';
      const url = isAdmin ? `${API_BASE}/api/events/admin` : `${API_BASE}/api/events/public`;
      const res = await fetch(url, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        set({ events: data });
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  },

  fetchAuditLogs: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/audit`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        // Backend returns paginated { logs, total, page, pages } — extract the array
        set({ auditLogs: Array.isArray(data) ? data : (data.logs || []) });
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  },

  // ─── Mutations ─────────────────────────────────────────────────────────────
  addCandidate: async (candidateData) => {
    try {
      const res = await fetch(`${API_BASE}/api/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(candidateData),
      });
      if (res.ok) {
        const newCandidate = await res.json();
        set((state) => ({ candidates: [newCandidate, ...state.candidates] }));
        get().fetchAuditLogs();
        return newCandidate;
      }
    } catch (err) {
      console.error('Error adding candidate:', err);
    }
    return null;
  },

  updateCandidate: async (id, updates) => {
    try {
      const res = await fetch(`${API_BASE}/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updatedCandidate = await res.json();
        set((state) => ({
          candidates: state.candidates.map((c) => (c._id === id || c.id === id ? updatedCandidate : c)),
        }));
        get().fetchAuditLogs();
        return true;
      }
    } catch (err) {
      console.error('Error updating candidate:', err);
    }
    return false;
  },

  deleteCandidate: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/candidates/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (res.ok) {
        set((state) => ({
          candidates: state.candidates.filter((c) => c._id !== id && c.id !== id),
        }));
        get().fetchAuditLogs();
        return true;
      }
    } catch (err) {
      console.error('Error deleting candidate:', err);
    }
    return false;
  },

  shareCandidate: async (candidateId, clientUserId, accessType = 'partial') => {
    try {
      const res = await fetch(`${API_BASE}/api/candidates/${candidateId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ clientUserId, accessType }),
      });
      if (res.ok) {
        const updated = await res.json();
        set((state) => ({
          candidates: state.candidates.map((c) => (c._id === candidateId || c.id === candidateId ? updated : c)),
        }));
        get().fetchAuditLogs();
      }
    } catch (err) {
      console.error('Error sharing candidate:', err);
    }
  },

  getVisibleCandidates: () => {
    return get().candidates; // Backend does the filtering for t-3!
  },

  canEditCandidate: (candidate) => {
    const { currentUser } = get();
    if (!currentUser) return false;
    return PERMISSIONS.canEditCandidate(currentUser.role, candidate, currentUser.id);
  },

  getPendingEventReviewCount: () => {
    return get().events.filter((event) => event.needsAdminReview).length;
  },

  // ─── Contact Access Requests ──────────────────────────────────────────────
  requestContactAccess: async (candidateId, candidateName, note = '') => {
    try {
      const res = await fetch(`${API_BASE}/api/contact-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ candidateId, note }),
      });
      if (res.ok) {
        const newReq = await res.json();
        set((state) => ({
          contactAccessRequests: [newReq, ...state.contactAccessRequests],
        }));
        get().fetchAuditLogs();
        return newReq;
      }
    } catch (err) {
      console.error('Error requesting contact access:', err);
    }
    return null;
  },

  reviewContactRequest: async (requestId, decision) => {
    try {
      const res = await fetch(`${API_BASE}/api/contact-requests/${requestId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ status: decision }),
      });
      if (res.ok) {
        const updated = await res.json();
        set((state) => ({
          contactAccessRequests: state.contactAccessRequests.map((r) =>
            r._id === requestId || r.id === requestId ? updated : r
          ),
        }));
        get().fetchAuditLogs();
        // Refresh candidates because sharing or visibility states might change
        get().fetchCandidates();
        return true;
      }
    } catch (err) {
      console.error('Error reviewing contact request:', err);
    }
    return false;
  },

  hasContactAccess: (candidateId) => {
    const { currentUser, contactAccessRequests, candidates } = get();
    if (!currentUser) return false;
    const candidate = candidates.find(c => c._id === candidateId || c.id === candidateId);
    const sharedWith = candidate ? candidate.sharedWith : [];
    return PERMISSIONS.canViewContactDetails(
      currentUser.role,
      candidateId,
      contactAccessRequests,
      sharedWith,
      currentUser.id
    );
  },

  hasPendingContactRequest: (candidateId) => {
    const { currentUser, contactAccessRequests } = get();
    if (!currentUser || currentUser.role !== 't-3') return false;
    return contactAccessRequests.some(
      (r) => String(r.candidateId) === String(candidateId) &&
             String(r.requestedBy) === String(currentUser.id) &&
             r.status === 'pending'
    );
  },

  // ─── Jobs ─────────────────────────────────────────────────────────────────
  addJob: async (jobData) => {
    try {
      const res = await fetch(`${API_BASE}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(jobData),
      });
      if (res.ok) {
        const newJob = await res.json();
        set((state) => ({ jobs: [newJob, ...state.jobs] }));
        get().fetchAuditLogs();
        return newJob;
      }
    } catch (err) {
      console.error('Error adding job:', err);
    }
    return null;
  },

  updateJob: async (id, updates) => {
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        set((state) => ({
          jobs: state.jobs.map((j) => (j._id === id || j.id === id ? updated : j)),
        }));
        get().fetchAuditLogs();
        return true;
      }
    } catch (err) {
      console.error('Error updating job:', err);
    }
    return false;
  },

  deleteJob: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (res.ok) {
        set((state) => ({
          jobs: state.jobs.filter((j) => j._id !== id && j.id !== id),
        }));
        get().fetchAuditLogs();
        return true;
      }
    } catch (err) {
      console.error('Error deleting job:', err);
    }
    return false;
  },

  // ─── UI State ─────────────────────────────────────────────────────────────
  selectedCandidateId:    null,
  setSelectedCandidateId: (id) => set({ selectedCandidateId: id }),
  isAddCandidateOpen:     false,
  setIsAddCandidateOpen:  (v) => set({ isAddCandidateOpen: v }),
  editingCandidateId:     null,
  setEditingCandidateId:  (id) => set({ editingCandidateId: id }),
  isBulkEmailOpen:        false,
  setIsBulkEmailOpen:     (v) => set({ isBulkEmailOpen: v }),
  selectedCandidateIds:   [],
  toggleCandidateSelection: (id) => {
    const { selectedCandidateIds } = get();
    set({ selectedCandidateIds: selectedCandidateIds.includes(id) ? selectedCandidateIds.filter((i) => i !== id) : [...selectedCandidateIds, id] });
  },
  selectAllCandidates:     (ids) => set({ selectedCandidateIds: ids }),
  clearCandidateSelection: ()    => set({ selectedCandidateIds: [] }),

  // ─── Scoring ──────────────────────────────────────────────────────────────
  scoringConfig: { ...DEFAULT_SCORING_CONFIG },
  setScoringConfig:   (config) => set({ scoringConfig: config }),
  resetScoringConfig: ()       => set({ scoringConfig: { ...DEFAULT_SCORING_CONFIG } }),

  // ─── Events (t-1 only) ────────────────────────────────────────────────────
  addEvent: async (eventData) => {
    try {
      const res = await fetch(`${API_BASE}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(eventData),
      });
      if (res.ok) {
        const newEvent = await res.json();
        set((state) => ({ events: [newEvent, ...state.events] }));
        get().fetchAuditLogs();
        return newEvent;
      }
    } catch (err) {
      console.error('Error adding event:', err);
    }
    return null;
  },

  updateEvent: async (id, updates) => {
    try {
      const res = await fetch(`${API_BASE}/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        set((state) => ({
          events: state.events.map((e) => (e._id === id || e.id === id ? updated : e)),
        }));
        get().fetchAuditLogs();
        return true;
      }
    } catch (err) {
      console.error('Error updating event:', err);
    }
    return false;
  },

  deleteEvent: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/events/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (res.ok) {
        set((state) => ({
          events: state.events.filter((e) => e._id !== id && e.id !== id),
        }));
        get().fetchAuditLogs();
        return true;
      }
    } catch (err) {
      console.error('Error deleting event:', err);
    }
    return false;
  },
}));

export default useStore;
