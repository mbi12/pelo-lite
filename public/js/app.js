import { renderBrandEmblem, renderSunriseGauge } from './logo.js';

const state = {
  data: null,
  currentUser: null,
  page: 'home', // 'home' | 'browse' | 'coach' | 'dashboard' | 'messages' | 'about' | 'contact' | 'auth'
  authMode: 'signup', // 'login' | 'signup'
  signupRole: 'student',
  introPlayed: false,
  theme: localStorage.getItem('itutor_theme') || 'light',
  searchQuery: '',
  selectedCategory: 'all',
  sortBy: 'recommended',
  vaultBookmarkedOnly: false,
  coachSubjectId: 'sub-math',
  coachTopic: 'Trigonometry & Identities',
  coachMode: 'step_by_step',
  coachSending: false,
  activePeerId: 'tut-naledi',
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
      .replace(/^(Ms\.|Mr\.|Mrs\.|Dr\.)\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'IT'
  );
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
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
  if (Math.abs(diffHrs) < 1) return diffMs >= 0 ? 'Within the hour' : 'Just now';
  if (diffHrs > 0 && diffHrs < 24) return `In ${diffHrs}h`;
  if (diffHrs >= 24) return `In ${Math.round(diffHrs / 24)}d`;
  if (diffHrs > -24) return `${Math.abs(diffHrs)}h ago`;
  return `${Math.round(Math.abs(diffHrs) / 24)}d ago`;
}

function formatInline(str) {
  let s = esc(str);
  s = s.replace(/\$\$(.+?)\$\$/g, '<code>$1</code>');
  s = s.replace(/\$(.+?)\$/g, '<code>$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return s;
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

function showToast(message) {
  const rack = document.getElementById('toast-rack');
  if (!rack) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  rack.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
  return payload;
}

async function refreshSnapshot({ silent = true } = {}) {
  const snapshot = await api('/api/bootstrap');
  state.data = snapshot;

  const savedUserId = localStorage.getItem('itutor_user_id');
  const user =
    (state.currentUser && snapshot.users.find((u) => u.id === state.currentUser.id)) ||
    (savedUserId && snapshot.users.find((u) => u.id === savedUserId)) ||
    snapshot.users.find((u) => u.id === 'stu-thabo') ||
    snapshot.users[0];

  setCurrentUser(user, { rerender: !silent });
  if (silent) renderApp();
}

function setCurrentUser(user, { rerender = true } = {}) {
  if (!user) return;
  state.currentUser = user;
  localStorage.setItem('itutor_user_id', user.id);
  if (user.role === 'parent') {
    state.selectedChildId = user.linked_student_id || 'stu-thabo';
  }
  if (state.activePeerId === user.id) {
    const fallbackPeer = state.data?.users.find((u) => u.id !== user.id);
    if (fallbackPeer) state.activePeerId = fallbackPeer.id;
  }
  if (rerender) renderApp();
}

function getSubjectName(subjectId) {
  return state.data?.subjects.find((s) => s.id === subjectId)?.name || 'General';
}

/* ==========================================================================
   SERVEHUB-STYLE TOP SHELL, INTRO OVERLAY & FOOTER
   ========================================================================== */
function renderApp() {
  const root = document.getElementById('app');
  if (!root || !state.data || !state.currentUser) return;

  const user = state.currentUser;
  const introClass = state.introPlayed ? 'sh-intro-overlay hidden' : 'sh-intro-overlay';

  root.innerHTML = `
    <div id="sh-intro" class="${introClass}" aria-hidden="true">
      <div class="sh-intro-word"><span style="color:var(--gold-sun);">i</span>-tutor<span>.</span></div>
      <div class="sh-intro-sub">Confidence in Learning</div>
    </div>

    <header class="sh-navbar">
      <div class="sh-navbar-inner">
        <a href="#home" data-action="nav-page" data-page="home">
          ${renderBrandEmblem({ size: 'sm', showTagline: true })}
        </a>

        <nav class="sh-nav-links" aria-label="Main Navigation">
          <button class="sh-nav-link ${state.page === 'home' ? 'active' : ''}" data-action="nav-page" data-page="home">Home</button>
          <button class="sh-nav-link ${state.page === 'browse' ? 'active' : ''}" data-action="nav-page" data-page="browse">Find a Tutor</button>
          <button class="sh-nav-link ${state.page === 'coach' ? 'active' : ''}" data-action="nav-page" data-page="coach">AI Coach & Quizzes</button>
          <button class="sh-nav-link ${state.page === 'dashboard' ? 'active' : ''}" data-action="nav-page" data-page="dashboard">Dashboard</button>
          <button class="sh-nav-link ${state.page === 'messages' ? 'active' : ''}" data-action="nav-page" data-page="messages">Messages</button>
          <button class="sh-nav-link ${state.page === 'about' ? 'active' : ''}" data-action="nav-page" data-page="about">About</button>
        </nav>

        <div class="sh-nav-actions">
          <div class="sh-role-strip" title="Instant View Switcher">
            <button class="sh-role-btn ${user.role === 'student' ? 'active' : ''}" data-action="quick-role" data-role="student">Student</button>
            <button class="sh-role-btn ${user.role === 'tutor' ? 'active' : ''}" data-action="quick-role" data-role="tutor">Tutor</button>
            <button class="sh-role-btn ${user.role === 'parent' ? 'active' : ''}" data-action="quick-role" data-role="parent">Parent</button>
          </div>
          <button class="icon-btn" data-action="toggle-theme" title="Toggle Cream / Night Study mode">
            ${state.theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button class="icon-btn" data-action="nav-page" data-page="auth" title="Account & Sign Up">
            <span class="avatar-circle" style="width:24px;height:24px;font-size:0.68rem;">${esc(initials(user.name))}</span>
            <span>${esc(user.name.split(' ')[0])}</span>
          </button>
        </div>
      </div>
    </header>

    <main class="sh-container">
      ${renderCurrentPage()}
    </main>

    <footer class="sh-footer">
      <div class="sh-footer-inner">
        <div>
          ${renderBrandEmblem({ size: 'sm', showTagline: true })}
          <p style="margin:12px 0 0;font-size:0.85rem;color:var(--ink-secondary);max-width:34ch;">
            Empowering learners, dedicated mentors, and parents with calm, structured mastery — confidence in learning without barriers.
          </p>
        </div>
        <div>
          <h4>Explore</h4>
          <div class="sh-footer-links">
            <button data-action="nav-page" data-page="browse">Find a Tutor</button>
            <button data-action="nav-page" data-page="coach">24/7 AI Study Coach</button>
            <button data-action="nav-page" data-page="browse">Study Vault & Notes</button>
            <button data-action="nav-page" data-page="dashboard">Practice Quizzes</button>
          </div>
        </div>
        <div>
          <h4>Portals</h4>
          <div class="sh-footer-links">
            <button data-action="quick-role" data-role="student">Student Sunrise Hub</button>
            <button data-action="quick-role" data-role="tutor">Tutor Studio</button>
            <button data-action="quick-role" data-role="parent">Parent Peace-of-Mind</button>
            <button data-action="nav-page" data-page="auth">Create an Account</button>
          </div>
        </div>
        <div>
          <h4>Company</h4>
          <div class="sh-footer-links">
            <button data-action="nav-page" data-page="about">About i-tutor</button>
            <button data-action="nav-page" data-page="contact">Contact & Support</button>
            <button data-action="nav-page" data-page="messages">Direct Messages</button>
          </div>
        </div>
      </div>
    </footer>

    <nav class="mobile-dock" aria-label="Mobile Navigation">
      <button class="dock-btn ${state.page === 'home' ? 'active' : ''}" data-action="nav-page" data-page="home">Home</button>
      <button class="dock-btn ${state.page === 'browse' ? 'active' : ''}" data-action="nav-page" data-page="browse">Tutors</button>
      <button class="dock-btn ${state.page === 'coach' ? 'active' : ''}" data-action="nav-page" data-page="coach">AI Coach</button>
      <button class="dock-btn ${state.page === 'dashboard' ? 'active' : ''}" data-action="nav-page" data-page="dashboard">Dashboard</button>
      <button class="dock-btn ${state.page === 'messages' ? 'active' : ''}" data-action="nav-page" data-page="messages">Messages</button>
    </nav>
  `;

  if (!state.introPlayed) {
    state.introPlayed = true;
    setTimeout(() => {
      const el = document.getElementById('sh-intro');
      if (el) el.classList.add('hidden');
    }, 620);
  }

  if (state.page === 'coach') {
    const feed = document.getElementById('coach-feed');
    if (feed) feed.scrollTop = feed.scrollHeight;
  }
}

function renderCurrentPage() {
  switch (state.page) {
    case 'home':
      return renderHomePage();
    case 'browse':
      return renderBrowsePage();
    case 'coach':
      return renderCoachAndQuizzesPage();
    case 'dashboard':
      return renderRoleDashboardPage();
    case 'messages':
      return renderMessagesPage();
    case 'about':
      return renderAboutPage();
    case 'contact':
      return renderContactPage();
    case 'auth':
      return renderAuthPage();
    default:
      return renderHomePage();
  }
}

/* ==========================================================================
   1. SERVEHUB-STRUCTURED HOME PAGE
   ========================================================================== */
function renderHomePage() {
  const tutors = state.data.users.filter((u) => u.role === 'tutor');
  const categoryIcons = {
    'sub-math': '∑',
    'sub-phys': '⚛',
    'sub-acct': '§',
    'sub-eng': '✒',
    'sub-life': '🌿'
  };

  const activeStuId =
    state.currentUser.role === 'student'
      ? state.currentUser.id
      : state.currentUser.linked_student_id || 'stu-thabo';
  const analytics = state.data.analytics_by_student[activeStuId];

  return `
    <!-- ServeHub Signature Quick Action Composer Bar -->
    <section class="sh-quickbar">
      <div class="sh-quickbar-prompt" data-action="scroll-to-request">
        <span class="sh-monogram">IT</span>
        <div class="sh-fake-input">What topic or subject do you need help with today, ${esc(state.currentUser.name.split(' ')[0])}?</div>
      </div>
      <div class="sh-quickbar-pills">
        <button class="btn btn-gold btn-sm" data-action="nav-page" data-page="browse">Find a tutor</button>
        <button class="btn btn-charcoal btn-sm" data-action="scroll-to-request">Post a request</button>
        <button class="btn btn-outline btn-sm" data-action="share-skill-cta">
          ${state.currentUser.role === 'tutor' ? '+ Publish a lesson' : 'Teach on i-tutor'}
        </button>
      </div>
    </section>

    <!-- ServeHub Centered Bold Hero + Search -->
    <section class="sh-hero">
      <div class="sh-hero-badge">☀️ i-tutor · Confidence in Learning</div>
      <h1>Learn with trusted <em>subject mentors</em> &amp; master every exam</h1>
      <p>Connect with verified i-tutor educators, explore worked study guides, post study requests, and track your confidence step by step.</p>

      <form id="hero-search-form" class="sh-search-box">
        <input id="hero-search-input" type="text" value="${esc(state.searchQuery)}" placeholder="Search subjects, tutors, quadratics, physics, essays…" />
        <button type="submit" class="btn btn-gold">Search</button>
      </form>
    </section>

    <!-- ServeHub "Popular categories" Section -->
    <section class="sh-section">
      <div class="sh-section-head">
        <h2 class="sh-section-title">Popular subjects</h2>
        <button class="sh-see-all" data-action="filter-category" data-category="all">See all →</button>
      </div>
      <div class="sh-cat-grid">
        ${state.data.subjects
          .slice(0, 5)
          .map((sub) => {
            const guideCount = state.data.resources.filter((r) => r.subject_id === sub.id).length;
            const quizCount = state.data.quizzes.filter((q) => q.subject_id === sub.id).length;
            return `
              <button class="sh-cat-card" data-action="filter-category" data-category="${sub.id}">
                <span class="sh-cat-icon">${categoryIcons[sub.id] || '📘'}</span>
                <span class="sh-cat-name">${esc(sub.name)}</span>
                <span class="sh-cat-meta">${sub.topics.length} topics · ${guideCount + quizCount} resources</span>
              </button>
            `;
          })
          .join('')}
        <button class="sh-cat-card" data-action="nav-page" data-page="coach">
          <span class="sh-cat-icon">✦</span>
          <span class="sh-cat-name">24/7 AI Coach</span>
          <span class="sh-cat-meta">Step-by-step Socratic solver</span>
        </button>
      </div>
    </section>

    <!-- ServeHub "Post a job / Study Request" Composer + Live Feed alongside Confidence Pulse -->
    <section id="study-request-section" class="sh-section sh-home-columns">
      <div>
        <div class="sh-section-head">
          <h2 class="sh-section-title">Post a study request</h2>
          <span class="badge badge-gold">${state.data.help_requests.length} active requests</span>
        </div>

        <form id="home-post-request-form" class="sh-post-box">
          <textarea name="notes" rows="3" placeholder="Describe the topic, homework question, or exam paper you want help with (e.g. 'Need a 1-on-1 walkthrough on Trig General Solutions before Friday')…" required></textarea>
          <div class="sh-post-toolbar">
            <div class="sh-post-tags">
              <select name="subject_id" aria-label="Subject">
                ${state.data.subjects.map((s) => `<option value="${s.id}">📘 ${esc(s.name)}</option>`).join('')}
              </select>
              <input name="topic" placeholder="Topic (e.g. Quadratics)" required />
              <input name="preferred_slot" placeholder="📍 Campus or Online time" value="Online · This afternoon" required />
            </div>
            <button type="submit" class="btn btn-gold">Post</button>
          </div>
        </form>

        <div class="item-list">
          ${state.data.help_requests
            .slice(0, 4)
            .map((req) => {
              const stu = state.data.users.find((u) => u.id === req.student_id);
              return `
                <div class="card" style="padding:18px 20px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span class="avatar-circle">${esc(initials(stu?.name || 'Student'))}</span>
                      <div>
                        <strong style="font-size:0.9rem;">${esc(stu?.name || 'Learner')}</strong>
                        <div style="font-size:0.75rem;color:var(--ink-muted);">📍 ${esc(req.preferred_slot)} · ${esc(formatRelative(req.created_at))}</div>
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;">
                      <span class="badge badge-charcoal">${esc(getSubjectName(req.subject_id))}</span>
                      <span class="badge ${req.status === 'scheduled' ? 'badge-emerald' : 'badge-gold'}">${esc(req.status)}</span>
                    </div>
                  </div>
                  <h4 style="margin:4px 0;">${esc(req.topic)}</h4>
                  <p style="margin:0 0 12px;color:var(--ink-secondary);font-size:0.88rem;">${esc(req.notes || 'Looking for a guided step-by-step session.')}</p>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${
                      state.currentUser.role === 'tutor' && req.status === 'pending'
                        ? `<button class="btn btn-gold btn-sm" data-action="approve-help-request" data-request-id="${req.id}">✓ Accept & Schedule 1-on-1</button>`
                        : ''
                    }
                    <button class="btn btn-outline btn-sm" data-action="message-peer" data-peer-id="${req.student_id === state.currentUser.id ? 'tut-naledi' : req.student_id}">
                      Message
                    </button>
                    <button class="btn btn-outline btn-sm" data-action="coach-topic" data-subject-id="${req.subject_id}" data-topic="${esc(req.topic)}">
                      Solve with AI Coach
                    </button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>

      <!-- Right Column: Sunrise Confidence Snapshot + Featured Tutors Preview -->
      <div class="section-stack">
        <div class="card" style="background:linear-gradient(150deg,#1E1F1D 0%,#2B2D28 100%);color:#F8F4EC;border-color:rgba(242,183,40,0.35);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="badge badge-gold">Live Confidence Meter</span>
            <button class="btn btn-ghost-light btn-sm" data-action="nav-page" data-page="dashboard">Open Dashboard →</button>
          </div>
          <h3 class="card-title" style="color:#FFFDF8;margin-bottom:4px;">${esc(analytics?.student_name || 'Thabo Mokoena')}’s Sunrise Score</h3>
          <p style="font-size:0.83rem;color:#D6CFC1;margin:0 0 14px;">${analytics?.mastered_topics_count || 3} of ${analytics?.total_topics_count || 19} syllabus topics Exam-Ready · ${analytics?.attendance_rate || 95}% attendance</p>
          ${renderSunriseGauge(analytics?.overall_confidence || 78, analytics?.label || 'Building Confidence')}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;">
            <button class="btn btn-gold btn-sm" data-action="nav-page" data-page="coach">Practice Quizzes</button>
            <button class="btn btn-ghost-light btn-sm" data-action="nav-page" data-page="browse">Study Vault</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Top i-tutor mentors</h3>
              <p class="card-subtitle">Verified educators ready for 1-on-1 &amp; cohort lessons.</p>
            </div>
            <button class="sh-see-all" data-action="nav-page" data-page="browse">See all</button>
          </div>
          <div class="item-list">
            ${tutors
              .slice(0, 3)
              .map(
                (t) => `
                <div class="list-row" style="align-items:center;">
                  <div style="display:flex;align-items:center;gap:12px;">
                    <span class="sh-avatar-lg" style="width:44px;height:44px;font-size:0.9rem;">${esc(initials(t.name))}</span>
                    <div>
                      <h4 style="margin:0;">${esc(t.name)}</h4>
                      <p style="font-size:0.78rem;color:var(--gold-ochre);font-weight:700;">★ ${Number(t.rating || 4.95).toFixed(2)} · ${esc(t.grade)}</p>
                    </div>
                  </div>
                  <button class="btn btn-outline btn-sm" data-action="message-peer" data-peer-id="${t.id}">Message</button>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- ServeHub "How It Works" 1 - 2 - 3 Section -->
    <section class="sh-section">
      <div class="sh-section-head">
        <h2 class="sh-section-title">How i-tutor works</h2>
      </div>
      <div class="sh-steps-grid">
        <div class="sh-step-card">
          <div class="sh-step-num">1</div>
          <h3>1. Find</h3>
          <p>Search and compare verified i-tutor subject mentors, formula playbooks, and past-paper guides.</p>
        </div>
        <div class="sh-step-card">
          <div class="sh-step-num">2</div>
          <h3>2. Learn &amp; Book</h3>
          <p>Join scheduled classes, request 1-on-1 focus slots, or work through tough equations with our 24/7 Socratic Coach.</p>
        </div>
        <div class="sh-step-card">
          <div class="sh-step-num">3</div>
          <h3>3. Confidence</h3>
          <p>Auto-graded quizzes, homework feedback, and Sunrise Confidence tracking keep students and parents in complete sync.</p>
        </div>
      </div>
    </section>

    <!-- ServeHub Bottom CTA Banner -->
    <section class="sh-cta-banner">
      <div>
        <h2>Ready to build real exam confidence?</h2>
        <p>Connect with a dedicated i-tutor mentor for any subject — or publish your own study lessons as an educator.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-gold" data-action="nav-page" data-page="browse">Browse mentors</button>
        <button class="btn btn-ghost-light" data-action="nav-page" data-page="auth">Create an account</button>
      </div>
    </section>
  `;
}

/* ==========================================================================
   2. SERVEHUB "/services" EQUIVALENT: FIND A TUTOR & STUDY VAULT
   ========================================================================== */
function renderBrowsePage() {
  const q = state.searchQuery.trim().toLowerCase();
  const tutors = state.data.users
    .filter((u) => u.role === 'tutor')
    .filter((t) => {
      if (state.selectedCategory !== 'all') {
        const subName = getSubjectName(state.selectedCategory).toLowerCase();
        const specs = (t.specialties || []).join(' ').toLowerCase();
        if (!specs.includes(subName.split(' ')[0]) && !(t.bio || '').toLowerCase().includes(subName.split(' ')[0])) {
          return false;
        }
      }
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.headline || '').toLowerCase().includes(q) ||
        (t.bio || '').toLowerCase().includes(q) ||
        (t.specialties || []).some((sp) => sp.toLowerCase().includes(q))
      );
    });

  if (state.sortBy === 'top_rated') {
    tutors.sort((a, b) => Number(b.rating || 4.95) - Number(a.rating || 4.95));
  } else if (state.sortBy === 'most_guides') {
    tutors.sort((a, b) => {
      const ca = state.data.resources.filter((r) => r.author_name === a.name).length;
      const cb = state.data.resources.filter((r) => r.author_name === b.name).length;
      return cb - ca;
    });
  }

  const stuId = state.currentUser.role === 'student' ? state.currentUser.id : 'stu-thabo';
  const resources = state.data.resources.filter((r) => {
    if (state.selectedCategory !== 'all' && r.subject_id !== state.selectedCategory) return false;
    if (state.vaultBookmarkedOnly) {
      const prog = state.data.resource_progress.find(
        (rp) => rp.resource_id === r.id && rp.student_id === stuId
      );
      if (!prog?.bookmarked) return false;
    }
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      r.topic.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q)
    );
  });

  return `
    <div class="section-stack">
      <div>
        <h1 class="sh-section-title" style="font-size:2.1rem;margin-bottom:4px;">Find a mentor &amp; study guide</h1>
        <p class="card-subtitle">${tutors.length} verified mentors · ${resources.length} study guides available</p>
      </div>

      <!-- ServeHub Directory Controls Bar -->
      <div class="sh-directory-bar">
        <div style="flex:1;min-width:240px;display:flex;gap:8px;">
          <input id="browse-search-input" type="text" value="${esc(state.searchQuery)}" placeholder="Filter by tutor, topic, formula, or subject…" style="flex:1;padding:9px 14px;border-radius:999px;border:1px solid var(--border-strong);background:var(--bg-canvas);color:var(--ink-primary);" />
          ${state.searchQuery ? `<button class="btn btn-outline btn-sm" data-action="clear-search">Clear</button>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <label style="font-size:0.82rem;font-weight:700;color:var(--ink-secondary);">Sort mentors by:</label>
          <select id="browse-sort-select" style="padding:8px 14px;border-radius:999px;border:1px solid var(--border-strong);background:var(--bg-canvas);color:var(--ink-primary);font-weight:600;font-size:0.83rem;">
            <option value="recommended" ${state.sortBy === 'recommended' ? 'selected' : ''}>Recommended</option>
            <option value="top_rated" ${state.sortBy === 'top_rated' ? 'selected' : ''}>Top rated</option>
            <option value="most_guides" ${state.sortBy === 'most_guides' ? 'selected' : ''}>Most published lessons</option>
          </select>
          <button class="chip ${state.vaultBookmarkedOnly ? 'active' : ''}" data-action="toggle-vault-bookmarks">★ Saved Guides</button>
        </div>
      </div>

      <div class="filter-bar">
        <button class="chip ${state.selectedCategory === 'all' ? 'active' : ''}" data-action="filter-category" data-category="all">All Subjects</button>
        ${state.data.subjects
          .map(
            (s) => `
            <button class="chip ${state.selectedCategory === s.id ? 'active' : ''}" data-action="filter-category" data-category="${s.id}">${esc(s.name)}</button>
          `
          )
          .join('')}
      </div>

      <!-- Verified Mentors Cards (ServeHub Provider Card Layout) -->
      <section>
        <div class="sh-section-head">
          <h2 class="sh-section-title" style="font-size:1.35rem;">Verified i-tutor Mentors</h2>
          ${
            state.currentUser.role === 'tutor'
              ? `<button class="btn btn-gold btn-sm" data-action="open-new-resource-modal">+ Publish Study Guide</button>`
              : `<button class="btn btn-outline btn-sm" data-action="open-help-modal">+ Request 1-on-1 Slot</button>`
          }
        </div>
        <div class="sh-provider-grid">
          ${tutors
            .map((t) => {
              const publishedCount = state.data.resources.filter((r) => r.author_name === t.name).length;
              return `
                <article class="sh-provider-card">
                  <div>
                    <div class="sh-provider-top">
                      <span class="sh-avatar-lg">${esc(initials(t.name))}</span>
                      <div>
                        <h3 class="sh-provider-name">${esc(t.name)}</h3>
                        <div class="sh-provider-role">${esc(t.headline || t.grade)}</div>
                        <div style="font-size:0.77rem;color:var(--ink-muted);margin-top:3px;">
                          ★ ${Number(t.rating || 4.95).toFixed(2)} · 📍 ${esc(t.campus_mode || 'Online & Studio')} · ${publishedCount} guides
                        </div>
                      </div>
                    </div>
                    <p style="font-size:0.86rem;color:var(--ink-secondary);margin:12px 0;">${esc(t.bio)}</p>
                    <div class="sh-tag-row">
                      ${(t.specialties || [t.grade])
                        .slice(0, 4)
                        .map((sp) => `<span class="sh-tag">${esc(sp)}</span>`)
                        .join('')}
                    </div>
                  </div>
                  <div class="sh-provider-actions">
                    <button class="btn btn-gold btn-sm" data-action="open-help-modal">Book 1-on-1</button>
                    <button class="btn btn-outline btn-sm" data-action="message-peer" data-peer-id="${t.id}">Message</button>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      </section>

      <!-- Published Study Vault Listings -->
      <section>
        <div class="sh-section-head">
          <h2 class="sh-section-title" style="font-size:1.35rem;">Published Study Guides &amp; Past-Paper Playbooks</h2>
        </div>
        <div class="grid-2">
          ${
            resources.length === 0
              ? `<div class="card"><p class="card-subtitle">No study guides match your current filter. Try clearing your search.</p></div>`
              : resources
                  .map((res) => {
                    const prog = state.data.resource_progress.find(
                      (rp) => rp.resource_id === res.id && rp.student_id === stuId
                    );
                    return `
                      <article class="card" style="display:flex;flex-direction:column;justify-content:space-between;">
                        <div>
                          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
                            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                              <span class="badge badge-charcoal">${esc(getSubjectName(res.subject_id))}</span>
                              <span class="badge badge-gold">${esc(res.resource_type.replace('_', ' '))}</span>
                              ${prog?.completed ? `<span class="badge badge-emerald">✓ Mastered</span>` : ''}
                            </div>
                            <button class="icon-btn" data-action="toggle-bookmark" data-resource-id="${res.id}">
                              ${prog?.bookmarked ? '★ Saved' : '☆ Save'}
                            </button>
                          </div>
                          <h3 class="card-title">${esc(res.title)}</h3>
                          <p style="font-size:0.8rem;font-weight:700;color:var(--gold-ochre);margin:4px 0 8px;">${esc(res.topic)} · By ${esc(res.author_name)}</p>
                          <p class="card-subtitle">${esc(res.summary)}</p>
                          <div class="formula-chips">
                            ${(res.key_formulas || [])
                              .slice(0, 3)
                              .map((f) => `<span class="formula-chip">${esc(f)}</span>`)
                              .join('')}
                          </div>
                        </div>
                        <div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border-sand);">
                          <button class="btn btn-gold btn-sm" data-action="open-resource" data-resource-id="${res.id}">Open Study Reader</button>
                          <button class="btn btn-outline btn-sm" data-action="coach-topic" data-subject-id="${res.subject_id}" data-topic="${esc(res.topic)}">Practice with AI</button>
                        </div>
                      </article>
                    `;
                  })
                  .join('')
          }
        </div>
      </section>
    </div>
  `;
}

/* ==========================================================================
   3. 24/7 SOCRATIC AI COACH & INTERACTIVE AUTO-GRADED QUIZZES
   ========================================================================== */
function renderCoachAndQuizzesPage() {
  const stuId = state.currentUser.role === 'student' ? state.currentUser.id : 'stu-thabo';
  const activeSubject =
    state.data.subjects.find((s) => s.id === state.coachSubjectId) || state.data.subjects[0];
  const topics = activeSubject?.topics || [];
  const myMessages = state.data.coach_messages.filter((m) => m.student_id === stuId);
  const attempts = state.data.quiz_attempts.filter((a) => a.student_id === stuId);

  return `
    <div class="section-stack">
      <div>
        <h1 class="sh-section-title" style="font-size:2rem;margin-bottom:4px;">24/7 i-tutor AI Coach &amp; Quiz Sprints</h1>
        <p class="card-subtitle">Step-by-step Socratic guidance between classes, paired with instant auto-graded exam quizzes.</p>
      </div>

      <div class="coach-layout">
        <div class="card">
          <h2 class="card-title">Coaching Controls</h2>
          <p class="card-subtitle" style="margin-bottom:14px;">Choose a subject and coaching style — Socratic Hint Mode guides you without spoiling homework answers.</p>

          <div class="form-grid">
            <div class="field">
              <label for="coach-sub-select">Subject</label>
              <select id="coach-sub-select">
                ${state.data.subjects
                  .map((s) => `<option value="${s.id}" ${s.id === activeSubject.id ? 'selected' : ''}>${esc(s.name)}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="field">
              <label for="coach-topic-select">Topic</label>
              <select id="coach-topic-select">
                ${topics
                  .map((t) => `<option value="${esc(t.name)}" ${t.name === state.coachTopic ? 'selected' : ''}>${esc(t.name)}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="field">
              <label for="coach-mode-select">Coaching Mode</label>
              <select id="coach-mode-select">
                <option value="step_by_step" ${state.coachMode === 'step_by_step' ? 'selected' : ''}>Step-by-Step Walkthrough</option>
                <option value="hint_only" ${state.coachMode === 'hint_only' ? 'selected' : ''}>Socratic Hint Only</option>
                <option value="explain_concept" ${state.coachMode === 'explain_concept' ? 'selected' : ''}>Explain Concept Simply</option>
              </select>
            </div>
          </div>

          <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-sand);display:flex;flex-direction:column;gap:8px;">
            <button class="btn btn-gold btn-sm" data-action="quick-coach" data-mode="practice" data-prompt="Generate a practice problem for me">⚡ Generate Practice Problem</button>
            <button class="btn btn-outline btn-sm" data-action="quick-coach" data-prompt="2x^2 - 7x + 3 = 0">Solve: 2x² - 7x + 3 = 0</button>
            <button class="btn btn-outline btn-sm" data-action="quick-coach" data-prompt="How do I prove a Trigonometry LHS = RHS identity?">Trig Proof Checklist</button>
            <button class="btn btn-outline btn-sm" data-action="quick-coach" data-prompt="Explain Newton's Second Law on an inclined plane">Inclined Plane Forces</button>
          </div>
        </div>

        <div class="card coach-chat-card" style="padding:0;overflow:hidden;">
          <div style="padding:18px 20px;border-bottom:1px solid var(--border-sand);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h2 class="card-title">i-tutor Socratic Coach</h2>
              <p class="card-subtitle">${esc(activeSubject?.name)} · ${esc(state.coachTopic || 'Core Mastery')}</p>
            </div>
            <span class="badge badge-gold">${state.coachMode === 'hint_only' ? 'Hint Mode' : 'Step-by-Step'}</span>
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

      <!-- Auto-Graded Quizzes Section -->
      <section class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Auto-Graded Topic Quizzes</h2>
            <p class="card-subtitle">Instant marking, Socratic hints, and worked solutions that update your Sunrise Confidence Meter.</p>
          </div>
          ${
            state.currentUser.role === 'tutor'
              ? `<button class="btn btn-gold btn-sm" data-action="open-new-quiz-modal">+ Create Quiz</button>`
              : ''
          }
        </div>
        <div class="grid-2">
          ${state.data.quizzes
            .map((qz) => {
              const myAttempts = attempts.filter((a) => a.quiz_id === qz.id);
              const best = myAttempts.length ? Math.max(...myAttempts.map((a) => a.score_percent)) : null;
              return `
                <div class="list-row" style="flex-direction:column;justify-content:space-between;">
                  <div style="width:100%;">
                    <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;">
                      <span class="badge badge-charcoal">${esc(getSubjectName(qz.subject_id))}</span>
                      <span class="badge ${best !== null && best >= 80 ? 'badge-emerald' : 'badge-gold'}">
                        ${best !== null ? `Best: ${best}%` : `${qz.questions.length} Qs · ${qz.time_limit_mins} min`}
                      </span>
                    </div>
                    <h4 style="margin:4px 0;">${esc(qz.title)}</h4>
                    <p>${esc(qz.description)}</p>
                  </div>
                  <div style="margin-top:12px;">
                    <button class="btn btn-gold btn-sm" data-action="start-quiz" data-quiz-id="${qz.id}">
                      ${best !== null ? 'Retake Quiz Sprint' : 'Start Quiz Sprint'}
                    </button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </section>
    </div>
  `;
}

/* ==========================================================================
   4. ROLE DASHBOARDS (STUDENT / TUTOR / PARENT)
   ========================================================================== */
function renderRoleDashboardPage() {
  const role = state.currentUser.role;
  if (role === 'tutor') return renderTutorDashboard();
  if (role === 'parent') return renderParentDashboard();
  return renderStudentDashboard();
}

function renderStudentDashboard() {
  const stu = state.currentUser;
  const analytics = state.data.analytics_by_student[stu.id];
  const submissions = state.data.submissions.filter((s) => s.student_id === stu.id);
  const sessions = state.data.sessions.filter(
    (s) => !s.target_student_id || s.target_student_id === stu.id
  );

  return `
    <div class="section-stack">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;">
        <div>
          <span class="badge badge-gold">Student Dashboard · ${esc(stu.grade)}</span>
          <h1 class="sh-section-title" style="font-size:2rem;margin-top:6px;">${esc(stu.name)}’s Learning Hub</h1>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn ${stu.confidence_mood === 'stuck' ? 'btn-gold' : 'btn-outline'} btn-sm" data-action="set-mood" data-mood="stuck">Mood: Stuck</button>
          <button class="btn ${stu.confidence_mood === 'building' ? 'btn-gold' : 'btn-outline'} btn-sm" data-action="set-mood" data-mood="building">Mood: Building</button>
          <button class="btn ${stu.confidence_mood === 'confident' ? 'btn-gold' : 'btn-outline'} btn-sm" data-action="set-mood" data-mood="confident">Mood: Exam-Ready</button>
        </div>
      </div>

      <section class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Sunrise Confidence</div>
          <div class="stat-value">${analytics.overall_confidence}%</div>
          <div class="stat-sub">${esc(analytics.label)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Attendance Rate</div>
          <div class="stat-value">${analytics.attendance_rate}%</div>
          <div class="stat-sub">${stu.streak_days || 1}-day learning streak</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Quiz Mastery Avg</div>
          <div class="stat-value">${analytics.quiz_average}%</div>
          <div class="stat-sub">${analytics.quizzes_completed} sprints completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Topics Mastered</div>
          <div class="stat-value">${analytics.mastered_topics_count} / ${analytics.total_topics_count}</div>
          <div class="stat-sub">${analytics.homework_pending_count} homework pending</div>
        </div>
      </section>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Weak-Spot Radar</h2>
              <p class="card-subtitle">Priority topics under 76% confidence.</p>
            </div>
          </div>
          <div class="item-list">
            ${analytics.weak_spots
              .map(
                (w) => `
                <div class="list-row" style="flex-direction:column;">
                  <div style="display:flex;justify-content:space-between;width:100%;">
                    <span class="badge badge-charcoal">${esc(w.subject_name)}</span>
                    <span class="badge ${w.confidence_score < 58 ? 'badge-coral' : 'badge-gold'}">${w.confidence_score}%</span>
                  </div>
                  <h4 style="margin:6px 0 2px;">${esc(w.name)}</h4>
                  <div class="conf-bar-track"><div class="conf-bar-fill ${w.tier}" style="width:${w.confidence_score}%"></div></div>
                  <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                    ${w.recommended_quiz_id ? `<button class="btn btn-gold btn-sm" data-action="start-quiz" data-quiz-id="${w.recommended_quiz_id}">Take Quiz</button>` : ''}
                    ${w.recommended_resource_id ? `<button class="btn btn-outline btn-sm" data-action="open-resource" data-resource-id="${w.recommended_resource_id}">Read Notes</button>` : ''}
                    <button class="btn btn-outline btn-sm" data-action="coach-topic" data-subject-id="${w.subject_id}" data-topic="${esc(w.name)}">AI Coach</button>
                  </div>
                </div>
              `
              )
              .join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Class Timetable &amp; Lesson Recaps</h2>
              <p class="card-subtitle">Upcoming classes and tutor key takeaways.</p>
            </div>
            <button class="btn btn-gold btn-sm" data-action="open-help-modal">+ Book 1-on-1</button>
          </div>
          <div class="item-list">
            ${sessions
              .slice(0, 5)
              .map(
                (s) => `
                <div class="list-row" style="flex-direction:column;">
                  <div style="display:flex;justify-content:space-between;width:100%;">
                    <span class="badge badge-charcoal">${esc(getSubjectName(s.subject_id))}</span>
                    <span class="badge ${s.status === 'completed' ? 'badge-emerald' : 'badge-gold'}">${esc(s.status === 'completed' ? 'Completed' : formatRelative(s.scheduled_at))}</span>
                  </div>
                  <h4 style="margin:6px 0 2px;">${esc(s.title)}</h4>
                  <p>${esc(formatDateTime(s.scheduled_at))} · 📍 ${esc(s.location_or_link)}</p>
                  ${s.lesson_recap ? `<p style="margin-top:6px;font-size:0.81rem;"><strong>Recap:</strong> ${esc(s.lesson_recap)}</p>` : ''}
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Homework &amp; Tutor Feedback</h2>
            <p class="card-subtitle">Submit worked steps and review marks &amp; encouragement from your mentors.</p>
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
                      <div style="display:flex;gap:6px;margin-bottom:4px;">
                        <span class="badge badge-charcoal">${esc(getSubjectName(asg.subject_id))}</span>
                        ${
                          sub?.status === 'graded'
                            ? `<span class="badge badge-emerald">Graded: ${sub.marks_awarded}/${asg.max_marks}</span>`
                            : sub
                              ? `<span class="badge badge-gold">Submitted</span>`
                              : `<span class="badge badge-coral">Due ${esc(formatDateTime(asg.due_at))}</span>`
                        }
                      </div>
                      <h4>${esc(asg.title)}</h4>
                      <p style="white-space:pre-line;">${esc(asg.instructions)}</p>
                    </div>
                    <button class="btn ${sub ? 'btn-outline' : 'btn-gold'} btn-sm" data-action="open-homework-modal" data-assignment-id="${asg.id}">
                      ${sub ? 'Edit Submission' : 'Submit Work'}
                    </button>
                  </div>
                  ${
                    sub?.tutor_feedback
                      ? `<div style="width:100%;margin-top:8px;padding:10px 14px;border-radius:10px;background:var(--emerald-soft);font-size:0.84rem;"><strong>Tutor Feedback:</strong> ${esc(sub.tutor_feedback)}</div>`
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

function renderTutorDashboard() {
  const students = state.data.users.filter((u) => u.role === 'student');
  const pendingHelp = state.data.help_requests.filter((r) => r.status === 'pending');

  return `
    <div class="section-stack">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;">
        <div>
          <span class="badge badge-gold">Tutor Studio · ${esc(state.currentUser.grade)}</span>
          <h1 class="sh-section-title" style="font-size:2rem;margin-top:6px;">Welcome, ${esc(state.currentUser.name)}</h1>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-gold btn-sm" data-action="open-new-session-modal">+ Schedule Class</button>
          <button class="btn btn-charcoal btn-sm" data-action="open-new-resource-modal">+ Publish Study Guide</button>
          <button class="btn btn-outline btn-sm" data-action="open-new-quiz-modal">+ New Quiz</button>
          <button class="btn btn-outline btn-sm" data-action="open-new-assignment-modal">+ Assign Homework</button>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Learner Confidence Roster</h2>
              <p class="card-subtitle">Real-time Sunrise Confidence &amp; top weak spot per student.</p>
            </div>
          </div>
          <div class="item-list">
            ${students
              .map((stu) => {
                const a = state.data.analytics_by_student[stu.id];
                return `
                  <div class="list-row" style="flex-direction:column;">
                    <div style="width:100%;display:flex;justify-content:space-between;align-items:center;">
                      <div>
                        <strong>${esc(stu.name)}</strong> <span class="badge badge-charcoal">${esc(stu.grade)}</span>
                        <p style="font-size:0.79rem;margin-top:2px;">Attendance: ${a?.attendance_rate ?? 92}% · Quiz Avg: ${a?.quiz_average ?? 75}%</p>
                      </div>
                      <strong style="font-size:1.3rem;color:var(--gold-ochre);">${a?.overall_confidence ?? 75}%</strong>
                    </div>
                    <div class="conf-bar-track"><div class="conf-bar-fill ${a?.tier || 'building'}" style="width:${a?.overall_confidence ?? 75}%"></div></div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Student Study Requests (${pendingHelp.length} open)</h2>
              <p class="card-subtitle">1-click approve to schedule a 1-on-1 session.</p>
            </div>
          </div>
          <div class="item-list">
            ${state.data.help_requests
              .map((req) => {
                const stu = state.data.users.find((u) => u.id === req.student_id);
                return `
                  <div class="list-row" style="flex-direction:column;">
                    <div style="display:flex;justify-content:space-between;width:100%;">
                      <strong>${esc(stu?.name || 'Learner')} · ${esc(getSubjectName(req.subject_id))}</strong>
                      <span class="badge ${req.status === 'scheduled' ? 'badge-emerald' : 'badge-coral'}">${esc(req.status)}</span>
                    </div>
                    <p style="margin:4px 0;"><strong>${esc(req.topic)}</strong> — "${esc(req.notes)}" (${esc(req.preferred_slot)})</p>
                    ${
                      req.status === 'pending'
                        ? `<button class="btn btn-gold btn-sm" data-action="approve-help-request" data-request-id="${req.id}">✓ Approve &amp; Schedule 1-on-1</button>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>

      <!-- 1-Tap Attendance & Recaps -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">1-Tap Attendance &amp; Lesson Recaps</h2>
            <p class="card-subtitle">Mark Present / Late / Absent and publish post-class takeaways.</p>
          </div>
        </div>
        <div class="item-list">
          ${state.data.sessions
            .slice(0, 4)
            .map((ses) => {
              const targetStudents = ses.target_student_id
                ? students.filter((s) => s.id === ses.target_student_id)
                : students;
              return `
                <div class="list-row" style="flex-direction:column;">
                  <div style="width:100%;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <div>
                      <span class="badge badge-charcoal">${esc(getSubjectName(ses.subject_id))}</span>
                      <strong style="margin-left:6px;">${esc(ses.title)}</strong>
                      <span style="font-size:0.8rem;color:var(--ink-muted);margin-left:8px;">${esc(formatDateTime(ses.scheduled_at))}</span>
                    </div>
                    <button class="btn btn-outline btn-sm" data-action="open-recap-modal" data-session-id="${ses.id}">
                      ${ses.lesson_recap ? 'Edit Recap' : '+ Post Recap'}
                    </button>
                  </div>
                  <div style="width:100%;margin-top:10px;display:flex;flex-direction:column;gap:6px;">
                    ${targetStudents
                      .map((stu) => {
                        const att = state.data.attendance.find(
                          (a) => a.session_id === ses.id && a.student_id === stu.id
                        );
                        return `
                          <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-size:0.85rem;">${esc(stu.name)}</span>
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
              `;
            })
            .join('')}
        </div>
      </div>

      <!-- Homework Grading Queue -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Homework Submissions Queue</h2>
            <p class="card-subtitle">Grade student answers and share written encouragement.</p>
          </div>
        </div>
        <div class="item-list">
          ${state.data.submissions
            .map((sub) => {
              const stu = state.data.users.find((u) => u.id === sub.student_id);
              const asg = state.data.assignments.find((a) => a.id === sub.assignment_id);
              return `
                <div class="list-row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;">
                  <div style="flex:1;min-width:240px;">
                    <strong>${esc(stu?.name || 'Student')}</strong> · <span class="badge badge-charcoal">${esc(asg?.title || 'Task')}</span>
                    <p style="margin:4px 0 0;font-size:0.84rem;">${esc(sub.answer_text.slice(0, 140))}${sub.answer_text.length > 140 ? '…' : ''}</p>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="badge ${sub.status === 'graded' ? 'badge-emerald' : 'badge-coral'}">
                      ${sub.status === 'graded' ? `${sub.marks_awarded}/${asg?.max_marks || 20}` : 'Pending Grade'}
                    </span>
                    <button class="btn btn-gold btn-sm" data-action="open-grade-modal" data-submission-id="${sub.id}">Grade</button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderParentDashboard() {
  const students = state.data.users.filter((u) => u.role === 'student');
  const child =
    students.find((s) => s.id === state.selectedChildId) ||
    students.find((s) => s.id === state.currentUser.linked_student_id) ||
    students[0];
  const analytics = state.data.analytics_by_student[child.id];
  const childAtt = state.data.attendance.filter((a) => a.student_id === child.id);
  const childSubs = state.data.submissions.filter((s) => s.student_id === child.id);

  return `
    <div class="section-stack">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;">
        <div>
          <span class="badge badge-gold">Parent Peace-of-Mind Dashboard</span>
          <h1 class="sh-section-title" style="font-size:2rem;margin-top:6px;">${esc(child.name)}’s Academic Progress</h1>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <select id="parent-child-switcher" style="padding:9px 14px;border-radius:999px;border:1px solid var(--border-strong);background:var(--bg-card);color:var(--ink-primary);font-weight:700;">
            ${students.map((s) => `<option value="${s.id}" ${s.id === child.id ? 'selected' : ''}>Learner: ${esc(s.name)} (${esc(s.grade)})</option>`).join('')}
          </select>
          <button class="btn btn-gold btn-sm" data-action="message-peer" data-peer-id="tut-naledi">Message Tutor</button>
        </div>
      </div>

      <section class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Overall Confidence</div>
          <div class="stat-value">${analytics.overall_confidence}%</div>
          <div class="stat-sub">${esc(analytics.label)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Attendance Rate</div>
          <div class="stat-value">${analytics.attendance_rate}%</div>
          <div class="stat-sub">Verified studio register</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Quiz Accuracy</div>
          <div class="stat-value">${analytics.quiz_average}%</div>
          <div class="stat-sub">${analytics.quizzes_completed} auto-graded quizzes</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Graded Homework</div>
          <div class="stat-value">${analytics.homework_average}%</div>
          <div class="stat-sub">${analytics.homework_submitted} tasks submitted</div>
        </div>
      </section>

      <div class="grid-2">
        <div class="card">
          <h2 class="card-title" style="margin-bottom:12px;">Subject Confidence Breakdown</h2>
          <div class="item-list">
            ${analytics.subjects
              .map(
                (s) => `
                <div class="list-row" style="flex-direction:column;">
                  <div style="display:flex;justify-content:space-between;width:100%;">
                    <strong>${esc(s.subject_name)}</strong>
                    <span class="badge ${s.tier === 'exam_ready' ? 'badge-emerald' : s.tier === 'building' ? 'badge-gold' : 'badge-coral'}">${s.confidence_score}% · ${esc(s.label)}</span>
                  </div>
                  <div class="conf-bar-track"><div class="conf-bar-fill ${s.tier}" style="width:${s.confidence_score}%"></div></div>
                </div>
              `
              )
              .join('')}
          </div>
        </div>

        <div class="card">
          <h2 class="card-title" style="margin-bottom:12px;">Verified Attendance &amp; Tutor Feedback</h2>
          <div class="item-list">
            ${childAtt
              .map((att) => {
                const ses = state.data.sessions.find((s) => s.id === att.session_id);
                if (!ses) return '';
                return `
                  <div class="list-row" style="justify-content:space-between;align-items:center;">
                    <div>
                      <h4 style="margin:0;">${esc(ses.title)}</h4>
                      <p style="font-size:0.8rem;">${esc(att.note || ses.lesson_recap || 'Participated well.')}</p>
                    </div>
                    <span class="badge ${att.status === 'present' ? 'badge-emerald' : att.status === 'late' ? 'badge-gold' : 'badge-coral'}">${esc(att.status.toUpperCase())}</span>
                  </div>
                `;
              })
              .join('')}
            ${childSubs
              .filter((s) => s.tutor_feedback)
              .map((sub) => {
                const asg = state.data.assignments.find((a) => a.id === sub.assignment_id);
                return `
                  <div class="list-row" style="flex-direction:column;background:var(--emerald-soft);">
                    <strong>Homework Feedback · ${esc(asg?.title || '')} (${sub.marks_awarded}/${asg?.max_marks || 20})</strong>
                    <p style="margin-top:4px;">"${esc(sub.tutor_feedback)}"</p>
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

/* ==========================================================================
   5. SERVEHUB 2-PANE DIRECT MESSENGER (/messages)
   ========================================================================== */
function renderMessagesPage() {
  const me = state.currentUser;
  const peers = state.data.users.filter((u) => u.id !== me.id);
  const activePeer = peers.find((p) => p.id === state.activePeerId) || peers[0];

  const thread = state.data.messages.filter((m) => {
    if (m.recipient_id) {
      return (
        (m.sender_id === me.id && m.recipient_id === activePeer.id) ||
        (m.sender_id === activePeer.id && m.recipient_id === me.id)
      );
    }
    // Include seeded student/parent/tutor thread messages seamlessly
    const involvesMe = m.sender_id === me.id || (me.role === 'tutor' && m.sender_role !== 'tutor') || (me.role !== 'tutor' && m.sender_role === 'tutor');
    const involvesPeer = m.sender_id === activePeer.id || (activePeer.id === 'tut-naledi' && m.sender_role !== 'tutor');
    return involvesMe && involvesPeer;
  });

  return `
    <div class="section-stack">
      <div>
        <h1 class="sh-section-title" style="font-size:2rem;margin-bottom:4px;">Messages</h1>
        <p class="card-subtitle">Direct conversations with i-tutor mentors, students, and parents.</p>
      </div>

      <div class="sh-messenger">
        <aside class="sh-peer-list">
          <div style="padding:14px 16px;font-size:0.75rem;font-weight:800;text-transform:uppercase;color:var(--ink-muted);border-bottom:1px solid var(--border-sand);">
            Directory Conversations
          </div>
          ${peers
            .map(
              (p) => `
              <button class="sh-peer-item ${p.id === activePeer.id ? 'active' : ''}" data-action="select-peer" data-peer-id="${p.id}">
                <span class="avatar-circle">${esc(initials(p.name))}</span>
                <div style="min-width:0;">
                  <div style="font-weight:700;font-size:0.88rem;">${esc(p.name)}</div>
                  <div style="font-size:0.74rem;color:var(--gold-ochre);font-weight:600;">${esc(p.role.toUpperCase())} · ${esc(p.grade || '')}</div>
                </div>
              </button>
            `
            )
            .join('')}
        </aside>

        <div style="display:flex;flex-direction:column;justify-content:space-between;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border-sand);display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="avatar-circle">${esc(initials(activePeer.name))}</span>
              <div>
                <strong>${esc(activePeer.name)}</strong>
                <div style="font-size:0.76rem;color:var(--ink-muted);">${esc(activePeer.headline || activePeer.grade || activePeer.role)}</div>
              </div>
            </div>
            ${
              activePeer.role === 'tutor'
                ? `<button class="btn btn-outline btn-sm" data-action="open-help-modal">Book 1-on-1</button>`
                : ''
            }
          </div>

          <div class="coach-feed" style="min-height:360px;">
            ${
              thread.length === 0
                ? `<p class="card-subtitle" style="margin:auto;text-align:center;">Say hello to ${esc(activePeer.name)} to start your conversation.</p>`
                : thread
                    .map(
                      (m) => `
                    <div class="coach-bubble ${m.sender_id === me.id ? 'student' : 'coach'}">
                      <div style="font-size:0.72rem;font-weight:800;opacity:0.75;margin-bottom:3px;">${esc(m.sender_name)} · ${esc(formatRelative(m.created_at))}</div>
                      <div>${esc(m.body)}</div>
                    </div>
                  `
                    )
                    .join('')
            }
          </div>

          <form id="direct-msg-form" data-peer-id="${activePeer.id}" data-peer-name="${esc(activePeer.name)}" class="coach-composer">
            <input id="direct-msg-input" type="text" placeholder="Message ${esc(activePeer.name)}…" required />
            <button type="submit" class="btn btn-gold">Send</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   6. SERVEHUB "/about", "/contact", AND SPLIT "/login + /signup" PAGES
   ========================================================================== */
function renderAboutPage() {
  return `
    <div class="section-stack">
      <section class="sh-hero" style="text-align:left;display:grid;grid-template-columns:1.15fr 0.85fr;gap:28px;align-items:center;">
        <div>
          <div class="sh-hero-badge">About i-tutor</div>
          <h1 style="margin:0 0 14px;max-width:none;font-size:clamp(1.9rem,3.4vw,2.7rem);">Empowering every learner with <em>confidence in learning</em>.</h1>
          <p style="margin:0 0 20px;">i-tutor is the academic hub where dedicated educators, motivated learners, and supportive parents unite around calm, step-by-step mastery.</p>
          <button class="btn btn-gold" data-action="nav-page" data-page="browse">Explore our mentors</button>
        </div>
        <div>
          <img src="/assets/itutor-logo.jpg" alt="i-tutor Confidence in learning wall emblem" style="width:100%;max-height:300px;object-fit:cover;border-radius:20px;border:1px solid rgba(242,183,40,0.35);" />
        </div>
      </section>

      <section>
        <div class="sh-section-head">
          <h2 class="sh-section-title">The pillars we stand on</h2>
        </div>
        <div class="sh-steps-grid">
          <div class="sh-step-card">
            <div class="sh-step-num">✦</div>
            <h3>Confidence by Design</h3>
            <p>Marks follow confidence. Our Sunrise Mastery Engine celebrates growth per topic so learners see exactly how far they’ve come.</p>
          </div>
          <div class="sh-step-card">
            <div class="sh-step-num">✦</div>
            <h3>Step-by-Step Clarity</h3>
            <p>Whether in live classes, Study Vault guides, or our 24/7 Socratic AI Coach, we teach repeatable reasoning — never shortcuts.</p>
          </div>
          <div class="sh-step-card">
            <div class="sh-step-num">✦</div>
            <h3>Connected Accountability</h3>
            <p>Students, tutors, and parents stay effortlessly aligned through 1-tap attendance, lesson recaps, and direct messaging.</p>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderContactPage() {
  return `
    <div class="section-stack">
      <div>
        <h1 class="sh-section-title" style="font-size:2.1rem;margin-bottom:4px;">Get in touch</h1>
        <p class="card-subtitle">Whether you have a question about subjects, 1-on-1 mentoring, or joining our educator team, we’re here to help.</p>
      </div>

      <div class="grid-2">
        <div class="card">
          <h2 class="card-title" style="margin-bottom:14px;">Academic Support Desk</h2>
          <div class="item-list">
            <div class="list-row">
              <div class="list-row-main">
                <h4>Academic Coordinator</h4>
                <p>support@itutor.academy · Main i-tutor Studio Campus</p>
              </div>
            </div>
            <div class="list-row">
              <div class="list-row-main">
                <h4>Tuition &amp; Study Hours</h4>
                <p>Monday – Friday: 08:00 – 20:00 · Saturday Past-Paper Clinics: 09:00 – 14:00</p>
              </div>
            </div>
            <div class="list-row">
              <div class="list-row-main">
                <h4>Frequently Asked Questions</h4>
                <p><strong>How quickly do mentors respond to study requests?</strong> Most requests receive a tutor response or 1-on-1 slot confirmation the same day, and our Socratic AI Coach is available 24/7.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title" style="margin-bottom:14px;">Send us a message</h2>
          <form id="contact-support-form" class="form-grid">
            <div class="form-row-2">
              <div class="field"><label>Full Name</label><input name="name" value="${esc(state.currentUser.name)}" required /></div>
              <div class="field"><label>Email Address</label><input name="email" type="email" value="${esc(state.currentUser.email)}" required /></div>
            </div>
            <div class="field">
              <label>Topic</label>
              <select name="subject">
                <option>Subject &amp; Curriculum Inquiry</option>
                <option>1-on-1 Mentoring Support</option>
                <option>Become an i-tutor Educator</option>
                <option>Technical Feedback</option>
              </select>
            </div>
            <div class="field">
              <label>Message</label>
              <textarea name="body" rows="4" placeholder="How can the i-tutor team support your learning?" required></textarea>
            </div>
            <button type="submit" class="btn btn-gold">Send Message</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

function renderAuthPage() {
  const students = state.data.users.filter((u) => u.role === 'student');

  return `
    <div class="sh-auth-split">
      <div class="sh-auth-visual">
        <div>
          <span class="sh-hero-badge">i-tutor · Confidence in Learning</span>
          <h2 style="font-family:var(--font-display);font-size:1.95rem;margin:8px 0 10px;color:#FFFDF8;">
            Connect with dedicated educators or guide learners to distinction.
          </h2>
          <p style="color:#D6CFC1;font-size:0.92rem;margin:0;">
            Switch instantly between demo accounts below or create your own Student, Tutor, or Parent profile.
          </p>
        </div>

        <img src="/assets/itutor-logo.jpg" alt="i-tutor Confidence in learning" />

        <div>
          <div style="font-size:0.74rem;font-weight:800;text-transform:uppercase;color:#FAD463;margin-bottom:8px;">1-Tap Demo Accounts</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${state.data.users
              .slice(0, 5)
              .map(
                (u) => `
                <button class="btn ${u.id === state.currentUser.id ? 'btn-gold' : 'btn-ghost-light'} btn-sm" data-action="switch-user-id" data-user-id="${u.id}">
                  ${esc(u.name.split(' ')[0])} (${esc(u.role)})
                </button>
              `
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="sh-auth-form-pane">
        <div style="display:flex;gap:8px;margin-bottom:20px;">
          <button class="chip ${state.authMode === 'signup' ? 'active' : ''}" data-action="set-auth-mode" data-mode="signup">Create an account</button>
          <button class="chip ${state.authMode === 'login' ? 'active' : ''}" data-action="set-auth-mode" data-mode="login">Welcome back (Log in)</button>
        </div>

        ${
          state.authMode === 'login'
            ? `
            <h1 class="sh-section-title" style="margin-bottom:4px;">Welcome back</h1>
            <p class="card-subtitle" style="margin-bottom:18px;">Log in to manage your classes, quizzes, and confidence progress.</p>
            <form id="login-user-form" class="form-grid">
              <div class="field">
                <label>Email Address</label>
                <input name="email" type="email" value="thabo@itutor.academy" required />
              </div>
              <div class="field">
                <label>Password</label>
                <input name="password" type="password" value="itutor123" required />
              </div>
              <button type="submit" class="btn btn-gold">Log in</button>
            </form>
          `
            : `
            <h1 class="sh-section-title" style="margin-bottom:4px;">Create an account</h1>
            <p class="card-subtitle" style="margin-bottom:14px;">Join our community of learners, educators, and parents.</p>

            <div style="font-size:0.8rem;font-weight:700;color:var(--ink-secondary);margin-bottom:6px;">I want to join as a</div>
            <div class="sh-join-toggle">
              <button type="button" class="sh-join-pill ${state.signupRole === 'student' ? 'active' : ''}" data-action="set-signup-role" data-role="student">Student</button>
              <button type="button" class="sh-join-pill ${state.signupRole === 'tutor' ? 'active' : ''}" data-action="set-signup-role" data-role="tutor">Tutor</button>
              <button type="button" class="sh-join-pill ${state.signupRole === 'parent' ? 'active' : ''}" data-action="set-signup-role" data-role="parent">Parent</button>
            </div>

            <form id="register-user-form" class="form-grid">
              <input type="hidden" name="role" value="${esc(state.signupRole)}" />
              <div class="field">
                <label>Full name</label>
                <input name="name" placeholder="e.g. Lerato Nkosi" required />
              </div>
              <div class="field">
                <label>Email Address</label>
                <input name="email" type="email" placeholder="lerato@itutor.academy" required />
              </div>
              <div class="form-row-2">
                <div class="field">
                  <label>${state.signupRole === 'tutor' ? 'Subject Specialty' : 'Grade Level'}</label>
                  <input name="grade" placeholder="${state.signupRole === 'tutor' ? 'Mathematics & Physics' : 'Grade 11'}" required />
                </div>
                <div class="field">
                  <label>Password</label>
                  <input name="password" type="password" value="itutor123" required />
                </div>
              </div>
              ${
                state.signupRole === 'parent'
                  ? `<div class="field">
                      <label>Link to Child Profile</label>
                      <select name="linked_student_id">
                        ${students.map((s) => `<option value="${s.id}">${esc(s.name)} (${esc(s.grade)})</option>`).join('')}
                      </select>
                    </div>`
                  : ''
              }
              <button type="submit" class="btn btn-gold">Create Account</button>
            </form>
          `
        }
      </div>
    </div>
  `;
}

/* ==========================================================================
   MODALS (STUDY READER, QUIZ RUNNER, HOMEWORK, TUTOR CREATORS)
   ========================================================================== */
function openModal(innerHtml) {
  const modalRoot = document.getElementById('modal-root');
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="backdrop-close">
      <div class="modal-panel" role="dialog" aria-modal="true">${innerHtml}</div>
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
        <p class="card-subtitle">By ${esc(res.author_name)} · ${esc(res.difficulty)}</p>
      </div>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>

    ${
      (res.key_formulas || []).length
        ? `<div class="formula-chips">${res.key_formulas.map((f) => `<span class="formula-chip">${esc(f)}</span>`).join('')}</div>`
        : ''
    }

    <div style="padding:16px 18px;border-radius:14px;background:var(--bg-canvas);border:1px solid var(--border-sand);margin-top:10px;">
      ${renderFormattedText(res.content_body)}
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:18px;">
      <button class="btn btn-outline btn-sm" data-action="coach-topic" data-subject-id="${res.subject_id}" data-topic="${esc(res.topic)}">Ask AI Coach</button>
      <button class="btn ${prog?.completed ? 'btn-outline' : 'btn-gold'}" data-action="toggle-complete-resource" data-resource-id="${res.id}">
        ${prog?.completed ? '✓ Marked Mastered' : '✓ Mark Study Guide Mastered'}
      </button>
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
    const el = document.getElementById('quiz-timer-readout');
    if (el) {
      const m = Math.floor(state.quizRunner.remainingSecs / 60);
      const s = String(state.quizRunner.remainingSecs % 60).padStart(2, '0');
      el.textContent = `⏱ ${m}:${s}`;
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
          <span class="badge badge-gold">Auto-Graded Result</span>
          <h2 class="card-title" style="margin-top:4px;">${esc(quiz.title)}</h2>
        </div>
        <button class="icon-btn" data-action="close-modal">✕ Done</button>
      </div>
      <div style="margin-bottom:16px;">
        ${renderSunriseGauge(result.attempt.score_percent, `${result.attempt.correct_count}/${result.attempt.total_count} Correct`)}
      </div>
      <div class="item-list">
        ${result.review
          .map(
            (r, idx) => `
            <div class="list-row" style="flex-direction:column;">
              <div style="display:flex;justify-content:space-between;width:100%;">
                <strong>Question ${idx + 1}</strong>
                <span class="badge ${r.is_correct ? 'badge-emerald' : 'badge-coral'}">${r.is_correct ? '✓ Correct' : 'Review Step'}</span>
              </div>
              <p style="margin:6px 0;font-weight:600;">${esc(r.prompt)}</p>
              <div style="padding:8px 12px;border-radius:8px;background:var(--gold-sun-soft);font-size:0.83rem;width:100%;">
                <strong>Worked Solution:</strong> ${esc(r.explanation)}
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
        <span id="quiz-timer-readout" class="badge badge-gold">⏱ ${m}:${s}</span>
        <h2 class="card-title" style="margin-top:4px;">${esc(quiz.title)}</h2>
      </div>
      <button class="icon-btn" data-action="close-modal">✕ Exit</button>
    </div>
    <div class="item-list">
      ${quiz.questions
        .map(
          (q, qIdx) => `
          <div class="list-row" style="flex-direction:column;">
            <div style="display:flex;justify-content:space-between;width:100%;">
              <span style="font-size:0.76rem;font-weight:800;color:var(--gold-ochre);">QUESTION ${qIdx + 1}</span>
              ${q.hint ? `<button type="button" class="btn btn-outline btn-sm" data-action="toggle-quiz-hint" data-qidx="${qIdx}">💡 Hint</button>` : ''}
            </div>
            <h4 style="margin:6px 0;">${esc(q.prompt)}</h4>
            ${revealedHints[qIdx] ? `<div style="padding:8px 12px;background:var(--gold-sun-soft);border-radius:8px;font-size:0.82rem;width:100%;">${esc(q.hint)}</div>` : ''}
            <div style="width:100%;">
              ${q.options
                .map(
                  (opt, oIdx) => `
                  <button type="button" class="quiz-option ${answers[qIdx] === oIdx ? 'selected' : ''}" data-action="select-quiz-opt" data-qidx="${qIdx}" data-oidx="${oIdx}">
                    <span class="quiz-option-letter">${letters[oIdx]}</span>
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
    <div style="margin-top:16px;display:flex;justify-content:flex-end;">
      <button type="button" class="btn btn-gold" data-action="submit-quiz">Submit &amp; Grade Instantly</button>
    </div>
  `);
}

function openHomeworkModal(assignmentId) {
  const asg = state.data.assignments.find((a) => a.id === assignmentId);
  if (!asg) return;
  const stuId = state.currentUser.role === 'student' ? state.currentUser.id : 'stu-thabo';
  const sub = state.data.submissions.find(
    (s) => s.assignment_id === assignmentId && s.student_id === stuId
  );

  openModal(`
    <div class="modal-header">
      <h2 class="card-title">${esc(asg.title)}</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <p style="white-space:pre-line;padding:12px;background:var(--bg-canvas);border-radius:10px;border:1px solid var(--border-sand);font-size:0.86rem;">${esc(asg.instructions)}</p>
    <form id="homework-submit-form" data-assignment-id="${asg.id}" class="form-grid" style="margin-top:12px;">
      <div class="field">
        <label>Your Worked Solution</label>
        <textarea name="answer_text" rows="5" required placeholder="Show every step clearly…">${esc(sub?.answer_text || '')}</textarea>
      </div>
      <div class="field">
        <label>How confident did this feel?</label>
        <select name="student_confidence">
          <option value="confident">Confident</option>
          <option value="building" selected>Building Confidence</option>
          <option value="stuck">Need Tutor Review</option>
        </select>
      </div>
      <button type="submit" class="btn btn-gold">Submit Homework</button>
    </form>
  `);
}

function openHelpModal() {
  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Book a 1-on-1 Focus Session</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="help-request-form" class="form-grid">
      <div class="field">
        <label>Subject</label>
        <select name="subject_id">
          ${state.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Topic</label><input name="topic" placeholder="e.g. Trig Identities or Inclined Planes" required /></div>
      <div class="field"><label>Preferred Time &amp; Mode</label><input name="preferred_slot" placeholder="e.g. Thursday 16:00 Online" required /></div>
      <div class="field"><label>What would you like to cover?</label><textarea name="notes" rows="3" placeholder="Share any specific past-paper or homework questions…"></textarea></div>
      <button type="submit" class="btn btn-gold">Post Request</button>
    </form>
  `);
}

function openNewSessionModal() {
  const students = state.data.users.filter((u) => u.role === 'student');
  const tomorrowIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);
  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Schedule Class Session</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="new-session-form" class="form-grid">
      <div class="form-row-2">
        <div class="field">
          <label>Subject</label>
          <select name="subject_id">${state.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Type</label>
          <select name="session_type"><option value="group">Group Class</option><option value="one_on_one">1-on-1 Session</option></select>
        </div>
      </div>
      <div class="field"><label>Lesson Title</label><input name="title" required placeholder="e.g. Parabola Turning Points Clinic" /></div>
      <div class="form-row-2">
        <div class="field"><label>Topic</label><input name="topic" required placeholder="Functions & Parabolas" /></div>
        <div class="field"><label>Date &amp; Time</label><input name="scheduled_at" type="datetime-local" value="${tomorrowIso}" required /></div>
      </div>
      <div class="form-row-2">
        <div class="field"><label>Mode</label><select name="mode"><option value="in_person">In-Person</option><option value="online">Online</option></select></div>
        <div class="field">
          <label>Learner (Optional)</label>
          <select name="target_student_id"><option value="">All Learners</option>${students.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field"><label>Location / Link</label><input name="location_or_link" value="Studio Room A · Main i-tutor Campus" required /></div>
      <button type="submit" class="btn btn-gold">Schedule Session</button>
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
      <div class="field"><label>Status</label><select name="status"><option value="completed">Completed</option><option value="upcoming">Upcoming</option></select></div>
      <div class="field"><label>Lesson Summary</label><textarea name="lesson_recap" rows="3" required>${esc(ses.lesson_recap || '')}</textarea></div>
      <div class="field"><label>Key Takeaways (one per line)</label><textarea name="key_takeaways" rows="3">${esc((ses.key_takeaways || []).join('\n'))}</textarea></div>
      <button type="submit" class="btn btn-gold">Publish Recap</button>
    </form>
  `);
}

function openGradeModal(submissionId) {
  const sub = state.data.submissions.find((s) => s.id === submissionId);
  if (!sub) return;
  const asg = state.data.assignments.find((a) => a.id === sub.assignment_id);
  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Grade Submission</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <div style="padding:12px;background:var(--bg-canvas);border-radius:10px;border:1px solid var(--border-sand);white-space:pre-line;font-size:0.85rem;margin-bottom:12px;">${esc(sub.answer_text)}</div>
    <form id="grade-submission-form" data-submission-id="${sub.id}" class="form-grid">
      <div class="field"><label>Marks (out of ${asg?.max_marks || 20})</label><input name="marks_awarded" type="number" value="${sub.marks_awarded ?? 18}" required /></div>
      <div class="field"><label>Feedback</label><textarea name="tutor_feedback" rows="3" required>${esc(sub.tutor_feedback || '')}</textarea></div>
      <button type="submit" class="btn btn-gold">Save Grade</button>
    </form>
  `);
}

function openNewAssignmentModal() {
  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Assign Homework</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="new-assignment-form" class="form-grid">
      <div class="form-row-2">
        <div class="field"><label>Subject</label><select name="subject_id">${state.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Max Marks</label><input name="max_marks" type="number" value="20" required /></div>
      </div>
      <div class="field"><label>Topic</label><input name="topic" required placeholder="e.g. Analytical Geometry" /></div>
      <div class="field"><label>Title</label><input name="title" required placeholder="e.g. Circle Equations Practice Set" /></div>
      <div class="field"><label>Instructions</label><textarea name="instructions" rows="4" required></textarea></div>
      <button type="submit" class="btn btn-gold">Publish Homework</button>
    </form>
  `);
}

function openNewQuizModal() {
  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Create Auto-Graded Quiz</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="new-quiz-form" class="form-grid">
      <div class="form-row-2">
        <div class="field"><label>Subject</label><select name="subject_id">${state.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Time Limit (mins)</label><input name="time_limit_mins" type="number" value="10" required /></div>
      </div>
      <div class="form-row-2">
        <div class="field"><label>Topic</label><input name="topic" required placeholder="e.g. Stoichiometry" /></div>
        <div class="field"><label>Quiz Title</label><input name="title" required placeholder="e.g. Mole Concept Sprint" /></div>
      </div>
      <div class="field"><label>Question Prompt</label><input name="q1_prompt" required placeholder="How many moles are in 36 g of H₂O?" /></div>
      <div class="form-row-2">
        <div class="field"><label>Correct Answer</label><input name="q1_opt0" required placeholder="2 mol" /></div>
        <div class="field"><label>Distractor B</label><input name="q1_opt1" required placeholder="0.5 mol" /></div>
      </div>
      <div class="form-row-2">
        <div class="field"><label>Distractor C</label><input name="q1_opt2" required placeholder="18 mol" /></div>
        <div class="field"><label>Distractor D</label><input name="q1_opt3" required placeholder="4 mol" /></div>
      </div>
      <div class="field"><label>Worked Explanation</label><input name="q1_exp" required placeholder="n = m / M = 36 / 18 = 2 mol." /></div>
      <button type="submit" class="btn btn-gold">Publish Quiz</button>
    </form>
  `);
}

function openNewResourceModal() {
  openModal(`
    <div class="modal-header">
      <h2 class="card-title">Publish Study Guide</h2>
      <button class="icon-btn" data-action="close-modal">✕ Close</button>
    </div>
    <form id="new-resource-form" class="form-grid">
      <div class="form-row-2">
        <div class="field"><label>Subject</label><select name="subject_id">${state.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field">
          <label>Type</label>
          <select name="resource_type">
            <option value="notes">Structured Notes</option>
            <option value="formula_sheet">Formula Sheet</option>
            <option value="worked_example">Worked Example</option>
            <option value="past_paper">Past Paper Guide</option>
          </select>
        </div>
      </div>
      <div class="form-row-2">
        <div class="field"><label>Topic</label><input name="topic" required placeholder="Functions & Parabolas" /></div>
        <div class="field"><label>Title</label><input name="title" required placeholder="Parabola Turning Point Master Sheet" /></div>
      </div>
      <div class="field"><label>Summary</label><input name="summary" required placeholder="Concise overview of what students will master…" /></div>
      <div class="field"><label>Key Formulae (one per line)</label><textarea name="key_formulas" rows="2"></textarea></div>
      <div class="field"><label>Study Content</label><textarea name="content_body" rows="5" required placeholder="### Step 1…"></textarea></div>
      <button type="submit" class="btn btn-gold">Publish to Study Vault</button>
    </form>
  `);
}

/* ==========================================================================
   EVENTS & INTERACTIONS
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
      case 'nav-page':
        e.preventDefault();
        state.page = btn.dataset.page;
        renderApp();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;

      case 'toggle-theme':
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('itutor_theme', state.theme);
        renderApp();
        break;

      case 'quick-role': {
        const targetRole = btn.dataset.role;
        const match =
          state.data.users.find(
            (u) => u.role === targetRole && (targetRole === 'student' ? u.id === 'stu-thabo' : true)
          ) || state.data.users.find((u) => u.role === targetRole);
        if (match) {
          setCurrentUser(match, { rerender: false });
          state.page = 'dashboard';
          renderApp();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          showToast(`Switched to ${match.name} (${targetRole.toUpperCase()} Dashboard)`);
        }
        break;
      }

      case 'switch-user-id': {
        const u = state.data.users.find((x) => x.id === btn.dataset.userId);
        if (u) {
          setCurrentUser(u, { rerender: false });
          state.page = 'dashboard';
          renderApp();
          showToast(`Signed in as ${u.name}`);
        }
        break;
      }

      case 'set-auth-mode':
        state.authMode = btn.dataset.mode;
        renderApp();
        break;

      case 'set-signup-role':
        state.signupRole = btn.dataset.role;
        renderApp();
        break;

      case 'scroll-to-request': {
        if (state.page !== 'home') {
          state.page = 'home';
          renderApp();
        }
        const sec = document.getElementById('study-request-section');
        if (sec) sec.scrollIntoView({ behavior: 'smooth' });
        break;
      }

      case 'share-skill-cta':
        if (state.currentUser.role === 'tutor') {
          openNewResourceModal();
        } else {
          state.signupRole = 'tutor';
          state.authMode = 'signup';
          state.page = 'auth';
          renderApp();
        }
        break;

      case 'filter-category':
        state.selectedCategory = btn.dataset.category;
        state.page = 'browse';
        renderApp();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;

      case 'clear-search':
        state.searchQuery = '';
        renderApp();
        break;

      case 'toggle-vault-bookmarks':
        state.vaultBookmarkedOnly = !state.vaultBookmarkedOnly;
        renderApp();
        break;

      case 'toggle-bookmark': {
        const stuId = state.currentUser.role === 'student' ? state.currentUser.id : 'stu-thabo';
        const resourceId = btn.dataset.resourceId;
        const existing = state.data.resource_progress.find(
          (rp) => rp.resource_id === resourceId && rp.student_id === stuId
        );
        await api(`/api/resources/${resourceId}/progress`, {
          method: 'POST',
          body: JSON.stringify({ student_id: stuId, bookmarked: !existing?.bookmarked })
        });
        await refreshSnapshot();
        showToast(!existing?.bookmarked ? 'Saved to bookmarks' : 'Removed bookmark');
        break;
      }

      case 'open-resource':
        openResourceModal(btn.dataset.resourceId);
        break;

      case 'toggle-complete-resource': {
        const stuId = state.currentUser.role === 'student' ? state.currentUser.id : 'stu-thabo';
        const resourceId = btn.dataset.resourceId;
        const existing = state.data.resource_progress.find(
          (rp) => rp.resource_id === resourceId && rp.student_id === stuId
        );
        await api(`/api/resources/${resourceId}/progress`, {
          method: 'POST',
          body: JSON.stringify({ student_id: stuId, completed: !existing?.completed })
        });
        await refreshSnapshot();
        openResourceModal(resourceId);
        showToast('Study Vault mastery updated!');
        break;
      }

      case 'message-peer':
        state.activePeerId = btn.dataset.peerId;
        state.page = 'messages';
        renderApp();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;

      case 'select-peer':
        state.activePeerId = btn.dataset.peerId;
        renderApp();
        break;

      case 'coach-topic':
        closeModal();
        state.coachSubjectId = btn.dataset.subjectId || 'sub-math';
        state.coachTopic = btn.dataset.topic || '';
        state.page = 'coach';
        renderApp();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;

      case 'quick-coach':
        await sendCoachMessage(btn.dataset.prompt, btn.dataset.mode || state.coachMode);
        break;

      case 'start-quiz':
        startQuizModal(btn.dataset.quizId);
        break;

      case 'toggle-quiz-hint': {
        const idx = Number(btn.dataset.qidx);
        if (state.quizRunner) {
          state.quizRunner.revealedHints[idx] = !state.quizRunner.revealedHints[idx];
          renderQuizRunnerModal();
        }
        break;
      }

      case 'select-quiz-opt': {
        if (state.quizRunner) {
          state.quizRunner.answers[Number(btn.dataset.qidx)] = Number(btn.dataset.oidx);
          renderQuizRunnerModal();
        }
        break;
      }

      case 'submit-quiz': {
        const qr = state.quizRunner;
        if (!qr) return;
        if (qr.answers.some((a) => a === null)) {
          showToast('Select an option for every question first.');
          return;
        }
        const stuId = state.currentUser.role === 'student' ? state.currentUser.id : 'stu-thabo';
        if (qr.timerId) clearInterval(qr.timerId);
        const res = await api(`/api/quizzes/${qr.quiz.id}/attempt`, {
          method: 'POST',
          body: JSON.stringify({
            student_id: stuId,
            answers: qr.answers,
            duration_secs: Math.round((Date.now() - qr.startedAt) / 1000),
            confidence_after: 'confident'
          })
        });
        qr.result = res;
        await refreshSnapshot();
        renderQuizRunnerModal();
        showToast(`Scored ${res.attempt.score_percent}%!`);
        break;
      }

      case 'set-mood':
        await api(`/api/students/${state.currentUser.id}/mood`, {
          method: 'POST',
          body: JSON.stringify({ mood: btn.dataset.mood })
        });
        await refreshSnapshot();
        showToast('Confidence mood updated!');
        break;

      case 'approve-help-request': {
        const req = state.data.help_requests.find((r) => r.id === btn.dataset.requestId);
        if (!req) return;
        const stu = state.data.users.find((u) => u.id === req.student_id);
        await api(`/api/help-requests/${req.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'scheduled',
            tutor_response: `Scheduled 1-on-1 for ${req.preferred_slot} with ${state.currentUser.name}.`,
            create_session_payload: {
              subject_id: req.subject_id,
              title: `1-on-1: ${req.topic} (${stu?.name.split(' ')[0] || 'Learner'})`,
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
        showToast('1-on-1 session scheduled!');
        break;
      }

      case 'mark-attendance':
        await api(`/api/sessions/${btn.dataset.sessionId}/attendance`, {
          method: 'POST',
          body: JSON.stringify({ student_id: btn.dataset.studentId, status: btn.dataset.status })
        });
        await refreshSnapshot();
        showToast(`Marked ${btn.dataset.status.toUpperCase()}`);
        break;

      case 'open-homework-modal':
        openHomeworkModal(btn.dataset.assignmentId);
        break;
      case 'open-help-modal':
        openHelpModal();
        break;
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
    }
  } catch (err) {
    showToast(err.message || 'Action failed');
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'browse-search-input') {
    state.searchQuery = e.target.value;
    renderApp();
    const el = document.getElementById('browse-search-input');
    if (el) {
      el.focus();
      el.setSelectionRange(state.searchQuery.length, state.searchQuery.length);
    }
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'browse-sort-select') {
    state.sortBy = e.target.value;
    renderApp();
  } else if (e.target.id === 'coach-sub-select') {
    state.coachSubjectId = e.target.value;
    const sub = state.data.subjects.find((s) => s.id === state.coachSubjectId);
    state.coachTopic = sub?.topics?.[0]?.name || '';
    renderApp();
  } else if (e.target.id === 'coach-topic-select') {
    state.coachTopic = e.target.value;
  } else if (e.target.id === 'coach-mode-select') {
    state.coachMode = e.target.value;
    renderApp();
  } else if (e.target.id === 'parent-child-switcher') {
    state.selectedChildId = e.target.value;
    renderApp();
  }
});

async function sendCoachMessage(promptText, mode = state.coachMode) {
  const stuId = state.currentUser.role === 'student' ? state.currentUser.id : 'stu-thabo';
  state.coachSending = true;
  renderApp();
  try {
    await api('/api/coach/ask', {
      method: 'POST',
      body: JSON.stringify({
        student_id: stuId,
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
    if (form.id === 'hero-search-form') {
      state.searchQuery = document.getElementById('hero-search-input').value;
      state.page = 'browse';
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (form.id === 'home-post-request-form') {
      const fd = new FormData(form);
      const stuId = state.currentUser.role === 'student' ? state.currentUser.id : 'stu-thabo';
      await api('/api/help-requests', {
        method: 'POST',
        body: JSON.stringify({
          student_id: stuId,
          subject_id: fd.get('subject_id'),
          topic: fd.get('topic'),
          preferred_slot: fd.get('preferred_slot'),
          notes: fd.get('notes')
        })
      });
      form.reset();
      await refreshSnapshot();
      showToast('Study request posted to the i-tutor feed!');
    } else if (form.id === 'coach-form') {
      const input = document.getElementById('coach-input');
      const val = input.value.trim();
      if (!val) return;
      input.value = '';
      await sendCoachMessage(val, state.coachMode);
    } else if (form.id === 'direct-msg-form') {
      const input = document.getElementById('direct-msg-input');
      const body = input.value.trim();
      if (!body) return;
      input.value = '';
      const stuContext =
        state.currentUser.role === 'student'
          ? state.currentUser.id
          : form.dataset.peerId.startsWith('stu-')
            ? form.dataset.peerId
            : 'stu-thabo';
      await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          student_id: stuContext,
          channel: 'direct',
          sender_id: state.currentUser.id,
          sender_name: state.currentUser.name,
          sender_role: state.currentUser.role,
          recipient_id: form.dataset.peerId,
          recipient_name: form.dataset.peerName,
          body
        })
      });
      await refreshSnapshot();
    } else if (form.id === 'login-user-form') {
      const fd = new FormData(form);
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') })
      });
      setCurrentUser(res.user, { rerender: false });
      state.page = 'dashboard';
      renderApp();
      showToast(`Welcome back, ${res.user.name}!`);
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
      setCurrentUser(res.user, { rerender: false });
      state.page = 'dashboard';
      renderApp();
      showToast(`Account created — welcome to i-tutor, ${res.user.name}!`);
    } else if (form.id === 'contact-support-form') {
      form.reset();
      showToast('Message received! Our i-tutor academic team will reply shortly.');
    } else if (form.id === 'homework-submit-form') {
      const fd = new FormData(form);
      const stuId = state.currentUser.role === 'student' ? state.currentUser.id : 'stu-thabo';
      await api(`/api/assignments/${form.dataset.assignmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          student_id: stuId,
          answer_text: fd.get('answer_text'),
          student_confidence: fd.get('student_confidence')
        })
      });
      closeModal();
      await refreshSnapshot();
      showToast('Homework submitted!');
    } else if (form.id === 'help-request-form') {
      const fd = new FormData(form);
      const stuId = state.currentUser.role === 'student' ? state.currentUser.id : 'stu-thabo';
      await api('/api/help-requests', {
        method: 'POST',
        body: JSON.stringify({
          student_id: stuId,
          subject_id: fd.get('subject_id'),
          topic: fd.get('topic'),
          preferred_slot: fd.get('preferred_slot'),
          notes: fd.get('notes')
        })
      });
      closeModal();
      await refreshSnapshot();
      showToast('1-on-1 focus request posted!');
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
      showToast('Session scheduled!');
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
      showToast('Grade & feedback saved!');
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
      showToast('Homework published!');
    } else if (form.id === 'new-quiz-form') {
      const fd = new FormData(form);
      await api('/api/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          subject_id: fd.get('subject_id'),
          time_limit_mins: Number(fd.get('time_limit_mins')),
          topic: fd.get('topic'),
          title: fd.get('title'),
          description: `Created by ${state.currentUser.name}.`,
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
      showToast('Quiz published!');
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
      showToast('Published to Study Vault!');
    }
  } catch (err) {
    showToast(err.message || 'Could not complete action');
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
