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
  syncWithServer,
  uploadAndCacheMediaFile
} from './offlineStore.js';
import { openInAppMediaViewer, renderAttachmentGalleryHTML } from './mediaViewer.js';

const SPLASH_DURATION_MS = 10000;

const LOADING_CAPTIONS = [
  { threshold: 0, text: 'Initializing i-tutor workspace...' },
  { threshold: 22, text: 'Downloading accounts, timetables & study notes...' },
  { threshold: 50, text: 'Caching homework PDFs, diagrams & offline packs...' },
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
  showAuthPortal: false,
  authTab: 'signin', // signin | join
  authError: '',
  authSuccess: '',
  demoAccountsOpen: false,
  view: 'tuition', // tuition (default on app open!) | overview | admissions | timetable | assignments | toolkit | messages | broadcasts | account
  searchQuery: '',
  roleFilter: 'all',

  // Admissions & Account editors
  editingAccountId: null,
  showNewAccountForm: false,
  editingEnquiryId: null,

  // Timetable & Exam editors
  timetableDay: 'All',
  showSlotCreator: false,
  editingTimetableId: null,
  showExamCreator: false,
  editingExamId: null,

  // Homework / Assignments editors & media staging
  expandedAssignmentId: null,
  showAssignCreator: false,
  editingAssignmentId: null,
  stagedAssignAttachments: [],
  stagedSubmissionAttachments: {}, // { [assignId]: Attachment[] }
  uploadingTarget: '', // 'assign' | 'chat' | `sub:${id}` | ''

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

  // Messenger editors & media staging
  selectedRoomId: null,
  showGroupCreator: false,
  editingRoomId: null,
  editingMessageId: null,
  stagedChatAttachments: [],
  chatDraftText: '',

  // Broadcasts & Attendance editors
  broadcastSubtab: 'announcements', // announcements | attendance
  showBroadcastCreator: false,
  editingBroadcastId: null,
  showAttendanceCreator: false,
  editingAttendanceId: null,

  // Flyers, Tuition & Package editors
  feeCalcMonthly: 750,
  feeCalcIncludeReg: true,
  showTuitionEditor: false,
  editingPlanId: null,
  showNewPlanForm: false,
  showFlyerForm: false,
  editingFlyerId: null,
  stagedFlyerAttachment: null,

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

/* Quiet single-button ⋯ action menu — replaces cluttered side-by-side Edit/Delete button pairs */
function renderMoreMenu(itemsHtml) {
  return `
    <details class="row-more-menu">
      <summary class="row-more-trigger" aria-label="More actions" title="Options">${ICONS.dots}</summary>
      <div class="row-more-popover">
        ${itemsHtml}
      </div>
    </details>
  `;
}

function getActiveUser() {
  if (ui.showAuthPortal) return null;
  if (!sessionState.currentUserId || sessionState.currentUserId === 'visitor') return VISITOR_PROFILE;
  const found = (vaultState.profiles || []).find((p) => p.id === sessionState.currentUserId);
  if (!found || found.status === 'suspended' || found.status === 'declined') return VISITOR_PROFILE;
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
        body: `Welcome to i-tutor, ${profile.name}! Your account has been accepted and activated. Your timetables & offline homework packs are ready.`,
        attachments: [],
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
   2. CLEAN ACCOUNT PORTAL (DE-CLUTTERED SIGN IN / JOIN / VISITOR ACCESS)
   ========================================================================== */

function renderAuthPortal(rootEl, { animateCard = true } = {}) {
  const plans = vaultState.tuitionInfo?.plans || [];
  const pendingTotal = getPendingAdmissionsCount();
  const quickAccounts = [
    { id: 'admin-1', tag: 'Super Admin', label: 'Kgomotso Dlamini' },
    { id: 'adm-lerato', tag: `Admissions (${pendingTotal} Pending)`, label: 'Lerato Sithole' },
    { id: 'stu-thabo', tag: 'Student · Grade 12', label: 'Thabo Mokoena' },
    { id: 'tch-naledi', tag: 'Teacher · Maths', label: 'Ms. Naledi Khumalo' },
    { id: 'par-grace', tag: 'Parent Account', label: 'Mrs. Grace Mokoena' }
  ];

  rootEl.innerHTML = `
    <div class="auth-portal-shell">
      <div class="auth-portal-grid ${animateCard ? 'is-entering' : ''}">
        <section class="auth-brand-pane">
          <div class="auth-brand-top">
            <div class="auth-emblem-box">
              ${renderEmblemSVG({ animated: false, uid: 'auth', className: 'brand-emblem-svg' })}
            </div>
            <div>
              <h1 class="auth-hero-title">
                <span style="color:var(--gold);">i</span>-tutor
              </h1>
              <p class="auth-hero-sub">Confidence in learning</p>
            </div>
          </div>

          <p class="auth-hero-copy">
            Offline-ready learning workspace with PDF, Photo & Video homework packs, direct teacher chats, and built-in media readers.
          </p>

          <div class="auth-visitor-box">
            <span class="auth-visitor-kicker">Official Botswana Pula Prices</span>
            <p class="auth-visitor-copy">
              Return anytime to view Breakthrough Std 4–6 (P500), JCE (from P200), BGCSE / IGCSE (P750 Best 6) + P100 Registration & Flyers.
            </p>
            <button class="gold-cta-btn auth-visitor-btn" id="btn-enter-visitor">
              ${ICONS.tuition} <span>← Back to Prices & Flyers</span>
            </button>
          </div>
        </section>

        <section class="auth-form-pane">
          <div class="auth-tabs-grid">
            <button class="subtab-btn ${ui.authTab === 'signin' ? 'is-active' : ''}" data-auth-tab="signin">
              Sign In
            </button>
            <button class="subtab-btn ${ui.authTab === 'join' ? 'is-active' : ''}" data-auth-tab="join">
              Apply to Join
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
            <form class="form-stack animated-drop" id="account-signin-form">
              <label style="font-size:0.79rem;font-weight:750;">Email, Phone Number, or Full Name</label>
              <input class="field-input" name="identifier" placeholder="e.g. admin@i-tutor.academy" required />
              <label style="font-size:0.79rem;font-weight:750;">Password / Account PIN</label>
              <input class="field-input" type="password" name="pin" placeholder="Enter PIN (Demo PIN: 1234)" required />
              <button class="dark-cta-btn" type="submit" style="padding:0.72rem;width:100%;">Sign In →</button>
            </form>

            <details class="quiet-disclosure" id="demo-accounts-disclosure" ${ui.demoAccountsOpen ? 'open' : ''}>
              <summary class="quiet-disclosure-summary">
                <span>Quick Demo Sign-In (Admin, Student, Teacher, Parent)</span>
                <span class="muted-pill">5 Roles</span>
              </summary>
              <div class="demo-accounts-grid" style="margin-top:0.65rem;">
                ${quickAccounts
                  .map(
                    (qa) => `
                  <button class="demo-acc-btn" type="button" data-quick-login="${esc(qa.id)}">
                    <span class="demo-acc-role">${esc(qa.tag)}</span>
                    <span class="demo-acc-name">${esc(qa.label)}</span>
                  </button>
                `
                  )
                  .join('')}
              </div>
            </details>
          `
              : `
            <form class="form-stack animated-drop" id="account-join-form">
              <p class="row-sub">Submit your details below — Admissions activates accounts in 1 click.</p>
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
              <button class="dark-cta-btn" type="submit" style="padding:0.72rem;width:100%;">Submit Application →</button>
            </form>
          `
          }
        </section>
      </div>
      <div id="live-toast-host">
        ${ui.toast ? `<div class="toast-banner" role="status">${esc(ui.toast)}</div>` : ''}
      </div>
    </div>
  `;

  const disc = document.getElementById('demo-accounts-disclosure');
  if (disc) {
    disc.addEventListener('toggle', () => {
      ui.demoAccountsOpen = disc.open;
    });
  }

  document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.authTab = btn.getAttribute('data-auth-tab');
      ui.authError = '';
      renderApp({ preserveScroll: true });
    });
  });

  const visitorBtn = document.getElementById('btn-enter-visitor');
  if (visitorBtn) {
    visitorBtn.addEventListener('click', () => {
      sessionState.currentUserId = 'visitor';
      saveSession(sessionState);
      ui.showAuthPortal = false;
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
        ui.showAuthPortal = false;
        ui.authError = '';
        ui.authSuccess = '';
        ui.view = target.role === 'admissions' ? 'admissions' : 'tuition';
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
      ui.showAuthPortal = false;
      ui.authError = '';
      ui.authSuccess = '';
      ui.view = res.profile.role === 'admissions' ? 'admissions' : 'tuition';
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
      ui.authSuccess = `Application received for ${newProfile.name}! Status: Pending Admissions Approval.`;
      ui.authTab = 'signin';
      await performActionAndSync('UPSERT_ACCOUNT', newProfile, 'Join application sent to Admissions!');
    });
  }
}

/* ==========================================================================
   3. ADMISSIONS & ACCOUNT MANAGEMENT (CLEAN 1-CLICK APPROVAL + ⋯ MENUS)
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
        <h1>Admissions & Accounts</h1>
        <p>Approve applicants in 1 click or manage any Student, Parent, Teacher, or Staff account.</p>
      </div>
      <button class="dark-cta-btn" id="btn-toggle-new-account">
        ${ICONS.plus} ${ui.showNewAccountForm || editingAcc ? 'Close' : 'New Account'}
      </button>
    </div>

    ${
      ui.showNewAccountForm || editingAcc
        ? `
      <form class="panel-card form-stack" id="upsert-account-form">
        <div class="panel-head">
          <h2 class="panel-title">${editingAcc ? `Edit Account · ${esc(editingAcc.name)}` : 'Create Active Account'}</h2>
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
          <input class="field-input" name="subtitle" value="${esc(editingAcc?.subtitle || '')}" placeholder="Profile Subtitle" />
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
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Account</button>
      </form>
    `
        : ''
    }

    <section class="panel-card">
      <div class="panel-head">
        <h2 class="panel-title">Pending Applications (${pendingApplicants.length})</h2>
        <span class="pill-badge">1-Click Approval</span>
      </div>
      ${
        pendingApplicants.length === 0
          ? `<p class="row-sub">All applications have been reviewed.</p>`
          : pendingApplicants
              .map(
                (app) => `
            <div class="list-row">
              <div class="list-row-col">
                <span class="row-title">
                  ${esc(app.name)}
                  <span class="status-chip pending">${esc(app.role)}</span>
                </span>
                <span class="row-sub">${esc(app.grade)} · ${esc(app.selected_plan || 'Standard')} · ${esc(
                  (app.subjects || []).join(', ') || 'General'
                )}</span>
                <span class="row-sub">${esc(app.email)} · ${esc(app.phone)}</span>
              </div>
              <div class="action-cluster">
                <button class="approve-btn" data-approve-acc="${esc(app.id)}">✓ Accept</button>
                ${renderMoreMenu(`
                  <button type="button" class="more-menu-item" data-edit-acc="${esc(app.id)}">${ICONS.edit} Edit Details</button>
                  <button type="button" class="more-menu-item is-danger" data-decline-acc="${esc(app.id)}">${ICONS.trash} Decline</button>
                `)}
              </div>
            </div>
          `
              )
              .join('')
      }
    </section>

    ${
      enquiries.length > 0
        ? `
      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Tuition Enquiries (${enquiries.length})</h2>
        </div>
        ${enquiries
          .map((eq) => {
            if (ui.editingEnquiryId === eq.id) {
              return `
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
                    <button class="dark-cta-btn" type="submit">Save</button>
                    <button class="outline-btn" type="button" data-cancel-eq>Cancel</button>
                  </div>
                </form>
              `;
            }
            return `
              <div class="list-row">
                <div class="list-row-col">
                  <span class="row-title">${esc(eq.full_name)} · ${esc(eq.student_grade)} (${esc(eq.selected_plan)})</span>
                  <span class="row-sub">${esc(eq.contact_detail)} — "${esc(eq.message)}"</span>
                </div>
                <div class="action-cluster">
                  ${
                    eq.status === 'accepted'
                      ? `<span class="status-chip active">Enrolled ✓</span>`
                      : `<button class="approve-btn" data-convert-eq="${esc(eq.id)}">✓ Enroll</button>`
                  }
                  ${renderMoreMenu(`
                    <button type="button" class="more-menu-item" data-edit-eq="${esc(eq.id)}">${ICONS.edit} Edit</button>
                    <button type="button" class="more-menu-item is-danger" data-del-eq="${esc(eq.id)}">${ICONS.trash} Delete</button>
                  `)}
                </div>
              </div>
            `;
          })
          .join('')}
      </section>
    `
        : ''
    }

    <section class="panel-card">
      <div class="panel-head">
        <h2 class="panel-title">Directory (${filteredAccounts.length})</h2>
        <select class="field-input compact-select" id="role-filter-select" aria-label="Filter accounts by role">
          ${['all', 'student', 'parent', 'teacher', 'admissions', 'admin']
            .map(
              (r) => `<option value="${r}" ${ui.roleFilter === r ? 'selected' : ''}>${
                r === 'all' ? 'All Roles' : r.toUpperCase()
              }</option>`
            )
            .join('')}
        </select>
      </div>

      <div class="form-stack">
        ${filteredAccounts
          .map(
            (acc) => `
          <div class="list-row">
            <div class="list-row-col">
              <span class="row-title">
                ${esc(acc.name)}
                <span class="muted-pill">${esc(acc.role.toUpperCase())}</span>
                <span class="status-chip ${esc(acc.status || 'active')}">${esc(acc.status || 'active')}</span>
              </span>
              <span class="row-sub">${esc(acc.subtitle || acc.grade)} · ${esc(acc.email || '—')} · PIN: <code>${esc(
              acc.pin || '1234'
            )}</code></span>
            </div>
            <div class="action-cluster">
              ${
                acc.status !== 'active'
                  ? `<button class="approve-btn" data-approve-acc="${esc(acc.id)}">✓ Activate</button>`
                  : ''
              }
              ${renderMoreMenu(`
                <button type="button" class="more-menu-item" data-edit-acc="${esc(acc.id)}">${ICONS.edit} Edit Account</button>
                ${
                  acc.id !== user.id
                    ? `<button type="button" class="more-menu-item is-danger" data-del-acc="${esc(acc.id)}">${ICONS.trash} Delete Account</button>`
                    : ''
                }
              `)}
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
   4. MY ACCOUNT SETTINGS VIEW
   ========================================================================== */

function buildMyAccountStage(user) {
  if (user.role === 'visitor') {
    return `
      <section class="panel-card">
        <h2 class="panel-title">Create or Sign In to Your i-tutor Account</h2>
        <p class="row-sub">You are browsing as a Visitor. Apply to join or sign in anytime.</p>
        <div class="action-cluster">
          <button class="dark-cta-btn" id="btn-go-join-portal">Apply to Join</button>
          <button class="outline-btn" id="btn-go-signin-portal">Sign In</button>
        </div>
      </section>
    `;
  }

  return `
    <div class="page-header-row">
      <div>
        <h1>My Account</h1>
        <p>Personal profile, preferences, and account switching.</p>
      </div>
      <button class="outline-btn" id="btn-signout-main">${ICONS.logout} Switch Account</button>
    </div>

    <form class="panel-card form-stack" id="my-profile-form">
      <div class="panel-head">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div class="account-avatar-gold" style="width:44px;height:44px;font-size:0.98rem;">${esc(initials(user.name))}</div>
          <div>
            <h2 class="panel-title">${esc(user.name)}</h2>
            <span class="status-chip active">${esc(user.role.toUpperCase())}</span>
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

      <button class="dark-cta-btn" type="submit" style="align-self:flex-start;">${ICONS.check} Save Changes</button>
    </form>
  `;
}

/* ==========================================================================
   5. OVERVIEW HUB (CALM, BREATHABLE, ZERO REDUNDANT BUTTONS)
   ========================================================================== */

function buildOverviewStage(user) {
  if (user.role === 'visitor') {
    const info = vaultState.tuitionInfo;
    return `
      <section class="panel-card" style="background:linear-gradient(135deg, rgba(242,183,40,0.22), var(--surface-ivory));">
        <span class="pill-badge" style="align-self:flex-start;">Public Preview</span>
        <h1 style="font-size:1.55rem;font-weight:850;letter-spacing:-0.03em;">${esc(info.headline)}</h1>
        <p style="font-size:0.9rem;color:var(--charcoal-soft);line-height:1.5;">${esc(info.intro)}</p>
        <div class="action-cluster" style="margin-top:0.25rem;">
          <button class="dark-cta-btn" id="visitor-apply-cta">${ICONS.plus} Apply to Join</button>
          <button class="outline-btn" data-nav="tuition">Tuition & Contacts</button>
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
      { label: 'Admissions', value: `${pendingAdmissions} Pending`, foot: '1-click approvals', go: 'admissions' },
      { label: 'Flyers & Prices', value: `${(vaultState.tuitionInfo.flyers || []).length} Flyer · ${(vaultState.tuitionInfo.plans || []).length} Plans`, foot: 'Add flyers & prices at will', go: 'tuition' },
      { label: 'Homework Packs', value: `${vaultState.assignments.length} Active`, foot: 'Upload PDFs, Photos & Videos', go: 'assignments' },
      { label: 'Chats & Groups', value: `${visibleRooms.length} Rooms`, foot: 'Share media & messages', go: 'messages' }
    ];
  } else if (user.role === 'teacher') {
    kpis = [
      { label: 'Homework & Media', value: `${ungradedCount} To Mark`, foot: 'Post PDFs, Photos & Videos', go: 'assignments' },
      { label: 'Class Schedule', value: `${vaultState.timetables.length} Slots`, foot: 'Weekly timetable', go: 'timetable' },
      { label: 'Attendance', value: `${presentRatio}%`, foot: 'Lesson recaps', go: 'broadcasts' },
      { label: 'Chats & Groups', value: `${visibleRooms.length} Open`, foot: 'Send media & notes', go: 'messages' }
    ];
  } else if (user.role === 'parent') {
    const childId = user.linked_student_id || 'stu-thabo';
    const childSubs = (vaultState.submissions || []).filter((s) => s.student_id === childId);
    const graded = childSubs.find((s) => s.status === 'graded');
    kpis = [
      { label: 'Attendance', value: `${presentRatio}%`, foot: 'Tutor recaps', go: 'broadcasts' },
      { label: 'Homework', value: graded ? `${graded.marks_awarded} Marks` : 'Active', foot: 'Open PDFs & feedback', go: 'assignments' },
      { label: 'Timetable', value: `${vaultState.timetables.length} Classes`, foot: 'Saved offline', go: 'timetable' },
      { label: 'Teacher Chats', value: `${visibleRooms.length} Open`, foot: 'Direct channels', go: 'messages' }
    ];
  } else {
    kpis = [
      { label: 'Confidence', value: `${avgConf}%`, foot: `Next: ${weakest.subject}`, go: 'toolkit' },
      { label: 'Homework', value: `${pendingCount} Due`, foot: 'Open PDFs, Photos & Videos', go: 'assignments' },
      { label: 'Chats & Groups', value: `${visibleRooms.length} Open`, foot: 'Share media & ask tutors', go: 'messages' },
      { label: 'Study Toolkit', value: `${vaultState.notes.length + vaultState.flashcards.length} Items`, foot: 'Notes, quiz & cards', go: 'toolkit' }
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
            <div class="ribbon-tag">Notice · ${esc(latestBroadcast.author_name)}</div>
            <div class="ribbon-headline">${esc(latestBroadcast.title)} — ${esc(latestBroadcast.body)}</div>
          </div>
        </div>
      </button>
    `
        : ''
    }

    <div class="page-header-row">
      <div>
        <h1>Welcome, ${esc(user.name.split(' ')[0])}</h1>
        <p>${esc(user.subtitle || user.grade)} · ${esc(user.role.toUpperCase())}</p>
      </div>
      ${
        isStaff(user)
          ? `<button class="dark-cta-btn" id="quick-new-assign-btn">${ICONS.plus} Post Homework</button>`
          : `<button class="dark-cta-btn" data-open-toolkit="quiz">${ICONS.quiz} Quick Practice</button>`
      }
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
          <h2 class="panel-title">Recent Homework & Media Packs</h2>
          <button class="text-link-btn" data-nav="assignments">See all →</button>
        </div>
        ${(vaultState.assignments || [])
          .slice(0, 3)
          .map((asg) => {
            const attCount = Array.isArray(asg.attachments) ? asg.attachments.length : 0;
            return `
              <button type="button" class="list-row clickable-list-row" data-jump-assign="${esc(asg.id)}">
                <div class="list-row-col">
                  <span class="row-title">${esc(asg.title)}</span>
                  <span class="row-sub">${esc(asg.subject)} · Due ${esc(asg.due_date)}${
              attCount ? ` · 📎 ${attCount} ${attCount === 1 ? 'file' : 'files'}` : ''
            }</span>
                </div>
                <span class="pill-badge">Open →</span>
              </button>
            `;
          })
          .join('')}
      </section>

      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Upcoming Classes</h2>
          <button class="text-link-btn" data-nav="timetable">Full schedule →</button>
        </div>
        ${(vaultState.timetables || [])
          .slice(0, 3)
          .map(
            (slot) => `
          <button type="button" class="list-row clickable-list-row" data-nav="timetable">
            <div class="list-row-col">
              <span class="row-title">${esc(slot.subject)} · ${esc(slot.day_of_week)}</span>
              <span class="row-sub">${esc(slot.start_time)}–${esc(slot.end_time)} · ${esc(slot.topic)}</span>
            </div>
            <span class="muted-pill">${esc(slot.grade_group)}</span>
          </button>
        `
          )
          .join('')}
      </section>
    </div>
  `;
}

/* ==========================================================================
   6. TIMETABLE & EXAMS (CLEAN TOGGLES + QUIET ⋯ MENUS)
   ========================================================================== */

function buildTimetableStage(user) {
  const days = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const q = ui.searchQuery.trim().toLowerCase();
  const superEdit = isStaff(user);

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
        <h1>Schedule & Exam Dates</h1>
        <p>Saved automatically on this device for offline viewing.</p>
      </div>
      ${
        user.role !== 'visitor'
          ? `<button class="dark-cta-btn" id="btn-toggle-slot-creator">${ICONS.plus} ${
              ui.showSlotCreator || editingSlot ? 'Close' : 'Add Slot'
            }</button>`
          : ''
      }
    </div>

    <div class="subtab-bar">
      ${days
        .map(
          (d) =>
            `<button class="subtab-btn ${ui.timetableDay === d ? 'is-active' : ''}" data-tt-day="${d}">${
              d === 'All' ? 'All Days' : d.slice(0, 3)
            }</button>`
        )
        .join('')}
    </div>

    ${
      ui.showSlotCreator || editingSlot
        ? `
      <form class="panel-card form-stack" id="upsert-tt-form">
        <div class="panel-head">
          <h2 class="panel-title">${editingSlot ? `Edit Slot · ${esc(editingSlot.subject)}` : 'Add Class / Study Slot'}</h2>
          <button type="button" class="outline-btn" id="cancel-tt-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingSlot?.id || '')}" />
        <div class="form-grid-2">
          <select class="field-input" name="day_of_week" required>
            ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
              .map((d) => `<option value="${d}" ${editingSlot?.day_of_week === d ? 'selected' : ''}>${d}</option>`)
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
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Slot</button>
      </form>
    `
        : ''
    }

    <div class="two-col-grid">
      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Weekly Classes (${slots.length})</h2>
        </div>

        ${slots
          .map((s) => {
            const canModify = superEdit || s.owner_id === user.id;
            return `
              <div class="list-row">
                <div class="list-row-col">
                  <span class="row-title">${esc(s.subject)} · <span class="muted-pill">${esc(s.grade_group)}</span></span>
                  <span class="row-sub">${esc(s.day_of_week)} · ${esc(s.start_time)}–${esc(s.end_time)} · ${esc(
              s.location_mode
            )}</span>
                  <span class="row-sub">${esc(s.topic)} (${esc(s.teacher_name)})</span>
                </div>
                ${
                  canModify
                    ? renderMoreMenu(`
                        <button type="button" class="more-menu-item" data-edit-tt="${esc(s.id)}">${ICONS.edit} Edit Slot</button>
                        <button type="button" class="more-menu-item is-danger" data-del-tt="${esc(s.id)}">${ICONS.trash} Remove Slot</button>
                      `)
                    : ''
                }
              </div>
            `;
          })
          .join('')}
      </section>

      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Exam Countdowns</h2>
          <button class="text-link-btn" id="btn-toggle-exam-creator">${
            ui.showExamCreator || editingExam ? 'Close' : '+ Add Exam'
          }</button>
        </div>

        ${
          ui.showExamCreator || editingExam
            ? `
          <form class="form-stack" id="upsert-exam-form" style="padding-bottom:0.85rem;border-bottom:1px solid var(--border-warm);">
            <input type="hidden" name="id" value="${esc(editingExam?.id || '')}" />
            <input class="field-input" name="title" value="${esc(editingExam?.title || '')}" placeholder="Exam Paper Title" required />
            <div class="form-grid-2">
              <input class="field-input" name="subject" value="${esc(editingExam?.subject || '')}" placeholder="Subject" required />
              <input class="field-input" type="number" min="1" max="365" name="daysAway" value="${esc(
                editingExam?.daysAway || ''
              )}" placeholder="Days left" required />
            </div>
            <button class="dark-cta-btn" type="submit">${editingExam ? 'Update Exam' : 'Save Exam'}</button>
          </form>
        `
            : ''
        }

        ${(personalState.exams || [])
          .map(
            (ex) => `
          <div class="list-row">
            <div class="list-row-col">
              <span class="row-title">${esc(ex.title)}</span>
              <span class="row-sub">${esc(ex.subject)} · <strong>${Number(ex.daysAway)} days left</strong></span>
            </div>
            ${renderMoreMenu(`
              <button type="button" class="more-menu-item" data-edit-exam="${esc(ex.id)}">${ICONS.edit} Edit</button>
              <button type="button" class="more-menu-item is-danger" data-del-exam="${esc(ex.id)}">${ICONS.trash} Remove</button>
            `)}
          </div>
        `
          )
          .join('')}
      </section>
    </div>
  `;
}

/* ==========================================================================
   7. HOMEWORK & MEDIA PACKS (ADMIN / EDUCATOR PHOTO, PDF & VIDEO UPLOADS +
      BUILT-IN IN-APP OPENER + STUDENT PHOTO/PDF SUBMISSIONS)
   ========================================================================== */

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
        <h1>Homework & Media Packs</h1>
        <p>Tap any PDF, Photo, or Video to open it right inside i-tutor — cached automatically for offline study.</p>
      </div>
      ${
        canManage
          ? `<button class="dark-cta-btn" id="toggle-assign-creator">${ICONS.plus} ${
              ui.showAssignCreator || editingAsg ? 'Close' : 'Post Homework'
            }</button>`
          : ''
      }
    </div>

    ${
      canManage && (ui.showAssignCreator || editingAsg)
        ? `
      <form class="panel-card form-stack" id="upsert-assign-form">
        <div class="panel-head">
          <h2 class="panel-title">${editingAsg ? `Edit Homework · ${esc(editingAsg.title)}` : 'Post New Homework (Photos, PDFs, Videos or Text)'}</h2>
          <button type="button" class="outline-btn" id="cancel-assign-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingAsg?.id || '')}" />
        <div class="form-grid-2">
          <input class="field-input" name="title" value="${esc(editingAsg?.title || '')}" placeholder="Homework Title (e.g. Trig Paper 2 Worksheet)" required />
          <select class="field-input" name="subject">
            ${SUBJECT_LIST.map(
              (s) => `<option value="${esc(s)}" ${editingAsg?.subject === s ? 'selected' : ''}>${esc(s)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="grade_group" value="${esc(editingAsg?.grade_group || 'Grade 12')}" placeholder="Grade Group" required />
          <input class="field-input" name="teacher_name" value="${esc(editingAsg?.teacher_name || user.name)}" placeholder="Posted By" required />
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="due_date" type="date" value="${esc(editingAsg?.due_date || '2026-12-05')}" required />
          <input class="field-input" name="max_marks" type="number" value="${esc(editingAsg?.max_marks || 30)}" min="5" max="200" required />
        </div>

        <!-- PHOTO / PDF / VIDEO UPLOAD ZONE FOR HOMEWORK -->
        <div class="media-upload-zone">
          <div class="media-upload-head">
            <div>
              <strong style="font-size:0.86rem;">Attach Homework Photos, PDFs or Videos</strong>
              <p class="row-sub">Upload exam scans, PDF worksheets, diagrams, or walkthrough videos — opens in-app on every device.</p>
            </div>
            <label class="gold-cta-btn upload-picker-label">
              ${ICONS.paperclip}
              <span>${ui.uploadingTarget === 'assign' ? 'Uploading...' : 'Choose Files'}</span>
              <input
                type="file"
                id="assign-media-input"
                accept="image/*,application/pdf,.pdf,video/*"
                multiple
                hidden
              />
            </label>
          </div>
          ${renderAttachmentGalleryHTML(ui.stagedAssignAttachments, { removablePrefix: 'assign' })}
        </div>

        <textarea class="field-input" name="instructions" rows="2" placeholder="Short instructions for learners...">${esc(
          editingAsg?.instructions || ''
        )}</textarea>
        <textarea class="field-input" name="offline_pack_content" rows="3" placeholder="Optional written questions or formula notes...">${esc(
          editingAsg?.offline_pack_content || ''
        )}</textarea>
        <button class="dark-cta-btn" type="submit">${ICONS.check} ${
            editingAsg ? 'Save Homework Changes' : 'Publish & Send Homework'
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
          const atts = Array.isArray(asg.attachments) ? asg.attachments : [];
          const stagedSubAtts = ui.stagedSubmissionAttachments[asg.id] ?? (mySub?.attachments || []);

          return `
            <article class="panel-card">
              <div class="panel-head">
                <div>
                  <span class="pill-badge">${esc(asg.subject)} · ${esc(asg.grade_group)} · ${asg.max_marks} Marks</span>
                  <h2 class="panel-title" style="margin-top:0.35rem;font-size:1.06rem;">${esc(asg.title)}</h2>
                  <p class="row-sub">${esc(asg.teacher_name)} · Due ${esc(asg.due_date)}</p>
                </div>
                <div class="action-cluster">
                  <button class="outline-btn" data-toggle-assign="${esc(asg.id)}">
                    ${isOpen ? 'Close' : canManage ? `Submissions (${allSubs.length})` : mySub ? 'View Work' : 'Answer / Submit'}
                  </button>
                  ${
                    canManage
                      ? renderMoreMenu(`
                          <button type="button" class="more-menu-item" data-edit-assign="${esc(asg.id)}">${ICONS.edit} Edit Homework</button>
                          <button type="button" class="more-menu-item is-danger" data-del-assign="${esc(asg.id)}">${ICONS.trash} Delete Homework</button>
                        `)
                      : ''
                  }
                </div>
              </div>

              ${
                asg.instructions
                  ? `<p style="font-size:0.86rem;line-height:1.5;color:var(--charcoal-soft);">${esc(asg.instructions)}</p>`
                  : ''
              }

              <!-- HOMEWORK MEDIA ATTACHMENTS (TAP ANY PDF / PHOTO / VIDEO TO OPEN IN-APP!) -->
              ${renderAttachmentGalleryHTML(atts)}

              ${
                mySub && mySub.status === 'graded'
                  ? `
                <div class="worksheet-box">
                  <strong>Graded: ${mySub.marks_awarded} / ${asg.max_marks}</strong> — ${esc(mySub.teacher_feedback)}
                </div>
              `
                  : ''
              }

              ${
                isOpen
                  ? `
                ${
                  asg.offline_pack_content
                    ? `<div class="worksheet-box">${esc(asg.offline_pack_content)}</div>`
                    : ''
                }

                ${
                  user.role === 'student'
                    ? `
                  <form class="form-stack submit-work-form" data-assign-id="${esc(asg.id)}" style="border-top:1px solid var(--border-warm);padding-top:0.85rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                      <label style="font-size:0.82rem;font-weight:750;">Your Answer & Photo/PDF Working:</label>
                      <label class="outline-btn upload-picker-label">
                        ${ICONS.paperclip}
                        <span>${ui.uploadingTarget === `sub:${asg.id}` ? 'Uploading...' : 'Attach Photo / PDF / Video'}</span>
                        <input
                          type="file"
                          class="sub-media-input"
                          data-sub-assign-id="${esc(asg.id)}"
                          accept="image/*,application/pdf,.pdf,video/*"
                          multiple
                          hidden
                        />
                      </label>
                    </div>
                    ${renderAttachmentGalleryHTML(stagedSubAtts, { removablePrefix: `sub:${asg.id}` })}
                    <textarea class="field-input draft-textarea" data-draft-id="${esc(
                      asg.id
                    )}" name="answer_text" rows="3" placeholder="Write your solution or notes here...">${esc(
                        draft
                      )}</textarea>
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                      <span class="row-sub">${mySub ? `Status: ${mySub.status.toUpperCase()}` : 'Draft saved offline'}</span>
                      <button class="dark-cta-btn" type="submit">${ICONS.check} ${
                        mySub ? 'Update Submission' : 'Submit Homework'
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
                        ? `<p class="row-sub">No student submissions yet.</p>`
                        : allSubs
                            .map(
                              (sub) => `
                          <div class="list-row" style="flex-direction:column;align-items:stretch;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                              <span class="row-title">${esc(sub.student_name)}</span>
                              <div class="action-cluster">
                                <span class="pill-badge">${
                                  sub.status === 'graded' ? `${sub.marks_awarded}/${asg.max_marks}` : 'Needs Marking'
                                }</span>
                                ${renderMoreMenu(`
                                  <button type="button" class="more-menu-item is-danger" data-del-sub="${esc(sub.id)}">${ICONS.trash} Delete Submission</button>
                                `)}
                              </div>
                            </div>
                            ${
                              sub.answer_text
                                ? `<p style="font-size:0.83rem;white-space:pre-line;margin:0.35rem 0;">${esc(sub.answer_text)}</p>`
                                : ''
                            }
                            ${renderAttachmentGalleryHTML(sub.attachments || [], { compact: true })}
                            <form class="form-grid-2 grade-sub-form" data-sub-id="${esc(sub.id)}" style="margin-top:0.35rem;">
                              <input class="field-input" name="marks_awarded" type="number" min="0" max="${
                                asg.max_marks
                              }" placeholder="Marks / ${asg.max_marks}" value="${sub.marks_awarded ?? ''}" required />
                              <input class="field-input" name="teacher_feedback" placeholder="Feedback..." value="${esc(
                                sub.teacher_feedback || ''
                              )}" required />
                              <button class="dark-cta-btn" type="submit" style="grid-column:1/-1;">Save Mark</button>
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

/* ==========================================================================
   8. OFFLINE STUDY TOOLKIT (CLEAN SUBJECT SELECT + QUIET ⋯ MENUS)
   ========================================================================== */

function buildToolkitStage(user) {
  const tabs = [
    { id: 'notes', label: `Notes (${(vaultState.notes || []).length})` },
    { id: 'quiz', label: `Quiz (${(vaultState.quizzes || []).length})` },
    { id: 'flashcards', label: `Cards (${(vaultState.flashcards || []).length})` },
    { id: 'focus', label: 'Timer & Pad' }
  ];

  return `
    <div class="page-header-row">
      <div>
        <h1>Study Toolkit</h1>
        <p>Revision notes, instant-marked quizzes, 3D flashcards & focus timer.</p>
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
    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.65rem;flex-wrap:wrap;">
      <select class="field-input compact-select" id="notes-subj-select" aria-label="Filter notes by subject">
        ${subjects
          .map(
            (s) => `<option value="${esc(s)}" ${ui.subjectFilter === s ? 'selected' : ''}>${
              s === 'All' ? 'All Subjects' : esc(s)
            }</option>`
          )
          .join('')}
      </select>
      ${
        user.role !== 'visitor'
          ? `<button class="dark-cta-btn" id="toggle-note-modal">${ICONS.plus} ${
              ui.showNoteModal || editingNote ? 'Close' : 'New Note'
            }</button>`
          : ''
      }
    </div>

    ${
      ui.showNoteModal || editingNote
        ? `
      <form class="panel-card form-stack" id="upsert-note-form">
        <div class="panel-head">
          <h2 class="panel-title">${editingNote ? `Edit Note · ${esc(editingNote.title)}` : 'Add Study Note'}</h2>
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
        <textarea class="field-input" name="summary" rows="3" placeholder="Key explanation..." required>${esc(
          editingNote?.summary || ''
        )}</textarea>
        <textarea class="field-input" name="formulasRaw" rows="3" placeholder="Formulas / key rules (one per line)...">${esc(
          (editingNote?.formulas || []).join('\n')
        )}</textarea>
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Note</button>
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
                  <button class="icon-action-btn" data-bookmark-note="${esc(n.id)}" title="Bookmark note">${
            saved ? '★' : '☆'
          }</button>
                  ${
                    canManage
                      ? renderMoreMenu(`
                          <button type="button" class="more-menu-item" data-edit-note="${esc(n.id)}">${ICONS.edit} Edit Note</button>
                          <button type="button" class="more-menu-item is-danger" data-del-note="${esc(n.id)}">${ICONS.trash} Delete Note</button>
                        `)
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
    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.65rem;flex-wrap:wrap;">
      <select class="field-input compact-select" id="quiz-subj-select" aria-label="Filter quiz by subject">
        ${subjects
          .map(
            (s) => `<option value="${esc(s)}" ${ui.quizState.subject === s ? 'selected' : ''}>${
              s === 'All' ? 'All Subjects' : esc(s)
            }</option>`
          )
          .join('')}
      </select>
      ${
        canManage
          ? `<button class="dark-cta-btn" id="toggle-quiz-modal">${ICONS.plus} ${
              ui.showQuizModal || editingQuiz ? 'Close' : 'Add Question'
            }</button>`
          : ''
      }
    </div>

    ${
      canManage && (ui.showQuizModal || editingQuiz)
        ? `
      <form class="panel-card form-stack" id="upsert-quiz-form">
        <div class="panel-head">
          <h3 class="panel-title">${editingQuiz ? 'Edit Question' : 'Add Quiz Question'}</h3>
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
          <input class="field-input" name="opt0" value="${esc(editingQuiz?.options?.[0] || '')}" placeholder="Option A" required />
          <input class="field-input" name="opt1" value="${esc(editingQuiz?.options?.[1] || '')}" placeholder="Option B" required />
          <input class="field-input" name="opt2" value="${esc(editingQuiz?.options?.[2] || '')}" placeholder="Option C" required />
          <input class="field-input" name="opt3" value="${esc(editingQuiz?.options?.[3] || '')}" placeholder="Option D" required />
        </div>
        <div class="form-grid-2">
          <select class="field-input" name="correct_index">
            ${[0, 1, 2, 3]
              .map(
                (i) =>
                  `<option value="${i}" ${Number(editingQuiz?.correct_index ?? 0) === i ? 'selected' : ''}>Correct: ${
                    ['Option A', 'Option B', 'Option C', 'Option D'][i]
                  }</option>`
              )
              .join('')}
          </select>
          <input class="field-input" name="explanation" value="${esc(editingQuiz?.explanation || '')}" placeholder="Explanation" required />
        </div>
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Question</button>
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
            <span class="pill-badge">Quiz Complete</span>
            <h2 style="font-size:1.5rem;font-weight:850;">Score: ${ui.quizState.correctCount} / ${safePool.length}</h2>
            <p class="row-sub">Your Sunrise Confidence meter has been updated.</p>
            <button class="dark-cta-btn" id="restart-quiz-btn">Practice Again</button>
          </div>
        `
            : `
          <div class="panel-head">
            <span class="pill-badge">${esc(current.subject)} · ${esc(current.topic || 'Practice')}</span>
            <div class="action-cluster">
              <span class="muted-pill">${idx + 1} / ${safePool.length}</span>
              ${
                canManage
                  ? renderMoreMenu(`
                      <button type="button" class="more-menu-item" data-edit-quiz="${esc(current.id)}">${ICONS.edit} Edit Question</button>
                      ${
                        allQuizzes.length > 1
                          ? `<button type="button" class="more-menu-item is-danger" data-del-quiz="${esc(current.id)}">${ICONS.trash} Delete</button>`
                          : ''
                      }
                    `)
                  : ''
              }
            </div>
          </div>
          <h2 style="font-size:1.1rem;font-weight:800;line-height:1.45;">${esc(current.question)}</h2>
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
              ${idx + 1 >= safePool.length ? 'Finish Quiz' : 'Next →'}
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
      <span class="pill-badge">${masteredCount} / ${cards.length} Mastered</span>
      <div class="action-cluster">
        ${
          user.role !== 'visitor'
            ? `<button class="dark-cta-btn" id="toggle-card-modal">${ICONS.plus} ${
                ui.showCardModal || editingCard ? 'Close' : 'New Card'
              }</button>`
            : ''
        }
        ${
          card && canManage
            ? renderMoreMenu(`
                <button type="button" class="more-menu-item" data-edit-card="${esc(card.id)}">${ICONS.edit} Edit Card</button>
                ${
                  cards.length > 1
                    ? `<button type="button" class="more-menu-item is-danger" data-del-card="${esc(card.id)}">${ICONS.trash} Delete Card</button>`
                    : ''
                }
              `)
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
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Card</button>
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
            <span class="pill-badge">${esc(card.subject)} · QUESTION</span>
            <h2 style="font-size:1.15rem;font-weight:800;max-width:560px;line-height:1.45;white-space:pre-line;">
              ${esc(card.front)}
            </h2>
            <span class="row-sub">${masteredIds.includes(card.id) ? '✓ Mastered' : 'Tap card to flip'}</span>
          </div>
          <div class="flashcard-face back">
            <span class="pill-badge">${esc(card.subject)} · ANSWER</span>
            <h2 style="font-size:1.12rem;font-weight:800;max-width:560px;line-height:1.45;white-space:pre-line;">
              ${esc(card.back)}
            </h2>
            <span class="row-sub">Tap to flip back</span>
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center;">
        <button class="outline-btn" id="prev-card-btn">← Prev</button>
        <button class="gold-cta-btn" data-master-card="${esc(card.id)}">
          ${masteredIds.includes(card.id) ? '✓ Mastered' : 'Mark Mastered'}
        </button>
        <button class="dark-cta-btn" id="next-card-btn">Next →</button>
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
          <h2 class="panel-title">Focus Timer</h2>
          <span class="pill-badge">${personalState.focusMinutesToday || 25}m Today</span>
        </div>
        <div class="timer-readout-big js-timer-readout ${ui.timerRunning ? 'is-ticking' : ''}">${formatClock(
          ui.timerSeconds
        )}</div>
        <div style="display:flex;justify-content:center;align-items:center;gap:0.55rem;flex-wrap:wrap;">
          <button class="dark-cta-btn" data-timer-action="toggle">${ui.timerRunning ? 'Pause' : 'Start Focus'}</button>
          <select class="field-input compact-select" id="timer-preset-select" aria-label="Timer duration">
            <option value="25" ${Math.round(ui.timerSeconds / 60) === 25 ? 'selected' : ''}>25m Deep Focus</option>
            <option value="15" ${Math.round(ui.timerSeconds / 60) === 15 ? 'selected' : ''}>15m Sprint</option>
            <option value="5" ${Math.round(ui.timerSeconds / 60) === 5 ? 'selected' : ''}>5m Break</option>
          </select>
        </div>

        <div style="border-top:1px solid var(--border-warm);padding-top:0.85rem;margin-top:0.35rem;">
          <h3 class="panel-title" style="margin-bottom:0.45rem;">Study Checklist</h3>
          ${(personalState.tasks || [])
            .map(
              (item) => `
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div class="checklist-row ${item.done ? 'done' : ''}" data-check-id="${esc(item.id)}" style="flex:1;">
                <span class="check-box-sq">${item.done ? '✓' : ''}</span>
                <span>${esc(item.title)}</span>
              </div>
              <button class="quiet-x-btn" data-del-task="${esc(item.id)}" aria-label="Remove task">✕</button>
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
          <h2 class="panel-title">Scratchpad & Math Check</h2>
          <span class="muted-pill">Auto-Saved</span>
        </div>
        <textarea class="field-input" id="scratchpad-area" rows="7" placeholder="Write rough calculations, formulas, or outlines offline...">${esc(
          personalState.scratchpad || ''
        )}</textarea>

        <form class="chat-input-bar" id="quick-calc-form">
          <input class="field-input" name="expr" placeholder="Math check e.g. (15600 / 13) * 12" required />
          <button class="outline-btn" type="submit">=</button>
        </form>
        ${ui.calcOutput ? `<div class="pill-badge" style="align-self:flex-start;">= ${esc(ui.calcOutput)}</div>` : ''}
      </section>
    </div>
  `;
}

/* ==========================================================================
   9. MESSAGES & STUDY GROUPS (PDF, PHOTO & VIDEO UPLOADS + BUILT-IN OPENER)
   ========================================================================== */

function buildMessagesStage(user) {
  if (user.role === 'visitor') {
    return `
      <section class="panel-card">
        <h2 class="panel-title">Chats & Study Groups</h2>
        <p class="row-sub">Apply to join i-tutor to message educators and share PDFs, photos & study videos.</p>
        <div><button class="dark-cta-btn" id="visitor-apply-chat">Apply to Join</button></div>
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
        <h1>Messages & Study Groups</h1>
        <p>Share messages, PDFs, photos & videos — tap any file to open it right inside i-tutor.</p>
      </div>
      <button class="dark-cta-btn" id="toggle-group-creator">${ICONS.plus} ${
    ui.showGroupCreator || editingRoom ? 'Close' : 'New Group'
  }</button>
    </div>

    ${
      ui.showGroupCreator || editingRoom
        ? `
      <form class="panel-card form-stack" id="upsert-room-form">
        <div class="panel-head">
          <h3 class="panel-title">${editingRoom ? `Edit Channel · ${esc(editingRoom.name)}` : 'Create Study Group'}</h3>
          <button type="button" class="outline-btn" id="cancel-room-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingRoom?.id || '')}" />
        <div class="form-grid-2">
          <input class="field-input" name="name" value="${esc(editingRoom?.name || '')}" placeholder="Group / Channel Name" required />
          <input class="field-input" name="subject" value="${esc(editingRoom?.subject || 'Mathematics')}" placeholder="Subject" required />
        </div>
        <input class="field-input" name="members_label" value="${esc(
          editingRoom?.members_label || `Created by ${user.name}`
        )}" placeholder="Subtitle / members" />
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Group</button>
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
            ${
              superEdit
                ? renderMoreMenu(`
                    <button type="button" class="more-menu-item" data-edit-room="${esc(activeRoom.id)}">${ICONS.edit} Edit Channel</button>
                    <button type="button" class="more-menu-item is-danger" data-del-room="${esc(activeRoom.id)}">${ICONS.trash} Delete Channel</button>
                  `)
                : ''
            }
          </div>

          <div class="chat-messages-scroll" id="chat-messages-scroll">
            ${roomMessages
              .map((m) => {
                const mine = m.sender_id === user.id;
                const canModMsg = superEdit || mine;
                const msgAtts = Array.isArray(m.attachments) ? m.attachments : [];

                if (ui.editingMessageId === m.id) {
                  return `
                    <form class="form-stack edit-msg-form" data-msg-id="${esc(m.id)}">
                      <input class="field-input" name="body" value="${esc(m.body)}" />
                      <div class="action-cluster">
                        <button class="dark-cta-btn" type="submit">Save</button>
                        <button class="outline-btn" type="button" data-cancel-msg-edit>Cancel</button>
                      </div>
                    </form>
                  `;
                }
                return `
                  <div class="msg-bubble ${mine ? 'mine' : ''}">
                    <div class="msg-head-row">
                      <span class="msg-author">${esc(m.sender_name)}</span>
                      ${
                        canModMsg
                          ? renderMoreMenu(`
                              <button type="button" class="more-menu-item" data-edit-msg="${esc(m.id)}">${ICONS.edit} Edit</button>
                              <button type="button" class="more-menu-item is-danger" data-del-msg="${esc(m.id)}">${ICONS.trash} Delete</button>
                            `)
                          : ''
                      }
                    </div>
                    ${m.body ? `<div class="msg-body">${esc(m.body)}</div>` : ''}
                    ${renderAttachmentGalleryHTML(msgAtts, { compact: true })}
                  </div>
                `;
              })
              .join('')}
          </div>

          ${
            ui.stagedChatAttachments.length > 0
              ? `
            <div class="chat-staged-strip">
              ${renderAttachmentGalleryHTML(ui.stagedChatAttachments, { compact: true, removablePrefix: 'chat' })}
            </div>
          `
              : ''
          }

          <form class="chat-composer-bar" id="send-msg-form" data-room-id="${esc(activeRoom.id)}">
            <label class="chat-attach-btn" title="Attach Photo, PDF, or Video">
              ${ICONS.paperclip}
              <input
                type="file"
                id="chat-media-input"
                accept="image/*,application/pdf,.pdf,video/*"
                multiple
                hidden
              />
            </label>
            <input
              class="field-input chat-text-field"
              id="chat-text-input"
              name="body"
              value="${esc(ui.chatDraftText)}"
              placeholder="${
                ui.uploadingTarget === 'chat'
                  ? 'Uploading attachment...'
                  : 'Message or attach PDF, photo or video...'
              }"
            />
            <button class="dark-cta-btn chat-send-btn" type="submit" aria-label="Send message">${ICONS.send}</button>
          </form>
        `
            : `<p class="row-sub">Select a conversation on the left.</p>`
        }
      </section>
    </div>
  `;
}

/* ==========================================================================
   10. BROADCASTS & ATTENDANCE (CLEAN TOGGLES + QUIET ⋯ MENUS)
   ========================================================================== */

function buildBroadcastsAttendanceStage(user) {
  const canPost = isStaff(user);
  const students = (vaultState.profiles || []).filter((p) => p.role === 'student');
  const editingBc = ui.editingBroadcastId
    ? (vaultState.broadcasts || []).find((b) => b.id === ui.editingBroadcastId)
    : null;
  const editingAtt = ui.editingAttendanceId
    ? (vaultState.attendance || []).find((a) => a.id === ui.editingAttendanceId)
    : null;

  const isAnnouncements = ui.broadcastSubtab === 'announcements';

  return `
    <div class="page-header-row">
      <div>
        <h1>Broadcasts & Attendance</h1>
        <p>Official academy notices and class attendance logs.</p>
      </div>
      ${
        canPost
          ? isAnnouncements
            ? `<button class="dark-cta-btn" id="btn-toggle-bc-creator">${ICONS.plus} ${
                ui.showBroadcastCreator || editingBc ? 'Close' : 'Post Notice'
              }</button>`
            : `<button class="dark-cta-btn" id="btn-toggle-att-creator">${ICONS.plus} ${
                ui.showAttendanceCreator || editingAtt ? 'Close' : 'Log Attendance'
              }</button>`
          : ''
      }
    </div>

    <div class="subtab-bar">
      <button class="subtab-btn ${isAnnouncements ? 'is-active' : ''}" data-bc-tab="announcements">
        Notices (${(vaultState.broadcasts || []).length})
      </button>
      <button class="subtab-btn ${!isAnnouncements ? 'is-active' : ''}" data-bc-tab="attendance">
        Attendance (${(vaultState.attendance || []).length})
      </button>
    </div>

    ${
      isAnnouncements
        ? `
      ${
        canPost && (ui.showBroadcastCreator || editingBc)
          ? `
        <form class="panel-card form-stack" id="upsert-broadcast-form">
          <div class="panel-head">
            <h2 class="panel-title">${editingBc ? 'Edit Broadcast' : 'Publish Broadcast'}</h2>
            <button type="button" class="outline-btn" id="cancel-bc-edit">Cancel</button>
          </div>
          <input type="hidden" name="id" value="${esc(editingBc?.id || '')}" />
          <div class="form-grid-2">
            <input class="field-input" name="title" value="${esc(editingBc?.title || '')}" placeholder="Headline" required />
            <select class="field-input" name="audience">
              <option value="students_parents" ${editingBc?.audience === 'students_parents' ? 'selected' : ''}>Students & Parents</option>
              <option value="students" ${editingBc?.audience === 'students' ? 'selected' : ''}>Students Only</option>
              <option value="parents" ${editingBc?.audience === 'parents' ? 'selected' : ''}>Parents Only</option>
            </select>
          </div>
          <textarea class="field-input" name="body" rows="2" placeholder="Announcement message..." required>${esc(
            editingBc?.body || ''
          )}</textarea>
          <button class="dark-cta-btn" type="submit">${ICONS.broadcast} ${editingBc ? 'Update' : 'Publish'}</button>
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
              <span class="pill-badge">${esc(b.author_name)}</span>
              ${
                canPost
                  ? renderMoreMenu(`
                      <button type="button" class="more-menu-item" data-edit-bc="${esc(b.id)}">${ICONS.edit} Edit Notice</button>
                      <button type="button" class="more-menu-item is-danger" data-del-bc="${esc(b.id)}">${ICONS.trash} Delete Notice</button>
                    `)
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
      ${
        canPost && (ui.showAttendanceCreator || editingAtt)
          ? `
        <form class="panel-card form-stack" id="upsert-attendance-form">
          <div class="panel-head">
            <h2 class="panel-title">${editingAtt ? 'Edit Attendance' : 'Log Attendance'}</h2>
            <button type="button" class="outline-btn" id="cancel-att-edit">Cancel</button>
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
          )}" placeholder="Lesson recap..." required />
          <button class="dark-cta-btn" type="submit">${ICONS.check} Save Attendance</button>
        </form>
      `
          : ''
      }

      <section class="panel-card">
        <h2 class="panel-title">Class Attendance Log</h2>
        ${(vaultState.attendance || [])
          .map(
            (a) => `
          <div class="list-row">
            <div class="list-row-col">
              <span class="row-title">${esc(a.student_name)} · ${esc(a.subject)}</span>
              <span class="row-sub">${esc(a.session_date)} · ${esc(a.teacher_name)} — "${esc(a.lesson_note)}"</span>
            </div>
            <div class="action-cluster">
              <span class="pill-badge">${esc((a.status || 'present').toUpperCase())}</span>
              ${
                canPost
                  ? renderMoreMenu(`
                      <button type="button" class="more-menu-item" data-edit-att="${esc(a.id)}">${ICONS.edit} Edit</button>
                      <button type="button" class="more-menu-item is-danger" data-del-att="${esc(a.id)}">${ICONS.trash} Remove</button>
                    `)
                  : ''
              }
            </div>
          </div>
        `
          )
          .join('')}
      </section>
    `
    }
  `;
}

/* ==========================================================================
   11. OFFICIAL FLYERS, REAL BOTSWANA PULA PRICES & ADMIN STUDIO
   ========================================================================== */

const BOTSWANA_CALC_OPTIONS = [
  { label: 'Breakthrough Classes (Standard 4–6) — P500 / mo', rate: 500 },
  { label: 'Breakthrough All Subjects (Standard 4–6) — P600 / mo', rate: 600 },
  { label: 'JCE Level — 1 Subject — P200 / mo', rate: 200 },
  { label: 'JCE Level — Science or Mathematics (1 Subject) — P250 / mo', rate: 250 },
  { label: 'JCE Level — Science & Mathematics Combo — P400 / mo', rate: 400 },
  { label: 'JCE Level — Core Subjects (5) — P600 / mo', rate: 600 },
  { label: 'JCE Level — Core + 1 Optional + 2 Practicals — P1,300 / mo', rate: 1300 },
  { label: 'BGCSE / IGCSE — Form 4 (Best 6 Package) — P750 / mo', rate: 750 },
  { label: 'BGCSE / IGCSE — Double Science (Part-Time) — P400 / mo', rate: 400 },
  { label: 'BGCSE / IGCSE — Double Science (Full-Time) — P450 / mo', rate: 450 },
  { label: 'BGCSE / IGCSE — Mathematics (Part-Time) — P250 / mo', rate: 250 },
  { label: 'BGCSE / IGCSE — Mathematics (Full-Time) — P300 / mo', rate: 300 },
  { label: 'BGCSE / IGCSE — Other Subject (Part-Time) — P200 / mo', rate: 200 },
  { label: 'BGCSE / IGCSE — Other Subject (Full-Time) — P250 / mo', rate: 250 }
];

function parseRegFeeNumeric(regFeeStr = 'P100') {
  const m = String(regFeeStr).match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 100;
}

function buildTuitionContactsStage(user) {
  const info = vaultState.tuitionInfo || {};
  const contacts = info.contacts || {};
  const plans = info.plans || [];
  const flyers = Array.isArray(info.flyers) ? info.flyers : [];
  const regFeeLabel = info.registration_fee || 'P100';
  const regFeeAmount = parseRegFeeNumeric(regFeeLabel);
  const promoBanner =
    info.promo_banner ||
    'WE OFFER FREE EXTRA LESSONS! — Homework assistance included · Experienced & caring tutors · Personalized attention';

  const superEdit = canEditEverything(user);
  const editingPlan = ui.editingPlanId ? plans.find((p) => p.id === ui.editingPlanId) : null;
  const editingFlyer = ui.editingFlyerId ? flyers.find((f) => f.id === ui.editingFlyerId) : null;
  const activeFlyerAttachment = ui.stagedFlyerAttachment || editingFlyer?.attachment || null;

  const firstMonthTotal = ui.feeCalcMonthly + (ui.feeCalcIncludeReg ? regFeeAmount : 0);

  return `
    <!-- HERO HEADER WITH OFFICIAL P100 REGISTRATION SEAL -->
    <section class="tuition-hero-card">
      <div class="tuition-hero-main">
        <span class="pill-badge">Francistown, Botswana · Official Tuition & Flyers</span>
        <h1>${esc(info.headline || 'Students Improve Through Tutoring.')}</h1>
        <p>${esc(info.intro || 'Better understanding. Better results. Brighter future.')}</p>
        <div class="free-lessons-strip">
          <strong>★ ${esc(promoBanner)}</strong>
        </div>
        ${
          user.role === 'visitor'
            ? `
          <div class="action-cluster" style="margin-top:0.35rem;">
            <button class="gold-cta-btn" id="visitor-apply-tuition">${ICONS.plus} <span>Apply to Join</span></button>
            <button class="outline-btn" id="visitor-signin-tuition" style="background:rgba(255,255,255,0.08);color:#FAF6F0;border-color:rgba(255,255,255,0.22);">${ICONS.user} <span>Sign In</span></button>
          </div>
        `
            : ''
        }
      </div>

      <div class="reg-fee-seal" aria-label="Registration Fee ${esc(regFeeLabel)}">
        <span class="reg-fee-kicker">FEE:</span>
        <strong class="reg-fee-amount">${esc(regFeeLabel)}</strong>
        <span class="reg-fee-sub">REGISTRATION</span>
        <span class="reg-fee-stars" aria-hidden="true">★ ★ ★</span>
      </div>
    </section>

    <!-- DEDICATED ADMIN STUDIO: ADD FLYERS & PRICES AT WILL -->
    ${
      superEdit
        ? `
      <section class="panel-card admin-studio-bar">
        <div class="admin-studio-copy">
          <span class="pill-badge">Admin Studio</span>
          <h2 class="panel-title">Manage Flyers & Prices At Will</h2>
          <p class="row-sub">Upload promotional flyers/posters, add or edit tuition packages & subject rates, or update the registration fee anytime.</p>
        </div>
        <div class="admin-studio-actions">
          <button type="button" class="gold-cta-btn" id="toggle-flyer-form-btn">
            ${ICONS.photo} <span>${ui.showFlyerForm || editingFlyer ? 'Close Flyer Form' : '+ Add Flyer'}</span>
          </button>
          <button type="button" class="dark-cta-btn" id="toggle-new-plan-btn">
            ${ICONS.plus} <span>${ui.showNewPlanForm || editingPlan ? 'Close Price Form' : '+ Add Price'}</span>
          </button>
          <button type="button" class="outline-btn" id="toggle-tuition-editor">
            ${ICONS.edit} <span>${ui.showTuitionEditor ? 'Close Settings' : 'Reg Fee & Contacts'}</span>
          </button>
        </div>
      </section>
    `
        : ''
    }

    <!-- ADMIN FLYER UPLOADER / EDITOR -->
    ${
      superEdit && (ui.showFlyerForm || editingFlyer)
        ? `
      <form class="panel-card form-stack" id="upsert-flyer-form">
        <div class="panel-head">
          <h2 class="panel-title">${editingFlyer ? `Edit Flyer · ${esc(editingFlyer.title)}` : 'Upload & Publish New Flyer'}</h2>
          <button type="button" class="outline-btn" id="cancel-flyer-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingFlyer?.id || '')}" />
        <div class="form-grid-2">
          <input class="field-input" name="title" value="${esc(editingFlyer?.title || '')}" placeholder="Flyer Title (e.g. 2026 Tuition & Registration Flyer)" required />
          <input class="field-input" name="badge" value="${esc(editingFlyer?.badge || 'Official Flyer')}" placeholder="Badge (e.g. Official Flyer / Exam Promo)" required />
        </div>
        <input class="field-input" name="subtitle" value="${esc(editingFlyer?.subtitle || '')}" placeholder="Short caption (e.g. Breakthrough Std 4–6 · JCE · BGCSE · Reg P100)" />

        <div class="media-upload-zone">
          <div class="media-upload-head">
            <div>
              <strong style="font-size:0.86rem;">Select Flyer Image or PDF Poster</strong>
              <p class="row-sub">Upload JPG, PNG, WebP, or PDF — learners & parents can tap to zoom in full-screen.</p>
            </div>
            <label class="gold-cta-btn upload-picker-label">
              ${ICONS.paperclip}
              <span>${ui.uploadingTarget === 'flyer' ? 'Uploading...' : activeFlyerAttachment ? 'Replace File' : 'Choose Flyer'}</span>
              <input
                type="file"
                id="flyer-media-input"
                accept="image/*,application/pdf,.pdf"
                hidden
              />
            </label>
          </div>
          ${activeFlyerAttachment ? renderAttachmentGalleryHTML([activeFlyerAttachment]) : ''}
        </div>

        <button class="dark-cta-btn" type="submit">${ICONS.check} ${editingFlyer ? 'Update Flyer' : 'Publish Flyer Live'}</button>
      </form>
    `
        : ''
    }

    <!-- ADMIN PRICE PACKAGE CREATOR / EDITOR -->
    ${
      superEdit && (ui.showNewPlanForm || editingPlan)
        ? `
      <form class="panel-card form-stack" id="upsert-plan-form">
        <div class="panel-head">
          <h2 class="panel-title">${editingPlan ? `Edit Price Package · ${esc(editingPlan.name)}` : 'Add New Price Package / Subject Rate'}</h2>
          <button type="button" class="outline-btn" id="cancel-plan-edit">Cancel</button>
        </div>
        <input type="hidden" name="id" value="${esc(editingPlan?.id || '')}" />
        <div class="form-grid-2">
          <input class="field-input" name="name" value="${esc(editingPlan?.name || '')}" placeholder="Level / Package Name (e.g. BGCSE Form 4 Best 6)" required />
          <input class="field-input" name="price" value="${esc(editingPlan?.price || '')}" placeholder="Displayed Price in Pula (e.g. P750.00 / month)" required />
        </div>
        <div class="form-grid-2">
          <input class="field-input" type="number" name="numericRate" value="${esc(editingPlan?.numericRate || 500)}" placeholder="Numeric Pula Amount (e.g. 500)" required />
          <input class="field-input" name="badge" value="${esc(editingPlan?.badge || 'Official Rate')}" placeholder="Badge (e.g. Standard 4 – 6 / JCE / Most Popular)" required />
        </div>
        <textarea class="field-input" name="featuresRaw" rows="4" placeholder="Subject prices & package details (one line per bullet)..." required>${esc(
          (editingPlan?.features || []).join('\n')
        )}</textarea>
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Price Package</button>
      </form>
    `
        : ''
    }

    <!-- ADMIN REGISTRATION FEE, PROMO BANNER & CONTACTS EDITOR -->
    ${
      superEdit && ui.showTuitionEditor
        ? `
      <form class="panel-card form-stack" id="update-tuition-form">
        <div class="panel-head">
          <h2 class="panel-title">Edit Registration Fee, Banner & Francistown Contacts</h2>
          <button type="button" class="outline-btn" id="cancel-tuition-editor">Cancel</button>
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="headline" value="${esc(info.headline || '')}" placeholder="Main Headline" required />
          <input class="field-input" name="registration_fee" value="${esc(regFeeLabel)}" placeholder="Registration Fee (e.g. P100)" required />
        </div>
        <input class="field-input" name="promo_banner" value="${esc(promoBanner)}" placeholder="Highlight Banner (e.g. WE OFFER FREE EXTRA LESSONS!)" required />
        <textarea class="field-input" name="intro" rows="2" placeholder="Intro description..." required>${esc(info.intro || '')}</textarea>
        <div class="form-grid-2">
          <input class="field-input" name="phone" value="${esc(contacts.phone)}" placeholder="Phone (e.g. 77 329 788)" required />
          <input class="field-input" name="whatsapp" value="${esc(contacts.whatsapp)}" placeholder="WhatsApp (e.g. +267 77 329 788)" required />
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="email" value="${esc(contacts.email)}" placeholder="Email (e.g. i-tutor@gmail.com)" required />
          <input class="field-input" name="hours" value="${esc(contacts.hours)}" placeholder="Operating Hours" required />
        </div>
        <input class="field-input" name="address" value="${esc(contacts.address)}" placeholder="Location (e.g. Francistown, Minestone Plot No. 1589, Botswana)" required />
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Settings</button>
      </form>
    `
        : ''
    }

    <!-- REAL BOTSWANA PULA TUITION PACKAGES & SUBJECT PRICES (FRONT & CENTER WHEN OPENING APP) -->
    <div class="pricing-cards-grid">
      ${plans
        .map(
          (plan) => `
        <article class="tuition-plan-card ${plan.badge === 'Most Popular' ? 'popular' : ''}">
          <div style="display:flex;flex-direction:column;gap:0.4rem;">
            <div class="panel-head">
              <span class="pill-badge">${esc(plan.badge)}</span>
              ${
                superEdit
                  ? renderMoreMenu(`
                      <button type="button" class="more-menu-item" data-edit-plan="${esc(plan.id)}">${ICONS.edit} Edit Price</button>
                      ${
                        plans.length > 1
                          ? `<button type="button" class="more-menu-item is-danger" data-del-plan="${esc(plan.id)}">${ICONS.trash} Remove Price</button>`
                          : ''
                      }
                    `)
                  : ''
              }
            </div>
            <h2 class="panel-title">${esc(plan.name)}</h2>
            <div class="plan-price-big">${esc(plan.price)}</div>
            <ul class="plan-bullets">
              ${(plan.features || []).map((f) => `<li>${esc(f)}</li>`).join('')}
            </ul>
          </div>
          <a href="#enquiry-form-card" class="outline-btn" style="text-decoration:none;">Enquire · Reg ${esc(regFeeLabel)}</a>
        </article>
      `
        )
        .join('')}
    </div>

    <!-- OFFICIAL FLYERS & POSTERS GALLERY -->
    ${
      flyers.length > 0
        ? `
      <section class="panel-card">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Official Flyers & Announcements (${flyers.length})</h2>
            <p class="row-sub">Tap any flyer to open & zoom full-screen inside the built-in viewer.</p>
          </div>
        </div>

        <div class="flyers-showcase-grid">
          ${flyers
            .map((fl) => {
              const att = fl.attachment || {};
              const payloadJson = esc(JSON.stringify(att));
              const isImg = (att.kind || 'image') === 'image' && (att.thumbUrl || att.url);
              return `
                <article class="flyer-poster-card">
                  <button
                    type="button"
                    class="flyer-poster-preview"
                    data-open-media="${payloadJson}"
                    title="Tap to open ${esc(fl.title)} in full-screen viewer"
                  >
                    ${
                      isImg
                        ? `<img src="${esc(att.url || att.thumbUrl)}" alt="${esc(fl.title)}" class="flyer-poster-img" loading="lazy" />`
                        : `<div class="flyer-pdf-placeholder">${ICONS.pdf}<span>Tap to Open PDF Flyer</span></div>`
                    }
                    <span class="flyer-zoom-hint">${ICONS.zoomIn} Tap to Zoom Full-Screen</span>
                  </button>
                  <div class="flyer-poster-foot">
                    <div style="min-width:0;flex:1;">
                      <span class="pill-badge">${esc(fl.badge || 'Official Flyer')}</span>
                      <h3 class="panel-title" style="margin-top:0.3rem;">${esc(fl.title)}</h3>
                      ${fl.subtitle ? `<p class="row-sub">${esc(fl.subtitle)}</p>` : ''}
                    </div>
                    ${
                      superEdit
                        ? renderMoreMenu(`
                            <button type="button" class="more-menu-item" data-edit-flyer="${esc(fl.id)}">${ICONS.edit} Edit Flyer</button>
                            <button type="button" class="more-menu-item is-danger" data-del-flyer="${esc(fl.id)}">${ICONS.trash} Delete Flyer</button>
                          `)
                        : ''
                    }
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      </section>
    `
        : ''
    }

    <!-- BOTSWANA PULA FEE ESTIMATOR & FRANCISTOWN CONTACTS -->
    <div class="two-col-grid">
      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Botswana Pula Fee Calculator & Contacts</h2>
          <span class="pill-badge">Reg: ${esc(regFeeLabel)}</span>
        </div>

        <label class="row-sub" style="font-weight:750;">Select Level or Subject Package:</label>
        <select class="field-input" id="calc-rate-select">
          ${BOTSWANA_CALC_OPTIONS.map(
            (opt, idx) =>
              `<option value="${opt.rate}" data-opt-idx="${idx}" ${
                ui.feeCalcMonthly === opt.rate && idx === BOTSWANA_CALC_OPTIONS.findIndex((o) => o.rate === ui.feeCalcMonthly)
                  ? 'selected'
                  : ''
              }>${esc(opt.label)}</option>`
          ).join('')}
        </select>

        <label class="checklist-row" style="cursor:pointer;">
          <input
            type="checkbox"
            id="calc-include-reg"
            ${ui.feeCalcIncludeReg ? 'checked' : ''}
            style="accent-color:var(--gold-deep);width:16px;height:16px;"
          />
          <span>Include once-off Registration Fee (<strong>+${esc(regFeeLabel)}</strong>)</span>
        </label>

        <div class="worksheet-box" style="display:flex;flex-direction:column;gap:0.28rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
            <span>${ui.feeCalcIncludeReg ? `First Month (with ${esc(regFeeLabel)} Registration):` : 'Monthly Tuition:'}</span>
            <strong style="font-size:1.25rem;">P${firstMonthTotal.toLocaleString()}</strong>
          </div>
          <span class="row-sub">Ongoing monthly tuition: <strong>P${ui.feeCalcMonthly.toLocaleString()} / month</strong> · Free extra lessons included!</span>
        </div>

        <div style="border-top:1px solid var(--border-warm);padding-top:0.8rem;display:flex;flex-direction:column;gap:0.36rem;font-size:0.84rem;">
          <div>📍 <strong>${esc(contacts.address || 'Francistown, Minestone Plot No. 1589, Botswana')}</strong></div>
          <div>📞 Contact Us: <strong>${esc(contacts.phone || '77 329 788')}</strong></div>
          <div>✉️ Email: <strong>${esc(contacts.email || 'i-tutor@gmail.com')}</strong></div>
        </div>
      </section>

      <section class="panel-card" id="enquiry-form-card">
        <h2 class="panel-title">Register / Send Tuition Enquiry</h2>
        <p class="row-sub">Select your level (Breakthrough Std 4–6, JCE, or BGCSE / IGCSE) — Admissions responds promptly.</p>
        <form class="form-stack" id="public-enquiry-form">
          <input class="field-input" name="full_name" placeholder="Student or Parent Full Name" required />
          <input class="field-input" name="contact_detail" placeholder="Phone / WhatsApp (e.g. 77 329 788) or Email" required />
          <div class="form-grid-2">
            <input class="field-input" name="student_grade" placeholder="Level (e.g. Std 5 / JCE / Form 4)" required />
            <select class="field-input" name="selected_plan">
              ${plans.map((p) => `<option value="${esc(p.name)}">${esc(p.name)} (${esc(p.price)})</option>`).join('')}
            </select>
          </div>
          <textarea class="field-input" name="message" rows="3" placeholder="Subjects needed (e.g. Mathematics, Double Science, Setswana, English)..." required></textarea>
          <button class="dark-cta-btn" type="submit">${ICONS.send} Send Enquiry</button>
        </form>
      </section>
    </div>
  `;
}

/* ==========================================================================
   12. CLEAN SHELL RENDERER & EVENT WIRING (ZERO TOPBAR / STRIP BUTTON CLUTTER)
   ========================================================================== */

function renderApp(opts = {}) {
  applyTheme();
  const rootEl = document.getElementById('app');
  if (!rootEl) return;

  const prevScrollY = opts.preserveScroll !== false ? window.scrollY : 0;

  const user = getActiveUser();
  if (!user) {
    const animateCard = lastAnimatedKey !== 'auth';
    lastAnimatedKey = 'auth';
    renderAuthPortal(rootEl, { animateCard });
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
    { id: 'tuition', label: 'Flyers & Prices', icon: ICONS.tuition, badge: '' },
    { id: 'overview', label: 'Overview Hub', icon: ICONS.home, badge: '' },
    ...(superEdit
      ? [
          {
            id: 'admissions',
            label: 'Admissions',
            icon: ICONS.users,
            badge: pendingAdmissions ? `${pendingAdmissions}` : ''
          }
        ]
      : []),
    { id: 'assignments', label: 'Homework & Media', icon: ICONS.assignment, badge: String(vaultState.assignments.length) },
    { id: 'messages', label: 'Messages & Groups', icon: ICONS.messages, badge: visibleRooms.length ? String(visibleRooms.length) : '' },
    { id: 'timetable', label: 'Schedule & Exams', icon: ICONS.timetable, badge: '' },
    { id: 'toolkit', label: 'Study Toolkit', icon: ICONS.toolkit, badge: '' },
    { id: 'broadcasts', label: 'Notices & Attendance', icon: ICONS.broadcast, badge: '' },
    { id: 'account', label: user.role === 'visitor' ? 'Join / Sign In' : 'My Account', icon: ICONS.user, badge: '' }
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
      <!-- ZONE 1: CLEAN DESKTOP LEFT RAIL -->
      <aside class="sidebar-rail">
        <div>
          <button class="brand-header-btn" data-nav="tuition" title="Flyers & Prices">
            <div class="sidebar-emblem-wrap">
              ${renderEmblemSVG({ animated: false, uid: 'sidebar', className: 'brand-emblem-svg' })}
            </div>
            <div>
              <div class="brand-title"><span class="gold-i">i</span>-tutor</div>
              <div class="brand-sub">Confidence in learning</div>
            </div>
          </button>

          <nav class="sidebar-nav" aria-label="Main navigation">
            ${navButtonsMarkup('rail')}
          </nav>
        </div>

        <div class="sidebar-footer">
          <div class="account-rail-card">
            <div class="account-rail-top" data-nav="account" style="cursor:pointer;" title="Account settings">
              <div class="account-avatar-gold">${esc(initials(user.name))}</div>
              <div style="min-width:0;flex:1;">
                <div style="font-size:0.82rem;font-weight:800;color:#F8F3EC;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${esc(user.name)}
                </div>
                <div style="font-size:0.67rem;color:var(--gold);font-weight:750;text-transform:uppercase;">
                  ${esc(user.role)} · <span class="dot-indicator ${offline ? 'offline' : ''}" style="margin:0 2px;"></span>${
    offline ? 'Offline' : 'Synced'
  }
                </div>
              </div>
            </div>
            <div class="mini-btn-row">
              <button class="rail-mini-btn" data-action-night="1">${sessionState.theme === 'night' ? '☀ Light' : '☾ Night'}</button>
              <button class="rail-mini-btn" data-action-signout="1">${user.role === 'visitor' ? 'Sign In' : 'Switch'}</button>
            </div>
          </div>
        </div>
      </aside>

      <!-- ZONE 2: CALM, MINIMAL MAIN STAGE -->
      <div class="main-stage">
        <header class="stage-topbar">
          <div class="topbar-left-group">
            <button class="mobile-menu-trigger" id="btn-open-mobile-drawer" aria-label="Open workspace menu">
              ${ICONS.menu}
            </button>

            <div class="mobile-brand-cluster" data-nav="tuition" style="cursor:pointer;">
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
              placeholder="Search homework, notes, schedule, accounts..."
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

            <button class="status-pill-btn" data-action-toggle-offline="1" title="Toggle offline mode">
              <span class="dot-indicator ${offline ? 'offline' : ''}"></span>
              <span>${offline ? (outboxCount ? `Offline (${outboxCount})` : 'Offline') : 'Synced'}</span>
            </button>

            ${
              user.role === 'visitor'
                ? `<button class="gold-cta-btn" data-action-signout="1" style="padding:0.38rem 0.72rem;font-size:0.75rem;" title="Sign In or Apply">Sign In</button>`
                : `<button class="topbar-avatar-btn" data-nav="account" title="${esc(user.name)} — My Account">${esc(initials(user.name))}</button>`
            }
          </div>
        </header>

        <div class="mobile-search-drawer ${ui.mobileSearchOpen || ui.searchQuery ? 'is-open' : ''}">
          <div class="search-box-wrap">
            <span class="search-icon-pos">${ICONS.search}</span>
            <input
              type="search"
              class="global-search-input"
              id="mobile-search-input"
              placeholder="Search homework, notes, schedule..."
              value="${esc(ui.searchQuery)}"
            />
          </div>
        </div>

        <main class="stage-body ${shouldAnimateStage ? 'is-entering' : ''}">
          ${centerHTML}
        </main>
      </div>

      <!-- ZONE 3: CALM DESKTOP WIDGET RAIL -->
      <aside class="context-rail">
        <section class="widget-card">
          <div class="panel-head">
            <span class="panel-title" style="font-size:0.88rem;">Sunrise Confidence</span>
            <span class="pill-badge">${avgConf}%</span>
          </div>
          ${renderSunriseGaugeSVG(avgConf)}
        </section>

        <section class="widget-card">
          <div class="panel-head">
            <span class="panel-title" style="font-size:0.88rem;">Focus Timer</span>
            <button class="text-link-btn" data-timer-action="toggle">${ui.timerRunning ? 'Pause' : 'Start'}</button>
          </div>
          <div class="timer-readout-big js-timer-readout ${ui.timerRunning ? 'is-ticking' : ''}" style="font-size:1.75rem;">${formatClock(
            ui.timerSeconds
          )}</div>
        </section>

        <section class="widget-card">
          <div class="panel-head">
            <span class="panel-title" style="font-size:0.88rem;">Study Checklist</span>
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
        </section>
      </aside>
    </div>

    <!-- SLIDE-OUT MENU DRAWER (ALL SECONDARY UTILITIES TUCKED NEATLY HERE) -->
    <div class="mobile-drawer-backdrop ${ui.mobileDrawerOpen ? 'is-open' : ''}" id="mobile-drawer-backdrop"></div>
    <aside class="mobile-drawer-panel ${ui.mobileDrawerOpen ? 'is-open' : ''}" id="mobile-drawer-panel" aria-label="Workspace menu">
      <div>
        <div class="drawer-head-row">
          <div style="display:flex;align-items:center;gap:0.55rem;">
            <div style="width:34px;height:34px;">${renderEmblemSVG({ animated: false, uid: 'drawer', className: 'brand-emblem-svg' })}</div>
            <div>
              <div class="brand-title" style="font-size:1.02rem;"><span class="gold-i">i</span>-tutor</div>
              <div class="brand-sub">Confidence in learning</div>
            </div>
          </div>
          <button class="drawer-close-btn" id="btn-close-mobile-drawer" aria-label="Close menu">${ICONS.close}</button>
        </div>

        <nav class="sidebar-nav" style="margin-top:0.75rem;" aria-label="Drawer navigation">
          ${navButtonsMarkup('drawer')}
        </nav>
      </div>

      <div class="sidebar-footer" style="margin-top:0.85rem;">
        <div class="offline-vault-box">
          <div class="vault-status-row">
            <span><span class="dot-indicator ${offline ? 'offline' : ''}"></span>${
    offline ? 'Offline Mode' : 'Cloud Synced'
  }</span>
            ${outboxCount ? `<span class="nav-badge">${outboxCount} Queued</span>` : ''}
          </div>
          <div class="mini-btn-row">
            <button class="rail-mini-btn" data-action-sync="1">Sync Now</button>
            <button class="rail-mini-btn" data-action-toggle-offline="1">${offline ? 'Go Online' : 'Test Offline'}</button>
          </div>
          <div class="mini-btn-row">
            <button class="rail-mini-btn" data-action-night="1">${sessionState.theme === 'night' ? '☀ Light' : '☾ Night'}</button>
            <button class="rail-mini-btn" data-action-export="1">⬇ Backup</button>
          </div>
          <div class="mini-btn-row">
            <button class="rail-mini-btn" data-action-replay="1">↻ 10s Intro</button>
            <button class="rail-mini-btn" data-action-signout="1">Switch User</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- CLEAN 4-TAB MOBILE BOTTOM BAR (PRICES · HUB · HOMEWORK · CHATS — NO BOTTOM-CORNER MENU BUTTON) -->
    <nav class="mobile-tabbar" aria-label="Mobile bottom navigation">
      <button class="mob-tab-btn ${ui.view === 'tuition' ? 'is-active' : ''}" data-nav="tuition">
        ${ICONS.tuition}<span>Prices</span>
      </button>
      <button class="mob-tab-btn ${ui.view === 'overview' ? 'is-active' : ''}" data-nav="overview">
        ${ICONS.home}<span>Hub</span>
      </button>
      <button class="mob-tab-btn ${ui.view === 'assignments' ? 'is-active' : ''}" data-nav="assignments">
        ${ICONS.assignment}<span>Homework</span>
      </button>
      <button class="mob-tab-btn ${ui.view === 'messages' ? 'is-active' : ''}" data-nav="messages">
        ${ICONS.messages}<span>Chats</span>
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
  ui.showAuthPortal = true;
  ui.authTab = defaultTab;
  ui.authError = '';
  ui.authSuccess = '';
  renderApp();
}

async function handleFileSelection(fileList, targetKey, getExistingList, setNextList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  ui.uploadingTarget = targetKey;
  renderApp({ preserveScroll: true });

  const uploaded = [];
  for (const file of files) {
    const att = await uploadAndCacheMediaFile(file, { simulateOffline: isOfflineActive() });
    uploaded.push(att);
  }

  ui.uploadingTarget = '';
  setNextList([...getExistingList(), ...uploaded]);
  renderApp({ preserveScroll: true });
  showToast(`${uploaded.length} ${uploaded.length === 1 ? 'file' : 'files'} attached & ready!`);
}

function bindWorkspaceEvents(user) {
  // Close any open ⋯ row menus when clicking outside
  document.querySelectorAll('.row-more-menu').forEach((menuEl) => {
    menuEl.addEventListener('toggle', () => {
      if (menuEl.open) {
        document.querySelectorAll('.row-more-menu[open]').forEach((other) => {
          if (other !== menuEl) other.open = false;
        });
      }
    });
  });

  // Built-In In-App Media Opener triggers (PDFs, Photos, Videos anywhere in Homework or Chats!)
  document.querySelectorAll('[data-open-media]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        const att = JSON.parse(btn.getAttribute('data-open-media') || '{}');
        openInAppMediaViewer(att);
      } catch {
        showToast('Could not open attachment.');
      }
    });
  });

  // Remove staged media attachment before sending/saving
  document.querySelectorAll('[data-remove-staged]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const prefix = btn.getAttribute('data-remove-staged');
      const idx = Number(btn.getAttribute('data-remove-idx'));
      if (prefix === 'assign') {
        ui.stagedAssignAttachments.splice(idx, 1);
      } else if (prefix === 'chat') {
        ui.stagedChatAttachments.splice(idx, 1);
      } else if (prefix?.startsWith('sub:')) {
        const asgId = prefix.slice(4);
        const cur = [...(ui.stagedSubmissionAttachments[asgId] || [])];
        cur.splice(idx, 1);
        ui.stagedSubmissionAttachments[asgId] = cur;
      }
      renderApp({ preserveScroll: true });
    });
  });

  // Mobile Slide-Out Drawer controls
  const openDrawer = () => {
    ui.mobileDrawerOpen = true;
    document.getElementById('mobile-drawer-backdrop')?.classList.add('is-open');
    document.getElementById('mobile-drawer-panel')?.classList.add('is-open');
  };
  const closeDrawer = () => {
    ui.mobileDrawerOpen = false;
    document.getElementById('mobile-drawer-backdrop')?.classList.remove('is-open');
    document.getElementById('mobile-drawer-panel')?.classList.remove('is-open');
  };

  document.getElementById('btn-open-mobile-drawer')?.addEventListener('click', openDrawer);
  document.getElementById('btn-close-mobile-drawer')?.addEventListener('click', closeDrawer);
  document.getElementById('mobile-drawer-backdrop')?.addEventListener('click', closeDrawer);

  // Mobile Expandable Search toggle
  document.getElementById('btn-toggle-mobile-search')?.addEventListener('click', () => {
    ui.mobileSearchOpen = !ui.mobileSearchOpen;
    renderApp({ preserveScroll: true });
    if (ui.mobileSearchOpen) {
      document.getElementById('mobile-search-input')?.focus();
    }
  });

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

  ['btn-signout-main', 'btn-go-signin-portal', 'visitor-signin-tuition'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => signOutToPortal('signin'));
  });

  ['btn-go-join-portal', 'visitor-apply-cta', 'visitor-apply-tuition', 'visitor-apply-chat'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => signOutToPortal('join'));
  });

  document.getElementById('quick-new-assign-btn')?.addEventListener('click', () => {
    ui.view = 'assignments';
    ui.editingAssignmentId = null;
    ui.stagedAssignAttachments = [];
    ui.showAssignCreator = true;
    renderApp({ preserveScroll: false });
  });

  // Global search
  ['global-search-input', 'mobile-search-input'].forEach((inputId) => {
    const searchInput = document.getElementById(inputId);
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        ui.searchQuery = e.target.value;
        const pos = e.target.selectionStart;
        if (ui.view === 'overview' && ui.searchQuery.trim().length > 1) {
          ui.view = 'assignments';
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

  // Sync & Offline controls
  document.querySelectorAll('[data-action-sync]').forEach((syncBtn) => {
    syncBtn.addEventListener('click', async () => {
      ui.mobileDrawerOpen = false;
      const res = await syncWithServer({ simulateOffline: sessionState.simulateOffline });
      if (res.vault) vaultState = res.vault;
      renderApp({ preserveScroll: true });
      showToast(res.status === 'synced' ? 'Synced with cloud database!' : 'Offline mode active — stored locally.');
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
        showToast('Back Online! Queued changes & media synced.');
      } else {
        renderApp({ preserveScroll: true });
        showToast('Offline Mode ON: Uploads & edits save to device.');
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
  document.getElementById('role-filter-select')?.addEventListener('change', (e) => {
    ui.roleFilter = e.target.value;
    renderApp();
  });

  document.getElementById('btn-toggle-new-account')?.addEventListener('click', () => {
    if (ui.editingAccountId || ui.showNewAccountForm) {
      ui.editingAccountId = null;
      ui.showNewAccountForm = false;
    } else {
      ui.showNewAccountForm = true;
    }
    renderApp();
  });

  document.getElementById('btn-cancel-account-edit')?.addEventListener('click', () => {
    ui.editingAccountId = null;
    ui.showNewAccountForm = false;
    renderApp();
  });

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
      showToast(`Accepted & activated ${target.name}!`);
    });
  });

  document.querySelectorAll('[data-decline-acc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-decline-acc');
      const target = (vaultState.profiles || []).find((p) => p.id === id);
      if (!target) return;
      performActionAndSync('UPSERT_ACCOUNT', { ...target, status: 'declined' }, 'Application declined.');
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
      showToast(`Enrolled ${newAcc.name} (PIN: 1234)!`);
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
        'Account profile saved!'
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

  document.getElementById('btn-toggle-slot-creator')?.addEventListener('click', () => {
    if (ui.editingTimetableId || ui.showSlotCreator) {
      ui.editingTimetableId = null;
      ui.showSlotCreator = false;
    } else {
      ui.showSlotCreator = true;
    }
    renderApp();
  });

  document.querySelectorAll('[data-edit-tt]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.editingTimetableId = el.getAttribute('data-edit-tt');
      ui.showSlotCreator = false;
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.getElementById('cancel-tt-edit')?.addEventListener('click', () => {
    ui.editingTimetableId = null;
    ui.showSlotCreator = false;
    renderApp();
  });

  document.querySelectorAll('[data-del-tt]').forEach((el) => {
    el.addEventListener('click', () => {
      performActionAndSync('DELETE_TIMETABLE', { id: el.getAttribute('data-del-tt') }, 'Slot removed.');
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
      ui.showSlotCreator = false;
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
        existingId ? 'Slot updated!' : 'Saved to schedule!'
      );
    });
  }

  document.getElementById('btn-toggle-exam-creator')?.addEventListener('click', () => {
    if (ui.editingExamId || ui.showExamCreator) {
      ui.editingExamId = null;
      ui.showExamCreator = false;
    } else {
      ui.showExamCreator = true;
    }
    renderApp();
  });

  document.querySelectorAll('[data-edit-exam]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingExamId = btn.getAttribute('data-edit-exam');
      ui.showExamCreator = false;
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
      ui.showExamCreator = false;
      savePersonal(personalState);
      showToast('Exam countdown saved!');
      renderApp();
    });
  }

  // --- HOMEWORK / ASSIGNMENTS & MEDIA UPLOAD EVENTS ---
  document.getElementById('toggle-assign-creator')?.addEventListener('click', () => {
    if (ui.editingAssignmentId || ui.showAssignCreator) {
      ui.editingAssignmentId = null;
      ui.showAssignCreator = false;
      ui.stagedAssignAttachments = [];
    } else {
      ui.showAssignCreator = true;
      ui.stagedAssignAttachments = [];
    }
    renderApp();
  });

  document.getElementById('cancel-assign-edit')?.addEventListener('click', () => {
    ui.editingAssignmentId = null;
    ui.showAssignCreator = false;
    ui.stagedAssignAttachments = [];
    renderApp();
  });

  document.querySelectorAll('[data-edit-assign]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-assign');
      const target = (vaultState.assignments || []).find((a) => a.id === id);
      ui.editingAssignmentId = id;
      ui.showAssignCreator = false;
      ui.stagedAssignAttachments = [...(target?.attachments || [])];
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-del-assign]').forEach((btn) => {
    btn.addEventListener('click', () => {
      performActionAndSync('DELETE_ASSIGNMENT', { id: btn.getAttribute('data-del-assign') }, 'Homework deleted.');
    });
  });

  // Homework Photo / PDF / Video file picker (Admin, Admissions, Teacher)
  const assignMediaInput = document.getElementById('assign-media-input');
  if (assignMediaInput) {
    assignMediaInput.addEventListener('change', (e) => {
      handleFileSelection(
        e.target.files,
        'assign',
        () => ui.stagedAssignAttachments,
        (next) => {
          ui.stagedAssignAttachments = next;
        }
      );
    });
  }

  const upsertAssignForm = document.getElementById('upsert-assign-form');
  if (upsertAssignForm) {
    upsertAssignForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertAssignForm);
      const existingId = fd.get('id');
      const newId = existingId || `asg-${Date.now()}`;
      const attachments = [...ui.stagedAssignAttachments];
      const instructions = String(fd.get('instructions') || '').trim();
      const packText = String(fd.get('offline_pack_content') || '').trim();

      if (!attachments.length && !instructions && !packText) {
        showToast('Please attach a Photo/PDF/Video or enter homework instructions.');
        return;
      }

      ui.editingAssignmentId = null;
      ui.showAssignCreator = false;
      ui.stagedAssignAttachments = [];
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
          instructions: instructions || 'Open the attached homework media pack below.',
          offline_pack_content: packText,
          attachments
        },
        existingId ? 'Homework updated!' : 'Homework published & sent!'
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

  // Student Homework Submission Photo / PDF / Video picker
  document.querySelectorAll('.sub-media-input').forEach((inp) => {
    inp.addEventListener('change', (e) => {
      const asgId = inp.getAttribute('data-sub-assign-id');
      const mySub = (vaultState.submissions || []).find(
        (s) => s.assignment_id === asgId && s.student_id === user.id
      );
      handleFileSelection(
        e.target.files,
        `sub:${asgId}`,
        () => ui.stagedSubmissionAttachments[asgId] ?? (mySub?.attachments || []),
        (next) => {
          ui.stagedSubmissionAttachments[asgId] = next;
        }
      );
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
      const answerText = String(fd.get('answer_text') || '').trim();
      const attachments = ui.stagedSubmissionAttachments[assignId] ?? (existing?.attachments || []);

      if (!answerText && !attachments.length) {
        showToast('Write your answer or attach a photo/PDF of your work.');
        return;
      }

      delete ui.stagedSubmissionAttachments[assignId];
      performActionAndSync(
        'SUBMIT_ASSIGNMENT',
        {
          id: existing ? existing.id : `subm-${Date.now()}`,
          assignment_id: assignId,
          student_id: user.id,
          student_name: user.name,
          answer_text: answerText || 'Attached homework working.',
          attachments,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        },
        'Homework submitted!'
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

  // --- STUDY TOOLKIT EVENTS ---
  document.querySelectorAll('[data-tk-tab]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.toolkitTab = el.getAttribute('data-tk-tab');
      renderApp();
    });
  });

  document.getElementById('notes-subj-select')?.addEventListener('change', (e) => {
    ui.subjectFilter = e.target.value;
    renderApp();
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

  document.getElementById('toggle-note-modal')?.addEventListener('click', () => {
    if (ui.editingNoteId || ui.showNoteModal) {
      ui.editingNoteId = null;
      ui.showNoteModal = false;
    } else {
      ui.showNoteModal = true;
    }
    renderApp();
  });

  document.getElementById('cancel-note-edit')?.addEventListener('click', () => {
    ui.editingNoteId = null;
    ui.showNoteModal = false;
    renderApp();
  });

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
        'Study note saved!'
      );
    });
  }

  // Quizzes
  document.getElementById('toggle-quiz-modal')?.addEventListener('click', () => {
    if (ui.editingQuizId || ui.showQuizModal) {
      ui.editingQuizId = null;
      ui.showQuizModal = false;
    } else {
      ui.showQuizModal = true;
    }
    renderApp();
  });

  document.getElementById('cancel-quiz-edit')?.addEventListener('click', () => {
    ui.editingQuizId = null;
    ui.showQuizModal = false;
    renderApp();
  });

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
      performActionAndSync('DELETE_QUIZ', { id: btn.getAttribute('data-del-quiz') }, 'Question deleted.');
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
        'Quiz question saved!'
      );
    });
  }

  document.getElementById('quiz-subj-select')?.addEventListener('change', (e) => {
    ui.quizState = {
      subject: e.target.value,
      index: 0,
      picked: null,
      correctCount: 0,
      finished: false
    };
    renderApp();
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

  document.getElementById('next-quiz-btn')?.addEventListener('click', () => {
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

  document.getElementById('restart-quiz-btn')?.addEventListener('click', () => {
    ui.quizState = { ...ui.quizState, index: 0, picked: null, correctCount: 0, finished: false };
    renderApp();
  });

  // Flashcards
  const flipStage = document.getElementById('flip-card-stage');
  if (flipStage) {
    const doFlip = () => {
      ui.cardState.flipped = !ui.cardState.flipped;
      document.getElementById('flashcard-3d-inner')?.classList.toggle('is-flipped', ui.cardState.flipped);
    };
    flipStage.addEventListener('click', doFlip);
    flipStage.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        doFlip();
      }
    });
  }

  document.getElementById('prev-card-btn')?.addEventListener('click', () => {
    const len = Math.max(1, (vaultState.flashcards || []).length);
    ui.cardState = { index: (ui.cardState.index - 1 + len) % len, flipped: false };
    renderApp();
  });

  document.getElementById('next-card-btn')?.addEventListener('click', () => {
    const len = Math.max(1, (vaultState.flashcards || []).length);
    ui.cardState = { index: (ui.cardState.index + 1) % len, flipped: false };
    renderApp();
  });

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

  document.getElementById('toggle-card-modal')?.addEventListener('click', () => {
    if (ui.editingCardId || ui.showCardModal) {
      ui.editingCardId = null;
      ui.showCardModal = false;
    } else {
      ui.showCardModal = true;
    }
    renderApp();
  });

  document.getElementById('cancel-card-edit')?.addEventListener('click', () => {
    ui.editingCardId = null;
    ui.showCardModal = false;
    renderApp();
  });

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
      performActionAndSync('DELETE_FLASHCARD', { id: btn.getAttribute('data-del-card') }, 'Card deleted.');
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
        'Flashcard saved!'
      );
    });
  }

  // Focus Timer, Checklist & Scratchpad
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

  document.getElementById('timer-preset-select')?.addEventListener('change', (e) => {
    const mins = Number(e.target.value);
    ui.timerRunning = false;
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
    ui.timerSeconds = mins * 60;
    renderApp();
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

  document.getElementById('add-checklist-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    personalState.tasks.unshift({
      id: `tk-${Date.now()}`,
      title: fd.get('title'),
      subject: 'Study',
      done: false
    });
    savePersonal(personalState);
    renderApp();
  });

  document.getElementById('scratchpad-area')?.addEventListener('input', (e) => {
    personalState.scratchpad = e.target.value;
    savePersonal(personalState);
  });

  document.getElementById('quick-calc-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = String(new FormData(e.target).get('expr') || '');
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

  // --- MESSENGER & CHAT MEDIA UPLOAD EVENTS ---
  document.querySelectorAll('.room-btn[data-room-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.selectedRoomId = btn.getAttribute('data-room-id');
      renderApp();
    });
  });

  document.getElementById('toggle-group-creator')?.addEventListener('click', () => {
    if (ui.editingRoomId || ui.showGroupCreator) {
      ui.editingRoomId = null;
      ui.showGroupCreator = false;
    } else {
      ui.showGroupCreator = true;
    }
    renderApp();
  });

  document.getElementById('cancel-room-edit')?.addEventListener('click', () => {
    ui.editingRoomId = null;
    ui.showGroupCreator = false;
    renderApp();
  });

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
      performActionAndSync('DELETE_MESSAGE', { id: btn.getAttribute('data-del-msg') }, 'Message deleted.');
    });
  });

  // Preserve chat draft text while attaching Photos/PDFs/Videos
  document.getElementById('chat-text-input')?.addEventListener('input', (e) => {
    ui.chatDraftText = e.target.value;
  });

  // Chat Photo / PDF / Video file picker
  document.getElementById('chat-media-input')?.addEventListener('change', (e) => {
    handleFileSelection(
      e.target.files,
      'chat',
      () => ui.stagedChatAttachments,
      (next) => {
        ui.stagedChatAttachments = next;
      }
    );
  });

  const sendMsgForm = document.getElementById('send-msg-form');
  if (sendMsgForm) {
    sendMsgForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(sendMsgForm);
      const text = String(fd.get('body') || '').trim();
      const attachments = [...ui.stagedChatAttachments];
      if (!text && !attachments.length) {
        showToast('Type a message or attach a PDF, photo, or video.');
        return;
      }
      const roomId = sendMsgForm.getAttribute('data-room-id');
      ui.stagedChatAttachments = [];
      ui.chatDraftText = '';
      performActionAndSync('SEND_MESSAGE', {
        id: `msg-${Date.now()}`,
        room_id: roomId,
        sender_id: user.id,
        sender_name: user.name,
        sender_role: user.role,
        body: text,
        attachments,
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

  document.getElementById('btn-toggle-bc-creator')?.addEventListener('click', () => {
    if (ui.editingBroadcastId || ui.showBroadcastCreator) {
      ui.editingBroadcastId = null;
      ui.showBroadcastCreator = false;
    } else {
      ui.showBroadcastCreator = true;
    }
    renderApp();
  });

  document.querySelectorAll('[data-edit-bc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingBroadcastId = btn.getAttribute('data-edit-bc');
      ui.showBroadcastCreator = false;
      renderApp();
    });
  });

  document.getElementById('cancel-bc-edit')?.addEventListener('click', () => {
    ui.editingBroadcastId = null;
    ui.showBroadcastCreator = false;
    renderApp();
  });

  document.querySelectorAll('[data-del-bc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      performActionAndSync('DELETE_BROADCAST', { id: btn.getAttribute('data-del-bc') }, 'Notice deleted.');
    });
  });

  const upsertBroadcastForm = document.getElementById('upsert-broadcast-form');
  if (upsertBroadcastForm) {
    upsertBroadcastForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertBroadcastForm);
      const existingId = fd.get('id');
      ui.editingBroadcastId = null;
      ui.showBroadcastCreator = false;
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
        existingId ? 'Notice updated!' : 'Notice published!'
      );
    });
  }

  document.getElementById('btn-toggle-att-creator')?.addEventListener('click', () => {
    if (ui.editingAttendanceId || ui.showAttendanceCreator) {
      ui.editingAttendanceId = null;
      ui.showAttendanceCreator = false;
    } else {
      ui.showAttendanceCreator = true;
    }
    renderApp();
  });

  document.querySelectorAll('[data-edit-att]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingAttendanceId = btn.getAttribute('data-edit-att');
      ui.showAttendanceCreator = false;
      renderApp();
    });
  });

  document.getElementById('cancel-att-edit')?.addEventListener('click', () => {
    ui.editingAttendanceId = null;
    ui.showAttendanceCreator = false;
    renderApp();
  });

  document.querySelectorAll('[data-del-att]').forEach((btn) => {
    btn.addEventListener('click', () => {
      performActionAndSync('DELETE_ATTENDANCE', { id: btn.getAttribute('data-del-att') }, 'Attendance removed.');
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
      ui.showAttendanceCreator = false;
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

  // --- FLYERS, BOTSWANA PULA PRICES & CONTACTS EVENTS ---
  document.getElementById('calc-rate-select')?.addEventListener('change', (e) => {
    ui.feeCalcMonthly = Number(e.target.value) || 500;
    renderApp({ preserveScroll: true });
  });

  document.getElementById('calc-include-reg')?.addEventListener('change', (e) => {
    ui.feeCalcIncludeReg = Boolean(e.target.checked);
    renderApp({ preserveScroll: true });
  });

  // Flyer Upload / Edit / Delete (Admin & Admissions)
  document.getElementById('toggle-flyer-form-btn')?.addEventListener('click', () => {
    if (ui.editingFlyerId || ui.showFlyerForm) {
      ui.editingFlyerId = null;
      ui.showFlyerForm = false;
      ui.stagedFlyerAttachment = null;
    } else {
      ui.showFlyerForm = true;
      ui.showNewPlanForm = false;
      ui.showTuitionEditor = false;
      ui.stagedFlyerAttachment = null;
    }
    renderApp({ preserveScroll: true });
  });

  document.getElementById('cancel-flyer-edit')?.addEventListener('click', () => {
    ui.editingFlyerId = null;
    ui.showFlyerForm = false;
    ui.stagedFlyerAttachment = null;
    renderApp({ preserveScroll: true });
  });

  document.getElementById('flyer-media-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    ui.uploadingTarget = 'flyer';
    renderApp({ preserveScroll: true });
    const uploaded = await uploadAndCacheMediaFile(file, { simulateOffline: isOfflineActive() });
    ui.uploadingTarget = '';
    ui.stagedFlyerAttachment = uploaded;
    renderApp({ preserveScroll: true });
    showToast('Flyer file ready to publish!');
  });

  document.querySelectorAll('[data-edit-flyer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-flyer');
      const target = (vaultState.tuitionInfo.flyers || []).find((f) => f.id === id);
      ui.editingFlyerId = id;
      ui.showFlyerForm = false;
      ui.stagedFlyerAttachment = target?.attachment || null;
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-del-flyer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del-flyer');
      const nextFlyers = (vaultState.tuitionInfo.flyers || []).filter((f) => f.id !== id);
      performActionAndSync(
        'UPDATE_TUITION_INFO',
        { flyers: nextFlyers },
        'Flyer removed!'
      );
    });
  });

  const upsertFlyerForm = document.getElementById('upsert-flyer-form');
  if (upsertFlyerForm) {
    upsertFlyerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(upsertFlyerForm);
      const existingId = fd.get('id');
      const prev = existingId ? (vaultState.tuitionInfo.flyers || []).find((f) => f.id === existingId) : null;
      const att = ui.stagedFlyerAttachment || prev?.attachment;
      if (!att) {
        showToast('Please select a flyer image or PDF first.');
        return;
      }
      const flyerObj = {
        id: existingId || `flyer-${Date.now()}`,
        title: fd.get('title'),
        badge: fd.get('badge') || 'Official Flyer',
        subtitle: fd.get('subtitle') || '',
        attachment: att,
        created_at: prev?.created_at || new Date().toISOString()
      };
      const currentFlyers = [...(vaultState.tuitionInfo.flyers || [])];
      const idx = currentFlyers.findIndex((f) => f.id === flyerObj.id);
      if (idx >= 0) currentFlyers[idx] = flyerObj;
      else currentFlyers.unshift(flyerObj);

      ui.editingFlyerId = null;
      ui.showFlyerForm = false;
      ui.stagedFlyerAttachment = null;
      performActionAndSync(
        'UPDATE_TUITION_INFO',
        { flyers: currentFlyers },
        existingId ? 'Flyer updated!' : 'New flyer published live!'
      );
    });
  }

  document.getElementById('toggle-tuition-editor')?.addEventListener('click', () => {
    ui.showTuitionEditor = !ui.showTuitionEditor;
    if (ui.showTuitionEditor) {
      ui.showFlyerForm = false;
      ui.showNewPlanForm = false;
    }
    renderApp({ preserveScroll: true });
  });

  document.getElementById('cancel-tuition-editor')?.addEventListener('click', () => {
    ui.showTuitionEditor = false;
    renderApp({ preserveScroll: true });
  });

  document.getElementById('toggle-new-plan-btn')?.addEventListener('click', () => {
    if (ui.editingPlanId || ui.showNewPlanForm) {
      ui.editingPlanId = null;
      ui.showNewPlanForm = false;
    } else {
      ui.showNewPlanForm = true;
      ui.showFlyerForm = false;
      ui.showTuitionEditor = false;
    }
    renderApp({ preserveScroll: true });
  });

  document.getElementById('cancel-plan-edit')?.addEventListener('click', () => {
    ui.editingPlanId = null;
    ui.showNewPlanForm = false;
    renderApp({ preserveScroll: true });
  });

  document.querySelectorAll('[data-edit-plan]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.editingPlanId = btn.getAttribute('data-edit-plan');
      ui.showNewPlanForm = false;
      ui.showFlyerForm = false;
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
        { plans: nextPlans },
        'Price package removed!'
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
        numericRate: Number(fd.get('numericRate')) || 500,
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
        { plans: currentPlans },
        existingId ? 'Price package updated!' : 'New price package added!'
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
          registration_fee: fd.get('registration_fee') || 'P100',
          promo_banner: fd.get('promo_banner') || '',
          intro: fd.get('intro'),
          contacts: {
            phone: fd.get('phone'),
            whatsapp: fd.get('whatsapp'),
            email: fd.get('email'),
            hours: fd.get('hours'),
            address: fd.get('address')
          }
        },
        'Registration fee & contacts updated!'
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
        'Enquiry sent!'
      );
    });
  }
}

/* Global listener to close any open ⋯ row menu when tapping anywhere outside */
document.addEventListener('click', (e) => {
  if (!e.target.closest('.row-more-menu')) {
    document.querySelectorAll('.row-more-menu[open]').forEach((el) => {
      el.open = false;
    });
  }
});

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
