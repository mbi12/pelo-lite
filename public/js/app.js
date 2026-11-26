import { renderEmblemSVG, renderSunriseGaugeSVG, ICONS } from './emblem.js';
import {
  SUBJECT_LIST,
  loadVault,
  loadPersonal,
  savePersonal,
  getOverallConfidence,
  getWeakestSubject,
  loadOutbox,
  loadSession,
  saveSession,
  authenticateAccount,
  dispatchOfflineAction,
  syncWithServer
} from './offlineStore.js';

const SPLASH_DURATION_MS = 10000;

const LOADING_CAPTIONS = [
  { threshold: 0, text: 'Initializing i-tutor workspace...' },
  { threshold: 22, text: 'Downloading accounts, timetables & study notes...' },
  { threshold: 50, text: 'Caching remote assignments & offline packs...' },
  { threshold: 78, text: 'Syncing admissions, chats & tuition packages...' },
  { threshold: 95, text: 'Ready — Confidence in learning.' }
];

const VISITOR_PROFILE = {
  id: 'visitor',
  name: 'Visitor (Not Joined Yet)',
  role: 'visitor',
  subtitle: 'Browsing Public Tuition Packages & Contacts',
  grade: 'Public Preview',
  status: 'active'
};

const ui = {
  authTab: 'signin', // signin | join
  authError: '',
  authSuccess: '',
  view: 'overview', // overview | admissions | timetable | assignments | toolkit | messages | broadcasts | tuition | account
  searchQuery: '',
  roleFilter: 'all',

  // Admissions & Account editors
  editingAccountId: null,
  showNewAccountForm: false,
  editingEnquiryId: null,

  // Timetable & Exam editors
  timetableDay: 'All',
  editingTimetableId: null,
  editingExamId: null,

  // Assignments editors
  expandedAssignmentId: 'asg-1',
  showAssignCreator: false,
  editingAssignmentId: null,

  // Study Toolkit tabs & editors
  toolkitTab: 'notes', // notes | quiz | flashcards | focus
  subjectFilter: 'All',
  showNoteModal: false,
  editingNoteId: null,
  quizState: { subject: 'All', index: 0, picked: null, correctCount: 0, finished: false },
  showQuizModal: false,
  editingQuizId: null,
  cardState: { index: 0, flipped: false },
  showCardModal: false,
  editingCardId: null,

  // Messenger editors
  selectedRoomId: null,
  showGroupCreator: false,
  editingRoomId: null,
  editingMessageId: null,

  // Broadcasts & Attendance editors
  broadcastSubtab: 'announcements', // announcements | attendance
  editingBroadcastId: null,
  editingAttendanceId: null,

  // Tuition & Package editors
  feeCalcSessions: 2,
  feeCalcRate: 220,
  showTuitionEditor: false,
  editingPlanId: null,
  showNewPlanForm: false,

  // Mobile responsive shell state
  mobileDrawerOpen: false,
  mobileSearchOpen: false,

  // Live timer & scratchpad
  timerSeconds: 25 * 60,
  timerRunning: false,
  calcOutput: '',
  toast: ''
};

let vaultState = loadVault();
let personalState = loadPersonal();
let sessionState = loadSession();
let timerHandle = null;
let toastHandle = null;
let lastAnimatedKey = '';

function esc(str = '') {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(name = 'IT') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function getActiveUser() {
  if (!sessionState.currentUserId) return null;
  if (sessionState.currentUserId === 'visitor') return VISITOR_PROFILE;
  const found = (vaultState.profiles || []).find((p) => p.id === sessionState.currentUserId);
  if (!found || found.status === 'suspended' || found.status === 'declined') return null;
  return found;
}

function canEditEverything(user) {
  return Boolean(user && (user.role === 'admissions' || user.role === 'admin'));
}

function isStaff(user) {
  return Boolean(user && (user.role === 'teacher' || user.role === 'admissions' || user.role === 'admin'));
}

function isOfflineActive() {
  return Boolean(sessionState.simulateOffline) || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

function applyTheme() {
  if (sessionState.theme === 'night') {
    document.documentElement.setAttribute('data-theme', 'night');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function renderToastOnly() {
  const host = document.getElementById('live-toast-host');
  if (!host) return;
  host.innerHTML = ui.toast ? `<div class="toast-banner" role="status">${esc(ui.toast)}</div>` : '';
}

function showToast(msg) {
  ui.toast = msg;
  if (document.getElementById('live-toast-host')) {
    renderToastOnly();
  } else {
    renderApp({ preserveScroll: true });
  }
  if (toastHandle) clearTimeout(toastHandle);
  toastHandle = setTimeout(() => {
    ui.toast = '';
    renderToastOnly();
  }, 3300);
}

function updateTimerReadoutsOnly() {
  const formatted = formatClock(ui.timerSeconds);
  document.querySelectorAll('.js-timer-readout').forEach((el) => {
    el.textContent = formatted;
    el.classList.toggle('is-ticking', ui.timerRunning);
  });
}

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getPendingAdmissionsCount() {
  const pendingAccounts = (vaultState.profiles || []).filter((p) => p.status === 'pending').length;
  const pendingEnquiries = (vaultState.enquiries || []).filter((e) => (e.status || 'pending') === 'pending').length;
  return pendingAccounts + pendingEnquiries;
}

function getVisibleRooms(user) {
  if (!user || user.role === 'visitor') return [];
  if (canEditEverything(user)) return vaultState.rooms || [];
  return (vaultState.rooms || []).filter((r) => (r.participant_ids || []).includes(user.id));
}

function getActiveRoom(user) {
  const rooms = getVisibleRooms(user);
  if (!rooms.length) return null;
  return rooms.find((r) => r.id === ui.selectedRoomId) || rooms[0];
}

async function performActionAndSync(type, payload, toastMessage) {
  dispatchOfflineAction(vaultState, { type, payload });
  vaultState = loadVault();
  renderApp();
  if (!isOfflineActive()) {
    const res = await syncWithServer({ simulateOffline: false });
    if (res.vault) vaultState = res.vault;
    renderApp();
  }
  if (toastMessage) showToast(toastMessage);
}

async function enrollAcceptedUserInRooms(profile) {
  if (!profile || !profile.id) return;
  const groupRoom = (vaultState.rooms || []).find((r) => r.id === 'room-grp-trig');
  if (groupRoom && !(groupRoom.participant_ids || []).includes(profile.id)) {
    const updatedParticipants = [...(groupRoom.participant_ids || []), profile.id];
    dispatchOfflineAction(vaultState, {
      type: 'UPSERT_ROOM',
      payload: {
        ...groupRoom,
        participant_ids: updatedParticipants,
        members_label: `${updatedParticipants.length} members · Study Group`
      }
    });
  }
  const welcomeRoomId = `room-welcome-${profile.id}`;
  if (!(vaultState.rooms || []).some((r) => r.id === welcomeRoomId)) {
    dispatchOfflineAction(vaultState, {
      type: 'UPSERT_ROOM',
      payload: {
        id: welcomeRoomId,
        room_type: 'direct',
        name: `Admissions & Support · ${profile.name}`,
        subject: profile.selected_plan || 'Welcome Channel',
        participant_ids: [profile.id, 'adm-lerato', 'admin-1', 'tch-naledi'],
        members_label: 'Direct Support · Admissions & Educators',
        created_by_name: 'Admissions Office'
      }
    });
    dispatchOfflineAction(vaultState, {
      type: 'SEND_MESSAGE',
      payload: {
        id: `msg-welcome-${Date.now()}`,
        room_id: welcomeRoomId,
        sender_id: 'adm-lerato',
        sender_name: 'Lerato Sithole (Admissions)',
        sender_role: 'admissions',
        body: `Welcome to i-tutor, ${profile.name}! Your account has been accepted and activated. Your timetables & offline study packs are ready.`,
        created_at: new Date().toISOString()
      }
    });
  }
  vaultState = loadVault();
  if (!isOfflineActive()) {
    const res = await syncWithServer({ simulateOffline: false });
    if (res.vault) vaultState = res.vault;
  }
}

/* ==========================================================================
   1. 10-SECOND ANIMATED INTRO SPLASH SCREEN
   ========================================================================== */

function runAnimatedSplash(rootEl, onDone) {
  const wordChars = [
    { ch: 't', delay: '3.60s' },
    { ch: 'u', delay: '3.74s' },
    { ch: 't', delay: '3.88s' },
    { ch: 'o', delay: '4.02s' },
    { ch: 'r', delay: '4.16s' }
  ];

  rootEl.innerHTML = `
    <main class="splash-screen" id="splash-screen" aria-label="i-tutor loading screen">
      <div class="splash-centerpiece">
        <div class="emblem-stage">
          <div class="emblem-aura"></div>
          ${renderEmblemSVG({ animated: true, uid: 'splash' })}
        </div>

        <h1 class="wordmark-row" aria-label="i-tutor">
          <span class="wm-i-wrap">
            <span class="wm-char" style="--char-delay: 3.35s">&#305;</span>
            <span class="wm-i-gold-dot" aria-hidden="true"></span>
          </span>
          <span class="wm-char wm-hyphen" style="--char-delay: 3.48s">-</span>
          ${wordChars
            .map((item) => `<span class="wm-char" style="--char-delay: ${item.delay}">${item.ch}</span>`)
            .join('')}
        </h1>

        <div class="slogan-wrap">
          <p class="slogan-text">Confidence in learning</p>
          <span class="slogan-shimmer" aria-hidden="true"></span>
        </div>

        <div class="loader-panel" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="loader-bar">
          <div class="loader-track">
            <div class="loader-fill" id="loader-fill"></div>
          </div>
          <div class="loader-meta">
            <span id="loader-caption">${LOADING_CAPTIONS[0].text}</span>
            <span class="loader-percent" id="loader-percent">0%</span>
          </div>
        </div>
      </div>
    </main>
  `;

  syncWithServer({ simulateOffline: sessionState.simulateOffline }).then((res) => {
    if (res?.vault) vaultState = res.vault;
  });

  const fillEl = document.getElementById('loader-fill');
  const pctEl = document.getElementById('loader-percent');
  const capEl = document.getElementById('loader-caption');
  const barEl = document.getElementById('loader-bar');
  const splashEl = document.getElementById('splash-screen');

  const start = performance.now();

  function frame(now) {
    const ratio = Math.min((now - start) / SPLASH_DURATION_MS, 1);
    const pct = Math.floor(ratio * 100);

    if (fillEl) fillEl.style.width = `${(ratio * 100).toFixed(2)}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (barEl) barEl.setAttribute('aria-valuenow', String(pct));

    let currentCaption = LOADING_CAPTIONS[0].text;
    for (const item of LOADING_CAPTIONS) {
      if (pct >= item.threshold) currentCaption = item.text;
    }
    if (capEl && capEl.textContent !== currentCaption) {
      capEl.textContent = currentCaption;
    }

    if (ratio < 1) {
      requestAnimationFrame(frame);
    } else {
      setTimeout(() => {
        if (splashEl) splashEl.classList.add('is-exiting');
        setTimeout(onDone, 560);
      }, 150);
    }
  }

  requestAnimationFrame(frame);
}

/* ==========================================================================
   2. ACCOUNT PORTAL (SIGN IN / APPLY TO JOIN / NOT-JOINED VISITOR ACCESS)
   ========================================================================== */

function renderAuthPortal(rootEl) {
  const plans = vaultState.tuitionInfo?.plans || [];
  const pendingTotal = getPendingAdmissionsCount();
  const quickAccounts = [
    { id: 'adm-lerato', tag: `Admissions (${pendingTotal} Pending)`, label: 'Lerato Sithole' },
    { id: 'admin-1', tag: 'Super Admin', label: 'Kgomotso Dlamini' },
    { id: 'stu-thabo', tag: 'Student · Grade 12', label: 'Thabo Mokoena' },
    { id: 'tch-naledi', tag: 'Teacher · Maths', label: 'Ms. Naledi Khumalo' },
    { id: 'par-grace', tag: 'Parent Account', label: 'Mrs. Grace Mokoena' }
  ];

  rootEl.innerHTML = `
    <div class="auth-portal-shell">
      <div class="auth-portal-grid">
        <section class="auth-brand-pane">
          <div>
            <div style="width:130px;margin-bottom:0.8rem;">
              ${renderEmblemSVG({ animated: false, uid: 'auth', className: 'brand-emblem-svg' })}
            </div>
            <h1 style="font-size:2rem;font-weight:850;letter-spacing:-0.03em;color:#F8F3EC;">
              <span style="color:var(--gold);">i</span>-tutor Accounts
            </h1>
            <p style="color:var(--gold);font-weight:750;font-size:0.95rem;margin-top:0.2rem;">Confidence in learning</p>
            <p style="color:var(--sidebar-muted);font-size:0.86rem;line-height:1.6;margin-top:0.9rem;">
              Personal accounts for Students, Parents, Educators, and Admissions — with saved offline timetables, auto-downloaded remote assignments, study toolkits, and full in-app Admissions management.
            </p>
          </div>

          <div style="background:var(--sidebar-card);padding:1rem;border-radius:16px;display:flex;flex-direction:column;gap:0.65rem;">
            <span style="font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--gold);">
              Haven't Joined Yet?
            </span>
            <p style="font-size:0.82rem;color:#EAE3D5;line-height:1.45;">
              Browse transparent tuition packages, use the monthly fee calculator, view academy contact details, or try a free sample quiz before creating an account.
            </p>
            <button class="gold-cta-btn" id="btn-enter-visitor" style="justify-content:center;">
              ${ICONS.tuition} View Tuition Prices & Contacts (No Login)
            </button>
          </div>
        </section>

        <section class="auth-form-pane">
          <div class="subtab-bar">
            <button class="subtab-btn ${ui.authTab === 'signin' ? 'is-active' : ''}" data-auth-tab="signin">
              Sign In to Account
            </button>
            <button class="subtab-btn ${ui.authTab === 'join' ? 'is-active' : ''}" data-auth-tab="join">
              Apply to Join (New Account)
            </button>
          </div>

          ${
            ui.authError
              ? `<div class="worksheet-box" style="border-left-color:#D6453A;color:#B83228;font-weight:700;">${esc(
                  ui.authError
                )}</div>`
              : ''
          }
          ${
            ui.authSuccess
              ? `<div class="worksheet-box" style="border-left-color:#1E7E48;font-weight:700;">${esc(ui.authSuccess)}</div>`
              : ''
          }

          ${
            ui.authTab === 'signin'
              ? `
            <form class="form-stack" id="account-signin-form">
              <label style="font-size:0.79rem;font-weight:750;">Email, Phone Number, or Full Name</label>
              <input class="field-input" name="identifier" placeholder="e.g. admissions@i-tutor.academy or thabo@student.i-tutor.academy" required />
              <label style="font-size:0.79rem;font-weight:750;">Password / Account PIN</label>
              <input class="field-input" type="password" name="pin" placeholder="Enter Password / PIN (Demo PIN: 1234)" required />
              <button class="dark-cta-btn" type="submit" style="padding:0.75rem;">Sign In to Workspace →</button>
            </form>

            <div style="border-top:1px solid var(--border-warm);padding-top:0.85rem;display:flex;flex-direction:column;gap:0.55rem;">
              <span class="row-sub" style="font-weight:800;">INSTANT 1-TAP DEMO ACCOUNTS (FOR TESTING ROLES):</span>
              <div class="demo-accounts-grid">
                ${quickAccounts
                  .map(
                    (qa) => `
                  <button class="demo-acc-btn" data-quick-login="${esc(qa.id)}">
                    <span class="demo-acc-role">${esc(qa.tag)}</span>
                    <span class="demo-acc-name">${esc(qa.label)}</span>
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
              : `
            <form class="form-stack" id="account-join-form">
              <p class="row-sub">Create your account application below. Admissions will review & accept your account in 1 click (works offline too!).</p>
              <div class="form-grid-2">
                <input class="field-input" name="name" placeholder="Full Name" required />
                <select class="field-input" name="role" required>
                  <option value="student">Joining as Student</option>
                  <option value="parent">Joining as Parent</option>
                  <option value="teacher">Joining as Teacher / Tutor</option>
                </select>
              </div>
              <div class="form-grid-2">
                <input class="field-input" type="email" name="email" placeholder="Email Address" required />
                <input class="field-input" name="phone" placeholder="Phone / WhatsApp Number" required />
              </div>
              <div class="form-grid-2">
                <input class="field-input" name="grade" placeholder="Grade / Role (e.g. Grade 11)" required />
                <input class="field-input" type="password" name="pin" placeholder="Create Password / PIN" required />
              </div>
              <div class="form-grid-2">
                <input class="field-input" name="subjectsRaw" placeholder="Subjects (e.g. Maths, Physics)" required />
                <select class="field-input" name="selected_plan">
                  ${plans.map((p) => `<option value="${esc(p.name)}">${esc(p.name)} (${esc(p.price)})</option>`).join('')}
                  <option value="Educator Application">Tutor / Staff Application</option>
                </select>
              </div>
              <input class="field-input" name="notes" placeholder="Goals or message for Admissions..." />
              <button class="dark-cta-btn" type="submit" style="padding:0.75rem;">Submit Join Application →</button>
            </form>
          `
          }
        </section>
      </div>
      ${ui.toast ? `<div class="toast-banner" role="status">${esc(ui.toast)}</div>` : ''}
    </div>
  `;

  document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.authTab = btn.getAttribute('data-auth-tab');
      ui.authError = '';
      renderApp();
    });
  });

  const visitorBtn = document.getElementById('btn-enter-visitor');
  if (visitorBtn) {
    visitorBtn.addEventListener('click', () => {
      sessionState.currentUserId = 'visitor';
      saveSession(sessionState);
      ui.view = 'tuition';
      renderApp();
    });
  }

  document.querySelectorAll('[data-quick-login]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-quick-login');
      const target = (vaultState.profiles || []).find((p) => p.id === id);
      if (target) {
        sessionState.currentUserId = target.id;
        saveSession(sessionState);
        ui.authError = '';
        ui.authSuccess = '';
        ui.view = target.role === 'admissions' ? 'admissions' : 'overview';
        showToast(`Signed in as ${target.name} (${target.role.toUpperCase()})`);
      }
    });
  });

  const signinForm = document.getElementById('account-signin-form');
  if (signinForm) {
    signinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(signinForm);
      const res = authenticateAccount(vaultState, fd.get('identifier'), fd.get('pin'));
      if (!res.ok) {
        ui.authError = res.error;
        ui.authSuccess = '';
        renderApp();
        return;
      }
      sessionState.currentUserId = res.profile.id;
      saveSession(sessionState);
      ui.authError = '';
      ui.authSuccess = '';
      ui.view = res.profile.role === 'admissions' ? 'admissions' : 'overview';
      showToast(`Welcome back, ${res.profile.name}!`);
    });
  }

  const joinForm = document.getElementById('account-join-form');
  if (joinForm) {
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(joinForm);
      const subjects = String(fd.get('subjectsRaw') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const role = fd.get('role');
      const newProfile = {
        id: `acc-${Date.now()}`,
        name: fd.get('name'),
        role,
        subtitle: `${fd.get('grade')} · ${role.charAt(0).toUpperCase() + role.slice(1)}`,
        grade: fd.get('grade'),
        pin: fd.get('pin') || '1234',
        email: fd.get('email'),
        phone: fd.get('phone'),
        status: 'pending',
        subjects,
        selected_plan: fd.get('selected_plan'),
        linked_student_id: '',
        notes: fd.get('notes') || 'Applied via in-app registration.'
      };
      ui.authError = '';
      ui.authSuccess = `Application received for ${newProfile.name}! Status: Pending Admissions Approval. Sign in as Admissions (Lerato Sithole) below to accept in 1 click!`;
      ui.authTab = 'signin';
      await performActionAndSync('UPSERT_ACCOUNT', newProfile, 'Join application sent to Admissions!');
    });
  }
}

/* ==========================================================================
   3. ADMISSIONS & FULL ACCOUNT MANAGEMENT VIEW ("ACCEPT ANYONE & EDIT ALL")
   ========================================================================== */

function buildAdmissionsStage(user) {
  const isSuper = canEditEverything(user);
  if (!isSuper) {
    return `<section class="panel-card"><p class="row-sub">Admissions & Account Directory is restricted to Admissions & Admin staff.</p></section>`;
  }

  const allProfiles = vaultState.profiles || [];
  const pendingApplicants = allProfiles.filter((p) => p.status === 'pending');
  const enquiries = vaultState.enquiries || [];
  const filteredAccounts = allProfiles.filter((p) => {
    const roleOk = ui.roleFilter === 'all' || p.role === ui.roleFilter;
    const q = ui.searchQuery.trim().toLowerCase();
    const searchOk =
      !q ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.role || '').toLowerCase().includes(q);
    return roleOk && searchOk;
  });

  const editingAcc = ui.editingAccountId ? allProfiles.find((p) => p.id === ui.editingAccountId) : null;
  const plans = vaultState.tuitionInfo?.plans || [];

  return `
    <div class="page-header-row">
      <div>
        <h1>Admissions Queue & Full Account Management</h1>
        <p>Accept anyone joining i-tutor in 1 click, convert enquiries into active accounts, or create & edit any Student, Parent, Teacher, Admissions, or Admin account.</p>
      </div>
      <button class="dark-cta-btn" id="btn-toggle-new-account">
        ${ICONS.plus} ${ui.showNewAccountForm ? 'Close Creator' : 'Create Account Directly'}
      </button>
    </div>

    ${
      ui.showNewAccountForm || editingAcc
        ? `
      <form class="panel-card form-stack" id="upsert-account-form">
        <div class="panel-head">
          <h2 class="panel-title">${editingAcc ? `Edit Account · ${esc(editingAcc.name)}` : 'Create New Active Account'}</h2>
          <button type="button" class="outline-btn" id="btn-cancel-account-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingAcc?.id || '')}" />
        <div class="form-grid-2">
          <input class="field-input" name="name" value="${esc(editingAcc?.name || '')}" placeholder="Full Name" required />
          <select class="field-input" name="role" required>
            ${['student', 'parent', 'teacher', 'admissions', 'admin']
              .map(
                (r) =>
                  `<option value="${r}" ${editingAcc?.role === r ? 'selected' : ''}>Role: ${r.toUpperCase()}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="email" value="${esc(editingAcc?.email || '')}" placeholder="Email Address" required />
          <input class="field-input" name="phone" value="${esc(editingAcc?.phone || '')}" placeholder="Phone / WhatsApp" />
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="pin" value="${esc(editingAcc?.pin || '1234')}" placeholder="Password / PIN" required />
          <select class="field-input" name="status">
            ${['active', 'pending', 'suspended', 'declined']
              .map(
                (st) =>
                  `<option value="${st}" ${(editingAcc?.status || 'active') === st ? 'selected' : ''}>Status: ${st.toUpperCase()}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="grade" value="${esc(editingAcc?.grade || 'Grade 12')}" placeholder="Grade / Department" />
          <input class="field-input" name="subtitle" value="${esc(editingAcc?.subtitle || '')}" placeholder="Profile Subtitle / Stream" />
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="subjectsRaw" value="${esc((editingAcc?.subjects || []).join(', '))}" placeholder="Subjects (comma-separated)" />
          <select class="field-input" name="selected_plan">
            <option value="${esc(editingAcc?.selected_plan || '')}">${esc(
            editingAcc?.selected_plan || 'Select Tuition Plan / Staff'
          )}</option>
            ${plans.map((p) => `<option value="${esc(p.name)}">${esc(p.name)} (${esc(p.price)})</option>`).join('')}
            <option value="Staff">Staff / Educator</option>
          </select>
        </div>
        <input class="field-input" name="notes" value="${esc(editingAcc?.notes || '')}" placeholder="Admissions / Learner Notes" />
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Account & Sync Everywhere</button>
      </form>
    `
        : ''
    }

    <!-- PENDING JOIN APPLICATIONS -->
    <section class="panel-card">
      <div class="panel-head">
        <h2 class="panel-title">Pending Join Applications (${pendingApplicants.length})</h2>
        <span class="pill-badge">1-Click Admissions Approval</span>
      </div>
      ${
        pendingApplicants.length === 0
          ? `<p class="row-sub">All account applications have been reviewed! Anyone who applies on the Join screen appears right here.</p>`
          : pendingApplicants
              .map(
                (app) => `
            <div class="list-row" style="flex-wrap:wrap;">
              <div class="list-row-col">
                <span class="row-title">
                  ${esc(app.name)}
                  <span class="status-chip pending">Pending ${esc(app.role)}</span>
                </span>
                <span class="row-sub">${esc(app.grade)} · Plan: <strong>${esc(app.selected_plan || 'Standard')}</strong> · Subjects: ${esc(
                  (app.subjects || []).join(', ') || 'General'
                )}</span>
                <span class="row-sub">Email: ${esc(app.email)} · Phone: ${esc(app.phone)} · Note: "${esc(app.notes || '')}"</span>
              </div>
              <div class="action-cluster">
                <button class="approve-btn" data-approve-acc="${esc(app.id)}">✓ Accept & Activate</button>
                <button class="icon-action-btn" data-edit-acc="${esc(app.id)}">${ICONS.edit} Edit</button>
                <button class="icon-action-btn danger" data-decline-acc="${esc(app.id)}">${ICONS.trash} Decline</button>
              </div>
            </div>
          `
              )
              .join('')
      }
    </section>

    <!-- PUBLIC TUITION ENQUIRIES -->
    <section class="panel-card">
      <div class="panel-head">
        <h2 class="panel-title">Public Tuition Enquiries (${enquiries.length})</h2>
        <span class="muted-pill">Convert Leads Directly into Active Accounts</span>
      </div>
      ${
        enquiries.length === 0
          ? `<p class="row-sub">No public enquiries waiting right now.</p>`
          : enquiries
              .map((eq) => {
                const isEditingEq = ui.editingEnquiryId === eq.id;
                return isEditingEq
                  ? `
                <form class="list-row form-stack edit-enquiry-form" data-eq-id="${esc(eq.id)}" style="align-items:stretch;">
                  <div class="form-grid-2">
                    <input class="field-input" name="full_name" value="${esc(eq.full_name)}" required />
                    <input class="field-input" name="contact_detail" value="${esc(eq.contact_detail)}" required />
                  </div>
                  <div class="form-grid-2">
                    <input class="field-input" name="student_grade" value="${esc(eq.student_grade)}" />
                    <input class="field-input" name="selected_plan" value="${esc(eq.selected_plan)}" />
                  </div>
                  <input class="field-input" name="message" value="${esc(eq.message)}" />
                  <div class="action-cluster">
                    <button class="dark-cta-btn" type="submit">Save Enquiry</button>
                    <button class="outline-btn" type="button" data-cancel-eq>Cancel</button>
                  </div>
                </form>
              `
                  : `
                <div class="list-row" style="flex-wrap:wrap;">
                  <div class="list-row-col">
                    <span class="row-title">${esc(eq.full_name)} · ${esc(eq.student_grade)} (${esc(eq.selected_plan)})</span>
                    <span class="row-sub">Contact: ${esc(eq.contact_detail)} — "${esc(eq.message)}"</span>
                  </div>
                  <div class="action-cluster">
                    ${
                      eq.status === 'accepted'
                        ? `<span class="status-chip active">Enrolled ✓</span>`
                        : `<button class="approve-btn" data-convert-eq="${esc(eq.id)}">✓ Accept & Create Account</button>`
                    }
                    <button class="icon-action-btn" data-edit-eq="${esc(eq.id)}">${ICONS.edit} Edit</button>
                    <button class="icon-action-btn danger" data-del-eq="${esc(eq.id)}">${ICONS.trash}</button>
                  </div>
                </div>
              `;
              })
              .join('')
      }
    </section>

    <!-- ALL ACCOUNTS DIRECTORY -->
    <section class="panel-card">
      <div class="panel-head">
        <h2 class="panel-title">All Academy Accounts Directory (${filteredAccounts.length})</h2>
        <div class="subtab-bar">
          ${['all', 'student', 'parent', 'teacher', 'admissions', 'admin']
            .map(
              (r) => `
            <button class="subtab-btn ${ui.roleFilter === r ? 'is-active' : ''}" data-role-filter="${r}">
              ${r.toUpperCase()}
            </button>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="form-stack">
        ${filteredAccounts
          .map(
            (acc) => `
          <div class="list-row" style="flex-wrap:wrap;">
            <div class="list-row-col">
              <span class="row-title">
                ${esc(acc.name)}
                <span class="muted-pill">${esc(acc.role.toUpperCase())}</span>
                <span class="status-chip ${esc(acc.status || 'active')}">${esc(acc.status || 'active')}</span>
              </span>
              <span class="row-sub">${esc(acc.subtitle || acc.grade)} · Email: ${esc(acc.email || '—')} · Phone: ${esc(
              acc.phone || '—'
            )} · PIN: <code>${esc(acc.pin || '1234')}</code></span>
              ${
                acc.selected_plan
                  ? `<span class="row-sub">Plan: ${esc(acc.selected_plan)} · Subjects: ${esc(
                      (acc.subjects || []).join(', ')
                    )}</span>`
                  : ''
              }
            </div>
            <div class="action-cluster">
              ${
                acc.status !== 'active'
                  ? `<button class="approve-btn" data-approve-acc="${esc(acc.id)}">✓ Activate</button>`
                  : ''
              }
              <button class="icon-action-btn" data-edit-acc="${esc(acc.id)}">${ICONS.edit} Edit</button>
              ${
                acc.id !== user.id
                  ? `<button class="icon-action-btn danger" data-del-acc="${esc(acc.id)}">${ICONS.trash} Delete</button>`
                  : ''
              }
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </section>
  `;
}

/* ==========================================================================
   4. MY ACCOUNT SETTINGS VIEW (FOR EVERY LOGGED-IN USER)
   ========================================================================== */

function buildMyAccountStage(user) {
  if (user.role === 'visitor') {
    return `
      <section class="panel-card">
        <h2 class="panel-title">Create or Sign In to Your i-tutor Account</h2>
        <p class="row-sub">You are currently browsing as a Visitor. Apply to join i-tutor or sign in to an existing account anytime!</p>
        <div class="action-cluster">
          <button class="dark-cta-btn" id="btn-go-join-portal">Apply to Join i-tutor</button>
          <button class="outline-btn" id="btn-go-signin-portal">Sign In</button>
        </div>
      </section>
    `;
  }

  return `
    <div class="page-header-row">
      <div>
        <h1>My Account & Profile Settings</h1>
        <p>Update your personal details, subjects, and password/PIN — saved offline and synced across devices.</p>
      </div>
      <button class="outline-btn" id="btn-signout-main">${ICONS.logout} Sign Out / Switch Account</button>
    </div>

    <form class="panel-card form-stack" id="my-profile-form">
      <div class="panel-head">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div class="account-avatar-gold" style="width:46px;height:46px;font-size:1rem;">${esc(initials(user.name))}</div>
          <div>
            <h2 class="panel-title">${esc(user.name)}</h2>
            <span class="status-chip active">${esc(user.role.toUpperCase())} ACCOUNT · ACTIVE</span>
          </div>
        </div>
      </div>

      <div class="form-grid-2">
        <div>
          <label class="row-sub">Full Name</label>
          <input class="field-input" name="name" value="${esc(user.name)}" required />
        </div>
        <div>
          <label class="row-sub">Email Address</label>
          <input class="field-input" name="email" value="${esc(user.email || '')}" required />
        </div>
      </div>

      <div class="form-grid-2">
        <div>
          <label class="row-sub">Phone / WhatsApp</label>
          <input class="field-input" name="phone" value="${esc(user.phone || '')}" />
        </div>
        <div>
          <label class="row-sub">Password / Sign-In PIN</label>
          <input class="field-input" name="pin" value="${esc(user.pin || '1234')}" required />
        </div>
      </div>

      <div class="form-grid-2">
        <div>
          <label class="row-sub">Grade / Department</label>
          <input class="field-input" name="grade" value="${esc(user.grade || '')}" />
        </div>
        <div>
          <label class="row-sub">Profile Headline / Stream</label>
          <input class="field-input" name="subtitle" value="${esc(user.subtitle || '')}" />
        </div>
      </div>

      <div>
        <label class="row-sub">Subjects (comma-separated)</label>
        <input class="field-input" name="subjectsRaw" value="${esc((user.subjects || []).join(', '))}" />
      </div>

      <button class="dark-cta-btn" type="submit" style="align-self:flex-start;">${ICONS.check} Save My Account Changes</button>
    </form>
  `;
}

/* ==========================================================================
   5. OVERVIEW, TIMETABLE, ASSIGNMENTS, TOOLKIT, CHATS, BROADCASTS & TUITION
      (WITH FULL IN-APP EDITING FOR ADMISSIONS & ADMIN!)
   ========================================================================== */

function buildOverviewStage(user) {
  if (user.role === 'visitor') {
    const info = vaultState.tuitionInfo;
    return `
      <section class="panel-card" style="background:linear-gradient(135deg, rgba(242,183,40,0.22), var(--surface-ivory));">
        <span class="pill-badge" style="align-self:flex-start;">Visitor Preview · Not Joined Yet</span>
        <h1 style="font-size:1.62rem;font-weight:850;letter-spacing:-0.03em;">${esc(info.headline)}</h1>
        <p style="font-size:0.9rem;color:var(--charcoal-soft);line-height:1.5;">${esc(info.intro)}</p>
        <div class="action-cluster" style="margin-top:0.25rem;">
          <button class="dark-cta-btn" id="visitor-apply-cta">${ICONS.plus} Apply to Join i-tutor</button>
          <button class="outline-btn" data-nav="tuition">${ICONS.tuition} See Tuition Prices & Contacts</button>
          <button class="outline-btn" data-open-toolkit="quiz">${ICONS.quiz} Try Free Sample Quiz</button>
        </div>
      </section>
    `;
  }

  const avgConf = getOverallConfidence(personalState);
  const weakest = getWeakestSubject(personalState);
  const pendingAdmissions = getPendingAdmissionsCount();
  const mySubs = (vaultState.submissions || []).filter((s) => s.student_id === user.id);
  const pendingCount = (vaultState.assignments || []).filter((a) => !mySubs.some((s) => s.assignment_id === a.id)).length;
  const ungradedCount = (vaultState.submissions || []).filter((s) => s.status !== 'graded').length;
  const visibleRooms = getVisibleRooms(user);
  const attendanceRecords = vaultState.attendance || [];
  const presentRatio = attendanceRecords.length
    ? Math.round((attendanceRecords.filter((a) => a.status === 'present').length / attendanceRecords.length) * 100)
    : 96;
  const latestBroadcast = (vaultState.broadcasts || [])[0];

  let kpis = [];
  if (canEditEverything(user)) {
    kpis = [
      {
        label: 'Admissions Queue',
        value: `${pendingAdmissions} Pending`,
        foot: 'Accept applicants in 1 click',
        go: 'admissions'
      },
      {
        label: 'Active Accounts',
        value: `${(vaultState.profiles || []).filter((p) => p.status === 'active').length} Users`,
        foot: 'Edit any account or role',
        go: 'admissions'
      },
      {
        label: 'Classes & Tasks',
        value: `${vaultState.timetables.length} / ${vaultState.assignments.length}`,
        foot: 'Edit schedules & assignments',
        go: 'timetable'
      },
      {
        label: 'Tuition Packages',
        value: `${(vaultState.tuitionInfo.plans || []).length} Plans`,
        foot: 'Edit prices & contacts live',
        go: 'tuition'
      }
    ];
  } else if (user.role === 'teacher') {
    kpis = [
      { label: 'Saved Class Schedule', value: `${vaultState.timetables.length} Slots`, foot: 'Manage timetable', go: 'timetable' },
      { label: 'Submissions to Mark', value: `${ungradedCount} Waiting`, foot: 'Grade remote work', go: 'assignments' },
      { label: 'Class Attendance', value: `${presentRatio}%`, foot: 'Log lesson recaps', go: 'broadcasts' },
      { label: 'Active Chat Rooms', value: `${visibleRooms.length} Open`, foot: '1-on-1s & study groups', go: 'messages' }
    ];
  } else if (user.role === 'parent') {
    const childId = user.linked_student_id || 'stu-thabo';
    const childSubs = (vaultState.submissions || []).filter((s) => s.student_id === childId);
    const graded = childSubs.find((s) => s.status === 'graded');
    kpis = [
      { label: 'Learner Attendance', value: `${presentRatio}%`, foot: 'View tutor recaps', go: 'broadcasts' },
      { label: 'Latest Graded Task', value: graded ? `${graded.marks_awarded} Marks` : 'In Progress', foot: 'Read teacher feedback', go: 'assignments' },
      { label: 'Saved Timetable', value: `${vaultState.timetables.length} Classes`, foot: 'Stored offline', go: 'timetable' },
      { label: 'Teacher Channels', value: `${visibleRooms.length} Open`, foot: 'Message educators', go: 'messages' }
    ];
  } else {
    kpis = [
      { label: 'Sunrise Confidence', value: `${avgConf}%`, foot: `Focus next: ${weakest.subject}`, go: 'toolkit' },
      { label: 'Remote Assignments', value: `${pendingCount} Due`, foot: `${vaultState.assignments.length} packs cached offline`, go: 'assignments' },
      { label: 'Saved Timetable', value: `${vaultState.timetables.length} Slots`, foot: 'Works with zero data', go: 'timetable' },
      { label: 'Notes & Flashcards', value: `${vaultState.notes.length + vaultState.flashcards.length} Ready`, foot: 'Formulas, quizzes & cards', go: 'toolkit' }
    ];
  }

  return `
    ${
      latestBroadcast
        ? `
      <button class="broadcast-ribbon" data-nav="broadcasts">
        <div class="ribbon-left">
          <div class="ribbon-icon">${ICONS.broadcast}</div>
          <div style="min-width:0;">
            <div class="ribbon-tag">Official Broadcast · ${esc(latestBroadcast.author_name)}</div>
            <div class="ribbon-headline">${esc(latestBroadcast.title)} — ${esc(latestBroadcast.body)}</div>
          </div>
        </div>
        <span class="pill-badge">${canEditEverything(user) ? 'Manage' : 'Read'}</span>
      </button>
    `
        : ''
    }

    <div class="page-header-row">
      <div>
        <h1>Welcome, ${esc(user.name)}</h1>
        <p>${esc(user.subtitle || user.grade)} · Signed in as <strong>${esc(user.role.toUpperCase())}</strong>${
    canEditEverything(user) ? ' (Full In-App Edit Permissions Enabled)' : ''
  }</p>
      </div>
      <div class="action-cluster">
        ${
          canEditEverything(user)
            ? `<button class="dark-cta-btn" data-nav="admissions">${ICONS.users} Review Admissions (${pendingAdmissions})</button>`
            : isStaff(user)
            ? `<button class="dark-cta-btn" id="quick-new-assign-btn">${ICONS.plus} Post Remote Assignment</button>`
            : `<button class="dark-cta-btn" data-open-toolkit="quiz">${ICONS.quiz} Quick Offline Quiz</button>`
        }
        <button class="outline-btn" data-nav="account">${ICONS.user} My Account</button>
      </div>
    </div>

    <section class="kpi-strip">
      ${kpis
        .map(
          (k) => `
        <button class="kpi-card" data-nav="${k.go}">
          <span class="kpi-label">${esc(k.label)}</span>
          <span class="kpi-value">${esc(k.value)}</span>
          <span class="kpi-foot">${esc(k.foot)} →</span>
        </button>
      `
        )
        .join('')}
    </section>

    <div class="two-col-grid">
      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Upcoming Offline Timetable</h2>
          <button class="outline-btn" data-nav="timetable">${canEditEverything(user) ? 'Edit Schedule' : 'Full Schedule'}</button>
        </div>
        ${(vaultState.timetables || [])
          .slice(0, 3)
          .map(
            (slot) => `
          <div class="list-row">
            <div class="list-row-col">
              <span class="row-title">${esc(slot.subject)} · ${esc(slot.day_of_week)}</span>
              <span class="row-sub">${esc(slot.start_time)}–${esc(slot.end_time)} · ${esc(slot.topic)}</span>
              <span class="row-sub">${esc(slot.teacher_name)} · ${esc(slot.location_mode)}</span>
            </div>
            <span class="pill-badge">Saved</span>
          </div>
        `
          )
          .join('')}
      </section>

      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Remote Assignments & Offline Packs</h2>
          <button class="outline-btn" data-nav="assignments">${canEditEverything(user) ? 'Manage All' : 'View All'}</button>
        </div>
        ${(vaultState.assignments || [])
          .slice(0, 3)
          .map((asg) => `
            <div class="list-row">
              <div class="list-row-col">
                <span class="row-title">${esc(asg.title)}</span>
                <span class="row-sub">${esc(asg.subject)} · Due ${esc(asg.due_date)}</span>
              </div>
              <button class="outline-btn" data-jump-assign="${esc(asg.id)}">Open</button>
            </div>
          `)
          .join('')}
      </section>
    </div>
  `;
}

/* --- TIMETABLE & EXAMS (WITH FULL EDIT & DELETE) --- */

function buildTimetableStage(user) {
  const days = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const q = ui.searchQuery.trim().toLowerCase();
  const superEdit = canEditEverything(user) || user.role === 'teacher';

  const slots = (vaultState.timetables || []).filter((slot) => {
    const dayOk = ui.timetableDay === 'All' || slot.day_of_week === ui.timetableDay;
    const searchOk =
      !q ||
      (slot.subject || '').toLowerCase().includes(q) ||
      (slot.topic || '').toLowerCase().includes(q) ||
      (slot.teacher_name || '').toLowerCase().includes(q);
    return dayOk && searchOk;
  });

  const editingSlot = ui.editingTimetableId
    ? (vaultState.timetables || []).find((t) => t.id === ui.editingTimetableId)
    : null;
  const editingExam = ui.editingExamId
    ? (personalState.exams || []).find((x) => x.id === ui.editingExamId)
    : null;

  return `
    <div class="page-header-row">
      <div>
        <h1>Saved Offline Timetable & Exam Dates</h1>
        <p>Automatically stored on every device. ${superEdit ? 'Click Edit on any slot to modify times, rooms, teachers or topics.' : ''}</p>
      </div>
      <span class="pill-badge">${ICONS.check} Auto-Saved Offline</span>
    </div>

    <div class="subtab-bar">
      ${days
        .map((d) => `<button class="subtab-btn ${ui.timetableDay === d ? 'is-active' : ''}" data-tt-day="${d}">${d}</button>`)
        .join('')}
    </div>

    <div class="two-col-grid">
      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Weekly Schedule (${slots.length})</h2>
        </div>

        ${slots
          .map((s) => {
            const canModify = superEdit || s.owner_id === user.id;
            return `
              <div class="list-row" style="flex-wrap:wrap;">
                <div class="list-row-col">
                  <span class="row-title">${esc(s.subject)} · <span class="muted-pill">${esc(s.grade_group)}</span></span>
                  <span class="row-sub">${esc(s.day_of_week)} · ${esc(s.start_time)}–${esc(s.end_time)} · ${esc(
              s.location_mode
            )}</span>
                  <span class="row-sub">${esc(s.topic)} (${esc(s.teacher_name)})</span>
                </div>
                ${
                  canModify
                    ? `
                  <div class="action-cluster">
                    <button class="icon-action-btn" data-edit-tt="${esc(s.id)}">${ICONS.edit} Edit</button>
                    <button class="icon-action-btn danger" data-del-tt="${esc(s.id)}">${ICONS.trash}</button>
                  </div>
                `
                    : ''
                }
              </div>
            `;
          })
          .join('')}

        <form class="form-stack" id="upsert-tt-form" style="margin-top:0.5rem;padding-top:0.85rem;border-top:1px solid var(--border-warm);">
          <div class="panel-head">
            <span class="panel-title" style="font-size:0.92rem;">
              ${editingSlot ? `Editing Slot: ${esc(editingSlot.subject)}` : superEdit ? '+ Add Official Timetable Slot' : '+ Add Personal Study Slot'}
            </span>
            ${editingSlot ? `<button type="button" class="outline-btn" id="cancel-tt-edit">Cancel Edit</button>` : ''}
          </div>
          <input type="hidden" name="id" value="${esc(editingSlot?.id || '')}" />
          <div class="form-grid-2">
            <select class="field-input" name="day_of_week" required>
              ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                .map(
                  (d) => `<option value="${d}" ${editingSlot?.day_of_week === d ? 'selected' : ''}>${d}</option>`
                )
                .join('')}
            </select>
            <input class="field-input" name="subject" value="${esc(editingSlot?.subject || '')}" placeholder="Subject (e.g. Mathematics)" required />
          </div>
          <div class="form-grid-2">
            <input class="field-input" name="start_time" value="${esc(editingSlot?.start_time || '')}" placeholder="Start (e.g. 15:30)" required />
            <input class="field-input" name="end_time" value="${esc(editingSlot?.end_time || '')}" placeholder="End (e.g. 17:00)" required />
          </div>
          <div class="form-grid-2">
            <input class="field-input" name="teacher_name" value="${esc(
              editingSlot?.teacher_name || (superEdit ? user.name : `${user.name} (Self-Study)`)
            )}" placeholder="Teacher Name" required />
            <input class="field-input" name="grade_group" value="${esc(
              editingSlot?.grade_group || user.grade || 'Grade 12'
            )}" placeholder="Grade Group" required />
          </div>
          <input class="field-input" name="topic" value="${esc(editingSlot?.topic || '')}" placeholder="Topic / Focus" required />
          <input class="field-input" name="location_mode" value="${esc(
            editingSlot?.location_mode || ''
          )}" placeholder="Room or Mode (e.g. Studio A / Remote Pack)" required />
          <button class="dark-cta-btn" type="submit">${ICONS.check} ${
    editingSlot ? 'Update Timetable Slot' : 'Save Timetable Slot'
  }</button>
        </form>
      </section>

      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Exam Countdowns</h2>
          <span class="muted-pill">Editable Planner</span>
        </div>
        ${(personalState.exams || [])
          .map(
            (ex) => `
          <div class="list-row">
            <div class="list-row-col">
              <span class="row-title">${esc(ex.title)}</span>
              <span class="row-sub">${esc(ex.subject)} · ${Number(ex.daysAway)} days away</span>
            </div>
            <div class="action-cluster">
              <button class="icon-action-btn" data-edit-exam="${esc(ex.id)}">${ICONS.edit}</button>
              <button class="icon-action-btn danger" data-del-exam="${esc(ex.id)}">${ICONS.trash}</button>
            </div>
          </div>
        `
          )
          .join('')}

        <form class="form-stack" id="upsert-exam-form" style="margin-top:0.5rem;padding-top:0.85rem;border-top:1px solid var(--border-warm);">
          <span class="panel-title" style="font-size:0.9rem;">${editingExam ? 'Edit Exam Countdown' : '+ Add Exam Countdown'}</span>
          <input type="hidden" name="id" value="${esc(editingExam?.id || '')}" />
          <input class="field-input" name="title" value="${esc(editingExam?.title || '')}" placeholder="Exam Paper Title" required />
          <div class="form-grid-2">
            <input class="field-input" name="subject" value="${esc(editingExam?.subject || '')}" placeholder="Subject" required />
            <input class="field-input" type="number" min="1" max="365" name="daysAway" value="${esc(
              editingExam?.daysAway || ''
            )}" placeholder="Days left" required />
          </div>
          <button class="outline-btn" type="submit">${editingExam ? 'Update Countdown' : '+ Add Countdown'}</button>
        </form>
      </section>
    </div>
  `;
}

/* --- REMOTE ASSIGNMENTS, OFFLINE PACKS & SUBMISSIONS (WITH FULL EDIT & DELETE) --- */

function buildAssignmentsStage(user) {
  const canManage = isStaff(user);
  const q = ui.searchQuery.trim().toLowerCase();
  const list = (vaultState.assignments || []).filter(
    (a) => !q || (a.title || '').toLowerCase().includes(q) || (a.subject || '').toLowerCase().includes(q)
  );
  const editingAsg = ui.editingAssignmentId
    ? (vaultState.assignments || []).find((a) => a.id === ui.editingAssignmentId)
    : null;

  return `
    <div class="page-header-row">
      <div>
        <h1>Remote Assignments & Auto-Downloaded Packs</h1>
        <p>Full offline worksheet packs, auto-saved student drafts, and instant editing/marking for educators & Admissions.</p>
      </div>
      ${
        canManage
          ? `<button class="dark-cta-btn" id="toggle-assign-creator">${ICONS.plus} ${
              ui.showAssignCreator || editingAsg ? 'Close Editor' : 'Post Remote Assignment'
            }</button>`
          : ''
      }
    </div>

    ${
      canManage && (ui.showAssignCreator || editingAsg)
        ? `
      <form class="panel-card form-stack" id="upsert-assign-form">
        <div class="panel-head">
          <h2 class="panel-title">${editingAsg ? `Edit Assignment: ${esc(editingAsg.title)}` : 'Publish New Remote Assignment & Offline Pack'}</h2>
          <button type="button" class="outline-btn" id="cancel-assign-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingAsg?.id || '')}" />
        <div class="form-grid-2">
          <input class="field-input" name="title" value="${esc(editingAsg?.title || '')}" placeholder="Assignment Title" required />
          <input class="field-input" name="subject" value="${esc(editingAsg?.subject || 'Mathematics')}" placeholder="Subject" required />
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="grade_group" value="${esc(editingAsg?.grade_group || 'Grade 12')}" placeholder="Grade Group" required />
          <input class="field-input" name="teacher_name" value="${esc(editingAsg?.teacher_name || user.name)}" placeholder="Educator Name" required />
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="due_date" type="date" value="${esc(editingAsg?.due_date || '2026-12-05')}" required />
          <input class="field-input" name="max_marks" type="number" value="${esc(editingAsg?.max_marks || 30)}" min="5" max="200" required />
        </div>
        <textarea class="field-input" name="instructions" rows="2" placeholder="Instructions..." required>${esc(
          editingAsg?.instructions || ''
        )}</textarea>
        <textarea class="field-input" name="offline_pack_content" rows="4" placeholder="Offline Worksheet Questions & Formulas..." required>${esc(
          editingAsg?.offline_pack_content || ''
        )}</textarea>
        <button class="dark-cta-btn" type="submit">${ICONS.sync} ${
            editingAsg ? 'Save Assignment Changes' : 'Publish & Push Offline Pack'
          }</button>
      </form>
    `
        : ''
    }

    <div class="form-stack" style="gap:1rem;">
      ${list
        .map((asg) => {
          const isOpen = ui.expandedAssignmentId === asg.id;
          const allSubs = (vaultState.submissions || []).filter((s) => s.assignment_id === asg.id);
          const targetStuId = user.role === 'parent' ? user.linked_student_id || 'stu-thabo' : user.id;
          const mySub = allSubs.find((s) => s.student_id === targetStuId);
          const draft = personalState.assignmentDrafts?.[asg.id] ?? (mySub ? mySub.answer_text : '');

          return `
            <article class="panel-card">
              <div class="panel-head">
                <div>
                  <span class="pill-badge">${esc(asg.subject)} · ${esc(asg.grade_group)} · ${asg.max_marks} Marks</span>
                  <h2 class="panel-title" style="margin-top:0.35rem;font-size:1.08rem;">${esc(asg.title)}</h2>
                  <p class="row-sub">${esc(asg.teacher_name)} · Due ${esc(asg.due_date)} · ✓ Cached Offline</p>
                </div>
                <div class="action-cluster">
                  ${
                    canManage
                      ? `
                    <button class="icon-action-btn" data-edit-assign="${esc(asg.id)}">${ICONS.edit} Edit</button>
                    <button class="icon-action-btn danger" data-del-assign="${esc(asg.id)}">${ICONS.trash}</button>
                  `
                      : ''
                  }
                  <button class="outline-btn" data-toggle-assign="${esc(asg.id)}">
                    ${isOpen ? 'Hide Pack' : 'Open Offline Pack'}
                  </button>
                </div>
              </div>

              <p style="font-size:0.86rem;line-height:1.5;color:var(--charcoal-soft);">${esc(asg.instructions)}</p>

              ${
                mySub && mySub.status === 'graded'
                  ? `
                <div class="worksheet-box">
                  <strong>Graded Result: ${mySub.marks_awarded} / ${asg.max_marks}</strong>\nFeedback: ${esc(
                      mySub.teacher_feedback
                    )}
                </div>
              `
                  : ''
              }

              ${
                isOpen
                  ? `
                <div class="worksheet-box">${esc(asg.offline_pack_content)}</div>

                ${
                  user.role === 'student'
                    ? `
                  <form class="form-stack submit-work-form" data-assign-id="${esc(asg.id)}">
                    <label style="font-size:0.8rem;font-weight:750;">Your Offline-Saved Working & Answer:</label>
                    <textarea class="field-input draft-textarea" data-draft-id="${esc(
                      asg.id
                    )}" name="answer_text" rows="4" placeholder="Write your solution offline..." required>${esc(
                        draft
                      )}</textarea>
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                      <span class="row-sub">${mySub ? `Status: ${mySub.status.toUpperCase()}` : 'Auto-saved on device'}</span>
                      <button class="dark-cta-btn" type="submit">${ICONS.check} ${
                        mySub ? 'Update Submission' : 'Submit Assignment'
                      }</button>
                    </div>
                  </form>
                `
                    : ''
                }

                ${
                  canManage
                    ? `
                  <div class="form-stack" style="border-top:1px solid var(--border-warm);padding-top:0.85rem;">
                    <strong style="font-size:0.86rem;">Student Submissions (${allSubs.length})</strong>
                    ${
                      allSubs.length === 0
                        ? `<p class="row-sub">No submissions yet.</p>`
                        : allSubs
                            .map(
                              (sub) => `
                          <div class="list-row" style="flex-direction:column;align-items:stretch;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                              <span class="row-title">${esc(sub.student_name)}</span>
                              <div class="action-cluster">
                                <span class="pill-badge">${
                                  sub.status === 'graded' ? `${sub.marks_awarded}/${asg.max_marks}` : 'Awaiting Mark'
                                }</span>
                                <button class="icon-action-btn danger" data-del-sub="${esc(sub.id)}">${ICONS.trash}</button>
                              </div>
                            </div>
                            <p style="font-size:0.83rem;white-space:pre-line;margin:0.35rem 0;">${esc(sub.answer_text)}</p>
                            <form class="form-grid-2 grade-sub-form" data-sub-id="${esc(sub.id)}">
                              <input class="field-input" name="marks_awarded" type="number" min="0" max="${
                                asg.max_marks
                              }" placeholder="Marks / ${asg.max_marks}" value="${sub.marks_awarded ?? ''}" required />
                              <input class="field-input" name="teacher_feedback" placeholder="Feedback..." value="${esc(
                                sub.teacher_feedback || ''
                              )}" required />
                              <button class="dark-cta-btn" type="submit" style="grid-column:1/-1;">Save Mark & Feedback</button>
                            </form>
                          </div>
                        `
                            )
                            .join('')
                    }
                  </div>
                `
                    : ''
                }
              `
                  : ''
              }
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

/* --- COMPLETE OFFLINE STUDY TOOLKIT (EDITABLE NOTES, QUIZZES, FLASHCARDS + TIMER/SCRATCHPAD) --- */

function buildToolkitStage(user) {
  const tabs = [
    { id: 'notes', label: `Notes & Formulas (${(vaultState.notes || []).length})` },
    { id: 'quiz', label: `Auto-Marked Quizzes (${(vaultState.quizzes || []).length})` },
    { id: 'flashcards', label: `3D Flashcards (${(vaultState.flashcards || []).length})` },
    { id: 'focus', label: 'Focus Timer & Scratchpad' }
  ];

  return `
    <div class="page-header-row">
      <div>
        <h1>Offline Study Toolkit</h1>
        <p>Notes & formulas, auto-marked quizzes, 3D flashcards, Pomodoro timer & scratchpad — all synced & editable in-app.</p>
      </div>
    </div>

    <div class="subtab-bar">
      ${tabs
        .map(
          (t) => `<button class="subtab-btn ${ui.toolkitTab === t.id ? 'is-active' : ''}" data-tk-tab="${t.id}">${esc(t.label)}</button>`
        )
        .join('')}
    </div>

    ${ui.toolkitTab === 'notes' ? buildNotesSubstage(user) : ''}
    ${ui.toolkitTab === 'quiz' ? buildQuizSubstage(user) : ''}
    ${ui.toolkitTab === 'flashcards' ? buildFlashcardsSubstage(user) : ''}
    ${ui.toolkitTab === 'focus' ? buildFocusScratchpadSubstage() : ''}
  `;
}

function buildNotesSubstage(user) {
  const subjects = ['All', ...SUBJECT_LIST];
  const q = ui.searchQuery.trim().toLowerCase();
  const canManage = isStaff(user);
  const editingNote = ui.editingNoteId ? (vaultState.notes || []).find((n) => n.id === ui.editingNoteId) : null;

  const notes = (vaultState.notes || []).filter((n) => {
    const subjOk = ui.subjectFilter === 'All' || n.subject === ui.subjectFilter;
    const searchOk =
      !q ||
      (n.title || '').toLowerCase().includes(q) ||
      (n.summary || '').toLowerCase().includes(q) ||
      (n.subject || '').toLowerCase().includes(q);
    return subjOk && searchOk;
  });

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">
      <div class="subtab-bar">
        ${subjects
          .map((s) => `<button class="subtab-btn ${ui.subjectFilter === s ? 'is-active' : ''}" data-subj-filter="${esc(s)}">${esc(s)}</button>`)
          .join('')}
      </div>
      ${
        user.role !== 'visitor'
          ? `<button class="dark-cta-btn" id="toggle-note-modal">${ICONS.plus} ${
              ui.showNoteModal || editingNote ? 'Close Editor' : 'Add Study Note'
            }</button>`
          : ''
      }
    </div>

    ${
      ui.showNoteModal || editingNote
        ? `
      <form class="panel-card form-stack" id="upsert-note-form">
        <div class="panel-head">
          <h2 class="panel-title">${editingNote ? `Edit Note: ${esc(editingNote.title)}` : 'Save Study Note & Formulas'}</h2>
          <button type="button" class="outline-btn" id="cancel-note-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingNote?.id || '')}" />
        <div class="form-grid-2">
          <input class="field-input" name="title" value="${esc(editingNote?.title || '')}" placeholder="Note Title" required />
          <select class="field-input" name="subject">
            ${SUBJECT_LIST.map(
              (s) => `<option value="${esc(s)}" ${editingNote?.subject === s ? 'selected' : ''}>${esc(s)}</option>`
            ).join('')}
          </select>
        </div>
        <textarea class="field-input" name="summary" rows="3" placeholder="Revision explanation..." required>${esc(
          editingNote?.summary || ''
        )}</textarea>
        <textarea class="field-input" name="formulasRaw" rows="3" placeholder="Formulas / key rules (one per line)...">${esc(
          (editingNote?.formulas || []).join('\n')
        )}</textarea>
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Note & Sync</button>
      </form>
    `
        : ''
    }

    <div class="two-col-grid">
      ${notes
        .map((n) => {
          const saved = (personalState.bookmarkedNoteIds || []).includes(n.id);
          return `
            <article class="panel-card">
              <div class="panel-head">
                <span class="pill-badge">${esc(n.subject)}</span>
                <div class="action-cluster">
                  <button class="icon-action-btn" data-bookmark-note="${esc(n.id)}">${saved ? '★ Saved' : '☆ Save'}</button>
                  ${
                    canManage
                      ? `
                    <button class="icon-action-btn" data-edit-note="${esc(n.id)}">${ICONS.edit} Edit</button>
                    <button class="icon-action-btn danger" data-del-note="${esc(n.id)}">${ICONS.trash}</button>
                  `
                      : ''
                  }
                </div>
              </div>
              <h3 class="panel-title">${esc(n.title)}</h3>
              <p style="font-size:0.85rem;line-height:1.55;color:var(--charcoal-soft);">${esc(n.summary)}</p>
              ${
                (n.formulas || []).length
                  ? `<div class="formula-list-box">${n.formulas.map((f) => `<div>• ${esc(f)}</div>`).join('')}</div>`
                  : ''
              }
              <span class="row-sub">By ${esc(n.author_name || 'i-tutor')}</span>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function buildQuizSubstage(user) {
  const canManage = isStaff(user);
  const allQuizzes = vaultState.quizzes || [];
  const subjects = ['All', ...new Set(allQuizzes.map((q) => q.subject))];
  const pool =
    ui.quizState.subject === 'All' ? allQuizzes : allQuizzes.filter((q) => q.subject === ui.quizState.subject);
  const safePool = pool.length ? pool : allQuizzes;
  const idx = safePool.length ? ui.quizState.index % safePool.length : 0;
  const current = safePool[idx];
  const editingQuiz = ui.editingQuizId ? allQuizzes.find((q) => q.id === ui.editingQuizId) : null;

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">
      <div class="subtab-bar">
        ${subjects
          .map(
            (s) => `<button class="subtab-btn ${ui.quizState.subject === s ? 'is-active' : ''}" data-quiz-subj="${esc(s)}">${esc(s)}</button>`
          )
          .join('')}
      </div>
      ${
        canManage
          ? `<button class="dark-cta-btn" id="toggle-quiz-modal">${ICONS.plus} ${
              ui.showQuizModal || editingQuiz ? 'Close Quiz Editor' : 'Add Quiz Question'
            }</button>`
          : ''
      }
    </div>

    ${
      canManage && (ui.showQuizModal || editingQuiz)
        ? `
      <form class="panel-card form-stack" id="upsert-quiz-form">
        <div class="panel-head">
          <h3 class="panel-title">${editingQuiz ? 'Edit Quiz Question' : 'Add New Quiz Question'}</h3>
          <button type="button" class="outline-btn" id="cancel-quiz-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingQuiz?.id || '')}" />
        <div class="form-grid-2">
          <select class="field-input" name="subject">
            ${SUBJECT_LIST.map(
              (s) => `<option value="${esc(s)}" ${editingQuiz?.subject === s ? 'selected' : ''}>${esc(s)}</option>`
            ).join('')}
          </select>
          <input class="field-input" name="topic" value="${esc(editingQuiz?.topic || 'Revision')}" placeholder="Topic" required />
        </div>
        <input class="field-input" name="question" value="${esc(editingQuiz?.question || '')}" placeholder="Question prompt" required />
        <div class="form-grid-2">
          <input class="field-input" name="opt0" value="${esc(editingQuiz?.options?.[0] || '')}" placeholder="Option A (Index 0)" required />
          <input class="field-input" name="opt1" value="${esc(editingQuiz?.options?.[1] || '')}" placeholder="Option B (Index 1)" required />
          <input class="field-input" name="opt2" value="${esc(editingQuiz?.options?.[2] || '')}" placeholder="Option C (Index 2)" required />
          <input class="field-input" name="opt3" value="${esc(editingQuiz?.options?.[3] || '')}" placeholder="Option D (Index 3)" required />
        </div>
        <div class="form-grid-2">
          <select class="field-input" name="correct_index">
            ${[0, 1, 2, 3]
              .map(
                (i) =>
                  `<option value="${i}" ${Number(editingQuiz?.correct_index ?? 0) === i ? 'selected' : ''}>Correct Option: ${
                    ['A (0)', 'B (1)', 'C (2)', 'D (3)'][i]
                  }</option>`
              )
              .join('')}
          </select>
          <input class="field-input" name="explanation" value="${esc(editingQuiz?.explanation || '')}" placeholder="Explanation shown after answering" required />
        </div>
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Quiz Question</button>
      </form>
    `
        : ''
    }

    ${
      !current
        ? `<div class="panel-card"><p class="row-sub">No quiz questions available yet.</p></div>`
        : `
      <div class="panel-card">
        ${
          ui.quizState.finished
            ? `
          <div style="text-align:center;padding:1.25rem;display:flex;flex-direction:column;align-items:center;gap:0.75rem;">
            <span class="pill-badge">Offline Quiz Complete</span>
            <h2 style="font-size:1.5rem;font-weight:850;">Score: ${ui.quizState.correctCount} / ${safePool.length}</h2>
            <p class="row-sub">Your Sunrise Confidence meter has been updated!</p>
            <button class="dark-cta-btn" id="restart-quiz-btn">Practice Again</button>
          </div>
        `
            : `
          <div class="panel-head">
            <span class="pill-badge">${esc(current.subject)} · ${esc(current.topic || 'Practice')}</span>
            <div class="action-cluster">
              <span class="muted-pill">Question ${idx + 1} of ${safePool.length}</span>
              ${
                canManage
                  ? `
                <button class="icon-action-btn" data-edit-quiz="${esc(current.id)}">${ICONS.edit} Edit</button>
                ${
                  allQuizzes.length > 1
                    ? `<button class="icon-action-btn danger" data-del-quiz="${esc(current.id)}">${ICONS.trash}</button>`
                    : ''
                }
              `
                  : ''
              }
            </div>
          </div>
          <h2 style="font-size:1.12rem;font-weight:800;line-height:1.45;">${esc(current.question)}</h2>
          <div class="form-stack">
            ${(current.options || [])
              .map((opt, i) => {
                let cls = 'quiz-choice-btn';
                const ans = Number(current.correct_index ?? current.correctIndex ?? 0);
                if (ui.quizState.picked !== null) {
                  if (i === ans) cls += ' correct';
                  else if (i === ui.quizState.picked) cls += ' wrong';
                }
                return `<button class="${cls}" data-quiz-pick="${i}">${esc(opt)}</button>`;
              })
              .join('')}
          </div>
          ${
            ui.quizState.picked !== null
              ? `
            <div class="worksheet-box">
              <strong>${
                ui.quizState.picked === Number(current.correct_index ?? current.correctIndex ?? 0)
                  ? '✓ Correct!'
                  : 'Explanation:'
              }</strong>\n${esc(current.explanation)}
            </div>
            <button class="dark-cta-btn" id="next-quiz-btn" style="align-self:flex-end;">
              ${idx + 1 >= safePool.length ? 'Finish & Boost Confidence' : 'Next Question →'}
            </button>
          `
              : ''
          }
        `
        }
      </div>
    `
    }
  `;
}

function buildFlashcardsSubstage(user) {
  const cards = vaultState.flashcards || [];
  const card = cards.length ? cards[ui.cardState.index % cards.length] : null;
  const masteredIds = personalState.masteredCardIds || [];
  const masteredCount = cards.filter((c) => masteredIds.includes(c.id)).length;
  const editingCard = ui.editingCardId ? cards.find((c) => c.id === ui.editingCardId) : null;
  const canManage = isStaff(user);

  return `
    <div class="panel-head">
      <span class="pill-badge">${masteredCount} of ${cards.length} Cards Mastered</span>
      <div class="action-cluster">
        ${
          card && canManage
            ? `
          <button class="icon-action-btn" data-edit-card="${esc(card.id)}">${ICONS.edit} Edit Card</button>
          ${cards.length > 1 ? `<button class="icon-action-btn danger" data-del-card="${esc(card.id)}">${ICONS.trash}</button>` : ''}
        `
            : ''
        }
        ${
          user.role !== 'visitor'
            ? `<button class="dark-cta-btn" id="toggle-card-modal">${ICONS.plus} ${
                ui.showCardModal || editingCard ? 'Close Creator' : 'Add Flashcard'
              }</button>`
            : ''
        }
      </div>
    </div>

    ${
      ui.showCardModal || editingCard
        ? `
      <form class="panel-card form-stack" id="upsert-card-form">
        <div class="panel-head">
          <h3 class="panel-title">${editingCard ? 'Edit Flashcard' : 'Create Flashcard'}</h3>
          <button type="button" class="outline-btn" id="cancel-card-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingCard?.id || '')}" />
        <select class="field-input" name="subject">
          ${SUBJECT_LIST.map(
            (s) => `<option value="${esc(s)}" ${editingCard?.subject === s ? 'selected' : ''}>${esc(s)}</option>`
          ).join('')}
        </select>
        <input class="field-input" name="front" value="${esc(editingCard?.front || '')}" placeholder="Front Question / Prompt" required />
        <textarea class="field-input" name="back" rows="2" placeholder="Back Answer / Formula" required>${esc(
          editingCard?.back || ''
        )}</textarea>
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Flashcard & Sync</button>
      </form>
    `
        : ''
    }

    ${
      card
        ? `
      <div class="flashcard-3d-scene" id="flip-card-stage" role="button" tabindex="0" aria-label="Flip flashcard">
        <div class="flashcard-3d-inner ${ui.cardState.flipped ? 'is-flipped' : ''}" id="flashcard-3d-inner">
          <div class="flashcard-face front">
            <span class="pill-badge">${esc(card.subject)} · QUESTION (Tap to Flip 3D)</span>
            <h2 style="font-size:1.18rem;font-weight:800;max-width:560px;line-height:1.45;white-space:pre-line;">
              ${esc(card.front)}
            </h2>
            <span class="row-sub">${masteredIds.includes(card.id) ? '✓ Mastered' : 'Tap card anywhere to flip'}</span>
          </div>
          <div class="flashcard-face back">
            <span class="pill-badge">${esc(card.subject)} · ANSWER</span>
            <h2 style="font-size:1.14rem;font-weight:800;max-width:560px;line-height:1.45;white-space:pre-line;">
              ${esc(card.back)}
            </h2>
            <span class="row-sub">Tap card to flip back</span>
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:0.6rem;flex-wrap:wrap;">
        <button class="outline-btn" id="prev-card-btn">← Previous</button>
        <button class="gold-cta-btn" data-master-card="${esc(card.id)}">
          ${masteredIds.includes(card.id) ? '✓ Mastered (Undo)' : 'Mark Mastered ✓'}
        </button>
        <button class="dark-cta-btn" id="next-card-btn">Next Card →</button>
      </div>
    `
        : ''
    }
  `;
}

function buildFocusScratchpadSubstage() {
  return `
    <div class="two-col-grid">
      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Pomodoro Focus Timer</h2>
          <span class="pill-badge">${personalState.focusMinutesToday || 25}m Focused Today</span>
        </div>
        <div class="timer-readout-big js-timer-readout ${ui.timerRunning ? 'is-ticking' : ''}">${formatClock(
          ui.timerSeconds
        )}</div>
        <div style="display:flex;justify-content:center;gap:0.5rem;flex-wrap:wrap;">
          <button class="dark-cta-btn" data-timer-action="toggle">${ui.timerRunning ? 'Pause' : 'Start Focus'}</button>
          <button class="outline-btn" data-timer-preset="25">25m Deep</button>
          <button class="outline-btn" data-timer-preset="15">15m Sprint</button>
          <button class="outline-btn" data-timer-preset="5">5m Break</button>
        </div>

        <div style="border-top:1px solid var(--border-warm);padding-top:0.85rem;margin-top:0.35rem;">
          <h3 class="panel-title" style="margin-bottom:0.45rem;">Daily Study Checklist</h3>
          ${(personalState.tasks || [])
            .map(
              (item) => `
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div class="checklist-row ${item.done ? 'done' : ''}" data-check-id="${esc(item.id)}" style="flex:1;">
                <span class="check-box-sq">${item.done ? '✓' : ''}</span>
                <span>${esc(item.title)}</span>
              </div>
              <button class="icon-action-btn danger" data-del-task="${esc(item.id)}" style="padding:0.2rem 0.4rem;">✕</button>
            </div>
          `
            )
            .join('')}
          <form class="chat-input-bar" id="add-checklist-form" style="margin-top:0.55rem;">
            <input class="field-input" name="title" placeholder="Add study goal..." required />
            <button class="dark-cta-btn" type="submit">Add</button>
          </form>
        </div>
      </section>

      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Offline Scratchpad & Math Evaluator</h2>
          <span class="muted-pill">Auto-Saved</span>
        </div>
        <textarea class="field-input" id="scratchpad-area" rows="7" placeholder="Write rough calculations, formulas, or essay outlines offline...">${esc(
          personalState.scratchpad || ''
        )}</textarea>

        <form class="chat-input-bar" id="quick-calc-form">
          <input class="field-input" name="expr" placeholder="Quick Math Check e.g. (15600 / 13) * 12" required />
          <button class="outline-btn" type="submit">Evaluate</button>
        </form>
        ${ui.calcOutput ? `<div class="pill-badge" style="align-self:flex-start;">= ${esc(ui.calcOutput)}</div>` : ''}
      </section>
    </div>
  `;
}

/* --- 2-PANE SPLIT MESSENGER (WITH ROOM & MESSAGE EDITING) --- */

function buildMessagesStage(user) {
  if (user.role === 'visitor') {
    return `
      <section class="panel-card">
        <h2 class="panel-title">Direct Teacher Chats & Student Study Groups</h2>
        <p class="row-sub">Apply to join i-tutor to unlock direct 1-on-1 teacher channels and collaborative peer study groups!</p>
        <div><button class="dark-cta-btn" id="visitor-apply-chat">Apply to Join i-tutor</button></div>
      </section>
    `;
  }

  const superEdit = canEditEverything(user);
  const rooms = getVisibleRooms(user);
  const activeRoom = getActiveRoom(user);
  const roomMessages = activeRoom ? (vaultState.messages || []).filter((m) => m.room_id === activeRoom.id) : [];
  const editingRoom = ui.editingRoomId ? rooms.find((r) => r.id === ui.editingRoomId) : null;

  return `
    <div class="page-header-row">
      <div>
        <h1>Direct Teacher Chats & Student Study Groups</h1>
        <p>1-on-1 channels with educators plus peer study groups — queued offline & synced automatically.</p>
      </div>
      <button class="dark-cta-btn" id="toggle-group-creator">${ICONS.plus} ${
    ui.showGroupCreator || editingRoom ? 'Close Channel Editor' : 'Form Study Group'
  }</button>
    </div>

    ${
      ui.showGroupCreator || editingRoom
        ? `
      <form class="panel-card form-stack" id="upsert-room-form">
        <div class="panel-head">
          <h3 class="panel-title">${editingRoom ? `Edit Channel: ${esc(editingRoom.name)}` : 'Create Study Group / Channel'}</h3>
          <button type="button" class="outline-btn" id="cancel-room-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingRoom?.id || '')}" />
        <div class="form-grid-2">
          <input class="field-input" name="name" value="${esc(editingRoom?.name || '')}" placeholder="Group / Channel Name" required />
          <input class="field-input" name="subject" value="${esc(editingRoom?.subject || 'Mathematics')}" placeholder="Subject" required />
        </div>
        <input class="field-input" name="members_label" value="${esc(
          editingRoom?.members_label || `Created by ${user.name}`
        )}" placeholder="Channel subtitle / members description" />
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Channel</button>
      </form>
    `
        : ''
    }

    <div class="messenger-split">
      <aside class="room-list-pane">
        <span class="row-sub" style="font-weight:800;padding:0.2rem 0.35rem;">CHANNELS (${rooms.length})</span>
        ${rooms
          .map(
            (r) => `
          <button class="room-btn ${activeRoom && activeRoom.id === r.id ? 'is-active' : ''}" data-room-id="${esc(r.id)}">
            <div class="avatar-badge">${r.room_type === 'group' ? 'SG' : '1:1'}</div>
            <div style="min-width:0;flex:1;">
              <div class="row-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.name)}</div>
              <div class="row-sub">${esc(r.members_label || r.subject)}</div>
            </div>
          </button>
        `
          )
          .join('')}
      </aside>

      <section class="chat-stage-pane">
        ${
          activeRoom
            ? `
          <div class="panel-head" style="border-bottom:1px solid var(--border-warm);padding-bottom:0.65rem;">
            <div>
              <h2 class="panel-title">${esc(activeRoom.name)}</h2>
              <span class="row-sub">${esc(activeRoom.members_label || activeRoom.subject)}</span>
            </div>
            <div class="action-cluster">
              ${
                superEdit
                  ? `
                <button class="icon-action-btn" data-edit-room="${esc(activeRoom.id)}">${ICONS.edit} Edit Room</button>
                <button class="icon-action-btn danger" data-del-room="${esc(activeRoom.id)}">${ICONS.trash}</button>
              `
                  : `<span class="pill-badge">Auto-Sync</span>`
              }
            </div>
          </div>

          <div class="chat-messages-scroll">
            ${roomMessages
              .map((m) => {
                const mine = m.sender_id === user.id;
                const canModMsg = superEdit || mine;
                if (ui.editingMessageId === m.id) {
                  return `
                    <form class="form-stack edit-msg-form" data-msg-id="${esc(m.id)}">
                      <input class="field-input" name="body" value="${esc(m.body)}" required />
                      <div class="action-cluster">
                        <button class="dark-cta-btn" type="submit">Save</button>
                        <button class="outline-btn" type="button" data-cancel-msg-edit>Cancel</button>
                      </div>
                    </form>
                  `;
                }
                return `
                  <div class="msg-bubble ${mine ? 'mine' : ''}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
                      <span class="msg-author">${esc(m.sender_name)} (${esc(m.sender_role)})</span>
                      ${
                        canModMsg
                          ? `
                        <span class="action-cluster">
                          <button class="icon-action-btn" style="padding:0.12rem 0.35rem;font-size:0.66rem;" data-edit-msg="${esc(
                            m.id
                          )}">Edit</button>
                          <button class="icon-action-btn danger" style="padding:0.12rem 0.35rem;font-size:0.66rem;" data-del-msg="${esc(
                            m.id
                          )}">✕</button>
                        </span>
                      `
                          : ''
                      }
                    </div>
                    <div class="msg-body">${esc(m.body)}</div>
                  </div>
                `;
              })
              .join('')}
          </div>

          <form class="chat-input-bar" id="send-msg-form" data-room-id="${esc(activeRoom.id)}">
            <input class="field-input" name="body" placeholder="Type your message..." required />
            <button class="dark-cta-btn" type="submit">${ICONS.send} Send</button>
          </form>
        `
            : `<p class="row-sub">Select a conversation on the left.</p>`
        }
      </section>
    </div>
  `;
}

/* --- BROADCASTS & ATTENDANCE (WITH FULL EDIT & DELETE) --- */

function buildBroadcastsAttendanceStage(user) {
  const canPost = isStaff(user);
  const students = (vaultState.profiles || []).filter((p) => p.role === 'student');
  const editingBc = ui.editingBroadcastId
    ? (vaultState.broadcasts || []).find((b) => b.id === ui.editingBroadcastId)
    : null;
  const editingAtt = ui.editingAttendanceId
    ? (vaultState.attendance || []).find((a) => a.id === ui.editingAttendanceId)
    : null;

  return `
    <div class="page-header-row">
      <div>
        <h1>School Broadcasts & Offline Class Attendance</h1>
        <p>Official announcements and transparent attendance logs — fully editable by educators & Admissions.</p>
      </div>
    </div>

    <div class="subtab-bar">
      <button class="subtab-btn ${ui.broadcastSubtab === 'announcements' ? 'is-active' : ''}" data-bc-tab="announcements">
        Broadcast Notices (${(vaultState.broadcasts || []).length})
      </button>
      <button class="subtab-btn ${ui.broadcastSubtab === 'attendance' ? 'is-active' : ''}" data-bc-tab="attendance">
        Attendance & Lesson Log (${(vaultState.attendance || []).length})
      </button>
    </div>

    ${
      ui.broadcastSubtab === 'announcements'
        ? `
      ${
        canPost
          ? `
        <form class="panel-card form-stack" id="upsert-broadcast-form">
          <div class="panel-head">
            <h2 class="panel-title">${editingBc ? 'Edit Broadcast Notice' : 'Publish Official Broadcast'}</h2>
            ${editingBc ? `<button type="button" class="outline-btn" id="cancel-bc-edit">Cancel</button>` : ''}
          </div>
          <input type="hidden" name="id" value="${esc(editingBc?.id || '')}" />
          <div class="form-grid-2">
            <input class="field-input" name="title" value="${esc(editingBc?.title || '')}" placeholder="Broadcast Headline" required />
            <select class="field-input" name="audience">
              <option value="students_parents" ${editingBc?.audience === 'students_parents' ? 'selected' : ''}>Students & Parents</option>
              <option value="students" ${editingBc?.audience === 'students' ? 'selected' : ''}>Students Only</option>
              <option value="parents" ${editingBc?.audience === 'parents' ? 'selected' : ''}>Parents Only</option>
            </select>
          </div>
          <textarea class="field-input" name="body" rows="2" placeholder="Announcement message..." required>${esc(
            editingBc?.body || ''
          )}</textarea>
          <button class="dark-cta-btn" type="submit">${ICONS.broadcast} ${
              editingBc ? 'Update Broadcast' : 'Send Broadcast'
            }</button>
        </form>
      `
          : ''
      }

      <div class="form-stack" style="gap:0.85rem;">
        ${(vaultState.broadcasts || [])
          .map(
            (b) => `
          <article class="panel-card">
            <div class="panel-head">
              <span class="pill-badge">${b.priority === 'important' ? '📌 Priority Broadcast' : 'Notice'} · ${esc(b.author_name)}</span>
              ${
                canPost
                  ? `
                <div class="action-cluster">
                  <button class="icon-action-btn" data-edit-bc="${esc(b.id)}">${ICONS.edit} Edit</button>
                  <button class="icon-action-btn danger" data-del-bc="${esc(b.id)}">${ICONS.trash}</button>
                </div>
              `
                  : ''
              }
            </div>
            <h3 class="panel-title">${esc(b.title)}</h3>
            <p style="font-size:0.87rem;line-height:1.5;">${esc(b.body)}</p>
          </article>
        `
          )
          .join('')}
      </div>
    `
        : `
      <div class="two-col-grid">
        ${
          canPost
            ? `
          <form class="panel-card form-stack" id="upsert-attendance-form">
            <div class="panel-head">
              <h2 class="panel-title">${editingAtt ? 'Edit Attendance Record' : 'Log Offline Attendance & Recap'}</h2>
              ${editingAtt ? `<button type="button" class="outline-btn" id="cancel-att-edit">Cancel</button>` : ''}
            </div>
            <input type="hidden" name="id" value="${esc(editingAtt?.id || '')}" />
            <div class="form-grid-2">
              <select class="field-input" name="student_id" required>
                ${students
                  .map(
                    (s) =>
                      `<option value="${esc(s.id)}" ${editingAtt?.student_id === s.id ? 'selected' : ''}>${esc(
                        s.name
                      )} (${esc(s.grade)})</option>`
                  )
                  .join('')}
              </select>
              <select class="field-input" name="status" required>
                <option value="present" ${editingAtt?.status === 'present' ? 'selected' : ''}>Present ✓</option>
                <option value="late" ${editingAtt?.status === 'late' ? 'selected' : ''}>Late ⏱</option>
                <option value="absent" ${editingAtt?.status === 'absent' ? 'selected' : ''}>Absent ✕</option>
              </select>
            </div>
            <div class="form-grid-2">
              <select class="field-input" name="subject">
                ${SUBJECT_LIST.map(
                  (s) => `<option value="${esc(s)}" ${editingAtt?.subject === s ? 'selected' : ''}>${esc(s)}</option>`
                ).join('')}
              </select>
              <input class="field-input" type="date" name="session_date" value="${esc(
                editingAtt?.session_date || '2026-11-25'
              )}" required />
            </div>
            <input class="field-input" name="lesson_note" value="${esc(
              editingAtt?.lesson_note || ''
            )}" placeholder="Lesson recap note..." required />
            <button class="dark-cta-btn" type="submit">${ICONS.check} ${
                editingAtt ? 'Update Attendance' : 'Save Attendance Offline & Sync'
              }</button>
          </form>
        `
            : ''
        }

        <section class="panel-card" style="${canPost ? '' : 'grid-column:1/-1;'}">
          <h2 class="panel-title">Attendance & Tutor Lesson Recaps</h2>
          ${(vaultState.attendance || [])
            .map(
              (a) => `
            <div class="list-row" style="flex-wrap:wrap;">
              <div class="list-row-col">
                <span class="row-title">${esc(a.student_name)} · ${esc(a.subject)}</span>
                <span class="row-sub">${esc(a.session_date)} · ${esc(a.teacher_name)} — "${esc(a.lesson_note)}"</span>
              </div>
              <div class="action-cluster">
                <span class="pill-badge">${esc((a.status || 'present').toUpperCase())}</span>
                ${
                  canPost
                    ? `
                  <button class="icon-action-btn" data-edit-att="${esc(a.id)}">${ICONS.edit}</button>
                  <button class="icon-action-btn danger" data-del-att="${esc(a.id)}">${ICONS.trash}</button>
                `
                    : ''
                }
              </div>
            </div>
          `
            )
            .join('')}
        </section>
      </div>
    `
    }
  `;
}

/* --- PUBLIC TUITION PACKAGES, FEE ESTIMATOR & CONTACTS (FULL PACKAGE + CONTACT EDITOR!) --- */

function buildTuitionContactsStage(user) {
  const info = vaultState.tuitionInfo;
  const contacts = info.contacts || {};
  const plans = info.plans || [];
  const monthlyEst = ui.feeCalcSessions * 4 * ui.feeCalcRate;
  const superEdit = canEditEverything(user);
  const editingPlan = ui.editingPlanId ? plans.find((p) => p.id === ui.editingPlanId) : null;

  return `
    <div class="page-header-row">
      <div>
        <h1>${esc(info.headline || 'Tuition Prices, Fee Estimator & Contacts')}</h1>
        <p>${esc(info.intro || 'Open to everyone — transparent tuition rates, instant fee estimator, and direct academy contact details.')}</p>
      </div>
      <div class="action-cluster">
        ${
          user.role === 'visitor'
            ? `<button class="dark-cta-btn" id="visitor-apply-tuition">${ICONS.plus} Apply to Join i-tutor</button>`
            : ''
        }
        ${
          superEdit
            ? `
          <button class="dark-cta-btn" id="toggle-new-plan-btn">${ICONS.plus} ${
                ui.showNewPlanForm || editingPlan ? 'Close Plan Editor' : 'Add Tuition Package'
              }</button>
          <button class="outline-btn" id="toggle-tuition-editor">${ICONS.edit} ${
                ui.showTuitionEditor ? 'Close Contact Editor' : 'Edit Contacts & Headline'
              }</button>
        `
            : `<span class="pill-badge">Public Access</span>`
        }
      </div>
    </div>

    ${
      superEdit && (ui.showNewPlanForm || editingPlan)
        ? `
      <form class="panel-card form-stack" id="upsert-plan-form">
        <div class="panel-head">
          <h2 class="panel-title">${editingPlan ? `Edit Package: ${esc(editingPlan.name)}` : 'Add New Tuition Package'}</h2>
          <button type="button" class="outline-btn" id="cancel-plan-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingPlan?.id || '')}" />
        <div class="form-grid-2">
          <input class="field-input" name="name" value="${esc(editingPlan?.name || '')}" placeholder="Package Name (e.g. Weekend Exam Clinic)" required />
          <input class="field-input" name="price" value="${esc(editingPlan?.price || '')}" placeholder="Displayed Price (e.g. R650 / month)" required />
        </div>
        <div class="form-grid-2">
          <input class="field-input" type="number" name="numericRate" value="${esc(editingPlan?.numericRate || 650)}" placeholder="Numeric Rate" required />
          <input class="field-input" name="badge" value="${esc(editingPlan?.badge || 'Grades 8 – 12')}" placeholder="Badge (e.g. Most Popular)" required />
        </div>
        <textarea class="field-input" name="featuresRaw" rows="3" placeholder="Package bullet features (one per line)..." required>${esc(
          (editingPlan?.features || []).join('\n')
        )}</textarea>
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Tuition Package & Sync</button>
      </form>
    `
        : ''
    }

    ${
      superEdit && ui.showTuitionEditor
        ? `
      <form class="panel-card form-stack" id="update-tuition-form">
        <h2 class="panel-title">Edit Academy Headline, Intro & Public Contact Details</h2>
        <input class="field-input" name="headline" value="${esc(info.headline || '')}" placeholder="Main Tuition Headline" required />
        <textarea class="field-input" name="intro" rows="2" placeholder="Intro description..." required>${esc(
          info.intro || ''
        )}</textarea>
        <div class="form-grid-2">
          <input class="field-input" name="phone" value="${esc(contacts.phone)}" placeholder="Phone" required />
          <input class="field-input" name="whatsapp" value="${esc(contacts.whatsapp)}" placeholder="WhatsApp" required />
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="email" value="${esc(contacts.email)}" placeholder="Email" required />
          <input class="field-input" name="hours" value="${esc(contacts.hours)}" placeholder="Hours" required />
        </div>
        <input class="field-input" name="address" value="${esc(contacts.address)}" placeholder="Campus Address" required />
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Public Details & Sync</button>
      </form>
    `
        : ''
    }

    <div class="pricing-cards-grid">
      ${plans
        .map(
          (plan) => `
        <article class="tuition-plan-card ${plan.badge === 'Most Popular' ? 'popular' : ''}">
          <div style="display:flex;flex-direction:column;gap:0.4rem;">
            <div class="panel-head">
              <h2 class="panel-title">${esc(plan.name)}</h2>
              <div class="action-cluster">
                <span class="pill-badge">${esc(plan.badge)}</span>
                ${
                  superEdit
                    ? `
                  <button class="icon-action-btn" data-edit-plan="${esc(plan.id)}">${ICONS.edit}</button>
                  ${plans.length > 1 ? `<button class="icon-action-btn danger" data-del-plan="${esc(plan.id)}">${ICONS.trash}</button>` : ''}
                `
                    : ''
                }
              </div>
            </div>
            <div class="plan-price-big">${esc(plan.price)}</div>
            <ul class="plan-bullets">
              ${(plan.features || []).map((f) => `<li>${esc(f)}</li>`).join('')}
            </ul>
          </div>
          <a href="#enquiry-form-card" class="outline-btn" style="text-decoration:none;">Select & Enquire</a>
        </article>
      `
        )
        .join('')}
    </div>

    <div class="two-col-grid">
      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Custom Session Fee Estimator & Contacts</h2>
          <span class="pill-badge">Instant Estimate</span>
        </div>
        <label style="font-size:0.8rem;font-weight:750;">1. Tutoring Format:</label>
        <select class="field-input" id="calc-rate-select">
          <option value="220" ${ui.feeCalcRate === 220 ? 'selected' : ''}>1-on-1 Private Mentoring (R220 / hr)</option>
          <option value="120" ${ui.feeCalcRate === 120 ? 'selected' : ''}>Small-Group Subject Pod (R120 / session)</option>
          <option value="90" ${ui.feeCalcRate === 90 ? 'selected' : ''}>Remote Pack + Live Check-In (R90 / session)</option>
        </select>

        <label style="font-size:0.8rem;font-weight:750;">2. Weekly Sessions: <strong>${ui.feeCalcSessions} sessions / week</strong></label>
        <input type="range" min="1" max="6" value="${ui.feeCalcSessions}" id="calc-sessions-range" />

        <div class="worksheet-box" style="display:flex;justify-content:space-between;align-items:center;">
          <span>Estimated 4-Week Tuition:</span>
          <strong style="font-size:1.28rem;">R${monthlyEst.toLocaleString()} / month</strong>
        </div>

        <div style="border-top:1px solid var(--border-warm);padding-top:0.8rem;display:flex;flex-direction:column;gap:0.36rem;font-size:0.84rem;">
          <strong>i-tutor Academy Direct Contacts</strong>
          <div>📞 Phone: <strong>${esc(contacts.phone)}</strong></div>
          <div>💬 WhatsApp: <strong>${esc(contacts.whatsapp)}</strong></div>
          <div>✉️ Email: <strong>${esc(contacts.email)}</strong></div>
          <div>📍 Address: <strong>${esc(contacts.address)}</strong></div>
          <div>🕒 Hours: <strong>${esc(contacts.hours)}</strong></div>
        </div>
      </section>

      <section class="panel-card" id="enquiry-form-card">
        <h2 class="panel-title">Send Admissions / Tuition Enquiry</h2>
        <p class="row-sub">Admissions can accept your enquiry directly into an active i-tutor account!</p>
        <form class="form-stack" id="public-enquiry-form">
          <input class="field-input" name="full_name" placeholder="Your Full Name (Parent or Student)" required />
          <input class="field-input" name="contact_detail" placeholder="Phone / WhatsApp or Email" required />
          <div class="form-grid-2">
            <input class="field-input" name="student_grade" placeholder="Learner Grade (e.g. Grade 12)" required />
            <select class="field-input" name="selected_plan">
              ${plans.map((p) => `<option value="${esc(p.name)}">${esc(p.name)} (${esc(p.price)})</option>`).join('')}
            </select>
          </div>
          <textarea class="field-input" name="message" rows="3" placeholder="Which subjects do you need help with?" required></textarea>
          <button class="dark-cta-btn" type="submit">${ICONS.send} Submit Enquiry to Admissions</button>
        </form>
      </section>
    </div>
  `;
}

/* ==========================================================================
   6. MAIN SHELL RENDERER & EVENT WIRING
   ========================================================================== */

function renderApp(opts = {}) {
  applyTheme();
  const rootEl = document.getElementById('app');
  if (!rootEl) return;

  const prevScrollY = opts.preserveScroll !== false ? window.scrollY : 0;

  const user = getActiveUser();
  if (!user) {
    lastAnimatedKey = 'auth';
    renderAuthPortal(rootEl);
    return;
  }

  const offline = isOfflineActive();
  const outboxCount = loadOutbox().length;
  const avgConf = getOverallConfidence(personalState);
  const visibleRooms = getVisibleRooms(user);
  const pendingAdmissions = getPendingAdmissionsCount();
  const superEdit = canEditEverything(user);

  const routeKey = `${user.id}:${ui.view}:${ui.toolkitTab}:${ui.broadcastSubtab}`;
  const shouldAnimateStage = routeKey !== lastAnimatedKey;
  lastAnimatedKey = routeKey;

  const navItems = [
    { id: 'overview', label: 'Overview Hub', short: 'Hub', icon: ICONS.home, badge: '' },
    ...(superEdit
      ? [
          {
            id: 'admissions',
            label: 'Admissions & Accounts',
            short: pendingAdmissions ? `Admissions (${pendingAdmissions})` : 'Admissions',
            icon: ICONS.users,
            badge: pendingAdmissions ? `${pendingAdmissions} New` : `${(vaultState.profiles || []).length}`
          }
        ]
      : []),
    { id: 'timetable', label: 'Timetable & Exams', short: 'Schedule', icon: ICONS.timetable, badge: String(vaultState.timetables.length) },
    { id: 'assignments', label: 'Remote Assignments', short: 'Tasks', icon: ICONS.assignment, badge: String(vaultState.assignments.length) },
    { id: 'toolkit', label: 'Offline Study Toolkit', short: 'Toolkit', icon: ICONS.toolkit, badge: '4 Tools' },
    { id: 'messages', label: 'Chats & Study Groups', short: 'Chats', icon: ICONS.messages, badge: visibleRooms.length ? String(visibleRooms.length) : '' },
    { id: 'broadcasts', label: 'Broadcasts & Attendance', short: 'Broadcasts', icon: ICONS.broadcast, badge: String(vaultState.broadcasts.length) },
    { id: 'tuition', label: 'Tuition Prices & Contact', short: 'Tuition', icon: ICONS.tuition, badge: superEdit ? 'Edit' : 'Open' },
    { id: 'account', label: user.role === 'visitor' ? 'Join / Sign In' : 'My Account', short: 'Account', icon: ICONS.user, badge: '' }
  ];

  let centerHTML = '';
  if (ui.view === 'overview') centerHTML = buildOverviewStage(user);
  else if (ui.view === 'admissions') centerHTML = buildAdmissionsStage(user);
  else if (ui.view === 'timetable') centerHTML = buildTimetableStage(user);
  else if (ui.view === 'assignments') centerHTML = buildAssignmentsStage(user);
  else if (ui.view === 'toolkit') centerHTML = buildToolkitStage(user);
  else if (ui.view === 'messages') centerHTML = buildMessagesStage(user);
  else if (ui.view === 'broadcasts') centerHTML = buildBroadcastsAttendanceStage(user);
  else if (ui.view === 'tuition') centerHTML = buildTuitionContactsStage(user);
  else if (ui.view === 'account') centerHTML = buildMyAccountStage(user);

  const navButtonsMarkup = (uidSuffix) =>
    navItems
      .map(
        (item) => `
      <button class="nav-item-btn ${ui.view === item.id ? 'is-active' : ''}" data-nav="${item.id}" data-nav-src="${uidSuffix}">
        <span class="nav-item-left">${item.icon} <span>${esc(item.label)}</span></span>
        ${item.badge ? `<span class="nav-badge">${esc(item.badge)}</span>` : ''}
      </button>
    `
      )
      .join('');

  rootEl.innerHTML = `
    <div class="workspace-shell">
      <!-- ZONE 1: LEFT NAVIGATION RAIL (DESKTOP) -->
      <aside class="sidebar-rail">
        <div>
          <button class="brand-header-btn" data-nav="overview" title="Go to Overview Hub">
            <div class="sidebar-emblem-wrap">
              ${renderEmblemSVG({ animated: false, uid: 'sidebar', className: 'brand-emblem-svg' })}
            </div>
            <div>
              <div class="brand-title"><span class="gold-i">i</span>-tutor</div>
              <div class="brand-sub">Confidence in learning</div>
            </div>
          </button>

          <!-- SIGNED-IN ACCOUNT CARD -->
          <div class="account-rail-card">
            <div class="account-rail-top">
              <div class="account-avatar-gold">${esc(initials(user.name))}</div>
              <div style="min-width:0;flex:1;">
                <div style="font-size:0.84rem;font-weight:800;color:#F8F3EC;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${esc(user.name)}
                </div>
                <div style="font-size:0.69rem;color:var(--gold);font-weight:750;text-transform:uppercase;">
                  ${esc(user.role)} ${superEdit ? '· Full Editor' : ''}
                </div>
              </div>
            </div>
            <div class="mini-btn-row">
              <button class="rail-mini-btn" data-nav="account">My Account</button>
              <button class="rail-mini-btn" data-action-signout="1">Switch / Out</button>
            </div>
          </div>

          <nav class="sidebar-nav" aria-label="Main navigation">
            <div class="nav-section-label">Workspace</div>
            ${navButtonsMarkup('rail')}
          </nav>
        </div>

        <div class="sidebar-footer">
          <div class="offline-vault-box">
            <div class="vault-status-row">
              <span><span class="dot-indicator ${offline ? 'offline' : ''}"></span>${
    offline ? 'Offline Mode Active' : 'Online · Auto-Synced'
  }</span>
              ${outboxCount ? `<span class="nav-badge">${outboxCount} Queued</span>` : ''}
            </div>
            <div class="mini-btn-row">
              <button class="rail-mini-btn" data-action-sync="1">Sync Now</button>
              <button class="rail-mini-btn" data-action-toggle-offline="1">${offline ? 'Go Online' : 'Test Offline'}</button>
            </div>
          </div>

          <div class="mini-btn-row">
            <button class="rail-mini-btn" data-action-night="1">${
              sessionState.theme === 'night' ? '☀ Cream Theme' : '☾ Night Study'
            }</button>
            <button class="rail-mini-btn" data-action-replay="1">↻ 10s Intro</button>
          </div>
        </div>
      </aside>

      <!-- ZONE 2: WIDE ADAPTIVE MAIN STAGE -->
      <div class="main-stage">
        <header class="stage-topbar">
          <div class="topbar-left-group">
            <button class="mobile-menu-trigger" id="btn-open-mobile-drawer" aria-label="Open full workspace menu">
              ${ICONS.menu}
            </button>

            <div class="mobile-brand-cluster" data-nav="overview" style="cursor:pointer;">
              <div class="mobile-emblem-mini">${renderEmblemSVG({ animated: false, uid: 'mob', className: 'brand-emblem-svg' })}</div>
              <strong class="mobile-brand-word"><span style="color:var(--gold-deep);">i</span>-tutor</strong>
            </div>
          </div>

          <div class="search-box-wrap desktop-only-search">
            <span class="search-icon-pos">${ICONS.search}</span>
            <input
              type="search"
              class="global-search-input"
              id="global-search-input"
              placeholder="Search accounts, offline notes, timetable, tasks..."
              value="${esc(ui.searchQuery)}"
            />
          </div>

          <div class="topbar-actions">
            <button
              class="mobile-search-toggle ${ui.mobileSearchOpen || ui.searchQuery ? 'is-open' : ''}"
              id="btn-toggle-mobile-search"
              aria-label="Search workspace"
              title="Search"
            >
              ${ICONS.search}
            </button>

            ${
              superEdit
                ? `<button class="gold-cta-btn hide-label-mobile" data-nav="admissions" title="Admissions (${pendingAdmissions})">
                    ${ICONS.users}<span>Admissions (${pendingAdmissions})</span>
                  </button>`
                : `<button class="gold-cta-btn hide-label-mobile" data-nav="tuition" title="Prices & Contact">
                    ${ICONS.tuition}<span>Prices & Contact</span>
                  </button>`
            }

            <button class="outline-btn" data-action-toggle-offline="1" title="Toggle offline simulation">
              <span class="dot-indicator ${offline ? 'offline' : ''}"></span>
              <span>${offline ? `Offline (${outboxCount})` : 'Synced'}</span>
            </button>

            <button class="outline-btn" data-action-signout="1" title="Switch account or sign out">
              ${ICONS.logout}
              <span>${user.role === 'visitor' ? 'Join' : 'Switch'}</span>
            </button>
          </div>
        </header>

        <!-- EXPANDABLE MOBILE SEARCH DRAWER -->
        <div class="mobile-search-drawer ${ui.mobileSearchOpen || ui.searchQuery ? 'is-open' : ''}">
          <div class="search-box-wrap">
            <span class="search-icon-pos">${ICONS.search}</span>
            <input
              type="search"
              class="global-search-input"
              id="mobile-search-input"
              placeholder="Search accounts, notes, schedule, tasks..."
              value="${esc(ui.searchQuery)}"
            />
          </div>
        </div>

        <!-- HORIZONTAL QUICK-JUMP STRIP ON MOBILE (ZERO CLIPPING, ALL 9 AREAS REACHABLE IN 1 TAP) -->
        <nav class="mobile-quick-strip" aria-label="Quick section jump">
          ${navItems
            .map(
              (item) => `
            <button class="quick-strip-pill ${ui.view === item.id ? 'is-active' : ''}" data-nav="${item.id}">
              ${item.icon}<span>${esc(item.short)}</span>
            </button>
          `
            )
            .join('')}
        </nav>

        <main class="stage-body ${shouldAnimateStage ? 'is-entering' : ''}">
          ${centerHTML}
        </main>
      </div>

      <!-- ZONE 3: RIGHT CONTEXTUAL LIVE WIDGET RAIL -->
      <aside class="context-rail">
        <section class="widget-card">
          <div class="panel-head">
            <span class="panel-title" style="font-size:0.9rem;">Sunrise Confidence</span>
            <span class="pill-badge">${avgConf}%</span>
          </div>
          ${renderSunriseGaugeSVG(avgConf)}
          <button class="outline-btn" data-open-toolkit="quiz">${ICONS.quiz} Practice Quick Quiz</button>
        </section>

        <section class="widget-card">
          <div class="panel-head">
            <span class="panel-title" style="font-size:0.9rem;">Live Focus Timer</span>
            <span class="muted-pill">${ui.timerRunning ? 'Ticking' : 'Ready'}</span>
          </div>
          <div class="timer-readout-big js-timer-readout ${ui.timerRunning ? 'is-ticking' : ''}" style="font-size:1.85rem;">${formatClock(
            ui.timerSeconds
          )}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;">
            <button class="dark-cta-btn" data-timer-action="toggle" style="padding:0.48rem;">
              ${ui.timerRunning ? 'Pause' : 'Start'}
            </button>
            <button class="outline-btn" data-timer-preset="25" style="padding:0.48rem;">Reset 25m</button>
          </div>
        </section>

        <section class="widget-card">
          <div class="panel-head">
            <span class="panel-title" style="font-size:0.9rem;">Today's Study Checklist</span>
          </div>
          ${(personalState.tasks || [])
            .slice(0, 4)
            .map(
              (c) => `
            <div class="checklist-row ${c.done ? 'done' : ''}" data-check-id="${esc(c.id)}">
              <span class="check-box-sq">${c.done ? '✓' : ''}</span>
              <span>${esc(c.title)}</span>
            </div>
          `
            )
            .join('')}
          <button class="outline-btn" data-action-export="1" style="margin-top:0.35rem;">
            ${ICONS.download} Export Offline Backup
          </button>
        </section>
      </aside>
    </div>

    <!-- ANIMATED SLIDE-OUT MOBILE MENU DRAWER -->
    <div class="mobile-drawer-backdrop ${ui.mobileDrawerOpen ? 'is-open' : ''}" id="mobile-drawer-backdrop"></div>
    <aside class="mobile-drawer-panel ${ui.mobileDrawerOpen ? 'is-open' : ''}" id="mobile-drawer-panel" aria-label="Mobile menu drawer">
      <div>
        <div class="drawer-head-row">
          <div style="display:flex;align-items:center;gap:0.55rem;">
            <div style="width:36px;height:36px;">${renderEmblemSVG({ animated: false, uid: 'drawer', className: 'brand-emblem-svg' })}</div>
            <div>
              <div class="brand-title" style="font-size:1.05rem;"><span class="gold-i">i</span>-tutor</div>
              <div class="brand-sub">Confidence in learning</div>
            </div>
          </div>
          <button class="drawer-close-btn" id="btn-close-mobile-drawer" aria-label="Close menu">${ICONS.close}</button>
        </div>

        <div class="account-rail-card" style="margin-top:0.75rem;">
          <div class="account-rail-top">
            <div class="account-avatar-gold">${esc(initials(user.name))}</div>
            <div style="min-width:0;flex:1;">
              <div style="font-size:0.84rem;font-weight:800;color:#F8F3EC;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${esc(user.name)}
              </div>
              <div style="font-size:0.68rem;color:var(--gold);font-weight:750;text-transform:uppercase;">
                ${esc(user.role)} ${superEdit ? '· Full Editor' : ''}
              </div>
            </div>
          </div>
          <div class="mini-btn-row">
            <button class="rail-mini-btn" data-nav="account">My Account</button>
            <button class="rail-mini-btn" data-action-signout="1">Switch / Out</button>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Drawer navigation">
          <div class="nav-section-label">All Workspaces</div>
          ${navButtonsMarkup('drawer')}
        </nav>
      </div>

      <div class="sidebar-footer" style="margin-top:0.85rem;">
        <div class="offline-vault-box">
          <div class="vault-status-row">
            <span><span class="dot-indicator ${offline ? 'offline' : ''}"></span>${
    offline ? 'Offline Mode Active' : 'Online · Auto-Synced'
  }</span>
            ${outboxCount ? `<span class="nav-badge">${outboxCount} Queued</span>` : ''}
          </div>
          <div class="mini-btn-row">
            <button class="rail-mini-btn" data-action-sync="1">Sync Now</button>
            <button class="rail-mini-btn" data-action-toggle-offline="1">${offline ? 'Go Online' : 'Test Offline'}</button>
          </div>
        </div>

        <div class="mini-btn-row">
          <button class="rail-mini-btn" data-action-night="1">${
            sessionState.theme === 'night' ? '☀ Cream Theme' : '☾ Night Study'
          }</button>
          <button class="rail-mini-btn" data-action-export="1">⬇ Backup</button>
        </div>
        <button class="rail-mini-btn" data-action-replay="1" style="width:100%;justify-content:center;">↻ Replay 10s Rising-Sun Intro</button>
      </div>
    </aside>

    <!-- MOBILE LABELED 5-TAB BOTTOM BAR -->
    <nav class="mobile-tabbar" aria-label="Mobile bottom navigation">
      <button class="mob-tab-btn ${ui.view === 'overview' ? 'is-active' : ''}" data-nav="overview">
        ${ICONS.home}<span>Hub</span>
      </button>
      ${
        superEdit
          ? `<button class="mob-tab-btn ${ui.view === 'admissions' ? 'is-active' : ''}" data-nav="admissions">
              ${ICONS.users}<span>Admissions</span>
            </button>`
          : `<button class="mob-tab-btn ${ui.view === 'timetable' ? 'is-active' : ''}" data-nav="timetable">
              ${ICONS.timetable}<span>Schedule</span>
            </button>`
      }
      <button class="mob-tab-btn ${ui.view === 'assignments' ? 'is-active' : ''}" data-nav="assignments">
        ${ICONS.assignment}<span>Tasks</span>
      </button>
      <button class="mob-tab-btn ${ui.view === 'toolkit' ? 'is-active' : ''}" data-nav="toolkit">
        ${ICONS.toolkit}<span>Toolkit</span>
      </button>
      <button class="mob-tab-btn" id="mob-tab-more">
        ${ICONS.menu}<span>Menu</span>
      </button>
    </nav>

    <div id="live-toast-host">
      ${ui.toast ? `<div class="toast-banner" role="status">${esc(ui.toast)}</div>` : ''}
    </div>
  `;

  bindWorkspaceEvents(user);

  if (opts.preserveScroll !== false && !shouldAnimateStage && prevScrollY > 0) {
    window.scrollTo(0, prevScrollY);
  }
}

function signOutToPortal(defaultTab = 'signin') {
  sessionState.currentUserId = null;
  saveSession(sessionState);
  ui.authTab = defaultTab;
  ui.authError = '';
  ui.authSuccess = '';
  renderApp();
}

function bindWorkspaceEvents(user) {
  // Mobile Slide-Out Drawer controls
  const openDrawer = () => {
    ui.mobileDrawerOpen = true;
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    const panel = document.getElementById('mobile-drawer-panel');
    if (backdrop) backdrop.classList.add('is-open');
    if (panel) panel.classList.add('is-open');
  };
  const closeDrawer = () => {
    ui.mobileDrawerOpen = false;
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    const panel = document.getElementById('mobile-drawer-panel');
    if (backdrop) backdrop.classList.remove('is-open');
    if (panel) panel.classList.remove('is-open');
  };

  const btnOpenDrawer = document.getElementById('btn-open-mobile-drawer');
  if (btnOpenDrawer) btnOpenDrawer.addEventListener('click', openDrawer);
  const mobTabMore = document.getElementById('mob-tab-more');
  if (mobTabMore) mobTabMore.addEventListener('click', openDrawer);
  const btnCloseDrawer = document.getElementById('btn-close-mobile-drawer');
  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeDrawer);
  const drawerBackdrop = document.getElementById('mobile-drawer-backdrop');
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

  // Mobile Expandable Search toggle
  const btnMobSearch = document.getElementById('btn-toggle-mobile-search');
  if (btnMobSearch) {
    btnMobSearch.addEventListener('click', () => {
      ui.mobileSearchOpen = !ui.mobileSearchOpen;
      renderApp({ preserveScroll: true });
      if (ui.mobileSearchOpen) {
        const mobInput = document.getElementById('mobile-search-input');
        if (mobInput) mobInput.focus();
      }
    });
  }

  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.view = el.getAttribute('data-nav');
      ui.mobileDrawerOpen = false;
      renderApp({ preserveScroll: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-open-toolkit]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.view = 'toolkit';
      ui.toolkitTab = el.getAttribute('data-open-toolkit');
      ui.mobileDrawerOpen = false;
      renderApp({ preserveScroll: false });
    });
  });

  document.querySelectorAll('[data-jump-assign]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.view = 'assignments';
      ui.expandedAssignmentId = el.getAttribute('data-jump-assign');
      ui.mobileDrawerOpen = false;
      renderApp({ preserveScroll: false });
    });
  });

  // Sign out / Switch account / Visitor apply buttons
  document.querySelectorAll('[data-action-signout]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.mobileDrawerOpen = false;
      signOutToPortal('signin');
    });
  });

  ['btn-signout-main', 'btn-go-signin-portal'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => signOutToPortal('signin'));
  });

  ['btn-go-join-portal', 'visitor-apply-cta', 'visitor-apply-tuition', 'visitor-apply-chat'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => signOutToPortal('join'));
  });

  const quickNewAssign = document.getElementById('quick-new-assign-btn');
  if (quickNewAssign) {
    quickNewAssign.addEventListener('click', () => {
      ui.view = 'assignments';
      ui.showAssignCreator = true;
      renderApp({ preserveScroll: false });
    });
  }

  // Global search (desktop + mobile expandable search bar)
  ['global-search-input', 'mobile-search-input'].forEach((inputId) => {
    const searchInput = document.getElementById(inputId);
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        ui.searchQuery = e.target.value;
        const pos = e.target.selectionStart;
        if (ui.view === 'overview' && ui.searchQuery.trim().length > 1) {
          ui.view = canEditEverything(user) ? 'admissions' : 'toolkit';
        }
        renderApp({ preserveScroll: true });
        const nextInput = document.getElementById(inputId);
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(pos, pos);
        }
      });
    }
  });

  // Sync & Offline controls (desktop rail + mobile drawer + topbar)
  document.querySelectorAll('[data-action-sync]').forEach((syncBtn) => {
    syncBtn.addEventListener('click', async () => {
      ui.mobileDrawerOpen = false;
      const res = await syncWithServer({ simulateOffline: sessionState.simulateOffline });
      if (res.vault) vaultState = res.vault;
      renderApp({ preserveScroll: true });
      showToast(res.status === 'synced' ? 'Synced with cloud database!' : 'Offline mode active — data stored locally.');
    });
  });

  document.querySelectorAll('[data-action-toggle-offline]').forEach((el) => {
    el.addEventListener('click', async () => {
      sessionState.simulateOffline = !sessionState.simulateOffline;
      saveSession(sessionState);
      if (!sessionState.simulateOffline) {
        const res = await syncWithServer({ simulateOffline: false });
        if (res.vault) vaultState = res.vault;
        renderApp({ preserveScroll: true });
        showToast('Back Online! Queued offline edits synced automatically.');
      } else {
        renderApp({ preserveScroll: true });
        showToast('Offline Mode ON: All edits & approvals queue locally.');
      }
    });
  });

  document.querySelectorAll('[data-action-night]').forEach((nightBtn) => {
    nightBtn.addEventListener('click', () => {
      sessionState.theme = sessionState.theme === 'night' ? 'light' : 'night';
      saveSession(sessionState);
      renderApp({ preserveScroll: true });
    });
  });

  document.querySelectorAll('[data-action-replay]').forEach((replayBtn) => {
    replayBtn.addEventListener('click', () => {
      ui.mobileDrawerOpen = false;
      const rootEl = document.getElementById('app');
      runAnimatedSplash(rootEl, () => renderApp({ preserveScroll: false }));
    });
  });

  document.querySelectorAll('[data-action-export]').forEach((exportBtn) => {
    exportBtn.addEventListener('click', () => {
      ui.mobileDrawerOpen = false;
      const payload = JSON.stringify({ vault: vaultState, personal: personalState }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'i-tutor-offline-vault.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Offline backup downloaded!');
    });
  });

  // --- ADMISSIONS & ACCOUNT EVENTS ---
  document.querySelectorAll('[data-role-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.roleFilter = btn.getAttribute('data-role-filter');
      renderApp();
    });
  });

  const toggleNewAccBtn = document.getElementById('btn-toggle-new-account');
  if (toggleNewAccBtn) {
    toggleNewAccBtn.addEventListener('click', () => {
      ui.editingAccountId = null;
      ui.showNewAccountForm = !ui.showNewAccountForm;
      renderApp();
    });
  }

  const cancelAccEditBtn = document.getElementById('btn-cancel-account-edit');
  if (cancelAccEditBtn) {
    cancelAccEditBtn.addEventListener('click', () => {
      ui.editingAccountId = null;
      ui.showNewAccountForm = false;
      renderApp();
    });
  }

  document.querySelectorAll('[data-edit-acc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingAccountId = btn.getAttribute('data-edit-acc');
      ui.showNewAccountForm = false;
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-approve-acc]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-approve-acc');
      const target = (vaultState.profiles || []).find((p) => p.id === id);
      if (!target) return;
      const updated = { ...target, status: 'active' };
      await performActionAndSync('UPSERT_ACCOUNT', updated);
      await enrollAcceptedUserInRooms(updated);
      showToast(`Accepted & activated ${target.name}! They can now sign in with full access.`);
    });
  });

  document.querySelectorAll('[data-decline-acc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-decline-acc');
      const target = (vaultState.profiles || []).find((p) => p.id === id);
      if (!target) return;
      performActionAndSync('UPSERT_ACCOUNT', { ...target, status: 'declined' }, `Application marked declined.`);
    });
  });

  document.querySelectorAll('[data-del-acc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      performActionAndSync('DELETE_ACCOUNT', { id: btn.getAttribute('data-del-acc') }, 'Account removed.');
    });
  });

  const upsertAccForm = document.getElementById('upsert-account-form');
  if (upsertAccForm) {
    upsertAccForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(upsertAccForm);
      const existingId = fd.get('id');
      const prev = existingId ? (vaultState.profiles || []).find((p) => p.id === existingId) : null;
      const subjects = String(fd.get('subjectsRaw') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const profile = {
        ...(prev || {}),
        id: existingId || `acc-${Date.now()}`,
        name: fd.get('name'),
        role: fd.get('role'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        pin: fd.get('pin') || '1234',
        status: fd.get('status') || 'active',
        grade: fd.get('grade'),
        subtitle: fd.get('subtitle') || `${fd.get('grade')} · ${fd.get('role')}`,
        subjects,
        selected_plan: fd.get('selected_plan'),
        notes: fd.get('notes')
      };
      ui.editingAccountId = null;
      ui.showNewAccountForm = false;
      await performActionAndSync('UPSERT_ACCOUNT', profile);
      if (profile.status === 'active') {
        await enrollAcceptedUserInRooms(profile);
      }
      showToast(`Account saved for ${profile.name}!`);
    });
  }

  // Enquiries convert / edit / delete
  document.querySelectorAll('[data-convert-eq]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const eq = (vaultState.enquiries || []).find((x) => x.id === btn.getAttribute('data-convert-eq'));
      if (!eq) return;
      const isEmail = (eq.contact_detail || '').includes('@');
      const newAcc = {
        id: `acc-${Date.now()}`,
        name: eq.full_name,
        role: eq.role_requested || 'student',
        subtitle: `${eq.student_grade || 'Learner'} · Enrolled via Admissions`,
        grade: eq.student_grade || 'Grade 12',
        pin: '1234',
        email: isEmail ? eq.contact_detail : `${eq.full_name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@student.i-tutor.academy`,
        phone: isEmail ? '' : eq.contact_detail,
        status: 'active',
        subjects: ['Mathematics', 'Physical Sciences'],
        selected_plan: eq.selected_plan || '3-Subject Core Package',
        linked_student_id: '',
        notes: eq.message || ''
      };
      await performActionAndSync('UPSERT_ACCOUNT', newAcc);
      await performActionAndSync('UPSERT_ENQUIRY', { ...eq, status: 'accepted' });
      await enrollAcceptedUserInRooms(newAcc);
      showToast(`Accepted ${newAcc.name} & created active account (PIN: 1234)!`);
    });
  });

  document.querySelectorAll('[data-edit-eq]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingEnquiryId = btn.getAttribute('data-edit-eq');
      renderApp();
    });
  });

  document.querySelectorAll('[data-cancel-eq]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingEnquiryId = null;
      renderApp();
    });
  });

  document.querySelectorAll('.edit-enquiry-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = form.getAttribute('data-eq-id');
      const prev = (vaultState.enquiries || []).find((x) => x.id === id);
      const fd = new FormData(form);
      ui.editingEnquiryId = null;
      performActionAndSync(
        'UPSERT_ENQUIRY',
        {
          ...(prev || {}),
          id,
          full_name: fd.get('full_name'),
          contact_detail: fd.get('contact_detail'),
          student_grade: fd.get('student_grade'),
          selected_plan: fd.get('selected_plan'),
          message: fd.get('message')
        },
        'Enquiry updated!'
      );
    });
  });

  document.querySelectorAll('[data-del-eq]').forEach((btn) => {
    btn.addEventListener('click', () => {
      performActionAndSync('DELETE_ENQUIRY', { id: btn.getAttribute('data-del-eq') }, 'Enquiry deleted.');
    });
  });

  // My Account self-update
  const myProfileForm = document.getElementById('my-profile-form');
  if (myProfileForm) {
    myProfileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(myProfileForm);
      const subjects = String(fd.get('subjectsRaw') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      performActionAndSync(
        'UPSERT_ACCOUNT',
        {
          ...user,
          name: fd.get('name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          pin: fd.get('pin') || '1234',
          grade: fd.get('grade'),
          subtitle: fd.get('subtitle'),
          subjects
        },
        'Your account profile has been updated!'
      );
    });
  }

  // --- TIMETABLE & EXAM EVENTS ---
  document.querySelectorAll('[data-tt-day]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.timetableDay = el.getAttribute('data-tt-day');
      renderApp();
    });
  });

  document.querySelectorAll('[data-edit-tt]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.editingTimetableId = el.getAttribute('data-edit-tt');
      renderApp();
    });
  });

  const cancelTtEdit = document.getElementById('cancel-tt-edit');
  if (cancelTtEdit) {
    cancelTtEdit.addEventListener('click', () => {
      ui.editingTimetableId = null;
      renderApp();
    });
  }

  document.querySelectorAll('[data-del-tt]').forEach((el) => {
    el.addEventListener('click', () => {
      performActionAndSync('DELETE_TIMETABLE', { id: el.getAttribute('data-del-tt') }, 'Timetable slot deleted.');
    });
  });

  const upsertTtForm = document.getElementById('upsert-tt-form');
  if (upsertTtForm) {
    upsertTtForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertTtForm);
      const existingId = fd.get('id');
      const official = isStaff(user);
      ui.editingTimetableId = null;
      performActionAndSync(
        'UPSERT_TIMETABLE',
        {
          id: existingId || `tt-${Date.now()}`,
          day_of_week: fd.get('day_of_week'),
          start_time: fd.get('start_time'),
          end_time: fd.get('end_time'),
          subject: fd.get('subject'),
          topic: fd.get('topic'),
          teacher_name: fd.get('teacher_name'),
          location_mode: fd.get('location_mode'),
          grade_group: fd.get('grade_group'),
          owner_id: official ? null : user.id,
          is_official: official
        },
        existingId ? 'Timetable slot updated!' : 'Saved to offline timetable!'
      );
    });
  }

  document.querySelectorAll('[data-edit-exam]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingExamId = btn.getAttribute('data-edit-exam');
      renderApp();
    });
  });

  document.querySelectorAll('[data-del-exam]').forEach((btn) => {
    btn.addEventListener('click', () => {
      personalState.exams = (personalState.exams || []).filter((x) => x.id !== btn.getAttribute('data-del-exam'));
      savePersonal(personalState);
      renderApp();
    });
  });

  const upsertExamForm = document.getElementById('upsert-exam-form');
  if (upsertExamForm) {
    upsertExamForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertExamForm);
      const id = fd.get('id');
      if (id) {
        const idx = personalState.exams.findIndex((x) => x.id === id);
        if (idx >= 0) {
          personalState.exams[idx] = {
            id,
            title: fd.get('title'),
            subject: fd.get('subject'),
            daysAway: Number(fd.get('daysAway')) || 14
          };
        }
      } else {
        personalState.exams.push({
          id: `ex-${Date.now()}`,
          title: fd.get('title'),
          subject: fd.get('subject'),
          daysAway: Number(fd.get('daysAway')) || 14
        });
      }
      ui.editingExamId = null;
      savePersonal(personalState);
      showToast('Exam countdown saved!');
    });
  }

  // --- ASSIGNMENTS EVENTS ---
  const toggleAssignCreator = document.getElementById('toggle-assign-creator');
  if (toggleAssignCreator) {
    toggleAssignCreator.addEventListener('click', () => {
      if (ui.editingAssignmentId || ui.showAssignCreator) {
        ui.editingAssignmentId = null;
        ui.showAssignCreator = false;
      } else {
        ui.showAssignCreator = true;
      }
      renderApp();
    });
  }

  const cancelAssignEdit = document.getElementById('cancel-assign-edit');
  if (cancelAssignEdit) {
    cancelAssignEdit.addEventListener('click', () => {
      ui.editingAssignmentId = null;
      ui.showAssignCreator = false;
      renderApp();
    });
  }

  document.querySelectorAll('[data-edit-assign]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingAssignmentId = btn.getAttribute('data-edit-assign');
      ui.showAssignCreator = false;
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-del-assign]').forEach((btn) => {
    btn.addEventListener('click', () => {
      performActionAndSync('DELETE_ASSIGNMENT', { id: btn.getAttribute('data-del-assign') }, 'Assignment deleted.');
    });
  });

  const upsertAssignForm = document.getElementById('upsert-assign-form');
  if (upsertAssignForm) {
    upsertAssignForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertAssignForm);
      const existingId = fd.get('id');
      const newId = existingId || `asg-${Date.now()}`;
      ui.editingAssignmentId = null;
      ui.showAssignCreator = false;
      ui.expandedAssignmentId = newId;
      performActionAndSync(
        'UPSERT_ASSIGNMENT',
        {
          id: newId,
          title: fd.get('title'),
          subject: fd.get('subject'),
          grade_group: fd.get('grade_group'),
          teacher_id: user.id,
          teacher_name: fd.get('teacher_name'),
          due_date: fd.get('due_date'),
          max_marks: Number(fd.get('max_marks')) || 30,
          instructions: fd.get('instructions'),
          offline_pack_content: fd.get('offline_pack_content')
        },
        existingId ? 'Assignment updated!' : 'Remote assignment published!'
      );
    });
  }

  document.querySelectorAll('[data-toggle-assign]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-toggle-assign');
      ui.expandedAssignmentId = ui.expandedAssignmentId === id ? null : id;
      renderApp();
    });
  });

  document.querySelectorAll('.draft-textarea').forEach((area) => {
    area.addEventListener('input', (e) => {
      personalState.assignmentDrafts[area.getAttribute('data-draft-id')] = e.target.value;
      savePersonal(personalState);
    });
  });

  document.querySelectorAll('.submit-work-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const assignId = form.getAttribute('data-assign-id');
      const fd = new FormData(form);
      const existing = (vaultState.submissions || []).find(
        (s) => s.assignment_id === assignId && s.student_id === user.id
      );
      performActionAndSync(
        'SUBMIT_ASSIGNMENT',
        {
          id: existing ? existing.id : `subm-${Date.now()}`,
          assignment_id: assignId,
          student_id: user.id,
          student_name: user.name,
          answer_text: fd.get('answer_text'),
          status: 'submitted',
          submitted_at: new Date().toISOString()
        },
        'Assignment answer saved & submitted!'
      );
    });
  });

  document.querySelectorAll('.grade-sub-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      performActionAndSync(
        'GRADE_SUBMISSION',
        {
          id: form.getAttribute('data-sub-id'),
          marks_awarded: Number(fd.get('marks_awarded')),
          teacher_feedback: fd.get('teacher_feedback')
        },
        'Mark & feedback saved!'
      );
    });
  });

  document.querySelectorAll('[data-del-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      performActionAndSync('DELETE_SUBMISSION', { id: btn.getAttribute('data-del-sub') }, 'Submission deleted.');
    });
  });

  // --- TOOLKIT EVENTS (NOTES, QUIZZES, FLASHCARDS, FOCUS) ---
  document.querySelectorAll('[data-tk-tab]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.toolkitTab = el.getAttribute('data-tk-tab');
      renderApp();
    });
  });

  document.querySelectorAll('[data-subj-filter]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.subjectFilter = el.getAttribute('data-subj-filter');
      renderApp();
    });
  });

  document.querySelectorAll('[data-bookmark-note]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-bookmark-note');
      const idx = personalState.bookmarkedNoteIds.indexOf(id);
      if (idx >= 0) personalState.bookmarkedNoteIds.splice(idx, 1);
      else personalState.bookmarkedNoteIds.push(id);
      savePersonal(personalState);
      renderApp();
    });
  });

  const toggleNoteModal = document.getElementById('toggle-note-modal');
  if (toggleNoteModal) {
    toggleNoteModal.addEventListener('click', () => {
      if (ui.editingNoteId || ui.showNoteModal) {
        ui.editingNoteId = null;
        ui.showNoteModal = false;
      } else {
        ui.showNoteModal = true;
      }
      renderApp();
    });
  }

  const cancelNoteEdit = document.getElementById('cancel-note-edit');
  if (cancelNoteEdit) {
    cancelNoteEdit.addEventListener('click', () => {
      ui.editingNoteId = null;
      ui.showNoteModal = false;
      renderApp();
    });
  }

  document.querySelectorAll('[data-edit-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingNoteId = btn.getAttribute('data-edit-note');
      ui.showNoteModal = false;
      renderApp();
    });
  });

  document.querySelectorAll('[data-del-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      performActionAndSync('DELETE_STUDY_NOTE', { id: btn.getAttribute('data-del-note') }, 'Study note deleted.');
    });
  });

  const upsertNoteForm = document.getElementById('upsert-note-form');
  if (upsertNoteForm) {
    upsertNoteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertNoteForm);
      const existingId = fd.get('id');
      const formulas = String(fd.get('formulasRaw') || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      ui.editingNoteId = null;
      ui.showNoteModal = false;
      performActionAndSync(
        'UPSERT_STUDY_NOTE',
        {
          id: existingId || `note-${Date.now()}`,
          subject: fd.get('subject'),
          title: fd.get('title'),
          summary: fd.get('summary'),
          formulas,
          author_name: user.name
        },
        'Study note saved & synced!'
      );
    });
  }

  // Quizzes
  const toggleQuizModal = document.getElementById('toggle-quiz-modal');
  if (toggleQuizModal) {
    toggleQuizModal.addEventListener('click', () => {
      if (ui.editingQuizId || ui.showQuizModal) {
        ui.editingQuizId = null;
        ui.showQuizModal = false;
      } else {
        ui.showQuizModal = true;
      }
      renderApp();
    });
  }

  const cancelQuizEdit = document.getElementById('cancel-quiz-edit');
  if (cancelQuizEdit) {
    cancelQuizEdit.addEventListener('click', () => {
      ui.editingQuizId = null;
      ui.showQuizModal = false;
      renderApp();
    });
  }

  document.querySelectorAll('[data-edit-quiz]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingQuizId = btn.getAttribute('data-edit-quiz');
      ui.showQuizModal = false;
      renderApp();
    });
  });

  document.querySelectorAll('[data-del-quiz]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.quizState.index = 0;
      ui.quizState.picked = null;
      performActionAndSync('DELETE_QUIZ', { id: btn.getAttribute('data-del-quiz') }, 'Quiz question deleted.');
    });
  });

  const upsertQuizForm = document.getElementById('upsert-quiz-form');
  if (upsertQuizForm) {
    upsertQuizForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertQuizForm);
      const existingId = fd.get('id');
      const ci = Number(fd.get('correct_index') || 0);
      ui.editingQuizId = null;
      ui.showQuizModal = false;
      performActionAndSync(
        'UPSERT_QUIZ',
        {
          id: existingId || `q-${Date.now()}`,
          subject: fd.get('subject'),
          topic: fd.get('topic'),
          question: fd.get('question'),
          options: [fd.get('opt0'), fd.get('opt1'), fd.get('opt2'), fd.get('opt3')],
          correct_index: ci,
          correctIndex: ci,
          explanation: fd.get('explanation')
        },
        'Quiz question saved & synced!'
      );
    });
  }

  document.querySelectorAll('[data-quiz-subj]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.quizState = {
        subject: el.getAttribute('data-quiz-subj'),
        index: 0,
        picked: null,
        correctCount: 0,
        finished: false
      };
      renderApp();
    });
  });

  document.querySelectorAll('[data-quiz-pick]').forEach((el) => {
    el.addEventListener('click', () => {
      if (ui.quizState.picked !== null) return;
      const picked = Number(el.getAttribute('data-quiz-pick'));
      const allQuizzes = vaultState.quizzes || [];
      const pool =
        ui.quizState.subject === 'All' ? allQuizzes : allQuizzes.filter((q) => q.subject === ui.quizState.subject);
      const safePool = pool.length ? pool : allQuizzes;
      const current = safePool[ui.quizState.index % safePool.length];
      ui.quizState.picked = picked;
      if (picked === Number(current.correct_index ?? current.correctIndex ?? 0)) {
        ui.quizState.correctCount += 1;
      }
      renderApp();
    });
  });

  const nextQuizBtn = document.getElementById('next-quiz-btn');
  if (nextQuizBtn) {
    nextQuizBtn.addEventListener('click', () => {
      const allQuizzes = vaultState.quizzes || [];
      const pool =
        ui.quizState.subject === 'All' ? allQuizzes : allQuizzes.filter((q) => q.subject === ui.quizState.subject);
      const total = (pool.length ? pool : allQuizzes).length;
      if (ui.quizState.index + 1 >= total) {
        ui.quizState.finished = true;
        const targetSubj = ui.quizState.subject === 'All' ? 'Mathematics' : ui.quizState.subject;
        const prev = Number(personalState.subjectConfidence[targetSubj] || 75);
        const pct = Math.round((ui.quizState.correctCount / Math.max(1, total)) * 100);
        personalState.subjectConfidence[targetSubj] = Math.min(100, Math.round(prev * 0.65 + pct * 0.35 + 3));
        savePersonal(personalState);
      } else {
        ui.quizState.index += 1;
        ui.quizState.picked = null;
      }
      renderApp();
    });
  }

  const restartQuizBtn = document.getElementById('restart-quiz-btn');
  if (restartQuizBtn) {
    restartQuizBtn.addEventListener('click', () => {
      ui.quizState = { ...ui.quizState, index: 0, picked: null, correctCount: 0, finished: false };
      renderApp();
    });
  }

  // Flashcards (True 3D in-place flip without destroying DOM mid-animation)
  const flipStage = document.getElementById('flip-card-stage');
  if (flipStage) {
    const doFlip = () => {
      ui.cardState.flipped = !ui.cardState.flipped;
      const inner = document.getElementById('flashcard-3d-inner');
      if (inner) inner.classList.toggle('is-flipped', ui.cardState.flipped);
    };
    flipStage.addEventListener('click', doFlip);
    flipStage.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        doFlip();
      }
    });
  }

  const prevCardBtn = document.getElementById('prev-card-btn');
  if (prevCardBtn) {
    prevCardBtn.addEventListener('click', () => {
      const len = Math.max(1, (vaultState.flashcards || []).length);
      ui.cardState = { index: (ui.cardState.index - 1 + len) % len, flipped: false };
      renderApp();
    });
  }

  const nextCardBtn = document.getElementById('next-card-btn');
  if (nextCardBtn) {
    nextCardBtn.addEventListener('click', () => {
      const len = Math.max(1, (vaultState.flashcards || []).length);
      ui.cardState = { index: (ui.cardState.index + 1) % len, flipped: false };
      renderApp();
    });
  }

  document.querySelectorAll('[data-master-card]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-master-card');
      const idx = personalState.masteredCardIds.indexOf(id);
      if (idx >= 0) personalState.masteredCardIds.splice(idx, 1);
      else personalState.masteredCardIds.push(id);
      savePersonal(personalState);
      renderApp();
    });
  });

  const toggleCardModal = document.getElementById('toggle-card-modal');
  if (toggleCardModal) {
    toggleCardModal.addEventListener('click', () => {
      if (ui.editingCardId || ui.showCardModal) {
        ui.editingCardId = null;
        ui.showCardModal = false;
      } else {
        ui.showCardModal = true;
      }
      renderApp();
    });
  }

  const cancelCardEdit = document.getElementById('cancel-card-edit');
  if (cancelCardEdit) {
    cancelCardEdit.addEventListener('click', () => {
      ui.editingCardId = null;
      ui.showCardModal = false;
      renderApp();
    });
  }

  document.querySelectorAll('[data-edit-card]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingCardId = btn.getAttribute('data-edit-card');
      ui.showCardModal = false;
      renderApp();
    });
  });

  document.querySelectorAll('[data-del-card]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.cardState.index = 0;
      performActionAndSync('DELETE_FLASHCARD', { id: btn.getAttribute('data-del-card') }, 'Flashcard deleted.');
    });
  });

  const upsertCardForm = document.getElementById('upsert-card-form');
  if (upsertCardForm) {
    upsertCardForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertCardForm);
      const existingId = fd.get('id');
      ui.editingCardId = null;
      ui.showCardModal = false;
      performActionAndSync(
        'UPSERT_FLASHCARD',
        {
          id: existingId || `fc-${Date.now()}`,
          subject: fd.get('subject'),
          front: fd.get('front'),
          back: fd.get('back')
        },
        'Flashcard saved & synced!'
      );
    });
  }

  // Focus Timer, Checklist & Scratchpad (Targeted DOM updates every second — zero full-page re-render jank!)
  document.querySelectorAll('[data-timer-action="toggle"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.timerRunning = !ui.timerRunning;
      if (ui.timerRunning && !timerHandle) {
        timerHandle = setInterval(() => {
          if (ui.timerSeconds > 0) {
            ui.timerSeconds -= 1;
            updateTimerReadoutsOnly();
          } else {
            ui.timerRunning = false;
            clearInterval(timerHandle);
            timerHandle = null;
            personalState.focusMinutesToday = (personalState.focusMinutesToday || 0) + 25;
            savePersonal(personalState);
            renderApp({ preserveScroll: true });
            showToast('Focus sprint complete! +25m logged.');
          }
        }, 1000);
      } else if (!ui.timerRunning && timerHandle) {
        clearInterval(timerHandle);
        timerHandle = null;
      }
      renderApp({ preserveScroll: true });
    });
  });

  document.querySelectorAll('[data-timer-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mins = Number(btn.getAttribute('data-timer-preset'));
      ui.timerRunning = false;
      if (timerHandle) {
        clearInterval(timerHandle);
        timerHandle = null;
      }
      ui.timerSeconds = mins * 60;
      renderApp();
    });
  });

  document.querySelectorAll('[data-check-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const item = (personalState.tasks || []).find((t) => t.id === row.getAttribute('data-check-id'));
      if (item) {
        item.done = !item.done;
        savePersonal(personalState);
        renderApp();
      }
    });
  });

  document.querySelectorAll('[data-del-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      personalState.tasks = (personalState.tasks || []).filter((t) => t.id !== btn.getAttribute('data-del-task'));
      savePersonal(personalState);
      renderApp();
    });
  });

  const addChecklistForm = document.getElementById('add-checklist-form');
  if (addChecklistForm) {
    addChecklistForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addChecklistForm);
      personalState.tasks.unshift({
        id: `tk-${Date.now()}`,
        title: fd.get('title'),
        subject: 'Study',
        done: false
      });
      savePersonal(personalState);
      renderApp();
    });
  }

  const scratchArea = document.getElementById('scratchpad-area');
  if (scratchArea) {
    scratchArea.addEventListener('input', (e) => {
      personalState.scratchpad = e.target.value;
      savePersonal(personalState);
    });
  }

  const calcForm = document.getElementById('quick-calc-form');
  if (calcForm) {
    calcForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = String(new FormData(calcForm).get('expr') || '');
      if (/^[0-9+\-*/().\s%]+$/.test(raw)) {
        try {
          const val = Function(`"use strict"; return (${raw});`)();
          ui.calcOutput = Number.isFinite(val) ? String(Math.round(val * 10000) / 10000) : 'Invalid expression';
        } catch {
          ui.calcOutput = 'Check syntax';
        }
      } else {
        ui.calcOutput = 'Use numbers & + - * / ( )';
      }
      renderApp();
    });
  }

  // --- MESSENGER EVENTS ---
  document.querySelectorAll('.room-btn[data-room-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.selectedRoomId = btn.getAttribute('data-room-id');
      renderApp();
    });
  });

  const toggleGroupBtn = document.getElementById('toggle-group-creator');
  if (toggleGroupBtn) {
    toggleGroupBtn.addEventListener('click', () => {
      if (ui.editingRoomId || ui.showGroupCreator) {
        ui.editingRoomId = null;
        ui.showGroupCreator = false;
      } else {
        ui.showGroupCreator = true;
      }
      renderApp();
    });
  }

  const cancelRoomEdit = document.getElementById('cancel-room-edit');
  if (cancelRoomEdit) {
    cancelRoomEdit.addEventListener('click', () => {
      ui.editingRoomId = null;
      ui.showGroupCreator = false;
      renderApp();
    });
  }

  document.querySelectorAll('[data-edit-room]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingRoomId = btn.getAttribute('data-edit-room');
      ui.showGroupCreator = false;
      renderApp();
    });
  });

  document.querySelectorAll('[data-del-room]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.selectedRoomId = null;
      performActionAndSync('DELETE_ROOM', { id: btn.getAttribute('data-del-room') }, 'Channel deleted.');
    });
  });

  const upsertRoomForm = document.getElementById('upsert-room-form');
  if (upsertRoomForm) {
    upsertRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertRoomForm);
      const existingId = fd.get('id');
      const prev = existingId ? (vaultState.rooms || []).find((r) => r.id === existingId) : null;
      const newId = existingId || `room-grp-${Date.now()}`;
      ui.selectedRoomId = newId;
      ui.editingRoomId = null;
      ui.showGroupCreator = false;
      performActionAndSync(
        'UPSERT_ROOM',
        {
          id: newId,
          room_type: prev?.room_type || 'group',
          name: fd.get('name'),
          subject: fd.get('subject'),
          participant_ids: prev?.participant_ids || ['stu-thabo', 'stu-amahle', 'stu-liam', 'tch-naledi', user.id],
          members_label: fd.get('members_label') || `Created by ${user.name}`,
          created_by_name: prev?.created_by_name || user.name
        },
        existingId ? 'Channel updated!' : 'Study group created!'
      );
    });
  }

  document.querySelectorAll('[data-edit-msg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingMessageId = btn.getAttribute('data-edit-msg');
      renderApp();
    });
  });

  document.querySelectorAll('[data-cancel-msg-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingMessageId = null;
      renderApp();
    });
  });

  document.querySelectorAll('.edit-msg-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = form.getAttribute('data-msg-id');
      const prev = (vaultState.messages || []).find((m) => m.id === id);
      const fd = new FormData(form);
      ui.editingMessageId = null;
      if (prev) {
        performActionAndSync('UPSERT_MESSAGE', { ...prev, body: fd.get('body') }, 'Message updated!');
      }
    });
  });

  document.querySelectorAll('[data-del-msg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      performActionAndSync('DELETE_MESSAGE', { id: btn.getAttribute('data-del-msg') }, 'Message removed.');
    });
  });

  const sendMsgForm = document.getElementById('send-msg-form');
  if (sendMsgForm) {
    sendMsgForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(sendMsgForm);
      const roomId = sendMsgForm.getAttribute('data-room-id');
      performActionAndSync('SEND_MESSAGE', {
        id: `msg-${Date.now()}`,
        room_id: roomId,
        sender_id: user.id,
        sender_name: user.name,
        sender_role: user.role,
        body: fd.get('body'),
        created_at: new Date().toISOString()
      });
    });
  }

  // --- BROADCASTS & ATTENDANCE EVENTS ---
  document.querySelectorAll('[data-bc-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.broadcastSubtab = btn.getAttribute('data-bc-tab');
      renderApp();
    });
  });

  document.querySelectorAll('[data-edit-bc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingBroadcastId = btn.getAttribute('data-edit-bc');
      renderApp();
    });
  });

  const cancelBcEdit = document.getElementById('cancel-bc-edit');
  if (cancelBcEdit) {
    cancelBcEdit.addEventListener('click', () => {
      ui.editingBroadcastId = null;
      renderApp();
    });
  }

  document.querySelectorAll('[data-del-bc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      performActionAndSync('DELETE_BROADCAST', { id: btn.getAttribute('data-del-bc') }, 'Broadcast deleted.');
    });
  });

  const upsertBroadcastForm = document.getElementById('upsert-broadcast-form');
  if (upsertBroadcastForm) {
    upsertBroadcastForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertBroadcastForm);
      const existingId = fd.get('id');
      ui.editingBroadcastId = null;
      performActionAndSync(
        'UPSERT_BROADCAST',
        {
          id: existingId || `bc-${Date.now()}`,
          title: fd.get('title'),
          body: fd.get('body'),
          audience: fd.get('audience'),
          author_name: `${user.name} (${user.role})`,
          author_role: user.role,
          priority: 'important',
          created_at: new Date().toISOString()
        },
        existingId ? 'Broadcast updated!' : 'Broadcast sent!'
      );
    });
  }

  document.querySelectorAll('[data-edit-att]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingAttendanceId = btn.getAttribute('data-edit-att');
      renderApp();
    });
  });

  const cancelAttEdit = document.getElementById('cancel-att-edit');
  if (cancelAttEdit) {
    cancelAttEdit.addEventListener('click', () => {
      ui.editingAttendanceId = null;
      renderApp();
    });
  }

  document.querySelectorAll('[data-del-att]').forEach((btn) => {
    btn.addEventListener('click', () => {
      performActionAndSync('DELETE_ATTENDANCE', { id: btn.getAttribute('data-del-att') }, 'Attendance entry removed.');
    });
  });

  const upsertAttForm = document.getElementById('upsert-attendance-form');
  if (upsertAttForm) {
    upsertAttForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertAttForm);
      const existingId = fd.get('id');
      const stuId = fd.get('student_id');
      const stuObj = (vaultState.profiles || []).find((p) => p.id === stuId);
      ui.editingAttendanceId = null;
      performActionAndSync(
        'UPSERT_ATTENDANCE',
        {
          id: existingId || `att-${Date.now()}`,
          session_date: fd.get('session_date'),
          subject: fd.get('subject'),
          student_id: stuId,
          student_name: stuObj ? stuObj.name : 'Student',
          status: fd.get('status'),
          teacher_name: user.name,
          lesson_note: fd.get('lesson_note')
        },
        existingId ? 'Attendance updated!' : 'Attendance logged!'
      );
    });
  }

  // --- TUITION PACKAGES & CONTACTS EVENTS ---
  const rateSelect = document.getElementById('calc-rate-select');
  if (rateSelect) {
    rateSelect.addEventListener('change', (e) => {
      ui.feeCalcRate = Number(e.target.value);
      renderApp();
    });
  }

  const sessionsRange = document.getElementById('calc-sessions-range');
  if (sessionsRange) {
    sessionsRange.addEventListener('input', (e) => {
      ui.feeCalcSessions = Number(e.target.value);
      renderApp();
    });
  }

  const toggleTuitionEditor = document.getElementById('toggle-tuition-editor');
  if (toggleTuitionEditor) {
    toggleTuitionEditor.addEventListener('click', () => {
      ui.showTuitionEditor = !ui.showTuitionEditor;
      renderApp();
    });
  }

  const toggleNewPlanBtn = document.getElementById('toggle-new-plan-btn');
  if (toggleNewPlanBtn) {
    toggleNewPlanBtn.addEventListener('click', () => {
      if (ui.editingPlanId || ui.showNewPlanForm) {
        ui.editingPlanId = null;
        ui.showNewPlanForm = false;
      } else {
        ui.showNewPlanForm = true;
      }
      renderApp();
    });
  }

  const cancelPlanEdit = document.getElementById('cancel-plan-edit');
  if (cancelPlanEdit) {
    cancelPlanEdit.addEventListener('click', () => {
      ui.editingPlanId = null;
      ui.showNewPlanForm = false;
      renderApp();
    });
  }

  document.querySelectorAll('[data-edit-plan]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingPlanId = btn.getAttribute('data-edit-plan');
      ui.showNewPlanForm = false;
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-del-plan]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del-plan');
      const nextPlans = (vaultState.tuitionInfo.plans || []).filter((p) => p.id !== id);
      performActionAndSync(
        'UPDATE_TUITION_INFO',
        {
          headline: vaultState.tuitionInfo.headline,
          intro: vaultState.tuitionInfo.intro,
          plans: nextPlans,
          contacts: vaultState.tuitionInfo.contacts
        },
        'Tuition package removed!'
      );
    });
  });

  const upsertPlanForm = document.getElementById('upsert-plan-form');
  if (upsertPlanForm) {
    upsertPlanForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertPlanForm);
      const existingId = fd.get('id');
      const features = String(fd.get('featuresRaw') || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const planObj = {
        id: existingId || `plan-${Date.now()}`,
        name: fd.get('name'),
        price: fd.get('price'),
        numericRate: Number(fd.get('numericRate')) || 450,
        badge: fd.get('badge'),
        features
      };
      const currentPlans = [...(vaultState.tuitionInfo.plans || [])];
      const idx = currentPlans.findIndex((p) => p.id === planObj.id);
      if (idx >= 0) currentPlans[idx] = planObj;
      else currentPlans.push(planObj);

      ui.editingPlanId = null;
      ui.showNewPlanForm = false;
      performActionAndSync(
        'UPDATE_TUITION_INFO',
        {
          headline: vaultState.tuitionInfo.headline,
          intro: vaultState.tuitionInfo.intro,
          plans: currentPlans,
          contacts: vaultState.tuitionInfo.contacts
        },
        'Tuition package saved & synced!'
      );
    });
  }

  const updateTuitionForm = document.getElementById('update-tuition-form');
  if (updateTuitionForm) {
    updateTuitionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(updateTuitionForm);
      ui.showTuitionEditor = false;
      performActionAndSync(
        'UPDATE_TUITION_INFO',
        {
          headline: fd.get('headline'),
          intro: fd.get('intro'),
          plans: vaultState.tuitionInfo.plans,
          contacts: {
            phone: fd.get('phone'),
            whatsapp: fd.get('whatsapp'),
            email: fd.get('email'),
            hours: fd.get('hours'),
            address: fd.get('address')
          }
        },
        'Public headline & contact details updated!'
      );
    });
  }

  const enquiryForm = document.getElementById('public-enquiry-form');
  if (enquiryForm) {
    enquiryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(enquiryForm);
      performActionAndSync(
        'SUBMIT_ENQUIRY',
        {
          id: `eq-${Date.now()}`,
          full_name: fd.get('full_name'),
          contact_detail: fd.get('contact_detail'),
          student_grade: fd.get('student_grade'),
          selected_plan: fd.get('selected_plan'),
          message: fd.get('message'),
          status: 'pending',
          created_at: new Date().toISOString()
        },
        'Enquiry sent! Admissions can accept & activate your account directly.'
      );
    });
  }
}

/* ==========================================================================
   BOOT SEQUENCE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  const rootEl = document.getElementById('app');
  if (!rootEl) return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  window.addEventListener('online', async () => {
    if (!sessionState.simulateOffline) {
      const res = await syncWithServer({ simulateOffline: false });
      if (res.vault) {
        vaultState = res.vault;
        if (!document.getElementById('splash-screen')) renderApp();
      }
    }
  });

  runAnimatedSplash(rootEl, () => {
    renderApp();
  });
});
