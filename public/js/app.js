import { renderEmblemSVG, ICONS } from './emblem.js';
import {
  loadVault,
  loadOutbox,
  loadSession,
  saveSession,
  dispatchOfflineAction,
  syncWithServer
} from './offlineStore.js';

const LOADING_DURATION_MS = 10000; // ~10 seconds

const STATUS_PHASES = [
  { threshold: 0, text: 'Starting i-tutor…' },
  { threshold: 25, text: 'Loading offline storage vault…' },
  { threshold: 55, text: 'Downloading timetables & assignments…' },
  { threshold: 82, text: 'Confidence in learning…' },
  { threshold: 100, text: 'Ready' }
];

const DAYS = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let vault = loadVault();
let session = loadSession();
let activeAnimationFrame = null;
let toastTimer = null;

const ui = {
  view: 'home', // 'home' | 'timetables' | 'assignments' | 'messages' | 'broadcasts' | 'tuition' | 'account' | 'sync'
  dockIndex: 0,
  dayFilter: 'All',
  msgTab: 'teachers', // 'teachers' | 'groups'
  activeRoomId: 'room-tch-naledi',
  showTimetableForm: false,
  showAssignmentForm: false,
  showGroupForm: false,
  showBroadcastForm: false,
  showContactEditForm: false,
  expandedAssignmentId: 'asg-1',
  syncState: 'synced', // 'synced' | 'offline' | 'syncing'
  toastMessage: ''
};

function applyTheme() {
  document.documentElement.setAttribute('data-theme', session.theme === 'night' ? 'night' : 'light');
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(name = '') {
  return name
    .replace(/^(Ms\.|Mr\.|Mrs\.|Dr\.)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase();
}

function showToast(msg) {
  ui.toastMessage = msg;
  renderToastOnly();
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toastMessage = '';
    renderToastOnly();
  }, 3200);
}

function renderToastOnly() {
  const existing = document.getElementById('toast-banner');
  if (existing) existing.remove();
  if (!ui.toastMessage) return;
  const div = document.createElement('div');
  div.id = 'toast-banner';
  div.className = 'toast-banner';
  div.textContent = ui.toastMessage;
  document.body.appendChild(div);
}

function getCurrentUser() {
  if (session.currentUserId === 'guest') {
    return {
      id: 'guest',
      name: 'Visitor (Not Joined)',
      role: 'guest',
      subtitle: 'Viewing Tuition Prices & Contact Info'
    };
  }
  return (
    vault.profiles.find((p) => p.id === session.currentUserId) ||
    vault.profiles[0] || {
      id: 'stu-thabo',
      name: 'Thabo Mokoena',
      role: 'student',
      subtitle: 'Grade 12 Student'
    }
  );
}

function isDeviceOffline() {
  return Boolean(session.simulateOffline || (typeof navigator !== 'undefined' && navigator.onLine === false));
}

async function performSync({ silent = true } = {}) {
  if (isDeviceOffline()) {
    ui.syncState = 'offline';
    if (!silent) showToast('Offline mode active — everything is safely stored on this device.');
    renderAppShell();
    return;
  }

  ui.syncState = 'syncing';
  const result = await syncWithServer({ simulateOffline: session.simulateOffline });
  vault = result.vault;
  ui.syncState = result.status === 'synced' ? 'synced' : 'offline';
  if (!silent) {
    showToast(
      ui.syncState === 'synced'
        ? 'Downloaded latest timetables, assignments & messages for offline use!'
        : 'Offline — changes saved locally and will auto-sync when online.'
    );
  }
  renderAppShell();
}

function runActionAndSync(action, offlineMsg, onlineMsg) {
  dispatchOfflineAction(vault, action);
  if (isDeviceOffline()) {
    ui.syncState = 'offline';
    showToast(offlineMsg || 'Saved offline — will sync automatically once online.');
    renderAppShell();
  } else {
    showToast(onlineMsg || 'Saved & synced!');
    renderAppShell();
    performSync({ silent: true });
  }
}

/* ==========================================================================
   1. 10-SECOND ANIMATED LOADING SCREEN
   ========================================================================== */

function renderSplashScreenMarkup() {
  return `
    <main class="splash-screen" id="splash-screen" aria-label="Loading i-tutor">
      <div class="splash-centerpiece">
        <div class="emblem-stage">
          <div class="emblem-aura"></div>
          ${renderEmblemSVG({ animated: true, uid: 'splash' })}
        </div>

        <h1 class="wordmark-row" aria-label="i-tutor">
          <span class="wm-i-wrap">
            <span class="wm-i-gold-dot" aria-hidden="true"></span>
            <span class="wm-char wm-i-stem" style="--char-delay: 3.45s">&#305;</span>
          </span><span class="wm-char wm-hyphen" style="--char-delay: 3.60s">-</span><span class="wm-char" style="--char-delay: 3.74s">t</span><span class="wm-char" style="--char-delay: 3.88s">u</span><span class="wm-char" style="--char-delay: 4.02s">t</span><span class="wm-char" style="--char-delay: 4.16s">o</span><span class="wm-char" style="--char-delay: 4.30s">r</span>
        </h1>

        <div class="slogan-wrap">
          <p class="slogan-text">Confidence in learning</p>
          <div class="slogan-shimmer" aria-hidden="true"></div>
        </div>

        <div
          class="loader-panel"
          role="progressbar"
          aria-label="Loading i-tutor app"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="0"
          id="loader-progressbar"
        >
          <div class="loader-track">
            <div class="loader-fill" id="loader-fill"></div>
          </div>
          <div class="loader-meta">
            <span class="loader-status" id="loader-status">${STATUS_PHASES[0].text}</span>
            <span class="loader-percent" id="loader-percent">0%</span>
          </div>
        </div>
      </div>
    </main>
  `;
}

/* ==========================================================================
   2. HOME WORKSPACE & VISITOR SHOWCASE
   ========================================================================== */

function renderPinnedBroadcastBanner() {
  const latest = vault.broadcasts?.[0];
  if (!latest) return '';

  return `
    <button type="button" class="broadcast-banner" data-open-view="broadcasts">
      <div class="broadcast-icon-badge">${ICONS.broadcast}</div>
      <div class="broadcast-banner-body">
        <div class="broadcast-banner-eyebrow">App Broadcast · ${escapeHtml(latest.author_name)}</div>
        <div class="broadcast-banner-title">${escapeHtml(latest.title)}</div>
        <div class="broadcast-banner-text">${escapeHtml(latest.body)}</div>
      </div>
    </button>
  `;
}

function renderHomeWorkspace(user) {
  // If Visitor (hasn't joined yet), show Tuition Prices & Contact Infos right away!
  if (user.role === 'guest') {
    return renderTuitionAndContactsView(user, { embeddedOnHome: true });
  }

  const isStaff = user.role === 'teacher' || user.role === 'admin';
  const nextSlot = vault.timetables[0];
  const groupCount = vault.rooms.filter((r) => r.room_type === 'group').length;
  const outboxCount = loadOutbox().length;

  let primaryBtnLabel = 'Open Remote Assignments';
  let primaryBtnTarget = 'assignments';
  if (isStaff) {
    primaryBtnLabel = user.role === 'admin' ? 'Send App-Wide Broadcast' : 'Send Remote Assignment';
    primaryBtnTarget = user.role === 'admin' ? 'broadcasts' : 'assignments';
  }

  return `
    ${renderPinnedBroadcastBanner()}

    <!-- HERO SNAPSHOT CARD -->
    <section class="layout-hero-card">
      <div class="hero-top-row">
        <span class="offline-saved-badge">
          ${ICONS.download}
          <span>${isDeviceOffline() ? `Offline Mode${outboxCount ? ` · ${outboxCount} queued` : ' · Saved on Device'}` : 'Saved Offline · Auto-Sync On'}</span>
        </span>
        <span class="tile-count-pill">${escapeHtml(user.role.toUpperCase())}</span>
      </div>

      <div>
        <div class="hero-eyebrow">Signed in as ${escapeHtml(user.name)}</div>
        <div class="hero-topic-title">
          ${nextSlot ? `Next: ${escapeHtml(nextSlot.subject)} (${escapeHtml(nextSlot.day_of_week)} ${escapeHtml(nextSlot.start_time)})` : 'All Offline Packs Downloaded'}
        </div>
        <div class="hero-subline">${escapeHtml(user.subtitle)}</div>
      </div>

      <button type="button" class="primary-dark-btn" data-open-view="${primaryBtnTarget}">
        <span>${primaryBtnLabel}</span>
      </button>
    </section>

    <!-- 2x2 MAIN FEATURE CARDS -->
    <section class="layout-grid">
      <button type="button" class="feature-tile-btn" data-open-view="timetables">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.timetable}</div>
          <span class="tile-count-pill">${vault.timetables.length} saved</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Timetable</div>
          <div class="tile-sub">Saved offline</div>
        </div>
      </button>

      <button type="button" class="feature-tile-btn" data-open-view="assignments">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.assignment}</div>
          <span class="tile-count-pill">${vault.assignments.length} tasks</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Assignments</div>
          <div class="tile-sub">${isStaff ? 'Send & mark remotely' : 'Auto-downloaded'}</div>
        </div>
      </button>

      <button type="button" class="feature-tile-btn" data-open-view="messages">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.messages}</div>
          <span class="tile-count-pill">${groupCount} groups</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Messages</div>
          <div class="tile-sub">Teachers &amp; Study Groups</div>
        </div>
      </button>

      <button type="button" class="feature-tile-btn" data-open-view="broadcasts">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.broadcast}</div>
          <span class="tile-count-pill">${vault.broadcasts.length} alerts</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Broadcasts</div>
          <div class="tile-sub">${isStaff ? 'Post to whole app' : 'School & parent notices'}</div>
        </div>
      </button>
    </section>

    <!-- PUBLIC TUITION PRICES & CONTACTS CARD -->
    <button type="button" class="wide-strip-btn" data-open-view="tuition">
      <div class="wide-strip-left">
        <div class="tile-icon-box">${ICONS.tuition}</div>
        <div>
          <div class="tile-title">Tuition Prices &amp; Contact Info</div>
          <div class="tile-sub">Public packages &amp; admissions desk for new learners</div>
        </div>
      </div>
      <span class="tile-count-pill">View →</span>
    </button>
  `;
}

/* ==========================================================================
   3. TIMETABLES VIEW (OFFLINE SAVED + AUTO SYNC)
   ========================================================================== */

function renderTimetablesView(user) {
  const isStaff = user.role === 'teacher' || user.role === 'admin';
  const visibleSlots = vault.timetables.filter((slot) => {
    const dayMatch = ui.dayFilter === 'All' || slot.day_of_week === ui.dayFilter;
    const ownerMatch = slot.is_official || !slot.owner_id || slot.owner_id === user.id || isStaff;
    return dayMatch && ownerMatch;
  });

  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      <button type="button" class="action-pill-btn" id="toggle-tt-form-btn">
        ${ICONS.plus}
        <span>${isStaff ? 'Add Class Slot' : 'Save Study Slot'}</span>
      </button>
    </div>

    <div class="subview-title-block">
      <h2>Saved Timetable</h2>
      <p>Stored directly on your device for offline access — updates download automatically when online.</p>
    </div>

    <div class="chip-row">
      ${DAYS.map(
        (d) => `
        <button type="button" class="filter-chip ${ui.dayFilter === d ? 'is-active' : ''}" data-day-filter="${d}">
          ${d === 'All' ? 'All Days' : d.slice(0, 3)}
        </button>
      `
      ).join('')}
    </div>

    ${
      ui.showTimetableForm
        ? `
      <form class="content-card inline-form" id="add-timetable-form">
        <h3 class="item-title">${isStaff ? 'Publish Official Class Timetable Slot' : 'Save Personal Offline Study Slot'}</h3>
        <div class="form-row-2">
          <select name="day_of_week" class="input-field" required>
            ${DAYS.slice(1).map((d) => `<option value="${d}">${d}</option>`).join('')}
          </select>
          <input type="text" name="subject" class="input-field" placeholder="Subject (e.g. Mathematics)" required />
        </div>
        <div class="form-row-2">
          <input type="time" name="start_time" class="input-field" value="16:00" required />
          <input type="time" name="end_time" class="input-field" value="17:00" required />
        </div>
        <input type="text" name="topic" class="input-field" placeholder="Focus topic (e.g. Trigonometry Revision)" required />
        <input type="text" name="location_mode" class="input-field" placeholder="Room or Mode (e.g. Room B2 / Home Study)" value="${isStaff ? 'Studio A · Auto-Saved Offline' : 'Personal Offline Revision'}" />
        <button type="submit" class="gold-btn">Save to Offline Timetable</button>
      </form>
    `
        : ''
    }

    <div class="stack-list">
      ${visibleSlots
        .map(
          (slot) => `
          <article class="content-card">
            <div class="card-meta-row">
              <span class="subject-tag">${escapeHtml(slot.day_of_week)} · ${escapeHtml(slot.start_time)} – ${escapeHtml(slot.end_time)}</span>
              <span class="offline-saved-badge">${ICONS.check} <span>Saved Offline</span></span>
            </div>
            <h3 class="item-title">${escapeHtml(slot.subject)} — ${escapeHtml(slot.topic)}</h3>
            <p class="item-desc">
              ${slot.teacher_name ? `Educator: <strong>${escapeHtml(slot.teacher_name)}</strong> · ` : ''}
              ${escapeHtml(slot.location_mode)} (${escapeHtml(slot.grade_group)})
            </p>
            ${
              isStaff || slot.owner_id === user.id
                ? `<div><button type="button" class="danger-link-btn" data-delete-tt="${slot.id}">Remove slot</button></div>`
                : ''
            }
          </article>
        `
        )
        .join('')}
    </div>
  `;
}

/* ==========================================================================
   4. REMOTE ASSIGNMENTS VIEW (TEACHER REMOTE SEND + OFFLINE WORKSHEET + SUBMIT)
   ========================================================================== */

function renderAssignmentsView(user) {
  const isStaff = user.role === 'teacher' || user.role === 'admin';
  const targetStudentId = user.role === 'student' ? user.id : 'stu-thabo';

  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      ${
        isStaff
          ? `
        <button type="button" class="action-pill-btn" id="toggle-asg-form-btn">
          ${ICONS.plus}
          <span>Give Remote Assignment</span>
        </button>
      `
          : `<span class="offline-saved-badge">${ICONS.download} <span>All Packs Downloaded</span></span>`
      }
    </div>

    <div class="subview-title-block">
      <h2>Remote Assignments</h2>
      <p>
        ${
          isStaff
            ? 'Send assignments to students from anywhere — packs download automatically to their phones when online.'
            : 'Worksheets download automatically when online so you can read and complete them offline.'
        }
      </p>
    </div>

    ${
      isStaff && ui.showAssignmentForm
        ? `
      <form class="content-card inline-form" id="create-assignment-form">
        <h3 class="item-title">Send Remote Assignment to Students</h3>
        <input type="text" name="title" class="input-field" placeholder="Assignment Title (e.g. Remote Algebra Drill 5)" required />
        <div class="form-row-2">
          <input type="text" name="subject" class="input-field" placeholder="Subject (e.g. Mathematics)" required />
          <input type="text" name="grade_group" class="input-field" value="Grade 12" placeholder="Grade (e.g. Grade 12)" required />
        </div>
        <div class="form-row-2">
          <input type="date" name="due_date" class="input-field" value="2026-12-05" required />
          <input type="number" name="max_marks" class="input-field" value="30" min="5" max="200" required />
        </div>
        <textarea name="instructions" rows="2" class="input-field" placeholder="Instructions for students…" required></textarea>
        <textarea name="offline_pack_content" rows="4" class="input-field" placeholder="Full Offline Worksheet Questions & Formulas (downloads to students’ phones so they can work without internet)…" required></textarea>
        <button type="submit" class="gold-btn">Publish Remote Assignment</button>
      </form>
    `
        : ''
    }

    <div class="stack-list">
      ${vault.assignments
        .map((asg) => {
          const allSubs = vault.submissions.filter((s) => s.assignment_id === asg.id);
          const mySub = allSubs.find((s) => s.student_id === targetStudentId);

          return `
            <article class="content-card">
              <div class="card-meta-row">
                <span class="subject-tag">${escapeHtml(asg.subject)} · ${escapeHtml(asg.grade_group)}</span>
                <span class="offline-saved-badge">${ICONS.download} <span>Available Offline · ${asg.max_marks} Marks</span></span>
              </div>

              <h3 class="item-title">${escapeHtml(asg.title)}</h3>
              <p class="item-desc">
                By <strong>${escapeHtml(asg.teacher_name)}</strong> · Due <strong>${escapeHtml(asg.due_date)}</strong><br/>
                ${escapeHtml(asg.instructions)}
              </p>

              ${
                asg.offline_pack_content
                  ? `<div class="worksheet-pack-box">${escapeHtml(asg.offline_pack_content)}</div>`
                  : ''
              }

              ${
                user.role === 'student'
                  ? mySub
                    ? `
                  <div class="worksheet-pack-box" style="border-left-color: #1E1F1D;">
                    <strong>Your Submitted Work (${mySub.status === 'graded' ? `Graded: ${mySub.marks_awarded}/${asg.max_marks}` : 'Submitted · Saved Offline & Syncing'}):</strong>
                    \n${escapeHtml(mySub.answer_text)}
                    ${mySub.teacher_feedback ? `\n\nTeacher Feedback: "${escapeHtml(mySub.teacher_feedback)}"` : ''}
                  </div>
                `
                    : `
                  <form class="inline-form student-submit-form" data-asg-id="${asg.id}">
                    <textarea name="answer_text" rows="3" class="input-field" placeholder="Write your solution steps here (works offline — auto-sends once online)…" required></textarea>
                    <button type="submit" class="gold-btn">Submit Assignment ${isDeviceOffline() ? '(Save Offline)' : ''}</button>
                  </form>
                `
                  : ''
              }

              ${
                user.role === 'parent'
                  ? mySub
                    ? `
                  <div class="worksheet-pack-box">
                    <strong>Thabo’s Status:</strong> ${mySub.status === 'graded' ? `Graded — ${mySub.marks_awarded}/${asg.max_marks} marks` : 'Submitted to Teacher'}
                    ${mySub.teacher_feedback ? `\nFeedback: "${escapeHtml(mySub.teacher_feedback)}"` : ''}
                  </div>
                `
                    : `<span class="tile-count-pill">Pending completion by student</span>`
                  : ''
              }

              ${
                isStaff
                  ? `
                <div class="inline-form" style="margin-top: 0.35rem;">
                  <strong style="font-size: 0.82rem;">Student Submissions (${allSubs.length})</strong>
                  ${
                    allSubs.length
                      ? allSubs
                          .map(
                            (sub) => `
                          <div class="worksheet-pack-box">
                            <strong>${escapeHtml(sub.student_name)}</strong> — ${
                              sub.status === 'graded'
                                ? `Marked: ${sub.marks_awarded}/${asg.max_marks}`
                                : 'Awaiting marks'
                            }\n${escapeHtml(sub.answer_text)}
                            ${
                              sub.status !== 'graded'
                                ? `
                              <form class="inline-form grade-sub-form" data-sub-id="${sub.id}" style="margin-top: 0.55rem;">
                                <div class="form-row-2">
                                  <input type="number" name="marks_awarded" class="input-field" min="0" max="${asg.max_marks}" placeholder="Marks / ${asg.max_marks}" required />
                                  <input type="text" name="teacher_feedback" class="input-field" placeholder="Feedback note…" required />
                                </div>
                                <button type="submit" class="secondary-btn">Save Grade &amp; Feedback</button>
                              </form>
                            `
                                : `\nFeedback: "${escapeHtml(sub.teacher_feedback)}"`
                            }
                          </div>
                        `
                          )
                          .join('')
                      : `<p class="tile-sub">No student submissions yet.</p>`
                  }
                </div>
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
   5. IN-BUILT MESSAGES: 1-ON-1 TEACHER CHATS + FORMING STUDY GROUPS
   ========================================================================== */

function renderMessagesView(user) {
  const filteredRooms = vault.rooms.filter((r) =>
    ui.msgTab === 'teachers' ? r.room_type === 'direct' : r.room_type === 'group'
  );

  const activeRoom =
    filteredRooms.find((r) => r.id === ui.activeRoomId) ||
    filteredRooms[0] ||
    vault.rooms[0];

  const roomMessages = activeRoom
    ? vault.messages.filter((m) => m.room_id === activeRoom.id)
    : [];

  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      <button type="button" class="action-pill-btn" id="toggle-group-form-btn">
        ${ICONS.plus}
        <span>Form Study Group</span>
      </button>
    </div>

    <div class="subview-title-block">
      <h2>Messages &amp; Study Groups</h2>
      <p>Talk directly with teachers or study together with classmates. Chats stay saved offline.</p>
    </div>

    <div class="chip-row">
      <button type="button" class="filter-chip ${ui.msgTab === 'teachers' ? 'is-active' : ''}" data-msg-tab="teachers">
        Teachers (1-on-1)
      </button>
      <button type="button" class="filter-chip ${ui.msgTab === 'groups' ? 'is-active' : ''}" data-msg-tab="groups">
        Study Groups (${vault.rooms.filter((r) => r.room_type === 'group').length})
      </button>
    </div>

    ${
      ui.showGroupForm
        ? `
      <form class="content-card inline-form" id="create-group-form">
        <h3 class="item-title">Form a New Study Group</h3>
        <input type="text" name="name" class="input-field" placeholder="Study Group Name (e.g. Grade 12 Calculus Revision)" required />
        <input type="text" name="subject" class="input-field" placeholder="Subject (e.g. Mathematics)" required />
        <input type="text" name="members" class="input-field" placeholder="Invite classmates / teacher (e.g. Amahle, Liam, Ms. Khumalo)" required />
        <button type="submit" class="gold-btn">Create Study Group</button>
      </form>
    `
        : ''
    }

    <!-- Room Selector List -->
    <div class="stack-list">
      ${filteredRooms
        .map(
          (room) => `
          <button type="button" class="room-item-btn ${activeRoom?.id === room.id ? 'is-active' : ''}" data-select-room="${room.id}">
            <div class="wide-strip-left">
              <div class="room-avatar">${escapeHtml(initials(room.name))}</div>
              <div>
                <div class="tile-title">${escapeHtml(room.name)}</div>
                <div class="tile-sub">${escapeHtml(room.members_label || room.subject)}</div>
              </div>
            </div>
            <span class="tile-count-pill">${escapeHtml(room.subject)}</span>
          </button>
        `
        )
        .join('')}
    </div>

    <!-- Active Chat Thread -->
    ${
      activeRoom
        ? `
      <section class="content-card">
        <div class="card-meta-row">
          <h3 class="item-title">${escapeHtml(activeRoom.name)}</h3>
          <span class="offline-saved-badge">${escapeHtml(activeRoom.room_type === 'group' ? 'Study Group' : 'Direct Teacher Chat')}</span>
        </div>

        <div class="chat-feed-box" id="chat-feed-box">
          ${
            roomMessages.length
              ? roomMessages
                  .map((m) => {
                    const mine = m.sender_id === user.id;
                    return `
                      <div class="chat-bubble ${mine ? 'is-mine' : ''}">
                        <span class="chat-sender">${escapeHtml(m.sender_name)} (${escapeHtml(m.sender_role)})</span>
                        <p class="chat-text">${escapeHtml(m.body)}</p>
                      </div>
                    `;
                  })
                  .join('')
              : `<p class="tile-sub">No messages yet — say hello to start the conversation!</p>`
          }
        </div>

        <form class="chat-composer-row" id="send-chat-form" data-room-id="${activeRoom.id}">
          <input type="text" name="body" class="input-field" placeholder="Write a message (queues offline if no signal)…" required />
          <button type="submit" class="gold-btn" aria-label="Send">${ICONS.send}</button>
        </form>
      </section>
    `
        : ''
    }
  `;
}

/* ==========================================================================
   6. APP-WIDE BROADCASTS VIEW (ADMIN & TEACHERS -> STUDENTS & PARENTS)
   ========================================================================== */

function renderBroadcastsView(user) {
  const canBroadcast = user.role === 'admin' || user.role === 'teacher';

  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      ${
        canBroadcast
          ? `
        <button type="button" class="action-pill-btn" id="toggle-bc-form-btn">
          ${ICONS.plus}
          <span>Broadcast Message</span>
        </button>
      `
          : `<span class="tile-count-pill">Students &amp; Parents Feed</span>`
      }
    </div>

    <div class="subview-title-block">
      <h2>App-Wide Broadcasts</h2>
      <p>
        ${
          canBroadcast
            ? 'Announcements posted here appear across the entire app for all Students and Parents.'
            : 'Official announcements from i-tutor Admin and Teachers — saved for offline reading.'
        }
      </p>
    </div>

    ${
      canBroadcast && ui.showBroadcastForm
        ? `
      <form class="content-card inline-form" id="send-broadcast-form">
        <h3 class="item-title">Broadcast to Students &amp; Parents</h3>
        <input type="text" name="title" class="input-field" placeholder="Headline (e.g. Friday Extra Maths Session at 15:00)" required />
        <select name="audience" class="input-field">
          <option value="students_parents">Students &amp; Parents</option>
          <option value="all">Everyone (Including Visitors)</option>
        </select>
        <textarea name="body" rows="3" class="input-field" placeholder="Write announcement message…" required></textarea>
        <button type="submit" class="gold-btn">Broadcast Throughout App</button>
      </form>
    `
        : ''
    }

    <div class="stack-list">
      ${vault.broadcasts
        .map(
          (bc) => `
          <article class="content-card">
            <div class="card-meta-row">
              <span class="subject-tag">${escapeHtml(bc.author_role === 'admin' ? 'Admin Broadcast' : 'Teacher Broadcast')}</span>
              <span class="tile-count-pill">To: Students &amp; Parents</span>
            </div>
            <h3 class="item-title">${escapeHtml(bc.title)}</h3>
            <p class="item-desc">${escapeHtml(bc.body)}</p>
            <span class="tile-sub">Posted by ${escapeHtml(bc.author_name)}</span>
          </article>
        `
        )
        .join('')}
    </div>
  `;
}

/* ==========================================================================
   7. PUBLIC TUITION PRICES & CONTACT INFO (FOR THOSE NOT YET JOINED)
   ========================================================================== */

function renderTuitionAndContactsView(user, { embeddedOnHome = false } = {}) {
  const plans = vault.tuitionInfo?.plans || [];
  const contacts = vault.tuitionInfo?.contacts || {};
  const isAdmin = user.role === 'admin';

  return `
    ${
      embeddedOnHome
        ? ''
        : `
      <div class="subview-header">
        <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
        ${
          isAdmin
            ? `<button type="button" class="action-pill-btn" id="toggle-contact-edit-btn">Edit Contacts</button>`
            : `<button type="button" class="action-pill-btn" data-open-view="account">${ICONS.user} <span>Member Sign In</span></button>`
        }
      </div>
    `
    }

    <section class="layout-hero-card">
      <div class="hero-top-row">
        <span class="offline-saved-badge">Open Admissions · Grades 8 – 12</span>
        ${
          embeddedOnHome
            ? `<button type="button" class="action-pill-btn" data-open-view="account">${ICONS.user} <span>Member Sign In</span></button>`
            : ''
        }
      </div>
      <div>
        <div class="hero-eyebrow">Welcome to i-tutor · Confidence in learning</div>
        <div class="hero-topic-title">Tuition Packages &amp; Contact Info</div>
        <div class="hero-subline">
          Not yet enrolled? Explore our monthly &amp; 1-on-1 tuition rates below or contact admissions directly.
        </div>
      </div>
    </section>

    <div class="pricing-grid">
      ${plans
        .map(
          (plan, idx) => `
          <article class="price-card ${idx === 1 ? 'is-featured' : ''}">
            <div>
              <span class="subject-tag">${escapeHtml(plan.badge)}</span>
              <h3 class="item-title" style="margin-top: 0.55rem;">${escapeHtml(plan.name)}</h3>
              <div class="price-amount" style="margin-top: 0.25rem;">${escapeHtml(plan.price)}</div>
            </div>
            <ul class="price-feature-list">
              ${(plan.features || []).map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
            </ul>
          </article>
        `
        )
        .join('')}
    </div>

    ${
      isAdmin && ui.showContactEditForm
        ? `
      <form class="content-card inline-form" id="edit-contacts-form">
        <h3 class="item-title">Update Public Contact Info</h3>
        <input type="text" name="phone" class="input-field" value="${escapeHtml(contacts.phone || '')}" placeholder="Phone" required />
        <input type="text" name="whatsapp" class="input-field" value="${escapeHtml(contacts.whatsapp || '')}" placeholder="WhatsApp" required />
        <input type="email" name="email" class="input-field" value="${escapeHtml(contacts.email || '')}" placeholder="Email" required />
        <input type="text" name="address" class="input-field" value="${escapeHtml(contacts.address || '')}" placeholder="Address" required />
        <input type="text" name="hours" class="input-field" value="${escapeHtml(contacts.hours || '')}" placeholder="Hours" required />
        <button type="submit" class="gold-btn">Save Contact Details</button>
      </form>
    `
        : ''
    }

    <!-- Contact Infos Card -->
    <section class="content-card">
      <h3 class="item-title">Contact i-tutor Admissions</h3>
      <div class="form-row-2">
        <div class="contact-row">
          <span class="contact-label">Phone Desk</span>
          <span class="contact-val">${escapeHtml(contacts.phone || '')}</span>
        </div>
        <div class="contact-row">
          <span class="contact-label">WhatsApp</span>
          <span class="contact-val">${escapeHtml(contacts.whatsapp || '')}</span>
        </div>
      </div>
      <div class="contact-row">
        <span class="contact-label">Email</span>
        <span class="contact-val">${escapeHtml(contacts.email || '')}</span>
      </div>
      <div class="contact-row">
        <span class="contact-label">Campus Address</span>
        <span class="contact-val">${escapeHtml(contacts.address || '')}</span>
      </div>
      <div class="contact-row">
        <span class="contact-label">Operating Hours</span>
        <span class="contact-val">${escapeHtml(contacts.hours || '')}</span>
      </div>
    </section>

    <!-- Prospective Learner Enquiry Form -->
    <form class="content-card inline-form" id="submit-enquiry-form">
      <h3 class="item-title">Enquire to Join i-tutor</h3>
      <div class="form-row-2">
        <input type="text" name="full_name" class="input-field" placeholder="Your Full Name" required />
        <input type="text" name="contact_detail" class="input-field" placeholder="Phone or WhatsApp Number" required />
      </div>
      <div class="form-row-2">
        <input type="text" name="student_grade" class="input-field" placeholder="Grade (e.g. Grade 11)" required />
        <select name="selected_plan" class="input-field">
          ${plans.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)} (${escapeHtml(p.price)})</option>`).join('')}
        </select>
      </div>
      <textarea name="message" rows="2" class="input-field" placeholder="Subjects needed or questions…"></textarea>
      <button type="submit" class="gold-btn">Send Admissions Enquiry</button>
    </form>

    ${
      isAdmin && vault.enquiries?.length
        ? `
      <section class="content-card">
        <h3 class="item-title">Recent Admissions Enquiries (${vault.enquiries.length})</h3>
        ${vault.enquiries
          .map(
            (eq) => `
            <div class="worksheet-pack-box">
              <strong>${escapeHtml(eq.full_name)}</strong> (${escapeHtml(eq.student_grade)}) · ${escapeHtml(eq.contact_detail)}
              \nPackage: ${escapeHtml(eq.selected_plan)}
              ${eq.message ? `\nNote: ${escapeHtml(eq.message)}` : ''}
            </div>
          `
          )
          .join('')}
      </section>
    `
        : ''
    }
  `;
}

/* ==========================================================================
   8. ACCOUNT / ROLE SWITCHER & OFFLINE SYNC CONTROLS
   ========================================================================== */

function renderAccountView(user) {
  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
    </div>

    <div class="subview-title-block">
      <h2>Switch View / Sign In</h2>
      <p>Preview how Visitors, Students, Parents, Teachers, and Admins use i-tutor.</p>
    </div>

    <section class="content-card">
      <h3 class="item-title">Not Yet Joined (Public View)</h3>
      <button
        type="button"
        class="role-choice-btn ${user.id === 'guest' ? 'is-selected' : ''}"
        data-switch-user="guest"
        style="width: 100%;"
      >
        <span class="tile-title">Visitor — Tuition Prices &amp; Contact Info</span>
        <span class="tile-sub">What people see before joining the app</span>
      </button>
    </section>

    <section class="content-card">
      <h3 class="item-title">Enrolled Members, Teachers &amp; Admin</h3>
      <div class="role-grid">
        ${vault.profiles
          .map(
            (p) => `
            <button
              type="button"
              class="role-choice-btn ${user.id === p.id ? 'is-selected' : ''}"
              data-switch-user="${p.id}"
            >
              <span class="subject-tag" style="align-self: flex-start;">${escapeHtml(p.role.toUpperCase())}</span>
              <span class="tile-title" style="margin-top: 0.25rem;">${escapeHtml(p.name)}</span>
              <span class="tile-sub">${escapeHtml(p.subtitle)}</span>
            </button>
          `
          )
          .join('')}
      </div>
    </section>

    <section class="content-card">
      <h3 class="item-title">Appearance &amp; Intro</h3>
      <div class="form-row-2">
        <button type="button" class="secondary-btn" id="toggle-theme-btn">
          ${session.theme === 'night' ? '☀️ Cream Mode' : '🌙 Night Study Mode'}
        </button>
        <button type="button" class="secondary-btn" id="replay-intro-btn">
          ↻ Replay 10s Intro
        </button>
      </div>
    </section>
  `;
}

function renderSyncCenterView() {
  const outbox = loadOutbox();
  const offline = isDeviceOffline();

  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
    </div>

    <div class="subview-title-block">
      <h2>Offline Storage &amp; Auto-Download</h2>
      <p>Everything below is stored on your device so you can keep working without internet.</p>
    </div>

    <section class="content-card">
      <div class="card-meta-row">
        <span class="subject-tag">${offline ? 'Currently Offline' : 'Online · Auto-Download Active'}</span>
        <span class="tile-count-pill">${outbox.length} queued offline</span>
      </div>
      <div class="contact-row">
        <span class="contact-label">Downloaded &amp; Stored on Device</span>
        <span class="contact-val">
          ${vault.timetables.length} Timetables · ${vault.assignments.length} Assignments · ${vault.messages.length} Messages · ${vault.broadcasts.length} Broadcasts
        </span>
      </div>

      <div class="form-row-2">
        <button type="button" class="gold-btn" id="manual-sync-btn">
          ${ICONS.sync}
          <span>Sync &amp; Download Now</span>
        </button>
        <button type="button" class="secondary-btn" id="toggle-offline-sim-btn">
          ${session.simulateOffline ? 'Go Back Online' : 'Test Offline Mode'}
        </button>
      </div>
    </section>
  `;
}

/* ==========================================================================
   9. SHELL RENDER & EVENTS
   ========================================================================== */

function renderCurrentView(user) {
  switch (ui.view) {
    case 'timetables':
      return renderTimetablesView(user);
    case 'assignments':
      return renderAssignmentsView(user);
    case 'messages':
      return renderMessagesView(user);
    case 'broadcasts':
      return renderBroadcastsView(user);
    case 'tuition':
      return renderTuitionAndContactsView(user);
    case 'account':
      return renderAccountView(user);
    case 'sync':
      return renderSyncCenterView();
    case 'home':
    default:
      return renderHomeWorkspace(user);
  }
}

function renderAppShell() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  applyTheme();
  const user = getCurrentUser();
  const offline = isDeviceOffline();
  const outboxCount = loadOutbox().length;

  const roleShort =
    user.role === 'guest'
      ? 'Not Joined'
      : user.role.charAt(0).toUpperCase() + user.role.slice(1);

  appEl.innerHTML = `
    <div class="app-layout" id="app-layout">
      <!-- Top Bar: Sync Pill | Emblem-Only Logo | Role Switcher -->
      <header class="app-topbar">
        <div class="topbar-inner">
          <div class="topbar-left">
            <button type="button" class="sync-pill-btn" data-open-view="sync">
              <span class="status-dot ${offline ? 'is-offline' : ''}"></span>
              <span>${offline ? `Offline${outboxCount ? ` (${outboxCount})` : ''}` : 'Synced'}</span>
            </button>
          </div>

          <button type="button" class="topbar-emblem-btn" id="topbar-logo" aria-label="Home">
            ${renderEmblemSVG({ animated: false, uid: 'header' })}
          </button>

          <div class="topbar-right">
            <button type="button" class="role-pill-btn" data-open-view="account">
              ${ICONS.user}
              <span>${escapeHtml(roleShort)}</span>
            </button>
          </div>
        </div>
      </header>

      <main class="app-workspace">
        ${renderCurrentView(user)}
      </main>

      <!-- Floating Bottom Charcoal Dock -->
      <nav class="app-bottom-dock" aria-label="Primary Navigation">
        <button type="button" class="dock-slot ${ui.dockIndex === 0 ? 'is-active' : ''}" data-dock-tab="0" aria-label="Home">
          ${ICONS.homeDock}
        </button>
        <button type="button" class="dock-slot ${ui.dockIndex === 1 ? 'is-active' : ''}" data-dock-tab="1" aria-label="Timetable">
          ${ICONS.timetableDock}
        </button>
        <button type="button" class="dock-slot ${ui.dockIndex === 2 ? 'is-active' : ''}" data-dock-tab="2" aria-label="Messages">
          ${ICONS.messagesDock}
        </button>
        <button type="button" class="dock-slot ${ui.dockIndex === 3 ? 'is-active' : ''}" data-dock-tab="3" aria-label="Broadcasts and Tuition">
          ${ICONS.infoDock}
        </button>
      </nav>
    </div>
  `;

  renderToastOnly();
  bindEvents(user);
}

function openView(target) {
  ui.view = target;
  if (target === 'home') ui.dockIndex = 0;
  else if (target === 'timetables' || target === 'assignments') ui.dockIndex = 1;
  else if (target === 'messages') ui.dockIndex = 2;
  else if (target === 'broadcasts' || target === 'tuition') ui.dockIndex = 3;

  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderAppShell();
}

function bindEvents(user) {
  const topLogo = document.getElementById('topbar-logo');
  if (topLogo) {
    topLogo.addEventListener('click', () => openView('home'));
    topLogo.addEventListener('dblclick', () => startTenSecondLoadingSequence());
  }

  document.querySelectorAll('[data-open-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-open-view');
      if (target) openView(target);
    });
  });

  // Bottom Dock
  document.querySelectorAll('[data-dock-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-dock-tab') || 0);
      ui.dockIndex = idx;
      if (idx === 0) ui.view = 'home';
      else if (idx === 1) ui.view = user.role === 'guest' ? 'tuition' : 'timetables';
      else if (idx === 2) ui.view = user.role === 'guest' ? 'tuition' : 'messages';
      else ui.view = user.role === 'guest' ? 'tuition' : 'broadcasts';
      renderAppShell();
    });
  });

  // Role Switcher
  document.querySelectorAll('[data-switch-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextId = btn.getAttribute('data-switch-user') || 'stu-thabo';
      session.currentUserId = nextId;
      saveSession(session);
      ui.view = 'home';
      ui.dockIndex = 0;
      const switchedUser = getCurrentUser();
      showToast(`Viewing as ${switchedUser.name}`);
      renderAppShell();
    });
  });

  // Theme & Intro Replay
  const themeBtn = document.getElementById('toggle-theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      session.theme = session.theme === 'night' ? 'light' : 'night';
      saveSession(session);
      renderAppShell();
    });
  }

  const replayBtn = document.getElementById('replay-intro-btn');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => startTenSecondLoadingSequence());
  }

  // Offline Sync Controls
  const manualSyncBtn = document.getElementById('manual-sync-btn');
  if (manualSyncBtn) {
    manualSyncBtn.addEventListener('click', () => performSync({ silent: false }));
  }

  const toggleOfflineSimBtn = document.getElementById('toggle-offline-sim-btn');
  if (toggleOfflineSimBtn) {
    toggleOfflineSimBtn.addEventListener('click', () => {
      session.simulateOffline = !session.simulateOffline;
      saveSession(session);
      if (!session.simulateOffline) {
        showToast('Back online — syncing queued offline items & downloading updates…');
        performSync({ silent: true });
      } else {
        ui.syncState = 'offline';
        showToast('Simulated Offline Mode ON — try saving timetables, assignments, or messages!');
        renderAppShell();
      }
    });
  }

  // --- Timetable Events ---
  document.querySelectorAll('[data-day-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      ui.dayFilter = chip.getAttribute('data-day-filter') || 'All';
      renderAppShell();
    });
  });

  const toggleTtFormBtn = document.getElementById('toggle-tt-form-btn');
  if (toggleTtFormBtn) {
    toggleTtFormBtn.addEventListener('click', () => {
      ui.showTimetableForm = !ui.showTimetableForm;
      renderAppShell();
    });
  }

  const addTtForm = document.getElementById('add-timetable-form');
  if (addTtForm) {
    addTtForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addTtForm);
      const isStaff = user.role === 'teacher' || user.role === 'admin';
      const slot = {
        id: `tt-${Date.now()}`,
        day_of_week: String(fd.get('day_of_week') || 'Monday'),
        start_time: String(fd.get('start_time') || '16:00'),
        end_time: String(fd.get('end_time') || '17:00'),
        subject: String(fd.get('subject') || '').trim(),
        topic: String(fd.get('topic') || '').trim(),
        teacher_name: isStaff ? user.name : '',
        location_mode: String(fd.get('location_mode') || 'Saved Offline').trim(),
        grade_group: user.grade || 'Grade 12',
        owner_id: isStaff ? null : user.id,
        is_official: isStaff
      };
      ui.showTimetableForm = false;
      runActionAndSync(
        { type: 'ADD_TIMETABLE', payload: slot },
        'Timetable saved offline on device — will sync when online!',
        'Timetable saved offline & synced!'
      );
    });
  }

  document.querySelectorAll('[data-delete-tt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-tt');
      if (!id) return;
      runActionAndSync(
        { type: 'DELETE_TIMETABLE', payload: { id } },
        'Removed offline — will sync when online.',
        'Timetable slot removed.'
      );
    });
  });

  // --- Remote Assignment Events ---
  const toggleAsgBtn = document.getElementById('toggle-asg-form-btn');
  if (toggleAsgBtn) {
    toggleAsgBtn.addEventListener('click', () => {
      ui.showAssignmentForm = !ui.showAssignmentForm;
      renderAppShell();
    });
  }

  const createAsgForm = document.getElementById('create-assignment-form');
  if (createAsgForm) {
    createAsgForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(createAsgForm);
      const asg = {
        id: `asg-${Date.now()}`,
        title: String(fd.get('title') || '').trim(),
        subject: String(fd.get('subject') || '').trim(),
        grade_group: String(fd.get('grade_group') || 'Grade 12').trim(),
        teacher_id: user.id,
        teacher_name: user.name,
        due_date: String(fd.get('due_date') || '2026-12-05'),
        max_marks: Number(fd.get('max_marks') || 30),
        instructions: String(fd.get('instructions') || '').trim(),
        offline_pack_content: String(fd.get('offline_pack_content') || '').trim()
      };
      ui.showAssignmentForm = false;
      runActionAndSync(
        { type: 'CREATE_ASSIGNMENT', payload: asg },
        'Assignment saved offline — will auto-send to students once online!',
        'Remote assignment sent! It will auto-download to students’ phones.'
      );
    });
  }

  document.querySelectorAll('.student-submit-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const asgId = form.getAttribute('data-asg-id');
      const fd = new FormData(form);
      const answerText = String(fd.get('answer_text') || '').trim();
      if (!asgId || !answerText) return;

      const submission = {
        id: `subm-${asgId}-${user.id}`,
        assignment_id: asgId,
        student_id: user.id,
        student_name: user.name,
        answer_text: answerText,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      };
      runActionAndSync(
        { type: 'SUBMIT_ASSIGNMENT', payload: submission },
        'Saved offline! Your assignment will submit automatically when online.',
        'Assignment submitted to teacher!'
      );
    });
  });

  document.querySelectorAll('.grade-sub-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const subId = form.getAttribute('data-sub-id');
      const fd = new FormData(form);
      runActionAndSync(
        {
          type: 'GRADE_SUBMISSION',
          payload: {
            id: subId,
            marks_awarded: Number(fd.get('marks_awarded') || 0),
            teacher_feedback: String(fd.get('teacher_feedback') || '').trim()
          }
        },
        'Grade saved offline — will sync to student once online.',
        'Marks & feedback sent to student!'
      );
    });
  });

  // --- Messages & Study Group Events ---
  document.querySelectorAll('[data-msg-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      ui.msgTab = tab.getAttribute('data-msg-tab') || 'teachers';
      const matching = vault.rooms.filter((r) =>
        ui.msgTab === 'teachers' ? r.room_type === 'direct' : r.room_type === 'group'
      );
      if (matching[0]) ui.activeRoomId = matching[0].id;
      renderAppShell();
    });
  });

  document.querySelectorAll('[data-select-room]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.activeRoomId = btn.getAttribute('data-select-room') || '';
      renderAppShell();
      const feed = document.getElementById('chat-feed-box');
      if (feed) feed.scrollTop = feed.scrollHeight;
    });
  });

  const toggleGroupBtn = document.getElementById('toggle-group-form-btn');
  if (toggleGroupBtn) {
    toggleGroupBtn.addEventListener('click', () => {
      ui.showGroupForm = !ui.showGroupForm;
      renderAppShell();
    });
  }

  const createGroupForm = document.getElementById('create-group-form');
  if (createGroupForm) {
    createGroupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(createGroupForm);
      const name = String(fd.get('name') || '').trim();
      const subject = String(fd.get('subject') || '').trim();
      const members = String(fd.get('members') || '').trim();
      if (!name) return;

      const newRoom = {
        id: `room-grp-${Date.now()}`,
        room_type: 'group',
        name,
        subject: subject || 'Study Group',
        participant_ids: [user.id],
        members_label: `Members: ${user.name}, ${members}`,
        created_by_name: user.name
      };
      ui.showGroupForm = false;
      ui.msgTab = 'groups';
      ui.activeRoomId = newRoom.id;
      runActionAndSync(
        { type: 'CREATE_STUDY_GROUP', payload: newRoom },
        'Study group created offline — will sync once online!',
        'New Study Group created!'
      );
    });
  }

  const sendChatForm = document.getElementById('send-chat-form');
  if (sendChatForm) {
    sendChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const roomId = sendChatForm.getAttribute('data-room-id');
      const fd = new FormData(sendChatForm);
      const body = String(fd.get('body') || '').trim();
      if (!roomId || !body) return;

      const msg = {
        id: `msg-${Date.now()}`,
        room_id: roomId,
        sender_id: user.id,
        sender_name: user.name,
        sender_role: user.role,
        body,
        created_at: new Date().toISOString()
      };
      runActionAndSync(
        { type: 'SEND_MESSAGE', payload: msg },
        'Message saved offline — will deliver automatically once online!',
        'Message sent!'
      );
      const feed = document.getElementById('chat-feed-box');
      if (feed) feed.scrollTop = feed.scrollHeight;
    });
  }

  // --- Broadcast Events ---
  const toggleBcBtn = document.getElementById('toggle-bc-form-btn');
  if (toggleBcBtn) {
    toggleBcBtn.addEventListener('click', () => {
      ui.showBroadcastForm = !ui.showBroadcastForm;
      renderAppShell();
    });
  }

  const sendBcForm = document.getElementById('send-broadcast-form');
  if (sendBcForm) {
    sendBcForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(sendBcForm);
      const bc = {
        id: `bc-${Date.now()}`,
        title: String(fd.get('title') || '').trim(),
        body: String(fd.get('body') || '').trim(),
        author_name: `${user.name} (${user.role === 'admin' ? 'Admin' : 'Teacher'})`,
        author_role: user.role === 'admin' ? 'admin' : 'teacher',
        audience: String(fd.get('audience') || 'students_parents'),
        priority: 'important',
        created_at: new Date().toISOString()
      };
      ui.showBroadcastForm = false;
      runActionAndSync(
        { type: 'SEND_BROADCAST', payload: bc },
        'Broadcast queued offline — will publish across the app once online!',
        'Broadcast sent throughout the app to Students & Parents!'
      );
    });
  }

  // --- Tuition Contacts & Enquiry Events ---
  const toggleContactEditBtn = document.getElementById('toggle-contact-edit-btn');
  if (toggleContactEditBtn) {
    toggleContactEditBtn.addEventListener('click', () => {
      ui.showContactEditForm = !ui.showContactEditForm;
      renderAppShell();
    });
  }

  const editContactsForm = document.getElementById('edit-contacts-form');
  if (editContactsForm) {
    editContactsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(editContactsForm);
      const nextContacts = {
        phone: String(fd.get('phone') || '').trim(),
        whatsapp: String(fd.get('whatsapp') || '').trim(),
        email: String(fd.get('email') || '').trim(),
        address: String(fd.get('address') || '').trim(),
        hours: String(fd.get('hours') || '').trim()
      };
      ui.showContactEditForm = false;
      runActionAndSync(
        {
          type: 'UPDATE_TUITION_INFO',
          payload: { plans: vault.tuitionInfo.plans, contacts: nextContacts }
        },
        'Contact info updated offline — will sync when online.',
        'Public contact info updated!'
      );
    });
  }

  const enquiryForm = document.getElementById('submit-enquiry-form');
  if (enquiryForm) {
    enquiryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(enquiryForm);
      const eq = {
        id: `eq-${Date.now()}`,
        full_name: String(fd.get('full_name') || '').trim(),
        contact_detail: String(fd.get('contact_detail') || '').trim(),
        student_grade: String(fd.get('student_grade') || '').trim(),
        selected_plan: String(fd.get('selected_plan') || '').trim(),
        message: String(fd.get('message') || '').trim(),
        created_at: new Date().toISOString()
      };
      enquiryForm.reset();
      runActionAndSync(
        { type: 'SUBMIT_ENQUIRY', payload: eq },
        'Enquiry saved offline — will send to Admissions automatically once online!',
        'Thank you! Admissions received your enquiry.'
      );
    });
  }
}

/* ==========================================================================
   10. BOOT SEQUENCE (10s ANIMATED INTRO + AUTOMATIC OFFLINE SYNC LISTENERS)
   ========================================================================== */

function startTenSecondLoadingSequence() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  if (activeAnimationFrame) {
    cancelAnimationFrame(activeAnimationFrame);
    activeAnimationFrame = null;
  }

  appEl.innerHTML = renderSplashScreenMarkup();

  // Trigger background auto-download of latest timetables, assignments, messages & broadcasts during splash
  if (!isDeviceOffline()) {
    syncWithServer({ simulateOffline: session.simulateOffline }).then((res) => {
      vault = res.vault;
      ui.syncState = res.status === 'synced' ? 'synced' : 'offline';
    });
  }

  const splashEl = document.getElementById('splash-screen');
  const fillEl = document.getElementById('loader-fill');
  const percentEl = document.getElementById('loader-percent');
  const statusEl = document.getElementById('loader-status');
  const progressbarEl = document.getElementById('loader-progressbar');

  const startTime = performance.now();
  let lastStatusText = STATUS_PHASES[0].text;

  function tick(now) {
    const elapsed = Math.max(0, now - startTime);
    const rawRatio = Math.min(1, elapsed / LOADING_DURATION_MS);

    const pct = rawRatio * 100;
    const roundedPct = Math.min(100, Math.floor(pct));

    if (fillEl) fillEl.style.width = `${pct.toFixed(2)}%`;
    if (percentEl) percentEl.textContent = `${roundedPct}%`;
    if (progressbarEl) progressbarEl.setAttribute('aria-valuenow', String(roundedPct));

    let currentPhase = STATUS_PHASES[0].text;
    for (const phase of STATUS_PHASES) {
      if (pct >= phase.threshold) currentPhase = phase.text;
    }
    if (statusEl && currentPhase !== lastStatusText) {
      lastStatusText = currentPhase;
      statusEl.textContent = currentPhase;
    }

    if (rawRatio < 1) {
      activeAnimationFrame = requestAnimationFrame(tick);
    } else {
      activeAnimationFrame = null;
      if (fillEl) fillEl.style.width = '100%';
      if (percentEl) percentEl.textContent = '100%';
      if (statusEl) statusEl.textContent = 'Ready';

      setTimeout(() => {
        if (splashEl) splashEl.classList.add('is-exiting');
        setTimeout(() => {
          ui.view = 'home';
          ui.dockIndex = 0;
          renderAppShell();
        }, 620);
      }, 280);
    }
  }

  activeAnimationFrame = requestAnimationFrame(tick);
}

// Automatic reconnect listener: downloads new assignments/timetables & pushes queued offline work automatically!
window.addEventListener('online', () => {
  if (!session.simulateOffline) {
    showToast('Connection restored — auto-downloading assignments & syncing offline work…');
    performSync({ silent: true });
  }
});

window.addEventListener('offline', () => {
  ui.syncState = 'offline';
  showToast('You are offline — your saved timetables & assignments remain available.');
  if (!activeAnimationFrame) renderAppShell();
});

// Gentle background auto-download every 20s when online so remote teacher assignments & broadcasts arrive automatically
setInterval(() => {
  if (!activeAnimationFrame && !isDeviceOffline() && document.visibilityState === 'visible') {
    syncWithServer({ simulateOffline: session.simulateOffline }).then((res) => {
      if (res.status === 'synced') {
        vault = res.vault;
        ui.syncState = 'synced';
      }
    });
  }
}, 20000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

applyTheme();
startTenSecondLoadingSequence();
