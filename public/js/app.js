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
  dispatchOfflineAction,
  syncWithServer
} from './offlineStore.js';

const SPLASH_DURATION_MS = 10000;

const LOADING_CAPTIONS = [
  { threshold: 0, text: 'Initializing i-tutor workspace...' },
  { threshold: 22, text: 'Downloading saved timetables & study notes...' },
  { threshold: 50, text: 'Caching remote assignments & offline packs...' },
  { threshold: 78, text: 'Syncing study groups, broadcasts & tuition hub...' },
  { threshold: 95, text: 'Ready — Confidence in learning.' }
];

const VISITOR_PROFILE = {
  id: 'visitor',
  name: 'Prospective Learner / Parent',
  role: 'visitor',
  subtitle: 'Exploring Tuition Packages & Contacts',
  grade: 'Open Preview'
};

const ui = {
  view: 'overview', // overview | timetable | assignments | toolkit | messages | broadcasts | tuition
  searchQuery: '',
  timetableDay: 'All',
  subjectFilter: 'All',
  expandedAssignmentId: 'asg-1',
  showAssignCreator: false,
  toolkitTab: 'notes', // notes | quiz | flashcards | focus
  showNoteModal: false,
  showCardModal: false,
  quizState: { subject: 'All', index: 0, picked: null, correctCount: 0, finished: false },
  cardState: { index: 0, flipped: false },
  selectedRoomId: null,
  showGroupCreator: false,
  broadcastSubtab: 'announcements', // announcements | attendance
  feeCalcSessions: 2,
  feeCalcRate: 220,
  showTuitionEditor: false,
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

function esc(str = '') {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getActiveUser() {
  if (sessionState.currentUserId === 'visitor') return VISITOR_PROFILE;
  return (
    (vaultState.profiles || []).find((p) => p.id === sessionState.currentUserId) ||
    vaultState.profiles?.[0] ||
    VISITOR_PROFILE
  );
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

function showToast(msg) {
  ui.toast = msg;
  renderWorkspace();
  if (toastHandle) clearTimeout(toastHandle);
  toastHandle = setTimeout(() => {
    ui.toast = '';
    renderWorkspace();
  }, 3300);
}

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getVisibleRooms(user) {
  if (user.role === 'visitor') return [];
  if (user.role === 'admin') return vaultState.rooms || [];
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
  renderWorkspace();
  if (!isOfflineActive()) {
    const res = await syncWithServer({ simulateOffline: false });
    if (res.vault) vaultState = res.vault;
    renderWorkspace();
  }
  if (toastMessage) showToast(toastMessage);
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

  // Background auto-download while the 10-second intro plays
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
   2. WORKSPACE VIEWS (UNIFIED OFFLINE TOOLKIT + MULTI-ROLE SYNC FEATURES)
   ========================================================================== */

function buildOverviewStage(user) {
  if (user.role === 'visitor') {
    return buildVisitorOverview();
  }

  const avgConf = getOverallConfidence(personalState);
  const weakest = getWeakestSubject(personalState);
  const mySubs = (vaultState.submissions || []).filter((s) => s.student_id === user.id);
  const pendingCount = (vaultState.assignments || []).filter(
    (a) => !mySubs.some((s) => s.assignment_id === a.id)
  ).length;
  const ungradedCount = (vaultState.submissions || []).filter((s) => s.status !== 'graded').length;
  const visibleRooms = getVisibleRooms(user);
  const attendanceRecords = vaultState.attendance || [];
  const presentRatio = attendanceRecords.length
    ? Math.round((attendanceRecords.filter((a) => a.status === 'present').length / attendanceRecords.length) * 100)
    : 96;

  const latestBroadcast = (vaultState.broadcasts || [])[0];

  let kpis = [];
  if (user.role === 'teacher' || user.role === 'admin') {
    kpis = [
      {
        label: 'Saved Class Schedule',
        value: `${vaultState.timetables.length} Slots`,
        foot: 'Auto-downloaded to devices',
        go: 'timetable'
      },
      {
        label: 'Submissions to Mark',
        value: `${ungradedCount} Waiting`,
        foot: `${vaultState.assignments.length} active remote packs`,
        go: 'assignments'
      },
      {
        label: 'Class Attendance',
        value: `${presentRatio}%`,
        foot: `${attendanceRecords.length} logged recaps`,
        go: 'broadcasts'
      },
      {
        label: user.role === 'admin' ? 'Tuition Enquiries' : 'Active Chat Rooms',
        value: user.role === 'admin' ? `${vaultState.enquiries.length} Leads` : `${visibleRooms.length} Open`,
        foot: user.role === 'admin' ? 'Admissions & price settings' : '1-on-1s & study groups',
        go: user.role === 'admin' ? 'tuition' : 'messages'
      }
    ];
  } else if (user.role === 'parent') {
    const childSubs = (vaultState.submissions || []).filter((s) => s.student_id === 'stu-thabo');
    const graded = childSubs.find((s) => s.status === 'graded');
    kpis = [
      {
        label: "Thabo's Attendance",
        value: `${presentRatio}%`,
        foot: 'View lesson recaps',
        go: 'broadcasts'
      },
      {
        label: 'Latest Graded Task',
        value: graded ? `${graded.marks_awarded} Marks` : 'In Progress',
        foot: 'Read teacher feedback',
        go: 'assignments'
      },
      {
        label: 'Saved Timetable',
        value: `${vaultState.timetables.length} Classes`,
        foot: 'Stored offline on your phone',
        go: 'timetable'
      },
      {
        label: 'Direct Teacher Chats',
        value: `${visibleRooms.length} Channels`,
        foot: 'Message educators directly',
        go: 'messages'
      }
    ];
  } else {
    kpis = [
      {
        label: 'Sunrise Confidence',
        value: `${avgConf}%`,
        foot: `Focus next: ${weakest.subject}`,
        go: 'toolkit'
      },
      {
        label: 'Remote Assignments',
        value: `${pendingCount} Due`,
        foot: `${vaultState.assignments.length} packs cached offline`,
        go: 'assignments'
      },
      {
        label: 'Saved Timetable',
        value: `${vaultState.timetables.length} Slots`,
        foot: 'Available with zero data',
        go: 'timetable'
      },
      {
        label: 'Notes & Flashcards',
        value: `${vaultState.notes.length + personalState.flashcards.length} Ready`,
        foot: 'Formulas, quizzes & recall',
        go: 'toolkit'
      }
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
        <span class="pill-badge">Open Feed</span>
      </button>
    `
        : ''
    }

    <div class="page-header-row">
      <div>
        <h1>Welcome, ${esc(user.name)}</h1>
        <p>${esc(user.subtitle || user.grade)} · All study tools, schedules & remote packs work offline and auto-sync when connected.</p>
      </div>
      <div style="display:flex;gap:0.55rem;flex-wrap:wrap;">
        ${
          user.role === 'teacher' || user.role === 'admin'
            ? `<button class="dark-cta-btn" id="quick-new-assign-btn">${ICONS.plus} Post Remote Assignment</button>`
            : `<button class="dark-cta-btn" data-open-toolkit="quiz">${ICONS.quiz} Quick Offline Quiz</button>`
        }
        <button class="outline-btn" data-nav="tuition">${ICONS.tuition} Tuition & Contact</button>
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
          <button class="outline-btn" data-nav="timetable">Full Schedule</button>
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
          <button class="outline-btn" data-nav="assignments">View All</button>
        </div>
        ${(vaultState.assignments || [])
          .slice(0, 3)
          .map((asg) => {
            const sub = (vaultState.submissions || []).find(
              (s) =>
                s.assignment_id === asg.id &&
                (user.role === 'parent' ? s.student_id === 'stu-thabo' : s.student_id === user.id)
            );
            const label = sub
              ? sub.status === 'graded'
                ? `${sub.marks_awarded}/${asg.max_marks}`
                : 'Submitted'
              : `Due ${asg.due_date}`;
            return `
              <div class="list-row">
                <div class="list-row-col">
                  <span class="row-title">${esc(asg.title)}</span>
                  <span class="row-sub">${esc(asg.subject)} · ${esc(asg.teacher_name)}</span>
                </div>
                <button class="outline-btn" data-jump-assign="${esc(asg.id)}">${esc(label)}</button>
              </div>
            `;
          })
          .join('')}
      </section>
    </div>

    <div class="two-col-grid">
      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Complete Offline Study Toolkit</h2>
          <span class="muted-pill">All Original Study Tools Included</span>
        </div>
        <div class="form-grid-2">
          <button class="list-row" style="border:none;cursor:pointer;text-align:left;" data-open-toolkit="notes">
            <div class="list-row-col">
              <span class="row-title">Notes & Formula Vault</span>
              <span class="row-sub">${vaultState.notes.length} revision summaries</span>
            </div>
          </button>
          <button class="list-row" style="border:none;cursor:pointer;text-align:left;" data-open-toolkit="quiz">
            <div class="list-row-col">
              <span class="row-title">Auto-Marked Quizzes</span>
              <span class="row-sub">${vaultState.quizzes.length} instant-feedback questions</span>
            </div>
          </button>
          <button class="list-row" style="border:none;cursor:pointer;text-align:left;" data-open-toolkit="flashcards">
            <div class="list-row-col">
              <span class="row-title">3D Flip Flashcards</span>
              <span class="row-sub">${personalState.flashcards.length} active recall cards</span>
            </div>
          </button>
          <button class="list-row" style="border:none;cursor:pointer;text-align:left;" data-open-toolkit="focus">
            <div class="list-row-col">
              <span class="row-title">Timer & Scratchpad</span>
              <span class="row-sub">Focus sprints + math evaluator</span>
            </div>
          </button>
        </div>
      </section>

      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Subject Confidence Progress</h2>
          <span class="pill-badge">Overall ${avgConf}%</span>
        </div>
        ${Object.entries(personalState.subjectConfidence || {})
          .map(
            ([subj, pct]) => `
          <div style="display:flex;flex-direction:column;gap:0.25rem;">
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;font-weight:750;">
              <span>${esc(subj)}</span>
              <span>${pct}%</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
        `
          )
          .join('')}
      </section>
    </div>
  `;
}

function buildVisitorOverview() {
  const info = vaultState.tuitionInfo;
  return `
    <section class="panel-card" style="background:linear-gradient(135deg, rgba(242,183,40,0.22), var(--surface-ivory));">
      <span class="pill-badge" style="align-self:flex-start;">Open Visitor Hub · No Login Required</span>
      <h1 style="font-size:1.62rem;font-weight:850;letter-spacing:-0.03em;">Explore i-tutor Tuition Packages, Contacts & Free Study Tools</h1>
      <p style="font-size:0.9rem;color:var(--charcoal-soft);line-height:1.5;">
        Not joined yet? View transparent monthly & hourly tuition rates, calculate estimated sessions, try our offline sample quiz, or message Admissions directly.
      </p>
      <div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-top:0.2rem;">
        <button class="dark-cta-btn" data-nav="tuition">${ICONS.tuition} View Full Tuition Prices & Contacts</button>
        <button class="outline-btn" data-open-toolkit="quiz">${ICONS.quiz} Try Free Sample Quiz</button>
      </div>
    </section>

    <div class="pricing-cards-grid">
      ${(info.plans || [])
        .map(
          (plan) => `
        <article class="tuition-plan-card ${plan.badge === 'Most Popular' ? 'popular' : ''}">
          <div style="display:flex;flex-direction:column;gap:0.4rem;">
            <div class="panel-head">
              <span class="panel-title">${esc(plan.name)}</span>
              <span class="pill-badge">${esc(plan.badge)}</span>
            </div>
            <div class="plan-price-big">${esc(plan.price)}</div>
            <ul class="plan-bullets">
              ${(plan.features || []).map((f) => `<li>${esc(f)}</li>`).join('')}
            </ul>
          </div>
          <button class="outline-btn" data-nav="tuition">Contact & Enquire</button>
        </article>
      `
        )
        .join('')}
    </div>
  `;
}

/* --- TIMETABLE & EXAM COUNTDOWNS --- */

function buildTimetableStage(user) {
  const days = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const q = ui.searchQuery.trim().toLowerCase();

  const slots = (vaultState.timetables || []).filter((slot) => {
    const dayOk = ui.timetableDay === 'All' || slot.day_of_week === ui.timetableDay;
    const searchOk =
      !q ||
      (slot.subject || '').toLowerCase().includes(q) ||
      (slot.topic || '').toLowerCase().includes(q) ||
      (slot.teacher_name || '').toLowerCase().includes(q);
    return dayOk && searchOk;
  });

  return `
    <div class="page-header-row">
      <div>
        <h1>Saved Offline Timetable & Exam Countdowns</h1>
        <p>Your class schedule and personal revision blocks stay stored on your device — zero internet needed to check times.</p>
      </div>
      <span class="pill-badge">${ICONS.check} Auto-Saved Offline</span>
    </div>

    <div class="subtab-bar">
      ${days
        .map(
          (d) => `
        <button class="subtab-btn ${ui.timetableDay === d ? 'is-active' : ''}" data-tt-day="${d}">${d}</button>
      `
        )
        .join('')}
    </div>

    <div class="two-col-grid">
      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Weekly Schedule (${slots.length})</h2>
        </div>
        ${
          slots.length === 0
            ? `<p class="row-sub">No classes match this day/filter yet.</p>`
            : slots
                .map(
                  (s) => `
              <div class="list-row">
                <div class="list-row-col">
                  <span class="row-title">${esc(s.subject)} · <span class="muted-pill">${esc(s.grade_group)}</span></span>
                  <span class="row-sub">${esc(s.day_of_week)} · ${esc(s.start_time)}–${esc(s.end_time)} · ${esc(
                    s.location_mode
                  )}</span>
                  <span class="row-sub">${esc(s.topic)} (${esc(s.teacher_name)})</span>
                </div>
                ${
                  user.role === 'admin' || user.role === 'teacher' || s.owner_id === user.id
                    ? `<button class="outline-btn" data-del-tt="${esc(s.id)}">Remove</button>`
                    : ''
                }
              </div>
            `
                )
                .join('')
        }

        <form class="form-stack" id="add-tt-form" style="margin-top:0.5rem;padding-top:0.85rem;border-top:1px solid var(--border-warm);">
          <span class="panel-title" style="font-size:0.9rem;">
            ${user.role === 'teacher' || user.role === 'admin' ? '+ Publish Official Class Slot' : '+ Save Personal Revision Slot'}
          </span>
          <div class="form-grid-2">
            <select class="field-input" name="day_of_week" required>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
            </select>
            <input class="field-input" name="subject" placeholder="Subject (e.g. Mathematics)" required />
          </div>
          <div class="form-grid-2">
            <input class="field-input" name="start_time" placeholder="Start (e.g. 16:00)" required />
            <input class="field-input" name="end_time" placeholder="End (e.g. 17:30)" required />
          </div>
          <input class="field-input" name="topic" placeholder="Topic / Focus (e.g. Trig Past Paper 2)" required />
          <input class="field-input" name="location_mode" placeholder="Room or Mode (e.g. Studio A / Home Study)" required />
          <button class="dark-cta-btn" type="submit">${ICONS.plus} Save Slot Offline & Sync</button>
        </form>
      </section>

      <section class="panel-card">
        <div class="panel-head">
          <h2 class="panel-title">Upcoming Exam Countdowns</h2>
          <span class="muted-pill">Personal Planner</span>
        </div>
        ${(personalState.exams || [])
          .map(
            (ex) => `
          <div class="list-row">
            <div class="list-row-col">
              <span class="row-title">${esc(ex.title)}</span>
              <span class="row-sub">${esc(ex.subject)}</span>
            </div>
            <span class="pill-badge">${Number(ex.daysAway)} days away</span>
          </div>
        `
          )
          .join('')}

        <form class="form-stack" id="add-exam-form" style="margin-top:0.5rem;padding-top:0.85rem;border-top:1px solid var(--border-warm);">
          <span class="panel-title" style="font-size:0.9rem;">+ Track Another Exam</span>
          <input class="field-input" name="title" placeholder="Paper Name (e.g. English Paper 2)" required />
          <div class="form-grid-2">
            <input class="field-input" name="subject" placeholder="Subject" required />
            <input class="field-input" type="number" min="1" max="365" name="daysAway" placeholder="Days left (e.g. 18)" required />
          </div>
          <button class="outline-btn" type="submit">${ICONS.plus} Add Countdown</button>
        </form>
      </section>
    </div>
  `;
}

/* --- REMOTE ASSIGNMENTS, AUTO-DOWNLOADED PACKS & GRADING --- */

function buildAssignmentsStage(user) {
  const canCreate = user.role === 'teacher' || user.role === 'admin';
  const q = ui.searchQuery.trim().toLowerCase();

  const list = (vaultState.assignments || []).filter(
    (a) => !q || (a.title || '').toLowerCase().includes(q) || (a.subject || '').toLowerCase().includes(q)
  );

  return `
    <div class="page-header-row">
      <div>
        <h1>Remote Assignments & Auto-Downloaded Packs</h1>
        <p>Teachers publish tasks remotely. Full worksheet packs cache onto student devices automatically for offline completion.</p>
      </div>
      ${
        canCreate
          ? `<button class="dark-cta-btn" id="toggle-assign-creator">${ICONS.plus} ${
              ui.showAssignCreator ? 'Close Composer' : 'Post Remote Assignment'
            }</button>`
          : ''
      }
    </div>

    ${
      canCreate && ui.showAssignCreator
        ? `
      <form class="panel-card form-stack" id="create-assign-form">
        <h2 class="panel-title">Publish Remote Assignment & Offline Worksheet Pack</h2>
        <div class="form-grid-2">
          <input class="field-input" name="title" placeholder="Assignment Title" required />
          <input class="field-input" name="subject" placeholder="Subject (e.g. Mathematics)" required />
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="due_date" type="date" value="2026-12-05" required />
          <input class="field-input" name="max_marks" type="number" value="30" min="5" max="100" required />
        </div>
        <textarea class="field-input" name="instructions" rows="2" placeholder="Clear instructions for learners..." required></textarea>
        <textarea class="field-input" name="offline_pack_content" rows="4" placeholder="Offline Worksheet Questions & Formula Hints (auto-downloaded to student phones)..." required></textarea>
        <button class="dark-cta-btn" type="submit">${ICONS.sync} Publish & Auto-Push Pack</button>
      </form>
    `
        : ''
    }

    <div class="form-stack" style="gap:1rem;">
      ${list
        .map((asg) => {
          const isOpen = ui.expandedAssignmentId === asg.id;
          const allSubs = (vaultState.submissions || []).filter((s) => s.assignment_id === asg.id);
          const mySub = allSubs.find((s) =>
            user.role === 'parent' ? s.student_id === 'stu-thabo' : s.student_id === user.id
          );
          const draft = personalState.assignmentDrafts?.[asg.id] ?? (mySub ? mySub.answer_text : '');

          return `
            <article class="panel-card">
              <div class="panel-head">
                <div>
                  <span class="pill-badge">${esc(asg.subject)} · ${asg.max_marks} Marks</span>
                  <h2 class="panel-title" style="margin-top:0.35rem;font-size:1.08rem;">${esc(asg.title)}</h2>
                  <p class="row-sub">${esc(asg.teacher_name)} · Due ${esc(asg.due_date)} · ✓ Offline Pack Downloaded</p>
                </div>
                <button class="outline-btn" data-toggle-assign="${esc(asg.id)}">
                  ${isOpen ? 'Hide Worksheet' : 'Open Offline Pack'}
                </button>
              </div>

              <p style="font-size:0.86rem;line-height:1.5;color:var(--charcoal-soft);">${esc(asg.instructions)}</p>

              ${
                mySub && mySub.status === 'graded'
                  ? `
                <div class="worksheet-box">
                  <strong>Graded Result: ${mySub.marks_awarded} / ${asg.max_marks}</strong>\nTeacher Feedback: ${esc(
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
                    <label style="font-size:0.8rem;font-weight:750;">Your Working & Answer (auto-saved offline as you type):</label>
                    <textarea class="field-input draft-textarea" data-draft-id="${esc(
                      asg.id
                    )}" name="answer_text" rows="4" placeholder="Write your step-by-step solution offline here..." required>${esc(
                        draft
                      )}</textarea>
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                      <span class="row-sub">${
                        mySub ? `Status: ${mySub.status.toUpperCase()}` : 'Draft safely stored on device'
                      }</span>
                      <button class="dark-cta-btn" type="submit">${ICONS.check} ${
                        mySub ? 'Update Answer' : 'Submit Assignment'
                      }</button>
                    </div>
                  </form>
                `
                    : ''
                }

                ${
                  canCreate
                    ? `
                  <div class="form-stack" style="border-top:1px solid var(--border-warm);padding-top:0.85rem;">
                    <strong style="font-size:0.86rem;">Student Submissions (${allSubs.length})</strong>
                    ${
                      allSubs.length === 0
                        ? `<p class="row-sub">No submissions received yet.</p>`
                        : allSubs
                            .map(
                              (sub) => `
                          <div class="list-row" style="flex-direction:column;align-items:stretch;">
                            <div style="display:flex;justify-content:space-between;">
                              <span class="row-title">${esc(sub.student_name)}</span>
                              <span class="pill-badge">${
                                sub.status === 'graded' ? `${sub.marks_awarded}/${asg.max_marks}` : 'Awaiting Mark'
                              }</span>
                            </div>
                            <p style="font-size:0.83rem;white-space:pre-line;margin:0.35rem 0;">${esc(sub.answer_text)}</p>
                            <form class="form-grid-2 grade-sub-form" data-sub-id="${esc(sub.id)}">
                              <input class="field-input" name="marks_awarded" type="number" min="0" max="${
                                asg.max_marks
                              }" placeholder="Marks / ${asg.max_marks}" value="${sub.marks_awarded ?? ''}" required />
                              <input class="field-input" name="teacher_feedback" placeholder="Feedback for student & parent..." value="${esc(
                                sub.teacher_feedback || ''
                              )}" required />
                              <button class="dark-cta-btn" type="submit" style="grid-column:1/-1;">Save Grade & Sync</button>
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

/* --- COMPLETE OFFLINE STUDY TOOLKIT (NOTES + QUIZZES + FLASHCARDS + FOCUS/SCRATCHPAD) --- */

function buildToolkitStage(user) {
  const tabs = [
    { id: 'notes', label: `Notes & Formulas (${vaultState.notes.length})` },
    { id: 'quiz', label: `Auto-Marked Quizzes (${vaultState.quizzes.length})` },
    { id: 'flashcards', label: `3D Flashcards (${personalState.flashcards.length})` },
    { id: 'focus', label: 'Focus Timer & Scratchpad' }
  ];

  return `
    <div class="page-header-row">
      <div>
        <h1>Offline Study Toolkit</h1>
        <p>Every study tool works 100% offline — formula vault, auto-marked quizzes, 3D flip flashcards, Pomodoro focus clock & math scratchpad.</p>
      </div>
    </div>

    <div class="subtab-bar">
      ${tabs
        .map(
          (t) => `
        <button class="subtab-btn ${ui.toolkitTab === t.id ? 'is-active' : ''}" data-tk-tab="${t.id}">
          ${esc(t.label)}
        </button>
      `
        )
        .join('')}
    </div>

    ${ui.toolkitTab === 'notes' ? buildNotesSubstage(user) : ''}
    ${ui.toolkitTab === 'quiz' ? buildQuizSubstage() : ''}
    ${ui.toolkitTab === 'flashcards' ? buildFlashcardsSubstage() : ''}
    ${ui.toolkitTab === 'focus' ? buildFocusScratchpadSubstage() : ''}
  `;
}

function buildNotesSubstage() {
  const subjects = ['All', ...SUBJECT_LIST];
  const q = ui.searchQuery.trim().toLowerCase();

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
          .map(
            (s) => `
          <button class="subtab-btn ${ui.subjectFilter === s ? 'is-active' : ''}" data-subj-filter="${esc(s)}">${esc(s)}</button>
        `
          )
          .join('')}
      </div>
      <button class="dark-cta-btn" id="toggle-note-modal">${ICONS.plus} ${
    ui.showNoteModal ? 'Close Editor' : 'Add Study Note / Formula'
  }</button>
    </div>

    ${
      ui.showNoteModal
        ? `
      <form class="panel-card form-stack" id="add-note-form">
        <h2 class="panel-title">Create Shared Offline Study Note & Formulas</h2>
        <div class="form-grid-2">
          <input class="field-input" name="title" placeholder="Note Title (e.g. Euclidean Circle Theorems)" required />
          <select class="field-input" name="subject">
            ${SUBJECT_LIST.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
          </select>
        </div>
        <textarea class="field-input" name="summary" rows="3" placeholder="Concise revision explanation..." required></textarea>
        <textarea class="field-input" name="formulasRaw" rows="2" placeholder="Key formulas / rules (one per line)..."></textarea>
        <button class="dark-cta-btn" type="submit">${ICONS.check} Save Note Offline & Sync</button>
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
                <button class="outline-btn" data-bookmark-note="${esc(n.id)}">${saved ? '★ Bookmarked' : '☆ Bookmark'}</button>
              </div>
              <h3 class="panel-title">${esc(n.title)}</h3>
              <p style="font-size:0.85rem;line-height:1.55;color:var(--charcoal-soft);">${esc(n.summary)}</p>
              ${
                (n.formulas || []).length
                  ? `
                <div class="formula-list-box">
                  ${n.formulas.map((f) => `<div>• ${esc(f)}</div>`).join('')}
                </div>
              `
                  : ''
              }
              <span class="row-sub">Author: ${esc(n.author_name || 'i-tutor Educator')}</span>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function buildQuizSubstage() {
  const allQuizzes = [...(vaultState.quizzes || []), ...(personalState.customQuizzes || [])];
  const subjects = ['All', ...new Set(allQuizzes.map((q) => q.subject))];
  const pool =
    ui.quizState.subject === 'All'
      ? allQuizzes
      : allQuizzes.filter((q) => q.subject === ui.quizState.subject);

  const safePool = pool.length ? pool : allQuizzes;
  const idx = ui.quizState.index % safePool.length;
  const current = safePool[idx];

  return `
    <div class="subtab-bar">
      ${subjects
        .map(
          (s) => `
        <button class="subtab-btn ${ui.quizState.subject === s ? 'is-active' : ''}" data-quiz-subj="${esc(s)}">${esc(s)}</button>
      `
        )
        .join('')}
    </div>

    <div class="panel-card">
      ${
        ui.quizState.finished
          ? `
        <div style="text-align:center;padding:1.25rem;display:flex;flex-direction:column;align-items:center;gap:0.75rem;">
          <span class="pill-badge">Offline Quiz Complete</span>
          <h2 style="font-size:1.5rem;font-weight:850;">Score: ${ui.quizState.correctCount} / ${safePool.length}</h2>
          <p class="row-sub">Your Sunrise Confidence meter has been updated automatically!</p>
          <button class="dark-cta-btn" id="restart-quiz-btn">Take Another Quiz</button>
        </div>
      `
          : `
        <div class="panel-head">
          <span class="pill-badge">${esc(current.subject)} · ${esc(current.topic || 'Practice')}</span>
          <span class="muted-pill">Question ${idx + 1} of ${safePool.length}</span>
        </div>
        <h2 style="font-size:1.12rem;font-weight:800;line-height:1.45;">${esc(current.question)}</h2>
        <div class="form-stack">
          ${current.options
            .map((opt, i) => {
              let cls = 'quiz-choice-btn';
              if (ui.quizState.picked !== null) {
                if (i === current.correctIndex) cls += ' correct';
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
            <strong>${ui.quizState.picked === current.correctIndex ? '✓ Spot On!' : 'Explanation:'}</strong>\n${esc(
                current.explanation
              )}
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
  `;
}

function buildFlashcardsSubstage() {
  const cards = personalState.flashcards || [];
  const card = cards[ui.cardState.index % cards.length];
  const masteredCount = cards.filter((c) => c.mastered).length;

  return `
    <div class="panel-head">
      <span class="pill-badge">${masteredCount} of ${cards.length} Cards Mastered</span>
      <button class="dark-cta-btn" id="toggle-card-modal">${ICONS.plus} ${
    ui.showCardModal ? 'Close Creator' : 'Add Custom Flashcard'
  }</button>
    </div>

    ${
      ui.showCardModal
        ? `
      <form class="panel-card form-stack" id="add-card-form">
        <h3 class="panel-title">Create Custom Offline Flashcard</h3>
        <select class="field-input" name="subject">
          ${SUBJECT_LIST.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select>
        <input class="field-input" name="front" placeholder="Front Question / Prompt" required />
        <textarea class="field-input" name="back" rows="2" placeholder="Back Answer / Formula" required></textarea>
        <button class="dark-cta-btn" type="submit">Add to Deck</button>
      </form>
    `
        : ''
    }

    <div class="flashcard-flip-card" id="flip-card-stage">
      <span class="pill-badge">${esc(card.subject)} · ${ui.cardState.flipped ? 'ANSWER' : 'QUESTION (Tap Card to Flip)'}</span>
      <h2 style="font-size:1.24rem;font-weight:800;max-width:560px;line-height:1.45;white-space:pre-line;">
        ${esc(ui.cardState.flipped ? card.back : card.front)}
      </h2>
      <span class="row-sub">${card.mastered ? '✓ Mastered' : 'Tap card to reveal answer'}</span>
    </div>

    <div style="display:flex;justify-content:space-between;gap:0.6rem;flex-wrap:wrap;">
      <button class="outline-btn" id="prev-card-btn">← Previous</button>
      <button class="gold-cta-btn" data-master-card="${esc(card.id)}">
        ${card.mastered ? '✓ Mastered (Tap to Undo)' : 'Mark Mastered ✓'}
      </button>
      <button class="dark-cta-btn" id="next-card-btn">Next Card →</button>
    </div>
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
        <div class="timer-readout-big">${formatClock(ui.timerSeconds)}</div>
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
            <div class="checklist-row ${item.done ? 'done' : ''}" data-check-id="${esc(item.id)}">
              <span class="check-box-sq">${item.done ? '✓' : ''}</span>
              <span>${esc(item.title)}</span>
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
          <h2 class="panel-title">Offline Scratchpad & Math Expression Check</h2>
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

/* --- 2-PANE SPLIT MESSENGER (1-ON-1 TEACHER CHATS & STUDY GROUPS) --- */

function buildMessagesStage(user) {
  if (user.role === 'visitor') {
    return `
      <section class="panel-card">
        <h2 class="panel-title">Direct Teacher Chats & Student Study Groups</h2>
        <p class="row-sub">Once enrolled, learners and parents unlock direct 1-on-1 teacher messaging and peer study groups with full offline message queuing.</p>
        <div><button class="dark-cta-btn" data-nav="tuition">See Tuition Packages & Contact Us</button></div>
      </section>
    `;
  }

  const rooms = getVisibleRooms(user);
  const activeRoom = getActiveRoom(user);
  const roomMessages = activeRoom ? (vaultState.messages || []).filter((m) => m.room_id === activeRoom.id) : [];

  return `
    <div class="page-header-row">
      <div>
        <h1>Direct Teacher Chats & Student Study Groups</h1>
        <p>Chat 1-on-1 with teachers or collaborate in peer study groups — messages queue offline and deliver automatically.</p>
      </div>
      <button class="dark-cta-btn" id="toggle-group-creator">${ICONS.plus} ${
    ui.showGroupCreator ? 'Close Creator' : 'Form Study Group'
  }</button>
    </div>

    ${
      ui.showGroupCreator
        ? `
      <form class="panel-card form-stack" id="create-group-form">
        <h3 class="panel-title">Create Collaborative Student Study Group</h3>
        <div class="form-grid-2">
          <input class="field-input" name="name" placeholder="Study Group Name (e.g. Accounting Paper 1 Squad)" required />
          <select class="field-input" name="subject">
            ${SUBJECT_LIST.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
          </select>
        </div>
        <button class="dark-cta-btn" type="submit">Create & Open Group</button>
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
            <div style="min-width:0;">
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
            <span class="pill-badge">Auto-Sync Chat</span>
          </div>

          <div class="chat-messages-scroll">
            ${roomMessages
              .map((m) => {
                const mine = m.sender_id === user.id;
                return `
                  <div class="msg-bubble ${mine ? 'mine' : ''}">
                    <div class="msg-author">${esc(m.sender_name)} (${esc(m.sender_role)})</div>
                    <div class="msg-body">${esc(m.body)}</div>
                  </div>
                `;
              })
              .join('')}
          </div>

          <form class="chat-input-bar" id="send-msg-form" data-room-id="${esc(activeRoom.id)}">
            <input class="field-input" name="body" placeholder="Type your message (saves offline if disconnected)..." required />
            <button class="dark-cta-btn" type="submit">${ICONS.send} Send</button>
          </form>
        `
            : `<p class="row-sub">Select a conversation on the left.</p>`
        }
      </section>
    </div>
  `;
}

/* --- BROADCASTS & OFFLINE ATTENDANCE REGISTER --- */

function buildBroadcastsAttendanceStage(user) {
  const canPost = user.role === 'admin' || user.role === 'teacher';
  const students = (vaultState.profiles || []).filter((p) => p.role === 'student');

  return `
    <div class="page-header-row">
      <div>
        <h1>School Broadcasts & Offline Class Attendance</h1>
        <p>Official Admin & Teacher announcements to Students & Parents, plus transparent lesson attendance & recaps.</p>
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
        <form class="panel-card form-stack" id="post-broadcast-form">
          <h2 class="panel-title">Publish Official Broadcast to Students & Parents</h2>
          <div class="form-grid-2">
            <input class="field-input" name="title" placeholder="Broadcast Headline" required />
            <select class="field-input" name="audience">
              <option value="students_parents">Students & Parents</option>
              <option value="students">Students Only</option>
              <option value="parents">Parents Only</option>
            </select>
          </div>
          <textarea class="field-input" name="body" rows="2" placeholder="Announcement message..." required></textarea>
          <button class="dark-cta-btn" type="submit">${ICONS.broadcast} Send Broadcast</button>
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
              <span class="pill-badge">${b.priority === 'important' ? '📌 Priority Broadcast' : 'Notice'}</span>
              <span class="row-sub">${esc(b.author_name)}</span>
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
          <form class="panel-card form-stack" id="log-attendance-form">
            <h2 class="panel-title">Log Offline Class Attendance & Recap</h2>
            <div class="form-grid-2">
              <select class="field-input" name="student_id" required>
                ${students.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.grade)})</option>`).join('')}
              </select>
              <select class="field-input" name="status" required>
                <option value="present">Present ✓</option>
                <option value="late">Late ⏱</option>
                <option value="absent">Absent ✕</option>
              </select>
            </div>
            <div class="form-grid-2">
              <select class="field-input" name="subject">
                ${SUBJECT_LIST.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
              </select>
              <input class="field-input" type="date" name="session_date" value="2026-11-25" required />
            </div>
            <input class="field-input" name="lesson_note" placeholder="Lesson recap note visible to student & parent..." required />
            <button class="dark-cta-btn" type="submit">${ICONS.check} Save Attendance Offline & Sync</button>
          </form>
        `
            : ''
        }

        <section class="panel-card" style="${canPost ? '' : 'grid-column:1/-1;'}">
          <h2 class="panel-title">Attendance & Tutor Lesson Recaps</h2>
          ${(vaultState.attendance || [])
            .map(
              (a) => `
            <div class="list-row">
              <div class="list-row-col">
                <span class="row-title">${esc(a.student_name)} · ${esc(a.subject)}</span>
                <span class="row-sub">${esc(a.session_date)} · ${esc(a.teacher_name)} — "${esc(a.lesson_note)}"</span>
              </div>
              <span class="pill-badge">${esc((a.status || 'present').toUpperCase())}</span>
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

/* --- PUBLIC TUITION PACKAGES, FEE ESTIMATOR & CONTACTS --- */

function buildTuitionContactsStage(user) {
  const info = vaultState.tuitionInfo;
  const contacts = info.contacts || {};
  const monthlyEst = ui.feeCalcSessions * 4 * ui.feeCalcRate;

  return `
    <div class="page-header-row">
      <div>
        <h1>Tuition Prices, Fee Estimator & Academy Contacts</h1>
        <p>Visible to everyone — even before joining i-tutor! Clear monthly & hourly tuition rates plus direct academy contact info.</p>
      </div>
      ${
        user.role === 'admin'
          ? `<button class="outline-btn" id="toggle-tuition-editor">${
              ui.showTuitionEditor ? 'Close Editor' : 'Edit Contact Info'
            }</button>`
          : `<span class="pill-badge">Open Public Info</span>`
      }
    </div>

    ${
      user.role === 'admin' && ui.showTuitionEditor
        ? `
      <form class="panel-card form-stack" id="update-tuition-form">
        <h2 class="panel-title">Update Public Academy Contact Information</h2>
        <div class="form-grid-2">
          <input class="field-input" name="phone" value="${esc(contacts.phone)}" placeholder="Phone" required />
          <input class="field-input" name="whatsapp" value="${esc(contacts.whatsapp)}" placeholder="WhatsApp" required />
        </div>
        <div class="form-grid-2">
          <input class="field-input" name="email" value="${esc(contacts.email)}" placeholder="Email" required />
          <input class="field-input" name="hours" value="${esc(contacts.hours)}" placeholder="Hours" required />
        </div>
        <input class="field-input" name="address" value="${esc(contacts.address)}" placeholder="Campus Address" required />
        <button class="dark-cta-btn" type="submit">Save & Sync Public Contact Info</button>
      </form>
    `
        : ''
    }

    <div class="pricing-cards-grid">
      ${(info.plans || [])
        .map(
          (plan) => `
        <article class="tuition-plan-card ${plan.badge === 'Most Popular' ? 'popular' : ''}">
          <div style="display:flex;flex-direction:column;gap:0.4rem;">
            <div class="panel-head">
              <h2 class="panel-title">${esc(plan.name)}</h2>
              <span class="pill-badge">${esc(plan.badge)}</span>
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
          <h2 class="panel-title">Custom Session Fee Estimator & Contact Details</h2>
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
        <p class="row-sub">No login needed — works offline too and syncs straight to Admissions once online.</p>
        <form class="form-stack" id="public-enquiry-form">
          <input class="field-input" name="full_name" placeholder="Your Full Name (Parent or Student)" required />
          <input class="field-input" name="contact_detail" placeholder="Phone / WhatsApp or Email" required />
          <div class="form-grid-2">
            <input class="field-input" name="student_grade" placeholder="Learner Grade (e.g. Grade 12)" required />
            <select class="field-input" name="selected_plan">
              ${(info.plans || []).map((p) => `<option value="${esc(p.name)}">${esc(p.name)} (${esc(p.price)})</option>`).join('')}
            </select>
          </div>
          <textarea class="field-input" name="message" rows="3" placeholder="Which subjects do you need help with?" required></textarea>
          <button class="dark-cta-btn" type="submit">${ICONS.send} Submit Enquiry</button>
        </form>
      </section>
    </div>

    ${
      user.role === 'admin'
        ? `
      <section class="panel-card">
        <h2 class="panel-title">Admissions Enquiry Inbox (${(vaultState.enquiries || []).length})</h2>
        ${
          (vaultState.enquiries || []).length === 0
            ? `<p class="row-sub">No new enquiries yet.</p>`
            : vaultState.enquiries
                .map(
                  (eq) => `
              <div class="list-row">
                <div class="list-row-col">
                  <span class="row-title">${esc(eq.full_name)} · ${esc(eq.student_grade)} · ${esc(eq.selected_plan)}</span>
                  <span class="row-sub">Contact: ${esc(eq.contact_detail)} — "${esc(eq.message)}"</span>
                </div>
                <span class="pill-badge">New Lead</span>
              </div>
            `
                )
                .join('')
        }
      </section>
    `
        : ''
    }
  `;
}

/* ==========================================================================
   3. ADAPTIVE 3-ZONE WORKSPACE SHELL & INTERACTIONS
   ========================================================================== */

function renderWorkspace() {
  applyTheme();
  const rootEl = document.getElementById('app');
  if (!rootEl) return;

  const user = getActiveUser();
  const offline = isOfflineActive();
  const outboxCount = loadOutbox().length;
  const avgConf = getOverallConfidence(personalState);
  const visibleRooms = getVisibleRooms(user);

  const navItems = [
    { id: 'overview', label: 'Overview Hub', icon: ICONS.home, badge: '' },
    { id: 'timetable', label: 'Timetable & Exams', icon: ICONS.timetable, badge: String(vaultState.timetables.length) },
    { id: 'assignments', label: 'Remote Assignments', icon: ICONS.assignment, badge: String(vaultState.assignments.length) },
    { id: 'toolkit', label: 'Offline Study Toolkit', icon: ICONS.toolkit, badge: '4 Tools' },
    { id: 'messages', label: 'Chats & Study Groups', icon: ICONS.messages, badge: visibleRooms.length ? String(visibleRooms.length) : '' },
    { id: 'broadcasts', label: 'Broadcasts & Attendance', icon: ICONS.broadcast, badge: String(vaultState.broadcasts.length) },
    { id: 'tuition', label: 'Tuition Prices & Contact', icon: ICONS.tuition, badge: 'Open' }
  ];

  let centerHTML = '';
  if (ui.view === 'overview') centerHTML = buildOverviewStage(user);
  else if (ui.view === 'timetable') centerHTML = buildTimetableStage(user);
  else if (ui.view === 'assignments') centerHTML = buildAssignmentsStage(user);
  else if (ui.view === 'toolkit') centerHTML = buildToolkitStage(user);
  else if (ui.view === 'messages') centerHTML = buildMessagesStage(user);
  else if (ui.view === 'broadcasts') centerHTML = buildBroadcastsAttendanceStage(user);
  else if (ui.view === 'tuition') centerHTML = buildTuitionContactsStage(user);

  rootEl.innerHTML = `
    <div class="workspace-shell">
      <!-- ZONE 1: LEFT NAVIGATION RAIL -->
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

          <div class="role-switcher-box">
            <span class="role-box-label">Switch Role / Perspective</span>
            <select class="role-select" id="sidebar-role-select" aria-label="Switch user role">
              ${(vaultState.profiles || [])
                .map(
                  (p) => `
                <option value="${esc(p.id)}" ${p.id === user.id ? 'selected' : ''}>
                  ${esc(p.role.toUpperCase())} · ${esc(p.name)}
                </option>
              `
                )
                .join('')}
              <option value="visitor" ${user.role === 'visitor' ? 'selected' : ''}>
                NOT JOINED · Prices & Contact
              </option>
            </select>
          </div>

          <nav class="sidebar-nav" aria-label="Main navigation">
            <div class="nav-section-label">Workspace</div>
            ${navItems
              .map(
                (item) => `
              <button class="nav-item-btn ${ui.view === item.id ? 'is-active' : ''}" data-nav="${item.id}">
                <span class="nav-item-left">${item.icon} <span>${esc(item.label)}</span></span>
                ${item.badge ? `<span class="nav-badge">${esc(item.badge)}</span>` : ''}
              </button>
            `
              )
              .join('')}
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
              <button class="rail-mini-btn" id="btn-sync-now">Sync Now</button>
              <button class="rail-mini-btn" id="btn-toggle-offline">${offline ? 'Go Online' : 'Test Offline'}</button>
            </div>
          </div>

          <div class="mini-btn-row">
            <button class="rail-mini-btn" id="btn-night-mode">${
              sessionState.theme === 'night' ? '☀ Cream Theme' : '☾ Night Study'
            }</button>
            <button class="rail-mini-btn" id="btn-replay-splash">↻ 10s Intro</button>
          </div>
        </div>
      </aside>

      <!-- ZONE 2: WIDE ADAPTIVE MAIN STAGE -->
      <div class="main-stage">
        <header class="stage-topbar">
          <div class="mobile-brand-cluster" data-nav="overview" style="cursor:pointer;">
            <div class="mobile-emblem-mini">${renderEmblemSVG({ animated: false, uid: 'mob', className: 'brand-emblem-svg' })}</div>
            <strong style="font-size:1.05rem;">i-tutor</strong>
          </div>

          <div class="search-box-wrap">
            <span class="search-icon-pos">${ICONS.search}</span>
            <input
              type="search"
              class="global-search-input"
              id="global-search-input"
              placeholder="Search offline notes, timetable, remote packs..."
              value="${esc(ui.searchQuery)}"
            />
          </div>

          <div class="topbar-actions">
            <select class="mobile-role-select" id="mobile-role-select" aria-label="Switch user role">
              ${(vaultState.profiles || [])
                .map(
                  (p) => `<option value="${esc(p.id)}" ${p.id === user.id ? 'selected' : ''}>${esc(p.role)}: ${esc(p.name)}</option>`
                )
                .join('')}
              <option value="visitor" ${user.role === 'visitor' ? 'selected' : ''}>Visitor (Prices)</option>
            </select>

            <button class="outline-btn" id="top-offline-pill" title="Toggle offline simulation">
              <span class="dot-indicator ${offline ? 'offline' : ''}"></span>
              ${offline ? `Offline (${outboxCount})` : 'Synced'}
            </button>

            <button class="gold-cta-btn" data-nav="tuition">${ICONS.tuition} Prices & Contact</button>
          </div>
        </header>

        <main class="stage-body">
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
          <div class="timer-readout-big" style="font-size:1.85rem;">${formatClock(ui.timerSeconds)}</div>
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
          <button class="outline-btn" id="btn-export-vault" style="margin-top:0.35rem;">
            ${ICONS.download} Export Offline Backup
          </button>
        </section>
      </aside>
    </div>

    <!-- MOBILE LABELED 5-TAB BOTTOM BAR -->
    <nav class="mobile-tabbar" aria-label="Mobile navigation">
      <button class="mob-tab-btn ${ui.view === 'overview' ? 'is-active' : ''}" data-nav="overview">
        ${ICONS.home}<span>Hub</span>
      </button>
      <button class="mob-tab-btn ${ui.view === 'timetable' ? 'is-active' : ''}" data-nav="timetable">
        ${ICONS.timetable}<span>Schedule</span>
      </button>
      <button class="mob-tab-btn ${ui.view === 'assignments' ? 'is-active' : ''}" data-nav="assignments">
        ${ICONS.assignment}<span>Tasks</span>
      </button>
      <button class="mob-tab-btn ${ui.view === 'toolkit' ? 'is-active' : ''}" data-nav="toolkit">
        ${ICONS.toolkit}<span>Toolkit</span>
      </button>
      <button class="mob-tab-btn ${ui.view === 'messages' ? 'is-active' : ''}" data-nav="messages">
        ${ICONS.messages}<span>Chats</span>
      </button>
    </nav>

    ${ui.toast ? `<div class="toast-banner" role="status">${esc(ui.toast)}</div>` : ''}
  `;

  bindEvents(user);
}

function bindEvents(user) {
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.view = el.getAttribute('data-nav');
      renderWorkspace();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-open-toolkit]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.view = 'toolkit';
      ui.toolkitTab = el.getAttribute('data-open-toolkit');
      renderWorkspace();
    });
  });

  document.querySelectorAll('[data-jump-assign]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.view = 'assignments';
      ui.expandedAssignmentId = el.getAttribute('data-jump-assign');
      renderWorkspace();
    });
  });

  const quickNewAssign = document.getElementById('quick-new-assign-btn');
  if (quickNewAssign) {
    quickNewAssign.addEventListener('click', () => {
      ui.view = 'assignments';
      ui.showAssignCreator = true;
      renderWorkspace();
    });
  }

  ['sidebar-role-select', 'mobile-role-select'].forEach((id) => {
    const sel = document.getElementById(id);
    if (sel) {
      sel.addEventListener('change', (e) => {
        sessionState.currentUserId = e.target.value;
        saveSession(sessionState);
        ui.selectedRoomId = null;
        if (e.target.value === 'visitor' && ui.view === 'messages') {
          ui.view = 'tuition';
        }
        showToast(`Viewing as ${getActiveUser().name}`);
      });
    }
  });

  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      ui.searchQuery = e.target.value;
      const pos = e.target.selectionStart;
      if (ui.view === 'overview' && ui.searchQuery.trim().length > 1) {
        ui.view = 'toolkit';
        ui.toolkitTab = 'notes';
      }
      renderWorkspace();
      const nextInput = document.getElementById('global-search-input');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(pos, pos);
      }
    });
  }

  const syncBtn = document.getElementById('btn-sync-now');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      const res = await syncWithServer({ simulateOffline: sessionState.simulateOffline });
      if (res.vault) vaultState = res.vault;
      showToast(
        res.status === 'synced'
          ? 'Auto-Sync complete: timetables, tasks & chats up to date!'
          : 'Offline mode active — items safely queued on device.'
      );
    });
  }

  ['btn-toggle-offline', 'top-offline-pill'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', async () => {
        sessionState.simulateOffline = !sessionState.simulateOffline;
        saveSession(sessionState);
        if (!sessionState.simulateOffline) {
          const res = await syncWithServer({ simulateOffline: false });
          if (res.vault) vaultState = res.vault;
          showToast('Back Online! Queued offline actions synced automatically.');
        } else {
          showToast('Offline Mode ON: Study, submit & chat with zero internet.');
        }
      });
    }
  });

  const nightBtn = document.getElementById('btn-night-mode');
  if (nightBtn) {
    nightBtn.addEventListener('click', () => {
      sessionState.theme = sessionState.theme === 'night' ? 'light' : 'night';
      saveSession(sessionState);
      renderWorkspace();
    });
  }

  const replayBtn = document.getElementById('btn-replay-splash');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      const rootEl = document.getElementById('app');
      runAnimatedSplash(rootEl, () => renderWorkspace());
    });
  }

  const exportBtn = document.getElementById('btn-export-vault');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const payload = JSON.stringify({ vault: vaultState, personal: personalState }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'i-tutor-offline-vault.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Offline study vault backup exported!');
    });
  }

  // Timetable
  document.querySelectorAll('[data-tt-day]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.timetableDay = el.getAttribute('data-tt-day');
      renderWorkspace();
    });
  });

  document.querySelectorAll('[data-del-tt]').forEach((el) => {
    el.addEventListener('click', () => {
      performActionAndSync('DELETE_TIMETABLE', { id: el.getAttribute('data-del-tt') }, 'Timetable slot removed.');
    });
  });

  const addTtForm = document.getElementById('add-tt-form');
  if (addTtForm) {
    addTtForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addTtForm);
      const isOfficial = user.role === 'teacher' || user.role === 'admin';
      performActionAndSync(
        'ADD_TIMETABLE',
        {
          id: `tt-${Date.now()}`,
          day_of_week: fd.get('day_of_week'),
          start_time: fd.get('start_time'),
          end_time: fd.get('end_time'),
          subject: fd.get('subject'),
          topic: fd.get('topic'),
          teacher_name: isOfficial ? user.name : `${user.name} (Personal Revision)`,
          location_mode: fd.get('location_mode'),
          grade_group: user.grade || 'Grade 12',
          owner_id: isOfficial ? null : user.id,
          is_official: isOfficial
        },
        'Saved to offline timetable!'
      );
    });
  }

  const addExamForm = document.getElementById('add-exam-form');
  if (addExamForm) {
    addExamForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addExamForm);
      personalState.exams.push({
        id: `ex-${Date.now()}`,
        title: fd.get('title'),
        subject: fd.get('subject'),
        daysAway: Number(fd.get('daysAway')) || 14
      });
      savePersonal(personalState);
      showToast('Exam countdown saved!');
    });
  }

  // Assignments
  const toggleAssignCreator = document.getElementById('toggle-assign-creator');
  if (toggleAssignCreator) {
    toggleAssignCreator.addEventListener('click', () => {
      ui.showAssignCreator = !ui.showAssignCreator;
      renderWorkspace();
    });
  }

  const createAssignForm = document.getElementById('create-assign-form');
  if (createAssignForm) {
    createAssignForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(createAssignForm);
      const newId = `asg-${Date.now()}`;
      ui.showAssignCreator = false;
      ui.expandedAssignmentId = newId;
      performActionAndSync(
        'CREATE_ASSIGNMENT',
        {
          id: newId,
          title: fd.get('title'),
          subject: fd.get('subject'),
          grade_group: 'Grade 12',
          teacher_id: user.id,
          teacher_name: user.name,
          due_date: fd.get('due_date'),
          max_marks: Number(fd.get('max_marks')) || 30,
          instructions: fd.get('instructions'),
          offline_pack_content: fd.get('offline_pack_content')
        },
        'Remote assignment published & cached offline!'
      );
    });
  }

  document.querySelectorAll('[data-toggle-assign]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-toggle-assign');
      ui.expandedAssignmentId = ui.expandedAssignmentId === id ? null : id;
      renderWorkspace();
    });
  });

  document.querySelectorAll('.draft-textarea').forEach((area) => {
    area.addEventListener('input', (e) => {
      const id = area.getAttribute('data-draft-id');
      personalState.assignmentDrafts[id] = e.target.value;
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
        isOfflineActive()
          ? 'Queued in Offline Outbox — will auto-upload once online!'
          : 'Assignment submitted & synced!'
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
        'Grade & feedback saved!'
      );
    });
  });

  // Study Toolkit
  document.querySelectorAll('[data-tk-tab]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.toolkitTab = el.getAttribute('data-tk-tab');
      renderWorkspace();
    });
  });

  document.querySelectorAll('[data-subj-filter]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.subjectFilter = el.getAttribute('data-subj-filter');
      renderWorkspace();
    });
  });

  document.querySelectorAll('[data-bookmark-note]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-bookmark-note');
      const idx = personalState.bookmarkedNoteIds.indexOf(id);
      if (idx >= 0) personalState.bookmarkedNoteIds.splice(idx, 1);
      else personalState.bookmarkedNoteIds.push(id);
      savePersonal(personalState);
      renderWorkspace();
    });
  });

  const toggleNoteModal = document.getElementById('toggle-note-modal');
  if (toggleNoteModal) {
    toggleNoteModal.addEventListener('click', () => {
      ui.showNoteModal = !ui.showNoteModal;
      renderWorkspace();
    });
  }

  const addNoteForm = document.getElementById('add-note-form');
  if (addNoteForm) {
    addNoteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addNoteForm);
      const formulas = String(fd.get('formulasRaw') || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      ui.showNoteModal = false;
      performActionAndSync(
        'ADD_STUDY_NOTE',
        {
          id: `note-${Date.now()}`,
          subject: fd.get('subject'),
          title: fd.get('title'),
          summary: fd.get('summary'),
          formulas,
          author_name: user.name
        },
        'Study note saved to offline vault & synced!'
      );
    });
  }

  // Quizzes
  document.querySelectorAll('[data-quiz-subj]').forEach((el) => {
    el.addEventListener('click', () => {
      ui.quizState = {
        subject: el.getAttribute('data-quiz-subj'),
        index: 0,
        picked: null,
        correctCount: 0,
        finished: false
      };
      renderWorkspace();
    });
  });

  document.querySelectorAll('[data-quiz-pick]').forEach((el) => {
    el.addEventListener('click', () => {
      if (ui.quizState.picked !== null) return;
      const picked = Number(el.getAttribute('data-quiz-pick'));
      const allQuizzes = [...(vaultState.quizzes || []), ...(personalState.customQuizzes || [])];
      const pool =
        ui.quizState.subject === 'All'
          ? allQuizzes
          : allQuizzes.filter((q) => q.subject === ui.quizState.subject);
      const safePool = pool.length ? pool : allQuizzes;
      const current = safePool[ui.quizState.index % safePool.length];
      ui.quizState.picked = picked;
      if (picked === current.correctIndex) {
        ui.quizState.correctCount += 1;
      }
      renderWorkspace();
    });
  });

  const nextQuizBtn = document.getElementById('next-quiz-btn');
  if (nextQuizBtn) {
    nextQuizBtn.addEventListener('click', () => {
      const allQuizzes = [...(vaultState.quizzes || []), ...(personalState.customQuizzes || [])];
      const pool =
        ui.quizState.subject === 'All'
          ? allQuizzes
          : allQuizzes.filter((q) => q.subject === ui.quizState.subject);
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
      renderWorkspace();
    });
  }

  const restartQuizBtn = document.getElementById('restart-quiz-btn');
  if (restartQuizBtn) {
    restartQuizBtn.addEventListener('click', () => {
      ui.quizState = { ...ui.quizState, index: 0, picked: null, correctCount: 0, finished: false };
      renderWorkspace();
    });
  }

  // Flashcards
  const flipStage = document.getElementById('flip-card-stage');
  if (flipStage) {
    flipStage.addEventListener('click', () => {
      ui.cardState.flipped = !ui.cardState.flipped;
      renderWorkspace();
    });
  }

  const prevCardBtn = document.getElementById('prev-card-btn');
  if (prevCardBtn) {
    prevCardBtn.addEventListener('click', () => {
      const len = personalState.flashcards.length;
      ui.cardState = { index: (ui.cardState.index - 1 + len) % len, flipped: false };
      renderWorkspace();
    });
  }

  const nextCardBtn = document.getElementById('next-card-btn');
  if (nextCardBtn) {
    nextCardBtn.addEventListener('click', () => {
      const len = personalState.flashcards.length;
      ui.cardState = { index: (ui.cardState.index + 1) % len, flipped: false };
      renderWorkspace();
    });
  }

  document.querySelectorAll('[data-master-card]').forEach((el) => {
    el.addEventListener('click', () => {
      const card = personalState.flashcards.find((c) => c.id === el.getAttribute('data-master-card'));
      if (card) {
        card.mastered = !card.mastered;
        savePersonal(personalState);
        renderWorkspace();
      }
    });
  });

  const toggleCardModal = document.getElementById('toggle-card-modal');
  if (toggleCardModal) {
    toggleCardModal.addEventListener('click', () => {
      ui.showCardModal = !ui.showCardModal;
      renderWorkspace();
    });
  }

  const addCardForm = document.getElementById('add-card-form');
  if (addCardForm) {
    addCardForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addCardForm);
      personalState.flashcards.unshift({
        id: `fc-${Date.now()}`,
        subject: fd.get('subject'),
        front: fd.get('front'),
        back: fd.get('back'),
        mastered: false
      });
      savePersonal(personalState);
      ui.cardState = { index: 0, flipped: false };
      ui.showCardModal = false;
      showToast('Flashcard added to offline deck!');
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
            renderWorkspace();
          } else {
            ui.timerRunning = false;
            clearInterval(timerHandle);
            timerHandle = null;
            personalState.focusMinutesToday = (personalState.focusMinutesToday || 0) + 25;
            savePersonal(personalState);
            showToast('Focus sprint complete! +25m logged.');
          }
        }, 1000);
      } else if (!ui.timerRunning && timerHandle) {
        clearInterval(timerHandle);
        timerHandle = null;
      }
      renderWorkspace();
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
      renderWorkspace();
    });
  });

  document.querySelectorAll('[data-check-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const item = (personalState.tasks || []).find((t) => t.id === row.getAttribute('data-check-id'));
      if (item) {
        item.done = !item.done;
        savePersonal(personalState);
        renderWorkspace();
      }
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
      renderWorkspace();
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
      renderWorkspace();
    });
  }

  // Messenger
  document.querySelectorAll('.room-btn[data-room-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.selectedRoomId = btn.getAttribute('data-room-id');
      renderWorkspace();
    });
  });

  const toggleGroupBtn = document.getElementById('toggle-group-creator');
  if (toggleGroupBtn) {
    toggleGroupBtn.addEventListener('click', () => {
      ui.showGroupCreator = !ui.showGroupCreator;
      renderWorkspace();
    });
  }

  const createGroupForm = document.getElementById('create-group-form');
  if (createGroupForm) {
    createGroupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(createGroupForm);
      const newId = `room-grp-${Date.now()}`;
      ui.selectedRoomId = newId;
      ui.showGroupCreator = false;
      performActionAndSync(
        'CREATE_STUDY_GROUP',
        {
          id: newId,
          room_type: 'group',
          name: fd.get('name'),
          subject: fd.get('subject'),
          participant_ids: ['stu-thabo', 'stu-amahle', 'stu-liam', 'tch-naledi', user.id],
          members_label: `Created by ${user.name} · Study Group`,
          created_by_name: user.name
        },
        'Study group created & synced!'
      );
    });
  }

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

  // Broadcasts & Attendance
  document.querySelectorAll('[data-bc-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.broadcastSubtab = btn.getAttribute('data-bc-tab');
      renderWorkspace();
    });
  });

  const postBroadcastForm = document.getElementById('post-broadcast-form');
  if (postBroadcastForm) {
    postBroadcastForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(postBroadcastForm);
      performActionAndSync(
        'SEND_BROADCAST',
        {
          id: `bc-${Date.now()}`,
          title: fd.get('title'),
          body: fd.get('body'),
          audience: fd.get('audience'),
          author_name: `${user.name} (${user.role})`,
          author_role: user.role,
          priority: 'important',
          created_at: new Date().toISOString()
        },
        'Broadcast published to Students & Parents!'
      );
    });
  }

  const logAttForm = document.getElementById('log-attendance-form');
  if (logAttForm) {
    logAttForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(logAttForm);
      const stuId = fd.get('student_id');
      const stuObj = (vaultState.profiles || []).find((p) => p.id === stuId);
      performActionAndSync(
        'LOG_ATTENDANCE',
        {
          id: `att-${Date.now()}`,
          session_date: fd.get('session_date'),
          subject: fd.get('subject'),
          student_id: stuId,
          student_name: stuObj ? stuObj.name : 'Student',
          status: fd.get('status'),
          teacher_name: user.name,
          lesson_note: fd.get('lesson_note')
        },
        'Attendance logged offline & queued for sync!'
      );
    });
  }

  // Tuition estimator, contact editor & public enquiry
  const rateSelect = document.getElementById('calc-rate-select');
  if (rateSelect) {
    rateSelect.addEventListener('change', (e) => {
      ui.feeCalcRate = Number(e.target.value);
      renderWorkspace();
    });
  }

  const sessionsRange = document.getElementById('calc-sessions-range');
  if (sessionsRange) {
    sessionsRange.addEventListener('input', (e) => {
      ui.feeCalcSessions = Number(e.target.value);
      renderWorkspace();
    });
  }

  const toggleTuitionEditor = document.getElementById('toggle-tuition-editor');
  if (toggleTuitionEditor) {
    toggleTuitionEditor.addEventListener('click', () => {
      ui.showTuitionEditor = !ui.showTuitionEditor;
      renderWorkspace();
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
          plans: vaultState.tuitionInfo.plans,
          contacts: {
            phone: fd.get('phone'),
            whatsapp: fd.get('whatsapp'),
            email: fd.get('email'),
            hours: fd.get('hours'),
            address: fd.get('address')
          }
        },
        'Public contact details updated & synced!'
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
          created_at: new Date().toISOString()
        },
        'Thank you! Your enquiry is saved & sent to Admissions.'
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
        if (!document.getElementById('splash-screen')) renderWorkspace();
      }
    }
  });

  runAnimatedSplash(rootEl, () => {
    renderWorkspace();
  });
});
