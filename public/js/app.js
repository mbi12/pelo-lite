import { renderBrandEmblem, renderSunriseGauge } from './logo.js';

const state = {
  data: null,
  currentUser: null,
  activeTab: 'overview',
  theme: localStorage.getItem('itutor_theme') || 'light',
  vaultSubjectFilter: 'all',
  vaultBookmarkedOnly: false,
  coachSubjectId: 'sub-math',
  coachTopic: 'Trigonometry & Identities',
  coachMode: 'step_by_step',
  coachSending: false,
  selectedStudentForTutorMsg: 'stu-thabo',
  selectedChannelForTutorMsg: 'tutor_parent',
  selectedChildId: 'stu-thabo',
  quizRunner: null
};

document.documentElement.setAttribute('data-theme', state.theme);

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'IT'
  );
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRelative(iso) {
  if (!iso) return '';
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffHrs = Math.round(diffMs / 3600000);
  if (Math.abs(diffHrs) < 1) return diffMs >= 0 ? 'Starting within the hour' : 'Just now';
  if (diffHrs > 0 && diffHrs < 24) return `In ${diffHrs}h`;
  if (diffHrs >= 24) return `In ${Math.round(diffHrs / 24)}d`;
  if (diffHrs > -24) return `${Math.abs(diffHrs)}h ago`;
  return `${Math.round(Math.abs(diffHrs) / 24)}d ago`;
}

function renderFormattedText(raw = '') {
  const lines = String(raw).split('\n');
  let html = '';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h3>${formatInline(line.slice(4))}</h3>`;
    } else if (line.startsWith('- ') || /^\d+\.\s/.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      const cleaned = line.replace(/^-\s+/, '').replace(/^\d+\.\s+/, '');
      html += `<li>${formatInline(cleaned)}</li>`;
    } else if (line.startsWith('> ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<blockquote style="margin:8px 0;padding:10px 14px;border-left:3px solid var(--gold-sun);background:var(--gold-sun-soft);border-radius:8px;">${formatInline(line.slice(2))}</blockquote>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p>${formatInline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function formatInline(str) {
  let s = esc(str);
  s = s.replace(/\$\$(.+?)\$\$/g, '<code>$1</code>');
  s = s.replace(/\$(.+?)\$/g, '<code>$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return s;
}

function showToast(message) {
  const rack = document.getElementById('toast-rack');
  if (!rack) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  rack.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3600);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || `Request failed (${res.status})`);
  }
  return payload;
}

async function refreshSnapshot({ silent = true } = {}) {
  const snapshot = await api('/api/bootstrap');
  state.data = snapshot;

  const savedUserId = localStorage.getItem('itutor_user_id');
  const existingUser =
    (state.currentUser && snapshot.users.find((u) => u.id === state.currentUser.id)) ||
    (savedUserId && snapshot.users.find((u) => u.id === savedUserId)) ||
    snapshot.users.find((u) => u.id === 'stu-thabo') ||
    snapshot.users[0];

  setCurrentUser(existingUser, { rerender: !silent });
  if (silent) renderApp();
}

function setCurrentUser(user, { rerender = true } = {}) {
  if (!user) return;
  const roleChanged = !state.currentUser || state.currentUser.role !== user.role;
  state.currentUser = user;
  localStorage.setItem('itutor_user_id', user.id);

  if (user.role === 'parent') {
    state.selectedChildId = user.linked_student_id || 'stu-thabo';
  }
  if (roleChanged) {
    state.activeTab =
      user.role === 'tutor' ? 'tutor_home' : user.role === 'parent' ? 'parent_home' : 'overview';
  }
  if (rerender) renderApp();
}

function getTabsForRole(role) {
  if (role === 'tutor') {
    const pendingHelp = (state.data?.help_requests || []).filter((r) => r.status === 'pending').length;
    const ungraded = (state.data?.submissions || []).filter((s) => s.status === 'submitted').length;
    return [
      { id: 'tutor_home', label: 'Academy Hub', short: 'Hub', badge: pendingHelp || null },
      { id: 'tutor_schedule', label: 'Timetable & Attendance', short: 'Classes', badge: null },
      { id: 'tutor_assessments', label: 'Homework & Quizzes', short: 'Grading', badge: ungraded || null },
      { id: 'tutor_vault', label: 'Study Vault Studio', short: 'Vault', badge: null },
      { id: 'tutor_comms', label: 'Notices & Inbox', short: 'Inbox', badge: null }
    ];
  }
  if (role === 'parent') {
    return [
      { id: 'parent_home', label: 'Confidence Overview', short: 'Progress', badge: null },
      { id: 'parent_academics', label: 'Attendance & Marks', short: 'Academics', badge: null },
      { id: 'parent_messages', label: 'Message Tutor', short: 'Tutor Chat', badge: null }
    ];
  }
  const analytics = state.data?.analytics_by_student?.[state.currentUser?.id];
  return [
    { id: 'overview', label: 'Sunrise Home', short: 'Home', badge: null },
    { id: 'vault', label: 'Subjects & Study Vault', short: 'Vault', badge: (state.data?.resources || []).length },
    {
      id: 'practice',
      label: 'Quizzes & Homework',
      short: 'Practice',
      badge: analytics?.homework_pending_count || null
    },
    { id: 'coach', label: 'i-tutor AI Coach', short: 'AI Coach', badge: '24/7' },
    { id: 'schedule', label: 'Timetable & Recaps', short: 'Classes', badge: null },
    { id: 'messages', label: 'Tutor Q&A', short: 'Messages', badge: null }
  ];
}

function getSubjectName(subjectId) {
  return state.data?.subjects.find((s) => s.id === subjectId)?.name || 'General';
}

/* ==========================================================================
   TOP-LEVEL SHELL RENDERER
   ========================================================================== */
function renderApp() {
  const root = document.getElementById('app');
  if (!root || !state.data || !state.currentUser) return;

  const user = state.currentUser;
  const tabs = getTabsForRole(user.role);
  if (!tabs.some((t) => t.id === state.activeTab)) {
    state.activeTab = tabs[0].id;
  }

  root.innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="topbar-left">
          ${renderBrandEmblem({ size: 'sm', showTagline: true })}
        </div>

        <div class="role-switcher-bar" role="tablist" aria-label="Portal Role Switcher">
          <button class="role-pill ${user.role === 'student' ? 'active' : ''}" data-action="quick-role" data-role="student">
            <span class="role-dot"></span>Student Portal
          </button>
          <button class="role-pill ${user.role === 'tutor' ? 'active' : ''}" data-action="quick-role" data-role="tutor">
            <span class="role-dot"></span>Tutor Studio
          </button>
          <button class="role-pill ${user.role === 'parent' ? 'active' : ''}" data-action="quick-role" data-role="parent">
            <span class="role-dot"></span>Parent View
          </button>
        </div>

        <div class="topbar-right">
          <button class="icon-btn" data-action="toggle-theme" title="Switch Day Cream / Night Study theme">
            ${state.theme === 'light' ? '🌙 Night Study' : '☀️ Warm Cream'}
          </button>
          <button class="user-chip" data-action="open-auth-modal" title="Switch or create account">
            <span class="avatar-circle">${esc(initials(user.name))}</span>
            <span class="user-chip-meta">
              <span class="user-chip-name">${esc(user.name)}</span>
              <span class="user-chip-sub">${esc(user.grade || user.role.toUpperCase())} · Switch</span>
            </span>
          </button>
        </div>
      </div>
    </header>

    <div class="workspace-shell">
      <aside class="side-nav" aria-label="Section Navigation">
        <div class="side-nav-label">${esc(user.role)} Workspace</div>
        ${tabs
          .map(
            (t) => `
            <button class="nav-item ${state.activeTab === t.id ? 'active' : ''}" data-action="switch-tab" data-tab="${t.id}">
              <span class="nav-item-left">${esc(t.label)}</span>
              ${t.badge ? `<span class="nav-badge">${esc(t.badge)}</span>` : ''}
            </button>
          `
          )
          .join('')}

        <div class="side-brand-card">
          <img src="/assets/itutor-logo.jpg" alt="i-tutor Confidence in learning sign" loading="lazy" />
          <p><strong>i-tutor Academy</strong> · Building calm, step-by-step mastery across every subject.</p>
        </div>
      </aside>

      <main class="main-stage">
        ${renderActiveView()}
      </main>
    </div>

    <nav class="mobile-dock" aria-label="Mobile Navigation">
      ${tabs
        .slice(0, 5)
        .map(
          (t) => `
          <button class="dock-btn ${state.activeTab === t.id ? 'active' : ''}" data-action="switch-tab" data-tab="${t.id}">
            <span>${esc(t.short)}</span>
          </button>
        `
        )
        .join('')}
    </nav>
  `;

  if (state.activeTab === 'coach') {
    const feed = document.getElementById('coach-feed');
    if (feed) feed.scrollTop = feed.scrollHeight;
  }
}

function renderActiveView() {
  switch (state.activeTab) {
    case 'overview':
      return renderStudentOverview();
    case 'vault':
      return renderStudentVault();
    case 'practice':
      return renderStudentPractice();
    case 'coach':
      return renderStudentCoach();
    case 'schedule':
      return renderStudentSchedule();
    case 'messages':
      return renderStudentMessages();
    case 'tutor_home':
      return renderTutorHome();
    case 'tutor_schedule':
      return renderTutorSchedule();
    case 'tutor_assessments':
      return renderTutorAssessments();
    case 'tutor_vault':
      return renderTutorVault();
    case 'tutor_comms':
      return renderTutorComms();
    case 'parent_home':
      return renderParentHome();
    case 'parent_academics':
      return renderParentAcademics();
    case 'parent_messages':
      return renderParentMessages();
    default:
      return renderStudentOverview();
  }
}

/* ==========================================================================
   STUDENT PORTAL VIEWS
   ========================================================================== */
function renderStudentOverview() {
  const stu = state.currentUser;
  const analytics = state.data.analytics_by_student[stu.id] || {
    overall_confidence: 74,
    label: 'Building Confidence',
    attendance_rate: 95,
    quiz_average: 78,
    mastered_topics_count: 4,
    total_topics_count: 16,
    subjects: [],
    weak_spots: []
  };

  const upcomingSessions = state.data.sessions
    .filter((s) => s.status === 'upcoming' && (!s.target_student_id || s.target_student_id === stu.id))
    .slice(0, 3);

  const pinnedAnnouncements = state.data.announcements
    .filter((a) => a.audience === 'all' || a.audience === 'students')
    .slice(0, 2);

  return `
    <div class="section-stack">
      <section class="sunrise-hero">
        <div>
          <div class="hero-eyebrow">☀️ ${esc(stu.grade)} · ${stu.streak_days || 1}-Day Learning Streak</div>
          <h1 class="hero-title">Welcome back, ${esc(stu.name.split(' ')[0])}. Your confidence is rising.</h1>
          <p class="hero-sub">
            Every worked note, practice quiz, and class check-in builds real exam readiness. How are you feeling about your current topics today?
          </p>
          <div style="margin-bottom:16px;">
            <div style="font-size:0.75rem;font-weight:700;color:#FAD463;margin-bottom:6px;">QUICK CONFIDENCE CHECK-IN:</div>
            <div class="mood-strip">
              <button class="mood-btn ${stu.confidence_mood === 'stuck' ? 'active' : ''}" data-action="set-mood" data-mood="stuck">Need Help / Stuck</button>
              <button class="mood-btn ${stu.confidence_mood === 'building' ? 'active' : ''}" data-action="set-mood" data-mood="building">Getting There</button>
              <button class="mood-btn ${stu.confidence_mood === 'confident' ? 'active' : ''}" data-action="set-mood" data-mood="confident">Feeling Exam-Ready</button>
            </div>
          </div>
          <div class="hero-actions">
            <button class="btn btn-gold" data-action="switch-tab" data-tab="coach">Ask 24/7 i-tutor Coach</button>
            <button class="btn btn-ghost-light" data-action="switch-tab" data-tab="practice">Take a Practice Quiz</button>
            <button class="btn btn-ghost-light" data-action="open-help-modal">Request 1-on-1 Tutor Slot</button>
          </div>
        </div>
        <div>
          ${renderSunriseGauge(analytics.overall_confidence, `${analytics.label} · Overall`)}
        </div>
      </section>

      <section class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Sunrise Confidence</div>
          <div class="stat-value">${analytics.overall_confidence}%</div>
          <div class="stat-sub">${esc(analytics.label)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Class Attendance</div>
          <div class="stat-value">${analytics.attendance_rate}%</div>
          <div class="stat-sub">Consistent studio presence</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Quiz Mastery Avg</div>
          <div class="stat-value">${analytics.quiz_average}%</div>
          <div class="stat-sub">${analytics.quizzes_completed} auto-graded sprints</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Topics Exam-Ready</div>
          <div class="stat-value">${analytics.mastered_topics_count} / ${analytics.total_topics_count}</div>
          <div class="stat-sub">${analytics.homework_pending_count} homework due soon</div>
        </div>
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Weak-Spot Radar</h2>
              <p class="card-subtitle">Topics below 76% confidence — tackle one today to lift your Sunrise score.</p>
            </div>
            <span class="badge badge-gold">Priority Focus</span>
          </div>
          <div class="item-list">
            ${
              analytics.weak_spots.length === 0
                ? `<div class="list-row"><div class="list-row-main"><h4>All topics above 76%!</h4><p>Incredible consistency — keep your streak alive with past papers in the Study Vault.</p></div></div>`
                : analytics.weak_spots
                    .map(
                      (w) => `
                    <div class="list-row">
                      <div class="list-row-main" style="flex:1;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                          <span class="badge badge-charcoal">${esc(w.subject_name)}</span>
                          <span class="badge ${w.confidence_score < 58 ? 'badge-coral' : 'badge-gold'}">${w.confidence_score}% · ${esc(w.label)}</span>
                        </div>
                        <h4 style="margin-top:6px;">${esc(w.name)}</h4>
                        <p>${esc(w.summary)}</p>
                        <div class="conf-bar-track"><div class="conf-bar-fill ${w.tier}" style="width:${w.confidence_score}%"></div></div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                          ${
                            w.recommended_quiz_id
                              ? `<button class="btn btn-gold btn-sm" data-action="start-quiz" data-quiz-id="${w.recommended_quiz_id}">Practice Quiz</button>`
                              : ''
                          }
                          ${
                            w.recommended_resource_id
                              ? `<button class="btn btn-outline btn-sm" data-action="open-resource" data-resource-id="${w.recommended_resource_id}">Study Notes</button>`
                              : ''
                          }
                          <button class="btn btn-outline btn-sm" data-action="coach-topic" data-subject-id="${w.subject_id}" data-topic="${esc(w.name)}">Coach Step-by-Step</button>
                        </div>
                      </div>
                    </div>
                  `
                    )
                    .join('')
            }
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Upcoming Tuition Classes</h2>
              <p class="card-subtitle">Your next group classes & 1-on-1 focus sessions.</p>
            </div>
            <button class="btn btn-outline btn-sm" data-action="switch-tab" data-tab="schedule">Full Timetable</button>
          </div>
          <div class="item-list">
            ${upcomingSessions
              .map(
                (ses) => `
                <div class="list-row">
                  <div class="list-row-main">
                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                      <span class="badge badge-gold">${esc(getSubjectName(ses.subject_id))}</span>
                      <span class="badge ${ses.session_type === 'one_on_one' ? 'badge-emerald' : 'badge-charcoal'}">${
                        ses.session_type === 'one_on_one' ? '1-on-1 Focus' : 'Group Class'
                      }</span>
                      <span class="badge badge-gold">${esc(formatRelative(ses.scheduled_at))}</span>
                    </div>
                    <h4>${esc(ses.title)}</h4>
                    <p>${esc(formatDateTime(ses.scheduled_at))} · ${ses.duration_mins} mins · ${esc(ses.tutor_name)}</p>
                    <p style="margin-top:3px;font-weight:600;">📍 ${esc(ses.location_or_link)}</p>
                  </div>
                </div>
              `
              )
              .join('')}
          </div>

          <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border-sand);">
            <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;color:var(--ink-muted);margin-bottom:8px;">Academy Notices</div>
            ${pinnedAnnouncements
              .map(
                (a) => `
                <div style="padding:10px 12px;border-radius:12px;background:var(--gold-sun-soft);margin-bottom:8px;">
                  <div style="font-weight:700;font-size:0.88rem;">📌 ${esc(a.title)}</div>
                  <div style="font-size:0.81rem;color:var(--ink-secondary);margin-top:2px;">${esc(a.body)}</div>
                </div>
              `
              )
              .join('')}
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Subject-by-Subject Confidence Map</h2>
            <p class="card-subtitle">Track how your understanding is growing across every i-tutor subject.</p>
          </div>
        </div>
        <div class="grid-2">
          ${analytics.subjects
            .map(
              (sub) => `
              <div class="list-row" style="flex-direction:column;">
                <div style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <div>
                    <span class="badge badge-charcoal">${esc(sub.code)}</span>
                    <h4 style="margin:6px 0 2px;font-size:1.05rem;">${esc(sub.subject_name)}</h4>
                    <p style="margin:0;font-size:0.8rem;color:var(--ink-muted);">Tutor: ${esc(sub.tutor_name)}</p>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-family:var(--font-display);font-size:1.55rem;font-weight:700;color:var(--gold-ochre);">${sub.confidence_score}%</div>
                    <span class="badge ${sub.tier === 'exam_ready' ? 'badge-emerald' : sub.tier === 'building' ? 'badge-gold' : 'badge-coral'}">${esc(sub.label)}</span>
                  </div>
                </div>
                <div class="conf-bar-track"><div class="conf-bar-fill ${sub.tier}" style="width:${sub.confidence_score}%"></div></div>
                <div style="width:100%;margin-top:10px;display:flex;flex-direction:column;gap:6px;">
                  ${sub.topics
                    .map(
                      (t) => `
                      <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.81rem;">
                        <span>${esc(t.name)}</span>
                        <strong style="color:${t.confidence_score >= 80 ? 'var(--emerald)' : t.confidence_score < 58 ? 'var(--coral)' : 'var(--gold-ochre)'};">${t.confidence_score}%</strong>
                      </div>
                    `
                    )
                    .join('')}
                </div>
              </div>
            `
            )
            .join('')}
        </div>
      </section>
    </div>
  `;
}

function renderStudentVault() {
  const stuId = state.currentUser.id;
  const resources = state.data.resources.filter((r) => {
    if (state.vaultSubjectFilter !== 'all' && r.subject_id !== state.vaultSubjectFilter) return false;
    if (state.vaultBookmarkedOnly) {
      const prog = state.data.resource_progress.find(
        (rp) => rp.resource_id === r.id && rp.student_id === stuId
      );
      if (!prog?.bookmarked) return false;
    }
    return true;
  });

  const typeLabel = {
    formula_sheet: 'Formula Sheet',
    notes: 'Structured Notes',
    worked_example: 'Worked Example',
    past_paper: 'Past Paper Guide'
  };

  return `
    <div class="section-stack">
      <div class="card">
        <div class="card-header">
          <div>
            <h1 class="card-title" style="font-size:1.45rem;">Subjects & Study Vault</h1>
            <p class="card-subtitle">Curated formula sheets, step-by-step worked examples, and past-paper walkthroughs from your i-tutor teachers.</p>
          </div>
        </div>
        <div class="filter-bar">
          <button class="chip ${state.vaultSubjectFilter === 'all' ? 'active' : ''}" data-action="filter-vault-subject" data-subject="all">All Subjects</button>
          ${state.data.subjects
            .map(
              (s) => `
              <button class="chip ${state.vaultSubjectFilter === s.id ? 'active' : ''}" data-action="filter-vault-subject" data-subject="${s.id}">
                ${esc(s.name)}
              </button>
            `
            )
            .join('')}
          <button class="chip ${state.vaultBookmarkedOnly ? 'active' : ''}" data-action="toggle-vault-bookmarks">
            ★ Saved Bookmarks
          </button>
        </div>
      </div>

      <div class="grid-2">
        ${
          resources.length === 0
            ? `<div class="card"><p>No study resources match this filter yet.</p></div>`
            : resources
                .map((res) => {
                  const prog = state.data.resource_progress.find(
                    (rp) => rp.resource_id === res.id && rp.student_id === stuId
                  );
                  return `
                  <article class="card" style="display:flex;flex-direction:column;justify-content:space-between;">
                    <div>
                      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;">
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                          <span class="badge badge-charcoal">${esc(getSubjectName(res.subject_id))}</span>
                          <span class="badge badge-gold">${esc(typeLabel[res.resource_type] || res.resource_type)}</span>
                          ${prog?.completed ? `<span class="badge badge-emerald">✓ Mastered</span>` : ''}
                        </div>
                        <button class="icon-btn" data-action="toggle-bookmark" data-resource-id="${res.id}" title="Bookmark study guide">
                          ${prog?.bookmarked ? '★ Saved' : '☆ Save'}
                        </button>
                      </div>
                      <h3 class="card-title">${esc(res.title)}</h3>
                      <p style="font-size:0.8rem;font-weight:700;color:var(--gold-ochre);margin:4px 0 8px;">Topic: ${esc(res.topic)} · By ${esc(res.author_name)}</p>
                      <p class="card-subtitle">${esc(res.summary)}</p>
                      <div class="formula-chips">
                        ${(res.key_formulas || [])
                          .slice(0, 3)
                          .map((f) => `<span class="formula-chip">${esc(f)}</span>`)
                          .join('')}
                      </div>
                    </div>
                    <div style="display:flex;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border-sand);">
                      <button class="btn btn-gold btn-sm" data-action="open-resource" data-resource-id="${res.id}">Open Study Guide</button>
                      <button class="btn btn-outline btn-sm" data-action="coach-topic" data-subject-id="${res.subject_id}" data-topic="${esc(res.topic)}">Ask AI Coach</button>
                    </div>
                  </article>
                `;
                })
                .join('')
        }
      </div>
    </div>
  `;
}

function renderStudentPractice() {
  const stuId = state.currentUser.id;
  const attempts = state.data.quiz_attempts.filter((a) => a.student_id === stuId);
  const submissions = state.data.submissions.filter((s) => s.student_id === stuId);

  return `
    <div class="section-stack">
      <section class="card">
        <div class="card-header">
          <div>
            <h1 class="card-title" style="font-size:1.45rem;">Interactive Practice Quizzes</h1>
            <p class="card-subtitle">Auto-graded topic sprints with optional hints and full step-by-step worked explanations.</p>
          </div>
          <span class="badge badge-gold">${state.data.quizzes.length} Active Sprints</span>
        </div>
        <div class="grid-2">
          ${state.data.quizzes
            .map((qz) => {
              const myAttempts = attempts.filter((a) => a.quiz_id === qz.id);
              const bestScore =
                myAttempts.length > 0 ? Math.max(...myAttempts.map((a) => a.score_percent)) : null;
              return `
                <div class="list-row" style="flex-direction:column;justify-content:space-between;">
                  <div style="width:100%;">
                    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                      <span class="badge badge-charcoal">${esc(getSubjectName(qz.subject_id))}</span>
                      <span class="badge ${bestScore !== null && bestScore >= 80 ? 'badge-emerald' : 'badge-gold'}">
                        ${bestScore !== null ? `Best: ${bestScore}% (${myAttempts.length}x)` : `${qz.questions.length} Questions · ${qz.time_limit_mins} min`}
                      </span>
                    </div>
                    <h3 style="margin:4px 0;">${esc(qz.title)}</h3>
                    <p style="font-size:0.8rem;color:var(--gold-ochre);font-weight:700;margin-bottom:6px;">Topic: ${esc(qz.topic)}</p>
                    <p>${esc(qz.description)}</p>
                  </div>
                  <div style="margin-top:12px;display:flex;gap:8px;">
                    <button class="btn btn-gold btn-sm" data-action="start-quiz" data-quiz-id="${qz.id}">
                      ${bestScore !== null ? 'Retake Sprint' : 'Start Quiz'}
                    </button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Homework & Tutor Feedback</h2>
            <p class="card-subtitle">Submit your worked steps directly to your tutor and receive detailed feedback.</p>
          </div>
        </div>
        <div class="item-list">
          ${state.data.assignments
            .map((asg) => {
              const sub = submissions.find((s) => s.assignment_id === asg.id);
              return `
                <div class="list-row" style="flex-direction:column;">
                  <div style="width:100%;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                    <div>
                      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                        <span class="badge badge-charcoal">${esc(getSubjectName(asg.subject_id))}</span>
                        <span class="badge badge-gold">${esc(asg.topic)}</span>
                        ${
                          sub?.status === 'graded'
                            ? `<span class="badge badge-emerald">Graded: ${sub.marks_awarded} / ${asg.max_marks}</span>`
                            : sub
                              ? `<span class="badge badge-gold">Submitted · Awaiting Tutor Review</span>`
                              : `<span class="badge badge-coral">Due ${esc(formatDateTime(asg.due_at))}</span>`
                        }
                      </div>
                      <h4>${esc(asg.title)}</h4>
                      <p style="white-space:pre-line;margin-top:4px;">${esc(asg.instructions)}</p>
                    </div>
                    <button class="btn ${sub ? 'btn-outline' : 'btn-gold'} btn-sm" data-action="open-homework-modal" data-assignment-id="${asg.id}">
                      ${sub ? 'View / Update Work' : 'Submit Homework'}
                    </button>
                  </div>
                  ${
                    sub?.tutor_feedback
                      ? `
                      <div style="width:100%;margin-top:10px;padding:12px 14px;border-radius:12px;background:var(--emerald-soft);border-left:4px solid var(--emerald);">
                        <div style="font-size:0.78rem;font-weight:800;color:var(--emerald);">TUTOR FEEDBACK (${sub.marks_awarded}/${asg.max_marks}):</div>
                        <div style="font-size:0.86rem;margin-top:3px;">${esc(sub.tutor_feedback)}</div>
                      </div>
                    `
                      : ''
                  }
                </div>
              `;
            })
            .join('')}
        </div>
      </section>
    </div>
  `;
}

function renderStudentCoach() {
  const stu = state.currentUser;
  const activeSubject =
    state.data.subjects.find((s) => s.id === state.coachSubjectId) || state.data.subjects[0];
  const topics = activeSubject?.topics || [];
  const myMessages = state.data.coach_messages.filter((m) => m.student_id === stu.id);

  return `
    <div class="coach-layout">
      <div class="card">
        <h2 class="card-title">i-tutor Study Coach</h2>
        <p class="card-subtitle" style="margin-bottom:14px;">24/7 Socratic coaching that teaches you the steps instead of just spoiling homework answers.</p>

        <div class="form-grid">
          <div class="field">
            <label for="coach-sub-select">Subject</label>
            <select id="coach-sub-select">
              ${state.data.subjects
                .map(
                  (s) => `<option value="${s.id}" ${s.id === activeSubject.id ? 'selected' : ''}>${esc(s.name)}</option>`
                )
                .join('')}
            </select>
          </div>

          <div class="field">
            <label for="coach-topic-select">Topic Focus</label>
            <select id="coach-topic-select">
              ${topics
                .map(
                  (t) => `<option value="${esc(t.name)}" ${t.name === state.coachTopic ? 'selected' : ''}>${esc(t.name)}</option>`
                )
                .join('')}
            </select>
          </div>

          <div class="field">
            <label for="coach-mode-select">Coaching Style</label>
            <select id="coach-mode-select">
              <option value="step_by_step" ${state.coachMode === 'step_by_step' ? 'selected' : ''}>Step-by-Step Walkthrough</option>
              <option value="hint_only" ${state.coachMode === 'hint_only' ? 'selected' : ''}>Socratic Hint Only (No Spoilers)</option>
              <option value="explain_concept" ${state.coachMode === 'explain_concept' ? 'selected' : ''}>Explain Concept Simply</option>
            </select>
          </div>
        </div>

        <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-sand);display:flex;flex-direction:column;gap:8px;">
          <div style="font-size:0.75rem;font-weight:800;color:var(--ink-muted);text-transform:uppercase;">1-Tap Try Prompts</div>
          <button class="btn btn-gold btn-sm" data-action="quick-coach" data-mode="practice" data-prompt="Generate a practice problem for me">⚡ Generate Practice Problem</button>
          <button class="btn btn-outline btn-sm" data-action="quick-coach" data-prompt="2x^2 - 7x + 3 = 0">Solve: 2x² - 7x + 3 = 0</button>
          <button class="btn btn-outline btn-sm" data-action="quick-coach" data-prompt="How do I prove a Trigonometry LHS = RHS identity?">Trig Identity Proof Steps</button>
          <button class="btn btn-outline btn-sm" data-action="quick-coach" data-prompt="Explain Newton's Second Law on an inclined plane">Inclined Plane Forces</button>
        </div>
      </div>

      <div class="card coach-chat-card">
        <div class="card-header" style="padding-bottom:10px;border-bottom:1px solid var(--border-sand);">
          <div>
            <h2 class="card-title">Live Coaching Session</h2>
            <p class="card-subtitle">${esc(activeSubject?.name)} · ${esc(state.coachTopic || 'General Mastery')}</p>
          </div>
          <span class="badge badge-gold">${state.coachMode === 'hint_only' ? 'Socratic Hint Mode' : 'Step-by-Step Mode'}</span>
        </div>

        <div id="coach-feed" class="coach-feed">
          ${myMessages
            .map(
              (m) => `
              <div class="coach-bubble ${m.sender}">
                <div>${renderFormattedText(m.content)}</div>
                ${
                  m.steps && m.steps.length
                    ? `<ul class="coach-steps">${m.steps.map((st) => `<li>${esc(st)}</li>`).join('')}</ul>`
                    : ''
                }
                ${m.follow_up_prompt ? `<div class="coach-followup">💡 ${esc(m.follow_up_prompt)}</div>` : ''}
              </div>
            `
            )
            .join('')}
        </div>

        <form id="coach-form" class="coach-composer">
          <input id="coach-input" type="text" placeholder="Type an equation (e.g. x^2 - 5x + 6 = 0) or ask any study question…" autocomplete="off" required />
          <button type="submit" class="btn btn-gold" ${state.coachSending ? 'disabled' : ''}>
            ${state.coachSending ? 'Thinking…' : 'Ask Coach'}
          </button>
        </form>
      </div>
    </div>
  `;
}

function renderStudentSchedule() {
  const stuId = state.currentUser.id;
  const mySessions = state.data.sessions.filter(
    (s) => !s.target_student_id || s.target_student_id === stuId
  );
  const upcoming = mySessions.filter((s) => s.status === 'upcoming');
  const completed = mySessions.filter((s) => s.status === 'completed');
  const myRequests = state.data.help_requests.filter((r) => r.student_id === stuId);

  return `
    <div class="section-stack">
      <div class="card">
        <div class="card-header">
          <div>
            <h1 class="card-title" style="font-size:1.45rem;">Class Timetable & Extra-Help Slots</h1>
            <p class="card-subtitle">Stay ahead of upcoming lessons and review structured recaps from past classes.</p>
          </div>
          <button class="btn btn-gold" data-action="open-help-modal">+ Request 1-on-1 Extra Help</button>
        </div>

        <div class="item-list">
          ${upcoming
            .map(
              (s) => `
              <div class="list-row">
                <div class="list-row-main">
                  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                    <span class="badge badge-charcoal">${esc(getSubjectName(s.subject_id))}</span>
                    <span class="badge badge-gold">${s.session_type === 'one_on_one' ? '1-on-1 Session' : 'Group Class'}</span>
                    <span class="badge badge-emerald">${esc(formatRelative(s.scheduled_at))}</span>
                  </div>
                  <h4>${esc(s.title)}</h4>
                  <p>${esc(formatDateTime(s.scheduled_at))} (${s.duration_mins} mins) · Tutor: ${esc(s.tutor_name)}</p>
                  <p style="margin-top:4px;font-weight:600;">📍 ${esc(s.location_or_link)}</p>
                </div>
              </div>
            `
            )
            .join('')}
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Completed Lesson Recaps</h2>
              <p class="card-subtitle">Key takeaways & your post-lesson confidence log.</p>
            </div>
          </div>
          <div class="item-list">
            ${completed
              .map((s) => {
                const att = state.data.attendance.find(
                  (a) => a.session_id === s.id && a.student_id === stuId
                );
                return `
                  <div class="list-row" style="flex-direction:column;">
                    <div style="display:flex;justify-content:space-between;width:100%;gap:8px;flex-wrap:wrap;">
                      <span class="badge badge-charcoal">${esc(getSubjectName(s.subject_id))}</span>
                      ${
                        att
                          ? `<span class="badge ${att.status === 'present' ? 'badge-emerald' : att.status === 'late' ? 'badge-gold' : 'badge-coral'}">Attendance: ${esc(att.status.toUpperCase())}</span>`
                          : ''
                      }
                    </div>
                    <h4 style="margin:6px 0 4px;">${esc(s.title)}</h4>
                    <p>${esc(s.lesson_recap || 'Session completed.')}</p>
                    ${
                      (s.key_takeaways || []).length
                        ? `<ul class="coach-steps" style="width:100%;">${s.key_takeaways.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">My 1-on-1 Extra-Help Requests</h2>
              <p class="card-subtitle">Ask for targeted support on any tricky topic.</p>
            </div>
          </div>
          <div class="item-list">
            ${
              myRequests.length === 0
                ? `<p class="card-subtitle">No extra-help requests yet. Tap "+ Request 1-on-1 Extra Help" anytime you want personal focus.</p>`
                : myRequests
                    .map(
                      (r) => `
                      <div class="list-row" style="flex-direction:column;">
                        <div style="display:flex;justify-content:space-between;width:100%;">
                          <span class="badge badge-charcoal">${esc(getSubjectName(r.subject_id))}</span>
                          <span class="badge ${r.status === 'scheduled' ? 'badge-emerald' : 'badge-gold'}">${esc(r.status.toUpperCase())}</span>
                        </div>
                        <h4 style="margin:6px 0 2px;">${esc(r.topic)}</h4>
                        <p>Preferred slot: ${esc(r.preferred_slot)}</p>
                        <p style="margin-top:4px;">"${esc(r.notes)}"</p>
                        ${
                          r.tutor_response
                            ? `<div style="margin-top:8px;padding:8px 12px;border-radius:8px;background:var(--emerald-soft);font-size:0.82rem;width:100%;"><strong>Tutor Reply:</strong> ${esc(r.tutor_response)}</div>`
                            : ''
                        }
                      </div>
                    `
                    )
                    .join('')
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderStudentMessages() {
  const stu = state.currentUser;
  const thread = state.data.messages.filter(
    (m) => m.student_id === stu.id && m.channel === 'tutor_student'
  );

  return `
    <div class="grid-2">
      <div class="card coach-chat-card" style="min-height:460px;">
        <div class="card-header" style="border-bottom:1px solid var(--border-sand);padding-bottom:10px;">
          <div>
            <h2 class="card-title">Direct Q&A with Your Tutor</h2>
            <p class="card-subtitle">Ask homework or revision questions directly to Ms. Naledi Khumalo & team.</p>
          </div>
        </div>
        <div class="coach-feed">
          ${
            thread.length === 0
              ? `<p class="card-subtitle">Start a conversation with your tutor below.</p>`
              : thread
                  .map(
                    (m) => `
                  <div class="coach-bubble ${m.sender_role === 'student' ? 'student' : 'coach'}">
                    <div style="font-size:0.73rem;font-weight:800;opacity:0.75;margin-bottom:3px;">${esc(m.sender_name)} · ${esc(formatRelative(m.created_at))}</div>
                    <div>${esc(m.body)}</div>
                  </div>
                `
                  )
                  .join('')
          }
        </div>
        <form id="student-msg-form" class="coach-composer">
          <input id="student-msg-input" type="text" placeholder="Write a message to your tutor…" required />
          <button type="submit" class="btn btn-gold">Send</button>
        </form>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Academy Announcements</h2>
            <p class="card-subtitle">Latest exam clinics, new notes, and schedule updates.</p>
          </div>
        </div>
        <div class="item-list">
          ${state.data.announcements
            .filter((a) => a.audience === 'all' || a.audience === 'students')
            .map(
              (a) => `
              <div class="list-row" style="flex-direction:column;">
                <div style="display:flex;gap:6px;align-items:center;">
                  ${a.pinned ? `<span class="badge badge-gold">Pinned</span>` : ''}
                  <span class="badge badge-charcoal">${esc(a.author_name)}</span>
                </div>
                <h4 style="margin:6px 0 4px;">${esc(a.title)}</h4>
                <p>${esc(a.body)}</p>
              </div>
            `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   TUTOR STUDIO VIEWS
   ========================================================================== */
function renderTutorHome() {
  const students = state.data.users.filter((u) => u.role === 'student');
  const analyticsList = students
    .map((s) => state.data.analytics_by_student[s.id])
    .filter(Boolean);

  const avgConfidence =
    analyticsList.length > 0
      ? Math.round(analyticsList.reduce((sum, a) => sum + a.overall_confidence, 0) / analyticsList.length)
      : 78;

  const avgAttendance =
    analyticsList.length > 0
      ? Math.round(analyticsList.reduce((sum, a) => sum + a.attendance_rate, 0) / analyticsList.length)
      : 92;

  const pendingHelp = state.data.help_requests.filter((r) => r.status === 'pending');
  const ungradedCount = state.data.submissions.filter((s) => s.status === 'submitted').length;

  return `
    <div class="section-stack">
      <section class="sunrise-hero">
        <div>
          <div class="hero-eyebrow">🎓 i-tutor Tutor Command Studio</div>
          <h1 class="hero-title">Good day, ${esc(state.currentUser.name)}.</h1>
          <p class="hero-sub">
            Track every learner’s Sunrise Confidence score in real time, mark 1-tap attendance, publish worked study guides, and turn weak spots into exam distinctions.
          </p>
          <div class="hero-actions">
            <button class="btn btn-gold" data-action="open-new-session-modal">+ Schedule Class</button>
            <button class="btn btn-ghost-light" data-action="open-new-quiz-modal">+ Create Quiz</button>
            <button class="btn btn-ghost-light" data-action="open-new-resource-modal">+ Publish Study Note</button>
          </div>
        </div>
        <div>
          ${renderSunriseGauge(avgConfidence, 'Cohort Confidence Avg')}
        </div>
      </section>

      <section class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Enrolled Learners</div>
          <div class="stat-value">${students.length}</div>
          <div class="stat-sub">Across ${state.data.subjects.length} core subjects</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cohort Confidence</div>
          <div class="stat-value">${avgConfidence}%</div>
          <div class="stat-sub">Live Sunrise Mastery index</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Attendance Rate</div>
          <div class="stat-value">${avgAttendance}%</div>
          <div class="stat-sub">Group & 1-on-1 classes</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Action Queue</div>
          <div class="stat-value">${pendingHelp.length + ungradedCount}</div>
          <div class="stat-sub">${ungradedCount} homework · ${pendingHelp.length} 1-on-1 requests</div>
        </div>
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Learner Confidence Roster</h2>
              <p class="card-subtitle">Live academic pulse for every student in i-tutor.</p>
            </div>
          </div>
          <div class="item-list">
            ${students
              .map((stu) => {
                const a = state.data.analytics_by_student[stu.id];
                const topWeak = a?.weak_spots?.[0];
                return `
                  <div class="list-row" style="flex-direction:column;">
                    <div style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;">
                      <div>
                        <div style="display:flex;gap:6px;align-items:center;">
                          <strong>${esc(stu.name)}</strong>
                          <span class="badge badge-charcoal">${esc(stu.grade)}</span>
                        </div>
                        <p style="font-size:0.8rem;margin-top:3px;">
                          Attendance: <strong>${a?.attendance_rate ?? 90}%</strong> · Quiz Avg: <strong>${a?.quiz_average ?? 75}%</strong> · Mood: <strong>${esc(stu.confidence_mood)}</strong>
                        </p>
                      </div>
                      <div style="text-align:right;">
                        <div style="font-family:var(--font-display);font-size:1.4rem;font-weight:700;color:var(--gold-ochre);">${a?.overall_confidence ?? 75}%</div>
                        <span class="badge ${a?.tier === 'exam_ready' ? 'badge-emerald' : a?.tier === 'building' ? 'badge-gold' : 'badge-coral'}">${esc(a?.label || 'Building')}</span>
                      </div>
                    </div>
                    <div class="conf-bar-track"><div class="conf-bar-fill ${a?.tier || 'building'}" style="width:${a?.overall_confidence ?? 75}%"></div></div>
                    ${
                      topWeak
                        ? `<div style="font-size:0.79rem;color:var(--coral);margin-top:8px;font-weight:600;">⚡ Top Weak Spot: ${esc(topWeak.subject_name)} — ${esc(topWeak.name)} (${topWeak.confidence_score}%)</div>`
                        : `<div style="font-size:0.79rem;color:var(--emerald);margin-top:8px;font-weight:600;">✓ All tracked topics above 76% confidence!</div>`
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">1-on-1 Extra-Help Requests</h2>
              <p class="card-subtitle">Approve requests to automatically add a 1-on-1 session to the timetable.</p>
            </div>
          </div>
          <div class="item-list">
            ${state.data.help_requests
              .map((req) => {
                const stu = state.data.users.find((u) => u.id === req.student_id);
                return `
                  <div class="list-row" style="flex-direction:column;">
                    <div style="display:flex;justify-content:space-between;width:100%;gap:8px;">
                      <div>
                        <span class="badge badge-charcoal">${esc(stu?.name || 'Student')}</span>
                        <span class="badge badge-gold">${esc(getSubjectName(req.subject_id))}</span>
                      </div>
                      <span class="badge ${req.status === 'scheduled' ? 'badge-emerald' : 'badge-coral'}">${esc(req.status.toUpperCase())}</span>
                    </div>
                    <h4 style="margin:6px 0 2px;">${esc(req.topic)}</h4>
                    <p>Preferred: <strong>${esc(req.preferred_slot)}</strong></p>
                    <p style="margin-top:3px;">"${esc(req.notes)}"</p>
                    ${
                      req.status === 'pending'
                        ? `
                        <div style="margin-top:10px;display:flex;gap:8px;">
                          <button class="btn btn-gold btn-sm" data-action="approve-help-request" data-request-id="${req.id}">
                            ✓ Approve & Schedule 1-on-1
                          </button>
                        </div>
                      `
                        : `<p style="margin-top:6px;font-size:0.8rem;color:var(--emerald);font-weight:700;">✓ ${esc(req.tutor_response)}</p>`
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderTutorSchedule() {
  const students = state.data.users.filter((u) => u.role === 'student');

  return `
    <div class="section-stack">
      <div class="card">
        <div class="card-header">
          <div>
            <h1 class="card-title" style="font-size:1.45rem;">Timetable, 1-Tap Attendance & Lesson Recaps</h1>
            <p class="card-subtitle">Mark student attendance in one tap and publish post-class takeaways visible to students & parents.</p>
          </div>
          <button class="btn btn-gold" data-action="open-new-session-modal">+ Schedule New Class</button>
        </div>

        <div class="item-list">
          ${state.data.sessions
            .map((ses) => {
              const targetStudents = ses.target_student_id
                ? students.filter((s) => s.id === ses.target_student_id)
                : students;
              return `
                <div class="list-row" style="flex-direction:column;">
                  <div style="width:100%;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                    <div>
                      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                        <span class="badge badge-charcoal">${esc(getSubjectName(ses.subject_id))}</span>
                        <span class="badge badge-gold">${ses.session_type === 'one_on_one' ? '1-on-1' : 'Group Class'}</span>
                        <span class="badge ${ses.status === 'completed' ? 'badge-emerald' : 'badge-gold'}">${esc(ses.status.toUpperCase())}</span>
                      </div>
                      <h4>${esc(ses.title)}</h4>
                      <p>${esc(formatDateTime(ses.scheduled_at))} · ${ses.duration_mins} mins · 📍 ${esc(ses.location_or_link)}</p>
                    </div>
                    <button class="btn btn-outline btn-sm" data-action="open-recap-modal" data-session-id="${ses.id}">
                      ${ses.lesson_recap ? 'Edit Lesson Recap' : '+ Post Lesson Recap'}
                    </button>
                  </div>

                  <div style="width:100%;margin-top:12px;padding-top:10px;border-top:1px solid var(--border-sand);">
                    <div style="font-size:0.75rem;font-weight:800;color:var(--ink-muted);text-transform:uppercase;margin-bottom:8px;">1-Tap Attendance Register</div>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                      ${targetStudents
                        .map((stu) => {
                          const att = state.data.attendance.find(
                            (a) => a.session_id === ses.id && a.student_id === stu.id
                          );
                          return `
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                              <span style="font-size:0.86rem;font-weight:600;">${esc(stu.name)} <small style="color:var(--ink-muted);">(${esc(stu.grade)})</small></span>
                              <div class="att-group">
                                <button class="att-btn present ${att?.status === 'present' ? 'active' : ''}" data-action="mark-attendance" data-session-id="${ses.id}" data-student-id="${stu.id}" data-status="present">Present</button>
                                <button class="att-btn late ${att?.status === 'late' ? 'active' : ''}" data-action="mark-attendance" data-session-id="${ses.id}" data-student-id="${stu.id}" data-status="late">Late</button>
                                <button class="att-btn absent ${att?.status === 'absent' ? 'active' : ''}" data-action="mark-attendance" data-session-id="${ses.id}" data-student-id="${stu.id}" data-status="absent">Absent</button>
                              </div>
                            </div>
                          `;
                        })
                        .join('')}
                    </div>
                  </div>

                  ${
                    ses.lesson_recap
                      ? `<div style="width:100%;margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--gold-sun-soft);font-size:0.83rem;"><strong>Published Recap:</strong> ${esc(ses.lesson_recap)}</div>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTutorAssessments() {
  return `
    <div class="section-stack">
      <div class="card">
        <div class="card-header">
          <div>
            <h1 class="card-title" style="font-size:1.45rem;">Homework Submissions & Grading</h1>
            <p class="card-subtitle">Review student working, award marks, and write constructive confidence-building feedback.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-gold" data-action="open-new-assignment-modal">+ Assign Homework</button>
            <button class="btn btn-charcoal" data-action="open-new-quiz-modal">+ Create Auto-Graded Quiz</button>
          </div>
        </div>

        <div class="item-list">
          ${state.data.submissions
            .map((sub) => {
              const stu = state.data.users.find((u) => u.id === sub.student_id);
              const asg = state.data.assignments.find((a) => a.id === sub.assignment_id);
              return `
                <div class="list-row" style="flex-direction:column;">
                  <div style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                      <strong>${esc(stu?.name || 'Student')}</strong>
                      <span class="badge badge-charcoal">${esc(asg?.title || 'Assignment')}</span>
                      <span class="badge badge-gold">Felt: ${esc(sub.student_confidence)}</span>
                    </div>
                    <span class="badge ${sub.status === 'graded' ? 'badge-emerald' : 'badge-coral'}">
                      ${sub.status === 'graded' ? `Graded: ${sub.marks_awarded}/${asg?.max_marks || 20}` : 'Needs Grading'}
                    </span>
                  </div>
                  <div style="width:100%;margin:8px 0;padding:10px 12px;border-radius:10px;background:var(--bg-subtle);font-size:0.86rem;white-space:pre-line;">${esc(sub.answer_text)}</div>
                  <div style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                    <span style="font-size:0.82rem;color:var(--ink-secondary);">${sub.tutor_feedback ? `Feedback: "${esc(sub.tutor_feedback)}"` : 'No feedback written yet.'}</span>
                    <button class="btn ${sub.status === 'graded' ? 'btn-outline' : 'btn-gold'} btn-sm" data-action="open-grade-modal" data-submission-id="${sub.id}">
                      ${sub.status === 'graded' ? 'Edit Grade / Feedback' : 'Grade & Give Feedback'}
                    </button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Published Auto-Graded Quizzes (${state.data.quizzes.length})</h2>
            <p class="card-subtitle">Quizzes automatically mark student attempts and update their Sunrise Confidence scores.</p>
          </div>
        </div>
        <div class="grid-2">
          ${state.data.quizzes
            .map((qz) => {
              const count = state.data.quiz_attempts.filter((a) => a.quiz_id === qz.id).length;
              return `
                <div class="list-row" style="flex-direction:column;">
                  <div style="display:flex;justify-content:space-between;width:100%;">
                    <span class="badge badge-charcoal">${esc(getSubjectName(qz.subject_id))}</span>
                    <span class="badge badge-gold">${qz.questions.length} Qs · ${count} attempts</span>
                  </div>
                  <h4 style="margin:6px 0 2px;">${esc(qz.title)}</h4>
                  <p>${esc(qz.topic)} · ${qz.time_limit_mins} mins</p>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTutorVault() {
  return `
    <div class="section-stack">
      <div class="card">
        <div class="card-header">
          <div>
            <h1 class="card-title" style="font-size:1.45rem;">Study Vault & Subject Curriculum Studio</h1>
            <p class="card-subtitle">Publish structured notes, formula sheets, worked examples, and new subjects.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-gold" data-action="open-new-resource-modal">+ Publish Study Material</button>
            <button class="btn btn-outline" data-action="open-new-subject-modal">+ Add Subject</button>
          </div>
        </div>

        <div class="grid-2">
          ${state.data.resources
            .map(
              (r) => `
              <div class="list-row" style="flex-direction:column;">
                <div style="display:flex;justify-content:space-between;width:100%;">
                  <span class="badge badge-charcoal">${esc(getSubjectName(r.subject_id))}</span>
                  <span class="badge badge-gold">${esc(r.resource_type.replace('_', ' '))}</span>
                </div>
                <h4 style="margin:6px 0 3px;">${esc(r.title)}</h4>
                <p>${esc(r.summary)}</p>
                <div style="margin-top:8px;">
                  <button class="btn btn-outline btn-sm" data-action="open-resource" data-resource-id="${r.id}">Preview Reader</button>
                </div>
              </div>
            `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTutorComms() {
  const students = state.data.users.filter((u) => u.role === 'student');
  const activeStuId = state.selectedStudentForTutorMsg || students[0]?.id || 'stu-thabo';
  const thread = state.data.messages.filter(
    (m) => m.student_id === activeStuId && m.channel === state.selectedChannelForTutorMsg
  );

  return `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Post Class Announcement</h2>
            <p class="card-subtitle">Broadcast updates to Students, Parents, or the entire Academy.</p>
          </div>
        </div>
        <form id="tutor-announcement-form" class="form-grid">
          <div class="field">
            <label>Headline</label>
            <input name="title" placeholder="e.g. Saturday Trigonometry Past Paper Clinic" required />
          </div>
          <div class="form-row-2">
            <div class="field">
              <label>Audience</label>
              <select name="audience">
                <option value="all">All Students & Parents</option>
                <option value="students">Students Only</option>
                <option value="parents">Parents Only</option>
              </select>
            </div>
            <div class="field">
              <label>Pin to Top?</label>
              <select name="pinned">
                <option value="true">Pin Announcement</option>
                <option value="false">Standard Notice</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>Message</label>
            <textarea name="body" rows="3" placeholder="Share session details, revision focus, or encouragement…" required></textarea>
          </div>
          <button type="submit" class="btn btn-gold">Publish Announcement</button>
        </form>
      </div>

      <div class="card coach-chat-card" style="min-height:460px;">
        <div class="card-header" style="border-bottom:1px solid var(--border-sand);padding-bottom:10px;">
          <div>
            <h2 class="card-title">Student & Parent Inbox</h2>
            <p class="card-subtitle">Direct progress updates and homework Q&A.</p>
          </div>
        </div>

        <div class="form-row-2" style="margin-bottom:10px;">
          <div class="field">
            <select id="tutor-msg-student">
              ${students
                .map((s) => `<option value="${s.id}" ${s.id === activeStuId ? 'selected' : ''}>Learner: ${esc(s.name)}</option>`)
                .join('')}
            </select>
          </div>
          <div class="field">
            <select id="tutor-msg-channel">
              <option value="tutor_parent" ${state.selectedChannelForTutorMsg === 'tutor_parent' ? 'selected' : ''}>Parent Progress Thread</option>
              <option value="tutor_student" ${state.selectedChannelForTutorMsg === 'tutor_student' ? 'selected' : ''}>Student Q&A Thread</option>
            </select>
          </div>
        </div>

        <div class="coach-feed">
          ${
            thread.length === 0
              ? `<p class="card-subtitle">No messages in this thread yet. Send an update below!</p>`
              : thread
                  .map(
                    (m) => `
                  <div class="coach-bubble ${m.sender_role === 'tutor' ? 'student' : 'coach'}">
                    <div style="font-size:0.73rem;font-weight:800;opacity:0.78;margin-bottom:3px;">${esc(m.sender_name)} (${esc(m.sender_role)})</div>
                    <div>${esc(m.body)}</div>
                  </div>
                `
                  )
                  .join('')
          }
        </div>

        <form id="tutor-msg-form" class="coach-composer">
          <input id="tutor-msg-input" type="text" placeholder="Write a reply or progress note…" required />
          <button type="submit" class="btn btn-gold">Send</button>
        </form>
      </div>
    </div>
  `;
}

/* ==========================================================================
   PARENT PEACE-OF-MIND PORTAL VIEWS
   ========================================================================== */
function getActiveChild() {
  const students = state.data.users.filter((u) => u.role === 'student');
  return (
    students.find((s) => s.id === state.selectedChildId) ||
    students.find((s) => s.id === state.currentUser.linked_student_id) ||
    students[0]
  );
}

function renderParentHome() {
  const child = getActiveChild();
  const students = state.data.users.filter((u) => u.role === 'student');
  const analytics = state.data.analytics_by_student[child.id];

  return `
    <div class="section-stack">
      <section class="sunrise-hero">
        <div>
          <div class="hero-eyebrow">💛 i-tutor Parent Peace-of-Mind Portal</div>
          <h1 class="hero-title">${esc(child.name)}’s Learning Confidence Report</h1>
          <p class="hero-sub">
            Real-time visibility into ${esc(child.name.split(' ')[0])}’s class attendance, topic mastery, quiz accuracy, and personal tutor feedback.
          </p>
          <div class="hero-actions">
            <button class="btn btn-gold" data-action="switch-tab" data-tab="parent_messages">Message Tutor Directly</button>
            <button class="btn btn-ghost-light" data-action="switch-tab" data-tab="parent_academics">View Attendance & Homework</button>
            ${
              students.length > 1
                ? `<select id="parent-child-switcher" style="padding:9px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.28);background:rgba(255,255,255,0.12);color:#fff;font-weight:700;">
                    ${students.map((s) => `<option value="${s.id}" style="color:#1E1F1D;" ${s.id === child.id ? 'selected' : ''}>Viewing: ${esc(s.name)} (${esc(s.grade)})</option>`).join('')}
                  </select>`
                : ''
            }
          </div>
        </div>
        <div>
          ${renderSunriseGauge(analytics.overall_confidence, `${child.name.split(' ')[0]} · ${analytics.label}`)}
        </div>
      </section>

      <section class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Overall Confidence</div>
          <div class="stat-value">${analytics.overall_confidence}%</div>
          <div class="stat-sub">${esc(analytics.label)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Attendance Rate</div>
          <div class="stat-value">${analytics.attendance_rate}%</div>
          <div class="stat-sub">Verified by tutor register</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Quiz Accuracy</div>
          <div class="stat-value">${analytics.quiz_average}%</div>
          <div class="stat-sub">${analytics.quizzes_completed} topic assessments</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Graded Homework Avg</div>
          <div class="stat-value">${analytics.homework_average}%</div>
          <div class="stat-sub">${analytics.homework_submitted} tasks submitted</div>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Subject Confidence Breakdown</h2>
            <p class="card-subtitle">Where ${esc(child.name.split(' ')[0])} is thriving and which topics tutors are reinforcing next.</p>
          </div>
        </div>
        <div class="grid-2">
          ${analytics.subjects
            .map(
              (sub) => `
              <div class="list-row" style="flex-direction:column;">
                <div style="width:100%;display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <h4 style="margin:0;">${esc(sub.subject_name)}</h4>
                    <p style="font-size:0.8rem;">Tutor: ${esc(sub.tutor_name)}</p>
                  </div>
                  <div style="text-align:right;">
                    <strong style="font-size:1.3rem;color:var(--gold-ochre);">${sub.confidence_score}%</strong>
                    <div><span class="badge ${sub.tier === 'exam_ready' ? 'badge-emerald' : sub.tier === 'building' ? 'badge-gold' : 'badge-coral'}">${esc(sub.label)}</span></div>
                  </div>
                </div>
                <div class="conf-bar-track"><div class="conf-bar-fill ${sub.tier}" style="width:${sub.confidence_score}%"></div></div>
              </div>
            `
            )
            .join('')}
        </div>
      </section>
    </div>
  `;
}

function renderParentAcademics() {
  const child = getActiveChild();
  const childAtt = state.data.attendance.filter((a) => a.student_id === child.id);
  const childSubs = state.data.submissions.filter((s) => s.student_id === child.id);
  const childAttempts = state.data.quiz_attempts.filter((a) => a.student_id === child.id);

  return `
    <div class="section-stack">
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Class Attendance & Lesson Recaps</h2>
              <p class="card-subtitle">Every logged class for ${esc(child.name)}.</p>
            </div>
          </div>
          <div class="item-list">
            ${childAtt
              .map((att) => {
                const ses = state.data.sessions.find((s) => s.id === att.session_id);
                if (!ses) return '';
                return `
                  <div class="list-row" style="flex-direction:column;">
                    <div style="width:100%;display:flex;justify-content:space-between;align-items:center;">
                      <span class="badge badge-charcoal">${esc(getSubjectName(ses.subject_id))}</span>
                      <span class="badge ${att.status === 'present' ? 'badge-emerald' : att.status === 'late' ? 'badge-gold' : 'badge-coral'}">${esc(att.status.toUpperCase())}</span>
                    </div>
                    <h4 style="margin:6px 0 3px;">${esc(ses.title)}</h4>
                    <p>${esc(formatDateTime(ses.scheduled_at))} · Tutor Note: ${esc(att.note || 'Participated well.')}</p>
                    ${ses.lesson_recap ? `<p style="margin-top:6px;font-size:0.81rem;"><strong>Class Recap:</strong> ${esc(ses.lesson_recap)}</p>` : ''}
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Graded Homework & Quiz Results</h2>
              <p class="card-subtitle">Direct written feedback from ${esc(child.name.split(' ')[0])}’s tutors.</p>
            </div>
          </div>
          <div class="item-list">
            ${childSubs
              .map((sub) => {
                const asg = state.data.assignments.find((a) => a.id === sub.assignment_id);
                return `
                  <div class="list-row" style="flex-direction:column;">
                    <div style="width:100%;display:flex;justify-content:space-between;">
                      <strong>${esc(asg?.title || 'Homework')}</strong>
                      <span class="badge ${sub.status === 'graded' ? 'badge-emerald' : 'badge-gold'}">
                        ${sub.status === 'graded' ? `${sub.marks_awarded} / ${asg?.max_marks || 20}` : 'Submitted'}
                      </span>
                    </div>
                    ${sub.tutor_feedback ? `<p style="margin-top:6px;"><strong>Tutor Feedback:</strong> "${esc(sub.tutor_feedback)}"</p>` : ''}
                  </div>
                `;
              })
              .join('')}

            ${childAttempts
              .map((qa) => {
                const qz = state.data.quizzes.find((q) => q.id === qa.quiz_id);
                return `
                  <div class="list-row">
                    <div class="list-row-main">
                      <h4>Quiz: ${esc(qz?.title || 'Topic Quiz')}</h4>
                      <p>${qa.correct_count} / ${qa.total_count} correct · ${esc(formatRelative(qa.created_at))}</p>
                    </div>
                    <span class="badge ${qa.score_percent >= 80 ? 'badge-emerald' : qa.score_percent >= 60 ? 'badge-gold' : 'badge-coral'}">${qa.score_percent}%</span>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderParentMessages() {
  const child = getActiveChild();
  const thread = state.data.messages.filter(
    (m) => m.student_id === child.id && m.channel === 'tutor_parent'
  );

  return `
    <div class="card coach-chat-card" style="max-width:860px;">
      <div class="card-header" style="border-bottom:1px solid var(--border-sand);padding-bottom:10px;">
        <div>
          <h2 class="card-title">Direct Tutor Conversation · Re: ${esc(child.name)}</h2>
          <p class="card-subtitle">Connected with Ms. Naledi Khumalo & the i-tutor academic team.</p>
        </div>
      </div>
      <div class="coach-feed">
        ${thread
          .map(
            (m) => `
            <div class="coach-bubble ${m.sender_role === 'parent' ? 'student' : 'coach'}">
              <div style="font-size:0.73rem;font-weight:800;opacity:0.78;margin-bottom:3px;">${esc(m.sender_name)} · ${esc(formatRelative(m.created_at))}</div>
              <div>${esc(m.body)}</div>
            </div>
          `
          )
          .join('')}
      </div>
      <form id="parent-msg-form" class="coach-composer">
        <input id="parent-msg-input" type="text" placeholder="Message ${esc(child.name.split(' ')[0])}’s tutor…" required />
        <button type="submit" class="btn btn-gold">Send Message</button>
      </form>
    </div>
  `;
}

/* ==========================================================================
   MODALS (STUDY READER, QUIZ RUNNER, HOMEWORK, AUTH, TUTOR CREATORS)
   ========================================================================== */
function openModal(innerHtml) {
  const modalRoot = document.getElementById('modal-root');
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="backdrop-close">
      <div class="modal-panel" role="dialog" aria-modal="true">
        ${innerHtml}
      </div>
    </div>
  `;
}

function closeModal() {
  if (state.quizRunner?.timerId) {
    clearInterval(state.quizRunner.timerId);
    state.quizRunner = null;
  }
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) modalRoot.innerHTML = '';
}

function openResourceModal(resourceId) {
  const res = state.data.resources.find((r) => r.id === resourceId);
  if (!res) return;
  const stuId = state.currentUser.role === 'student' ? state.currentUser.id : 'stu-thabo';
  const prog = state.data.resource_progress.find(
    (rp) => rp.resource_id === res.id && rp.student_id === stuId
  );

  openModal(`
    <div class="modal-header">
      <div>
        <div style="display:flex;gap:6px;margin-bottom:6px;">
          <span class="badge badge-charcoal">${esc(getSubjectName(res.subject_id))}</span>
          <span class="badge badge-gold">${esc(res.topic)}</span>
        </div>
        <h2 class="card-title" style="font-size:1.4rem;">${esc(res.title)}</h2>
        <p class="card-subtitle">Prepared by ${esc(res.author_name)} · ${esc(res.difficulty)}</p>
      </div>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>

    ${
      (res.key_formulas || []).length
        ? `<div style="margin-bottom:14px;">
            <div style="font-size:0.74rem;font-weight:800;text-transform:uppercase;color:var(--ink-muted);margin-bottom:4px;">Key Formulae & Anchors</div>
            <div class="formula-chips">${res.key_formulas.map((f) => `<span class="formula-chip">${esc(f)}</span>`).join('')}</div>
          </div>`
        : ''
    }

    <div class="study-prose" style="padding:16px 18px;border-radius:14px;background:var(--bg-canvas);border:1px solid var(--border-sand);">
      ${renderFormattedText(res.content_body)}
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:18px;">
      <button class="btn btn-outline btn-sm" data-action="coach-topic" data-subject-id="${res.subject_id}" data-topic="${esc(res.topic)}">
        Ask AI Coach About This Topic
      </button>
      ${
        state.currentUser.role === 'student'
          ? `<button class="btn ${prog?.completed ? 'btn-outline' : 'btn-gold'}" data-action="toggle-complete-resource" data-resource-id="${res.id}">
              ${prog?.completed ? '✓ Marked as Mastered' : '✓ Mark Study Guide Mastered'}
            </button>`
          : ''
      }
    </div>
  `);
}

function startQuizModal(quizId) {
  const quiz = state.data.quizzes.find((q) => q.id === quizId);
  if (!quiz) return;

  state.quizRunner = {
    quiz,
    answers: new Array(quiz.questions.length).fill(null),
    revealedHints: {},
    startedAt: Date.now(),
    remainingSecs: (quiz.time_limit_mins || 10) * 60,
    result: null,
    timerId: null
  };

  renderQuizRunnerModal();
  state.quizRunner.timerId = setInterval(() => {
    if (!state.quizRunner || state.quizRunner.result) return;
    state.quizRunner.remainingSecs = Math.max(0, state.quizRunner.remainingSecs - 1);
    const timerEl = document.getElementById('quiz-timer-readout');
    if (timerEl) {
      const m = Math.floor(state.quizRunner.remainingSecs / 60);
      const s = String(state.quizRunner.remainingSecs % 60).padStart(2, '0');
      timerEl.textContent = `⏱ ${m}:${s}`;
    }
  }, 1000);
}

function renderQuizRunnerModal() {
  const qr = state.quizRunner;
  if (!qr) return;
  const { quiz, answers, revealedHints, result } = qr;
  const m = Math.floor(qr.remainingSecs / 60);
  const s = String(qr.remainingSecs % 60).padStart(2, '0');

  if (result) {
    openModal(`
      <div class="modal-header">
        <div>
          <span class="badge badge-gold">Quiz Complete · Auto-Graded</span>
          <h2 class="card-title" style="font-size:1.45rem;margin-top:6px;">${esc(quiz.title)}</h2>
        </div>
        <button class="icon-btn" data-action="close-modal">✕ Done</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:center;margin-bottom:18px;">
        ${renderSunriseGauge(result.attempt.score_percent, `${result.attempt.correct_count}/${result.attempt.total_count} Correct`)}
        <div style="padding:14px;border-radius:14px;background:var(--bg-canvas);border:1px solid var(--border-sand);">
          <div style="font-weight:800;font-size:1.05rem;margin-bottom:6px;">
            ${result.attempt.score_percent >= 80 ? '🌟 Outstanding Confidence!' : result.attempt.score_percent >= 60 ? '💪 Solid Progress!' : '🌱 Every Step Builds Mastery'}
          </div>
          <p style="font-size:0.85rem;color:var(--ink-secondary);margin:0;">
            Your updated Sunrise Confidence score is now <strong>${result.analytics?.overall_confidence ?? 78}%</strong>. Review the step-by-step worked solutions below!
          </p>
        </div>
      </div>

      <div class="item-list">
        ${result.review
          .map(
            (r, idx) => `
            <div class="list-row" style="flex-direction:column;">
              <div style="display:flex;justify-content:space-between;width:100%;">
                <strong>Question ${idx + 1}</strong>
                <span class="badge ${r.is_correct ? 'badge-emerald' : 'badge-coral'}">${r.is_correct ? '✓ Correct' : '✕ Review Step'}</span>
              </div>
              <p style="font-weight:600;color:var(--ink-primary);margin:6px 0;">${esc(r.prompt)}</p>
              <p style="font-size:0.83rem;"><strong>Correct Answer:</strong> ${esc(quiz.questions[idx].options[r.correct_index])}</p>
              <div style="margin-top:6px;padding:9px 12px;border-radius:8px;background:var(--gold-sun-soft);font-size:0.83rem;width:100%;">
                <strong>Worked Explanation:</strong> ${esc(r.explanation)}
              </div>
            </div>
          `
          )
          .join('')}
      </div>
    `);
    return;
  }

  const letters = ['A', 'B', 'C', 'D', 'E'];
  openModal(`
    <div class="modal-header">
      <div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
          <span class="badge badge-charcoal">${esc(getSubjectName(quiz.subject_id))}</span>
          <span id="quiz-timer-readout" class="badge badge-gold">⏱ ${m}:${s}</span>
        </div>
        <h2 class="card-title">${esc(quiz.title)}</h2>
      </div>
      <button class="icon-btn" data-action="close-modal">✕ Exit</button>
    </div>

    <div class="item-list">
      ${quiz.questions
        .map(
          (q, qIdx) => `
          <div class="list-row" style="flex-direction:column;">
            <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
              <span style="font-size:0.78rem;font-weight:800;color:var(--gold-ochre);">QUESTION ${qIdx + 1} OF ${quiz.questions.length}</span>
              ${
                q.hint
                  ? `<button type="button" class="btn btn-outline btn-sm" data-action="toggle-quiz-hint" data-qidx="${qIdx}">💡 ${revealedHints[qIdx] ? 'Hide Hint' : 'Need a Hint?'}</button>`
                  : ''
              }
            </div>
            <h4 style="margin:8px 0 4px;font-size:1rem;">${esc(q.prompt)}</h4>
            ${
              revealedHints[qIdx]
                ? `<div style="padding:8px 12px;border-radius:8px;background:var(--gold-sun-soft);font-size:0.82rem;width:100%;margin-bottom:4px;"><strong>Socratic Hint:</strong> ${esc(q.hint)}</div>`
                : ''
            }
            <div style="width:100%;">
              ${q.options
                .map(
                  (opt, oIdx) => `
                  <button type="button" class="quiz-option ${answers[qIdx] === oIdx ? 'selected' : ''}" data-action="select-quiz-opt" data-qidx="${qIdx}" data-oidx="${oIdx}">
                    <span class="quiz-option-letter">${letters[oIdx] || oIdx + 1}</span>
                    <span>${esc(opt)}</span>
                  </button>
                `
                )
                .join('')}
            </div>
          </div>
        `
        )
        .join('')}
    </div>

    <div style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <div class="field" style="min-width:210px;">
        <label style="margin-bottom:3px;">How confident did this feel?</label>
        <select id="quiz-confidence-after">
          <option value="confident">Confident — ready for exam questions</option>
          <option value="building">Getting there — want a little more practice</option>
          <option value="stuck">Still tricky — need extra review</option>
        </select>
      </div>
      <button type="button" class="btn btn-gold" data-action="submit-quiz">Submit & Grade Instantly</button>
    </div>
  `);
}

function openHomeworkModal(assignmentId) {
  const asg = state.data.assignments.find((a) => a.id === assignmentId);
  if (!asg) return;
  const sub = state.data.submissions.find(
    (s) => s.assignment_id === assignmentId && s.student_id === state.currentUser.id
  );

  openModal(`
    <div class="modal-header">
      <div>
        <span class="badge badge-charcoal">${esc(getSubjectName(asg.subject_id))} · ${asg.max_marks} Marks</span>
        <h2 class="card-title" style="margin-top:6px;">${esc(asg.title)}</h2>
      </div>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <p style="white-space:pre-line;padding:12px 14px;background:var(--bg-canvas);border-radius:12px;border:1px solid var(--border-sand);font-size:0.88rem;">${esc(asg.instructions)}</p>

    <form id="homework-submit-form" data-assignment-id="${asg.id}" class="form-grid" style="margin-top:14px;">
      <div class="field">
        <label>Your Step-by-Step Solution</label>
        <textarea name="answer_text" rows="5" placeholder="Show each step of your working clearly…" required>${esc(sub?.answer_text || '')}</textarea>
      </div>
      <div class="field">
        <label>Confidence Check-In on This Task</label>
        <select name="student_confidence">
          <option value="confident" ${sub?.student_confidence === 'confident' ? 'selected' : ''}>Confident — understood every step</option>
          <option value="building" ${!sub || sub?.student_confidence === 'building' ? 'selected' : ''}>Building — got most of it, unsure on one part</option>
          <option value="stuck" ${sub?.student_confidence === 'stuck' ? 'selected' : ''}>Stuck — please review in next lesson</option>
        </select>
      </div>
      <button type="submit" class="btn btn-gold">Save & Submit to Tutor</button>
    </form>
  `);
}

function openHelpModal() {
  openModal(`
    <div class="modal-header">
      <div>
        <span class="badge badge-gold">1-on-1 Support</span>
        <h2 class="card-title" style="margin-top:4px;">Request a 1-on-1 Extra-Help Session</h2>
      </div>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="help-request-form" class="form-grid">
      <div class="field">
        <label>Subject</label>
        <select name="subject_id">
          ${state.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Specific Topic You Want Help With</label>
        <input name="topic" placeholder="e.g. Trig General Solutions or Inclined Planes" required />
      </div>
      <div class="field">
        <label>Preferred Day & Time</label>
        <input name="preferred_slot" placeholder="e.g. Thursday 16:00 Online or Saturday Morning" required />
      </div>
      <div class="field">
        <label>What part is tripping you up?</label>
        <textarea name="notes" rows="3" placeholder="Tell your tutor what you’d like to practise together…"></textarea>
      </div>
      <button type="submit" class="btn btn-gold">Send 1-on-1 Request</button>
    </form>
  `);
}

function openAuthModal() {
  const users = state.data.users;
  const students = users.filter((u) => u.role === 'student');

  openModal(`
    <div class="modal-header">
      <div>
        ${renderBrandEmblem({ size: 'sm', showTagline: true })}
      </div>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>

    <div style="margin-bottom:18px;">
      <div style="font-size:0.75rem;font-weight:800;text-transform:uppercase;color:var(--ink-muted);margin-bottom:8px;">1-Tap Instant Account Switcher</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;">
        ${users
          .map(
            (u) => `
            <button class="list-row" style="text-align:left;padding:10px 12px;align-items:center;${u.id === state.currentUser.id ? 'border-color:var(--gold-sun);background:var(--gold-sun-soft);' : ''}" data-action="switch-user-id" data-user-id="${u.id}">
              <div>
                <div style="font-weight:700;font-size:0.86rem;">${esc(u.name)}</div>
                <div style="font-size:0.74rem;color:var(--gold-ochre);font-weight:700;">${esc(u.role.toUpperCase())} · ${esc(u.grade || '')}</div>
              </div>
            </button>
          `
          )
          .join('')}
      </div>
    </div>

    <div style="padding-top:14px;border-top:1px solid var(--border-sand);">
      <h3 class="card-title" style="font-size:1.08rem;margin-bottom:10px;">Or Register a New i-tutor Member</h3>
      <form id="register-user-form" class="form-grid">
        <div class="form-row-2">
          <div class="field">
            <label>Full Name</label>
            <input name="name" placeholder="e.g. Lerato Nkosi" required />
          </div>
          <div class="field">
            <label>Role</label>
            <select name="role" id="reg-role-select">
              <option value="student">Student</option>
              <option value="tutor">Tutor</option>
              <option value="parent">Parent</option>
            </select>
          </div>
        </div>
        <div class="form-row-2">
          <div class="field">
            <label>Email</label>
            <input name="email" type="email" placeholder="lerato@itutor.academy" required />
          </div>
          <div class="field">
            <label>Password</label>
            <input name="password" type="password" value="itutor123" required />
          </div>
        </div>
        <div class="form-row-2">
          <div class="field">
            <label>Grade / Specialty</label>
            <input name="grade" placeholder="e.g. Grade 11" />
          </div>
          <div class="field">
            <label>Linked Learner (if Parent)</label>
            <select name="linked_student_id">
              ${students.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <button type="submit" class="btn btn-gold">Create Account & Enter i-tutor</button>
      </form>
    </div>
  `);
}

function openNewSessionModal() {
  const students = state.data.users.filter((u) => u.role === 'student');
  const tomorrowIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);

  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Schedule New Class Session</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="new-session-form" class="form-grid">
      <div class="form-row-2">
        <div class="field">
          <label>Subject</label>
          <select name="subject_id">
            ${state.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Session Type</label>
          <select name="session_type">
            <option value="group">Group Class</option>
            <option value="one_on_one">1-on-1 Focus</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Lesson Title</label>
        <input name="title" placeholder="e.g. Analytical Geometry Circle Tangents" required />
      </div>
      <div class="form-row-2">
        <div class="field">
          <label>Topic</label>
          <input name="topic" placeholder="e.g. Analytical Geometry" required />
        </div>
        <div class="field">
          <label>Date & Time</label>
          <input name="scheduled_at" type="datetime-local" value="${tomorrowIso}" required />
        </div>
      </div>
      <div class="form-row-2">
        <div class="field">
          <label>Delivery Mode</label>
          <select name="mode">
            <option value="in_person">In-Person Studio</option>
            <option value="online">Live Online Link</option>
          </select>
        </div>
        <div class="field">
          <label>Target Learner (Optional for 1-on-1)</label>
          <select name="target_student_id">
            <option value="">All Enrolled Learners</option>
            ${students.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label>Classroom or Online Link</label>
        <input name="location_or_link" value="Studio Room A · Main i-tutor Campus" required />
      </div>
      <button type="submit" class="btn btn-gold">Add to Timetable</button>
    </form>
  `);
}

function openRecapModal(sessionId) {
  const ses = state.data.sessions.find((s) => s.id === sessionId);
  if (!ses) return;

  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Lesson Recap · ${esc(ses.title)}</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="session-recap-form" data-session-id="${ses.id}" class="form-grid">
      <div class="field">
        <label>Session Status</label>
        <select name="status">
          <option value="completed" ${ses.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="upcoming" ${ses.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
        </select>
      </div>
      <div class="field">
        <label>Lesson Summary (visible to Students & Parents)</label>
        <textarea name="lesson_recap" rows="3" placeholder="What concepts and worked examples were covered today?" required>${esc(ses.lesson_recap || '')}</textarea>
      </div>
      <div class="field">
        <label>Key Takeaways (one per line)</label>
        <textarea name="key_takeaways" rows="3" placeholder="Always convert to standard form first&#10;Sketch sign parabola for inequalities">${esc((ses.key_takeaways || []).join('\n'))}</textarea>
      </div>
      <button type="submit" class="btn btn-gold">Save & Publish Recap</button>
    </form>
  `);
}

function openGradeModal(submissionId) {
  const sub = state.data.submissions.find((s) => s.id === submissionId);
  if (!sub) return;
  const asg = state.data.assignments.find((a) => a.id === sub.assignment_id);
  const stu = state.data.users.find((u) => u.id === sub.student_id);

  openModal(`
    <div class="modal-header">
      <div>
        <span class="badge badge-charcoal">${esc(stu?.name || 'Student')}</span>
        <h2 class="card-title" style="margin-top:4px;">Grade: ${esc(asg?.title || 'Homework')}</h2>
      </div>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <div style="padding:12px;background:var(--bg-canvas);border-radius:10px;border:1px solid var(--border-sand);white-space:pre-line;font-size:0.86rem;margin-bottom:14px;">${esc(sub.answer_text)}</div>
    <form id="grade-submission-form" data-submission-id="${sub.id}" class="form-grid">
      <div class="field">
        <label>Marks Awarded (out of ${asg?.max_marks || 20})</label>
        <input name="marks_awarded" type="number" min="0" max="${asg?.max_marks || 100}" value="${sub.marks_awarded ?? (asg?.max_marks ? asg.max_marks - 2 : 18)}" required />
      </div>
      <div class="field">
        <label>Personalized Encouraging Feedback</label>
        <textarea name="tutor_feedback" rows="3" placeholder="Highlight what they did well and one sharp tip for exams…" required>${esc(sub.tutor_feedback || '')}</textarea>
      </div>
      <button type="submit" class="btn btn-gold">Save Grade & Notify Student/Parent</button>
    </form>
  `);
}

function openNewAssignmentModal() {
  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Assign New Homework</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="new-assignment-form" class="form-grid">
      <div class="form-row-2">
        <div class="field">
          <label>Subject</label>
          <select name="subject_id">
            ${state.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Max Marks</label>
          <input name="max_marks" type="number" value="20" min="5" max="100" required />
        </div>
      </div>
      <div class="field">
        <label>Topic</label>
        <input name="topic" placeholder="e.g. Functions & Parabolas" required />
      </div>
      <div class="field">
        <label>Assignment Title</label>
        <input name="title" placeholder="e.g. Parabola Turning Points & Sketching Set" required />
      </div>
      <div class="field">
        <label>Worked Instructions / Questions</label>
        <textarea name="instructions" rows="4" placeholder="Write the homework questions clearly…" required></textarea>
      </div>
      <button type="submit" class="btn btn-gold">Publish Homework</button>
    </form>
  `);
}

function openNewQuizModal() {
  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Create Auto-Graded Topic Quiz</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="new-quiz-form" class="form-grid">
      <div class="form-row-2">
        <div class="field">
          <label>Subject</label>
          <select name="subject_id">
            ${state.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Time Limit (mins)</label>
          <input name="time_limit_mins" type="number" value="10" min="3" max="60" required />
        </div>
      </div>
      <div class="form-row-2">
        <div class="field">
          <label>Topic</label>
          <input name="topic" placeholder="e.g. Stoichiometry & Mole Concept" required />
        </div>
        <div class="field">
          <label>Quiz Title</label>
          <input name="title" placeholder="e.g. Mole Calculations Confidence Check" required />
        </div>
      </div>
      <div style="padding:12px;border-radius:12px;background:var(--bg-canvas);border:1px solid var(--border-sand);" class="form-grid">
        <strong>Question 1</strong>
        <div class="field"><label>Question Prompt</label><input name="q1_prompt" placeholder="e.g. How many moles are in 36 g of H₂O (M = 18 g/mol)?" required /></div>
        <div class="form-row-2">
          <div class="field"><label>Correct Answer (Option A)</label><input name="q1_opt0" placeholder="2 mol" required /></div>
          <div class="field"><label>Distractor B</label><input name="q1_opt1" placeholder="0.5 mol" required /></div>
        </div>
        <div class="form-row-2">
          <div class="field"><label>Distractor C</label><input name="q1_opt2" placeholder="18 mol" required /></div>
          <div class="field"><label>Distractor D</label><input name="q1_opt3" placeholder="54 mol" required /></div>
        </div>
        <div class="field"><label>Worked Explanation</label><input name="q1_exp" placeholder="n = m / M = 36 / 18 = 2 mol." required /></div>
      </div>
      <button type="submit" class="btn btn-gold">Publish Auto-Graded Quiz</button>
    </form>
  `);
}

function openNewResourceModal() {
  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Publish to Study Vault</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="new-resource-form" class="form-grid">
      <div class="form-row-2">
        <div class="field">
          <label>Subject</label>
          <select name="subject_id">
            ${state.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Resource Type</label>
          <select name="resource_type">
            <option value="notes">Structured Notes</option>
            <option value="formula_sheet">Formula Sheet</option>
            <option value="worked_example">Worked Example</option>
            <option value="past_paper">Past Paper Guide</option>
          </select>
        </div>
      </div>
      <div class="form-row-2">
        <div class="field">
          <label>Topic</label>
          <input name="topic" placeholder="e.g. Functions & Parabolas" required />
        </div>
        <div class="field">
          <label>Title</label>
          <input name="title" placeholder="e.g. Sketching Hyperbolas & Parabolas Fast" required />
        </div>
      </div>
      <div class="field">
        <label>Short Summary</label>
        <input name="summary" placeholder="1-sentence overview for students…" required />
      </div>
      <div class="field">
        <label>Key Formulae (one per line)</label>
        <textarea name="key_formulas" rows="2" placeholder="y = a(x - p)² + q"></textarea>
      </div>
      <div class="field">
        <label>Study Content (Supports ### Headings & bullet points)</label>
        <textarea name="content_body" rows="5" placeholder="### Core Method&#10;- Step 1…&#10;- Step 2…" required></textarea>
      </div>
      <button type="submit" class="btn btn-gold">Publish Study Guide</button>
    </form>
  `);
}

function openNewSubjectModal() {
  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Add New Academy Subject</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="new-subject-form" class="form-grid">
      <div class="form-row-2">
        <div class="field"><label>Subject Name</label><input name="name" placeholder="e.g. Life Sciences" required /></div>
        <div class="field"><label>Subject Code</label><input name="code" placeholder="LIFE-11" required /></div>
      </div>
      <div class="form-row-2">
        <div class="field"><label>Grade Level</label><input name="grade_level" value="Grades 10–12" required /></div>
        <div class="field"><label>Lead Tutor</label><input name="tutor_name" value="${esc(state.currentUser.name)}" required /></div>
      </div>
      <div class="field"><label>Description</label><input name="description" placeholder="Core syllabus topics and exam mastery…" required /></div>
      <div class="field"><label>Topics (comma-separated)</label><input name="topics" placeholder="Genetics & Meiosis, Human Endocrine System, Photosynthesis" required /></div>
      <button type="submit" class="btn btn-gold">Create Subject</button>
    </form>
  `);
}

/* ==========================================================================
   EVENT DELEGATION & ACTIONS
   ========================================================================== */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'backdrop-close' && e.target !== btn) return;
  if (action === 'close-modal' || action === 'backdrop-close') {
    closeModal();
    return;
  }

  try {
    switch (action) {
      case 'toggle-theme': {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('itutor_theme', state.theme);
        renderApp();
        break;
      }

      case 'switch-tab': {
        state.activeTab = btn.dataset.tab;
        renderApp();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      }

      case 'quick-role': {
        const targetRole = btn.dataset.role;
        const match =
          state.data.users.find(
            (u) =>
              u.role === targetRole &&
              (targetRole === 'student' ? u.id === 'stu-thabo' : true)
          ) || state.data.users.find((u) => u.role === targetRole);
        if (match) {
          setCurrentUser(match);
          showToast(`Switched to ${match.name} (${targetRole.toUpperCase()} view)`);
        }
        break;
      }

      case 'open-auth-modal':
        openAuthModal();
        break;

      case 'switch-user-id': {
        const u = state.data.users.find((x) => x.id === btn.dataset.userId);
        if (u) {
          closeModal();
          setCurrentUser(u);
          showToast(`Signed in as ${u.name}`);
        }
        break;
      }

      case 'set-mood': {
        const mood = btn.dataset.mood;
        await api(`/api/students/${state.currentUser.id}/mood`, {
          method: 'POST',
          body: JSON.stringify({ mood })
        });
        await refreshSnapshot();
        showToast('Confidence check-in updated!');
        break;
      }

      case 'filter-vault-subject':
        state.vaultSubjectFilter = btn.dataset.subject;
        renderApp();
        break;

      case 'toggle-vault-bookmarks':
        state.vaultBookmarkedOnly = !state.vaultBookmarkedOnly;
        renderApp();
        break;

      case 'toggle-bookmark': {
        const resourceId = btn.dataset.resourceId;
        const existing = state.data.resource_progress.find(
          (rp) => rp.resource_id === resourceId && rp.student_id === state.currentUser.id
        );
        await api(`/api/resources/${resourceId}/progress`, {
          method: 'POST',
          body: JSON.stringify({
            student_id: state.currentUser.id,
            bookmarked: !existing?.bookmarked
          })
        });
        await refreshSnapshot();
        showToast(!existing?.bookmarked ? 'Saved to your Study Vault bookmarks' : 'Bookmark removed');
        break;
      }

      case 'open-resource':
        openResourceModal(btn.dataset.resourceId);
        break;

      case 'toggle-complete-resource': {
        const resourceId = btn.dataset.resourceId;
        const existing = state.data.resource_progress.find(
          (rp) => rp.resource_id === resourceId && rp.student_id === state.currentUser.id
        );
        await api(`/api/resources/${resourceId}/progress`, {
          method: 'POST',
          body: JSON.stringify({
            student_id: state.currentUser.id,
            completed: !existing?.completed
          })
        });
        await refreshSnapshot();
        openResourceModal(resourceId);
        showToast('Study Vault mastery progress saved!');
        break;
      }

      case 'coach-topic': {
        closeModal();
        state.coachSubjectId = btn.dataset.subjectId || 'sub-math';
        state.coachTopic = btn.dataset.topic || '';
        state.activeTab = 'coach';
        renderApp();
        break;
      }

      case 'quick-coach': {
        const prompt = btn.dataset.prompt;
        const modeOverride = btn.dataset.mode || state.coachMode;
        await sendCoachMessage(prompt, modeOverride);
        break;
      }

      case 'start-quiz':
        startQuizModal(btn.dataset.quizId);
        break;

      case 'toggle-quiz-hint': {
        const qIdx = Number(btn.dataset.qidx);
        if (state.quizRunner) {
          state.quizRunner.revealedHints[qIdx] = !state.quizRunner.revealedHints[qIdx];
          renderQuizRunnerModal();
        }
        break;
      }

      case 'select-quiz-opt': {
        const qIdx = Number(btn.dataset.qidx);
        const oIdx = Number(btn.dataset.oidx);
        if (state.quizRunner) {
          state.quizRunner.answers[qIdx] = oIdx;
          renderQuizRunnerModal();
        }
        break;
      }

      case 'submit-quiz': {
        const qr = state.quizRunner;
        if (!qr) return;
        if (qr.answers.some((a) => a === null)) {
          showToast('Please select an answer for every question first.');
          return;
        }
        const confEl = document.getElementById('quiz-confidence-after');
        const confidence_after = confEl?.value || 'confident';
        const duration_secs = Math.round((Date.now() - qr.startedAt) / 1000);
        if (qr.timerId) clearInterval(qr.timerId);

        const res = await api(`/api/quizzes/${qr.quiz.id}/attempt`, {
          method: 'POST',
          body: JSON.stringify({
            student_id: state.currentUser.id,
            answers: qr.answers,
            duration_secs,
            confidence_after
          })
        });
        qr.result = res;
        await refreshSnapshot();
        renderQuizRunnerModal();
        showToast(`Scored ${res.attempt.score_percent}%! Sunrise Confidence updated.`);
        break;
      }

      case 'open-homework-modal':
        openHomeworkModal(btn.dataset.assignmentId);
        break;

      case 'open-help-modal':
        openHelpModal();
        break;

      case 'mark-attendance': {
        await api(`/api/sessions/${btn.dataset.sessionId}/attendance`, {
          method: 'POST',
          body: JSON.stringify({
            student_id: btn.dataset.studentId,
            status: btn.dataset.status
          })
        });
        await refreshSnapshot();
        showToast(`Marked ${btn.dataset.status.toUpperCase()}`);
        break;
      }

      case 'approve-help-request': {
        const req = state.data.help_requests.find((r) => r.id === btn.dataset.requestId);
        if (!req) return;
        const stu = state.data.users.find((u) => u.id === req.student_id);
        await api(`/api/help-requests/${req.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'scheduled',
            tutor_response: `Scheduled 1-on-1 session for ${req.preferred_slot} with ${state.currentUser.name}.`,
            create_session_payload: {
              subject_id: req.subject_id,
              title: `1-on-1 Extra Help: ${req.topic} (${stu?.name.split(' ')[0] || 'Student'})`,
              topic: req.topic,
              tutor_name: state.currentUser.name,
              session_type: 'one_on_one',
              mode: 'online',
              location_or_link: `https://meet.itutor.academy/1on1-${req.id}`,
              duration_mins: 45,
              target_student_id: req.student_id
            }
          })
        });
        await refreshSnapshot();
        showToast('1-on-1 session approved & added to timetable!');
        break;
      }

      case 'open-new-session-modal':
        openNewSessionModal();
        break;
      case 'open-recap-modal':
        openRecapModal(btn.dataset.sessionId);
        break;
      case 'open-grade-modal':
        openGradeModal(btn.dataset.submissionId);
        break;
      case 'open-new-assignment-modal':
        openNewAssignmentModal();
        break;
      case 'open-new-quiz-modal':
        openNewQuizModal();
        break;
      case 'open-new-resource-modal':
        openNewResourceModal();
        break;
      case 'open-new-subject-modal':
        openNewSubjectModal();
        break;
    }
  } catch (err) {
    showToast(err.message || 'Action failed');
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'coach-sub-select') {
    state.coachSubjectId = e.target.value;
    const sub = state.data.subjects.find((s) => s.id === state.coachSubjectId);
    state.coachTopic = sub?.topics?.[0]?.name || '';
    renderApp();
  } else if (e.target.id === 'coach-topic-select') {
    state.coachTopic = e.target.value;
  } else if (e.target.id === 'coach-mode-select') {
    state.coachMode = e.target.value;
    renderApp();
  } else if (e.target.id === 'tutor-msg-student') {
    state.selectedStudentForTutorMsg = e.target.value;
    renderApp();
  } else if (e.target.id === 'tutor-msg-channel') {
    state.selectedChannelForTutorMsg = e.target.value;
    renderApp();
  } else if (e.target.id === 'parent-child-switcher') {
    state.selectedChildId = e.target.value;
    renderApp();
  }
});

async function sendCoachMessage(promptText, mode = state.coachMode) {
  state.coachSending = true;
  renderApp();
  try {
    await api('/api/coach/ask', {
      method: 'POST',
      body: JSON.stringify({
        student_id: state.currentUser.id,
        student_name: state.currentUser.name,
        subject_id: state.coachSubjectId,
        topic: state.coachTopic,
        mode,
        prompt: promptText
      })
    });
    state.coachSending = false;
    await refreshSnapshot();
  } catch (err) {
    state.coachSending = false;
    renderApp();
    showToast(err.message);
  }
}

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  try {
    if (form.id === 'coach-form') {
      const input = document.getElementById('coach-input');
      const prompt = input.value.trim();
      if (!prompt) return;
      input.value = '';
      await sendCoachMessage(prompt, state.coachMode);
    } else if (form.id === 'homework-submit-form') {
      const fd = new FormData(form);
      await api(`/api/assignments/${form.dataset.assignmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          student_id: state.currentUser.id,
          answer_text: fd.get('answer_text'),
          student_confidence: fd.get('student_confidence')
        })
      });
      closeModal();
      await refreshSnapshot();
      showToast('Homework submitted to your tutor!');
    } else if (form.id === 'help-request-form') {
      const fd = new FormData(form);
      await api('/api/help-requests', {
        method: 'POST',
        body: JSON.stringify({
          student_id: state.currentUser.id,
          subject_id: fd.get('subject_id'),
          topic: fd.get('topic'),
          preferred_slot: fd.get('preferred_slot'),
          notes: fd.get('notes')
        })
      });
      closeModal();
      await refreshSnapshot();
      showToast('1-on-1 Extra-Help request sent!');
    } else if (form.id === 'student-msg-form') {
      const input = document.getElementById('student-msg-input');
      const body = input.value.trim();
      if (!body) return;
      input.value = '';
      await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          student_id: state.currentUser.id,
          channel: 'tutor_student',
          sender_id: state.currentUser.id,
          sender_name: state.currentUser.name,
          sender_role: 'student',
          body
        })
      });
      await refreshSnapshot();
    } else if (form.id === 'parent-msg-form') {
      const input = document.getElementById('parent-msg-input');
      const body = input.value.trim();
      if (!body) return;
      input.value = '';
      const child = getActiveChild();
      await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          student_id: child.id,
          channel: 'tutor_parent',
          sender_id: state.currentUser.id,
          sender_name: state.currentUser.name,
          sender_role: 'parent',
          body
        })
      });
      await refreshSnapshot();
      showToast('Message sent to tutor');
    } else if (form.id === 'tutor-msg-form') {
      const input = document.getElementById('tutor-msg-input');
      const body = input.value.trim();
      if (!body) return;
      input.value = '';
      await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          student_id: state.selectedStudentForTutorMsg,
          channel: state.selectedChannelForTutorMsg,
          sender_id: state.currentUser.id,
          sender_name: state.currentUser.name,
          sender_role: 'tutor',
          body
        })
      });
      await refreshSnapshot();
      showToast('Reply sent');
    } else if (form.id === 'tutor-announcement-form') {
      const fd = new FormData(form);
      await api('/api/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: fd.get('title'),
          body: fd.get('body'),
          audience: fd.get('audience'),
          pinned: fd.get('pinned') === 'true',
          author_name: state.currentUser.name
        })
      });
      form.reset();
      await refreshSnapshot();
      showToast('Announcement published!');
    } else if (form.id === 'register-user-form') {
      const fd = new FormData(form);
      const res = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          password: fd.get('password'),
          role: fd.get('role'),
          grade: fd.get('grade'),
          linked_student_id: fd.get('linked_student_id')
        })
      });
      state.data = res.snapshot;
      closeModal();
      setCurrentUser(res.user);
      showToast(`Welcome to i-tutor, ${res.user.name}!`);
    } else if (form.id === 'new-session-form') {
      const fd = new FormData(form);
      await api('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          subject_id: fd.get('subject_id'),
          session_type: fd.get('session_type'),
          title: fd.get('title'),
          topic: fd.get('topic'),
          scheduled_at: new Date(fd.get('scheduled_at')).toISOString(),
          mode: fd.get('mode'),
          target_student_id: fd.get('target_student_id') || null,
          location_or_link: fd.get('location_or_link'),
          tutor_name: state.currentUser.name
        })
      });
      closeModal();
      await refreshSnapshot();
      showToast('Class session added to timetable!');
    } else if (form.id === 'session-recap-form') {
      const fd = new FormData(form);
      await api(`/api/sessions/${form.dataset.sessionId}/recap`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: fd.get('status'),
          lesson_recap: fd.get('lesson_recap'),
          key_takeaways: fd.get('key_takeaways')
        })
      });
      closeModal();
      await refreshSnapshot();
      showToast('Lesson recap published!');
    } else if (form.id === 'grade-submission-form') {
      const fd = new FormData(form);
      await api(`/api/submissions/${form.dataset.submissionId}/grade`, {
        method: 'PATCH',
        body: JSON.stringify({
          marks_awarded: Number(fd.get('marks_awarded')),
          tutor_feedback: fd.get('tutor_feedback')
        })
      });
      closeModal();
      await refreshSnapshot();
      showToast('Submission graded & feedback shared!');
    } else if (form.id === 'new-assignment-form') {
      const fd = new FormData(form);
      await api('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({
          subject_id: fd.get('subject_id'),
          max_marks: Number(fd.get('max_marks')),
          topic: fd.get('topic'),
          title: fd.get('title'),
          instructions: fd.get('instructions'),
          author_name: state.currentUser.name
        })
      });
      closeModal();
      await refreshSnapshot();
      showToast('New homework assignment published!');
    } else if (form.id === 'new-quiz-form') {
      const fd = new FormData(form);
      await api('/api/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          subject_id: fd.get('subject_id'),
          time_limit_mins: Number(fd.get('time_limit_mins')),
          topic: fd.get('topic'),
          title: fd.get('title'),
          description: `Custom auto-graded sprint created by ${state.currentUser.name}.`,
          author_name: state.currentUser.name,
          questions: [
            {
              id: 'q1',
              prompt: fd.get('q1_prompt'),
              options: [fd.get('q1_opt0'), fd.get('q1_opt1'), fd.get('q1_opt2'), fd.get('q1_opt3')],
              correct_index: 0,
              hint: 'Check your core formula sheet in the Study Vault.',
              explanation: fd.get('q1_exp')
            }
          ]
        })
      });
      closeModal();
      await refreshSnapshot();
      showToast('Auto-graded quiz published!');
    } else if (form.id === 'new-resource-form') {
      const fd = new FormData(form);
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({
          subject_id: fd.get('subject_id'),
          resource_type: fd.get('resource_type'),
          topic: fd.get('topic'),
          title: fd.get('title'),
          summary: fd.get('summary'),
          key_formulas: fd.get('key_formulas'),
          content_body: fd.get('content_body'),
          author_name: state.currentUser.name
        })
      });
      closeModal();
      await refreshSnapshot();
      showToast('Study resource published to Study Vault!');
    } else if (form.id === 'new-subject-form') {
      const fd = new FormData(form);
      const topics = String(fd.get('topics') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api('/api/subjects', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          code: fd.get('code'),
          grade_level: fd.get('grade_level'),
          tutor_name: fd.get('tutor_name'),
          description: fd.get('description'),
          topics
        })
      });
      closeModal();
      await refreshSnapshot();
      showToast('New subject added to i-tutor!');
    }
  } catch (err) {
    showToast(err.message || 'Could not save changes');
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

refreshSnapshot({ silent: true }).catch((err) => {
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = `<div class="boot-splash"><p>Could not connect to i-tutor: ${esc(err.message)}</p></div>`;
  }
});
