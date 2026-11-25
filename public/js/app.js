import { renderEmblemSVG, renderSunriseGaugeSVG, ICONS } from './emblem.js';
import {
  SUBJECTS,
  loadState,
  saveState,
  resetState,
  getOverallConfidence,
  getWeakestSubject,
  getSubjectById
} from './offlineStore.js';

const LOADING_DURATION_MS = 10000; // ~10 seconds

const STATUS_PHASES = [
  { threshold: 0, text: 'Starting i-tutor…' },
  { threshold: 25, text: 'Loading standalone offline engine…' },
  { threshold: 55, text: 'Caching local workspace…' },
  { threshold: 82, text: 'Confidence in learning…' },
  { threshold: 100, text: 'Ready' }
];

let state = loadState();
let activeAnimationFrame = null;

// UI Navigation & Ephemeral Session State
const ui = {
  view: 'home', // 'home' | 'notes' | 'quiz' | 'flashcards' | 'planner' | 'timer' | 'goal' | 'library' | 'practice' | 'confidence'
  dockIndex: 0,
  subjectFilter: 'all',
  focusNoteId: null,
  showNewNoteForm: false,
  showNewCardForm: false,
  showNewExamForm: false,
  // Quiz session
  quizIndex: 0,
  quizSelectedOption: null,
  quizScore: 0,
  quizFinished: false,
  // Flashcard session
  cardIndex: 0,
  cardFlipped: false,
  // Focus timer
  timerModeMinutes: 25,
  timerSecondsLeft: 25 * 60,
  timerRunning: false,
  timerIntervalId: null
};

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme === 'night' ? 'night' : 'light');
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimer(totalSec) {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
          aria-label="Loading i-tutor standalone app"
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
   2. HOME VIEW — EXACT SKETCH BUTTON MAP
   ========================================================================== */

function renderHomeWorkspace() {
  const confidence = getOverallConfidence(state);
  const goalPct = Math.min(100, Math.round((state.dailyCompleted / Math.max(1, state.dailyGoalTarget)) * 100));
  const openTasksCount = state.tasks.filter((t) => !t.done).length;
  const masteredCards = state.flashcards.filter((c) => c.mastered).length;
  const timerBadgeLabel = ui.timerRunning ? formatTimer(ui.timerSecondsLeft) : 'Timer';

  return `
    <!-- HERO CARD (Confidence + Timer Pill + Continue Studying) -->
    <section class="layout-hero-card">
      <div class="hero-top-row">
        <div class="confidence-chip">
          <span class="confidence-sun-dot" aria-hidden="true"></span>
          <div class="confidence-readout">${confidence}% <span>Confidence</span></div>
        </div>

        <button type="button" class="timer-pill-btn" data-open-view="timer">
          ${ICONS.timer}
          <span>${timerBadgeLabel}</span>
        </button>
      </div>

      <div class="hero-last-studied">
        <span class="hero-eyebrow">Last studied</span>
        <div class="hero-topic-title">${escapeHtml(state.lastStudied?.title || 'Mathematics — Trigonometry')}</div>
      </div>

      <button type="button" class="continue-btn" id="continue-study-btn">
        <span class="play-accent">${ICONS.play}</span>
        <span>Continue Studying</span>
      </button>
    </section>

    <!-- 2x2 MAIN FEATURE BUTTONS -->
    <section class="layout-grid">
      <button type="button" class="feature-tile-btn" data-open-view="notes">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.notes}</div>
          <span class="tile-count-pill">${state.notes.length} notes</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Study Notes</div>
          <div class="tile-sub">&amp; Formulas</div>
        </div>
      </button>

      <button type="button" class="feature-tile-btn" data-open-view="quiz">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.quiz}</div>
          <span class="tile-count-pill">${state.quizzes.length} Qs</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Quick Quiz</div>
          <div class="tile-sub">Auto-marked</div>
        </div>
      </button>

      <button type="button" class="feature-tile-btn" data-open-view="flashcards">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.flashcards}</div>
          <span class="tile-count-pill">${masteredCards}/${state.flashcards.length}</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Flashcards</div>
          <div class="tile-sub">Tap to flip</div>
        </div>
      </button>

      <button type="button" class="feature-tile-btn" data-open-view="planner">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.planner}</div>
          <span class="tile-count-pill">${openTasksCount} left</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Study Planner</div>
          <div class="tile-sub">&amp; Exam dates</div>
        </div>
      </button>
    </section>

    <!-- LOWER GOAL BAR BUTTON -->
    <button type="button" class="goal-bar-btn" data-open-view="goal">
      <div class="goal-ring-badge">${ICONS.target}</div>
      <div class="goal-bar-body">
        <div class="goal-bar-labels">
          <span class="goal-bar-title">Today’s Goal</span>
          <span class="goal-bar-count">${state.dailyCompleted} / ${state.dailyGoalTarget} done</span>
        </div>
        <div class="goal-track">
          <div class="goal-track-fill" style="width: ${goalPct}%"></div>
        </div>
      </div>
    </button>
  `;
}

/* ==========================================================================
   3. INNER FEATURE VIEWS (100% OFFLINE)
   ========================================================================== */

function renderSubjectChips() {
  return `
    <div class="chip-row">
      <button type="button" class="filter-chip ${ui.subjectFilter === 'all' ? 'is-active' : ''}" data-filter-sub="all">All</button>
      ${SUBJECTS.map(
        (s) => `
          <button type="button" class="filter-chip ${ui.subjectFilter === s.id ? 'is-active' : ''}" data-filter-sub="${s.id}">
            ${escapeHtml(s.short)}
          </button>
        `
      ).join('')}
    </div>
  `;
}

function renderNotesView() {
  const filtered = state.notes.filter(
    (n) => ui.subjectFilter === 'all' || n.subjectId === ui.subjectFilter
  );

  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      <button type="button" class="action-pill-btn" id="toggle-new-note-btn">${ICONS.plus} <span>New Note</span></button>
    </div>

    <div class="subview-title-block">
      <h2>Study Notes &amp; Formulas</h2>
      <p>Saved directly on your device for offline revision.</p>
    </div>

    ${renderSubjectChips()}

    ${
      ui.showNewNoteForm
        ? `
      <form class="content-card inline-form" id="new-note-form">
        <select name="subjectId" class="input-field" required>
          ${SUBJECTS.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
        </select>
        <input type="text" name="title" class="input-field" placeholder="Note title (e.g. Cosine Rule)" required />
        <input type="text" name="formula" class="input-field" placeholder="Key formula (optional)" />
        <textarea name="summary" rows="3" class="input-field" placeholder="Write your key study summary…" required></textarea>
        <button type="submit" class="gold-btn">Save Offline Note</button>
      </form>
    `
        : ''
    }

    <div class="note-list">
      ${filtered
        .map((note) => {
          const sub = getSubjectById(note.subjectId);
          return `
            <article class="content-card" data-note-card="${note.id}">
              <div class="note-card-head">
                <span class="subject-tag">${escapeHtml(sub.name)}</span>
              </div>
              <h3 class="note-title">${escapeHtml(note.title)}</h3>
              ${
                note.keyFormulas?.length
                  ? `<div class="formula-box">${note.keyFormulas.map((f) => `<div>${escapeHtml(f)}</div>`).join('')}</div>`
                  : ''
              }
              <p class="note-summary">${escapeHtml(note.summary)}</p>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderQuizView() {
  const pool = state.quizzes.filter(
    (q) => ui.subjectFilter === 'all' || q.subjectId === ui.subjectFilter
  );

  if (!pool.length) {
    return `
      <div class="subview-header">
        <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      </div>
      ${renderSubjectChips()}
      <div class="content-card"><p>No questions in this filter yet.</p></div>
    `;
  }

  if (ui.quizFinished) {
    const pct = Math.round((ui.quizScore / pool.length) * 100);
    return `
      <div class="subview-header">
        <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      </div>
      <div class="content-card timer-dial-card">
        <span class="subject-tag">Quiz Complete</span>
        <div class="timer-digits">${pct}%</div>
        <p class="note-summary">You got <strong>${ui.quizScore} out of ${pool.length}</strong> right. Your Confidence score has been updated offline.</p>
        <div class="dual-btn-row" style="width:100%; margin-top: 0.6rem;">
          <button type="button" class="secondary-btn" data-open-view="home">Home</button>
          <button type="button" class="gold-btn" id="restart-quiz-btn">Try Again</button>
        </div>
      </div>
    `;
  }

  const safeIdx = Math.min(ui.quizIndex, pool.length - 1);
  const currentQ = pool[safeIdx];
  const sub = getSubjectById(currentQ.subjectId);
  const answered = ui.quizSelectedOption !== null;

  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      <span class="tile-count-pill">Question ${safeIdx + 1} / ${pool.length}</span>
    </div>

    <div class="subview-title-block">
      <h2>Quick Quiz</h2>
      <p>Instant offline marking &amp; explanation.</p>
    </div>

    ${renderSubjectChips()}

    <div class="content-card">
      <div class="note-card-head">
        <span class="subject-tag">${escapeHtml(sub.name)} · ${escapeHtml(currentQ.topic)}</span>
      </div>
      <h3 class="note-title">${escapeHtml(currentQ.question)}</h3>

      <div class="inline-form">
        ${currentQ.options
          .map((opt, idx) => {
            let stateCls = '';
            if (answered) {
              if (idx === currentQ.correctIndex) stateCls = 'is-correct';
              else if (idx === ui.quizSelectedOption) stateCls = 'is-wrong';
            }
            return `
              <button
                type="button"
                class="quiz-option-btn ${stateCls}"
                data-quiz-opt="${idx}"
                ${answered ? 'disabled' : ''}
              >
                ${escapeHtml(opt)}
              </button>
            `;
          })
          .join('')}
      </div>

      ${
        answered
          ? `
        <div class="quiz-explain">
          <strong>${ui.quizSelectedOption === currentQ.correctIndex ? 'Correct!' : 'Keep going:'}</strong>
          ${escapeHtml(currentQ.explanation)}
        </div>
        <button type="button" class="gold-btn" id="next-quiz-btn">
          ${safeIdx + 1 < pool.length ? 'Next Question →' : 'See Results'}
        </button>
      `
          : ''
      }
    </div>
  `;
}

function renderFlashcardsView() {
  const deck = state.flashcards.filter(
    (c) => ui.subjectFilter === 'all' || c.subjectId === ui.subjectFilter
  );

  const safeIdx = deck.length ? ui.cardIndex % deck.length : 0;
  const card = deck[safeIdx];
  const sub = card ? getSubjectById(card.subjectId) : SUBJECTS[0];

  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      <button type="button" class="action-pill-btn" id="toggle-new-card-btn">${ICONS.plus} <span>Add Card</span></button>
    </div>

    <div class="subview-title-block">
      <h2>Flashcards</h2>
      <p>Tap the card to flip between question and answer.</p>
    </div>

    ${renderSubjectChips()}

    ${
      ui.showNewCardForm
        ? `
      <form class="content-card inline-form" id="new-card-form">
        <select name="subjectId" class="input-field" required>
          ${SUBJECTS.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
        </select>
        <input type="text" name="front" class="input-field" placeholder="Front (Question or Prompt)" required />
        <textarea name="back" rows="2" class="input-field" placeholder="Back (Answer or Formula)" required></textarea>
        <button type="submit" class="gold-btn">Save Flashcard</button>
      </form>
    `
        : ''
    }

    ${
      card
        ? `
      <div class="flashcard-stage" id="flashcard-flip-box">
        <span class="flashcard-side-label">${escapeHtml(sub.short)} · ${ui.cardFlipped ? 'Answer' : 'Question'} (${safeIdx + 1}/${deck.length})</span>
        <div class="flashcard-text">${escapeHtml(ui.cardFlipped ? card.back : card.front)}</div>
        <span class="tile-sub">${ui.cardFlipped ? 'Tap to see question' : 'Tap card to reveal answer'}</span>
      </div>

      <div class="dual-btn-row">
        <button type="button" class="secondary-btn" id="fc-practice-btn">Need Practice</button>
        <button type="button" class="gold-btn" id="fc-gotit-btn">Got It ✓</button>
      </div>
    `
        : `<div class="content-card"><p>No flashcards in this subject yet.</p></div>`
    }
  `;
}

function renderPlannerView() {
  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      <button type="button" class="action-pill-btn" id="toggle-exam-form-btn">${ICONS.plus} <span>Exam Date</span></button>
    </div>

    <div class="subview-title-block">
      <h2>Study Planner &amp; Exams</h2>
      <p>Offline daily study checklist and upcoming countdowns.</p>
    </div>

    <div class="content-card">
      <h3 class="note-title">Today’s Study Checklist</h3>
      <form class="inline-form" id="add-task-form" style="flex-direction: row;">
        <input type="text" name="title" class="input-field" placeholder="Add study task…" required />
        <button type="submit" class="gold-btn" style="white-space: nowrap;">Add</button>
      </form>

      <div class="inline-form">
        ${state.tasks
          .map(
            (t) => `
            <div class="task-item ${t.done ? 'is-done' : ''}" data-toggle-task="${t.id}">
              <div class="task-check">${t.done ? ICONS.check : ''}</div>
              <span class="task-label">${escapeHtml(t.title)}</span>
            </div>
          `
          )
          .join('')}
      </div>
    </div>

    ${
      ui.showNewExamForm
        ? `
      <form class="content-card inline-form" id="add-exam-form">
        <input type="text" name="title" class="input-field" placeholder="Exam paper name (e.g. Maths Paper 1)" required />
        <input type="number" name="daysAway" min="1" max="365" class="input-field" placeholder="Days remaining (e.g. 14)" required />
        <button type="submit" class="gold-btn">Save Countdown</button>
      </form>
    `
        : ''
    }

    <div class="content-card">
      <h3 class="note-title">Exam Countdowns</h3>
      <div class="inline-form">
        ${state.exams
          .map(
            (ex) => `
            <div class="exam-row">
              <span class="task-label">${escapeHtml(ex.title)}</span>
              <span class="exam-days-badge">${Number(ex.daysAway)} days left</span>
            </div>
          `
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderTimerView() {
  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      <span class="tile-count-pill">${state.focusMinutesToday} mins today</span>
    </div>

    <div class="subview-title-block">
      <h2>Offline Focus Timer</h2>
      <p>Stay locked in without distractions or internet.</p>
    </div>

    <div class="chip-row">
      ${[25, 15, 5]
        .map(
          (m) => `
          <button type="button" class="filter-chip ${ui.timerModeMinutes === m ? 'is-active' : ''}" data-timer-preset="${m}">
            ${m === 5 ? '5m Break' : `${m}m Focus`}
          </button>
        `
        )
        .join('')}
    </div>

    <div class="content-card timer-dial-card">
      <span class="subject-tag">${ui.timerRunning ? 'Focus Session Active' : 'Ready to Focus'}</span>
      <div class="timer-digits" id="timer-live-readout">${formatTimer(ui.timerSecondsLeft)}</div>
      <div class="dual-btn-row" style="width: 100%; margin-top: 0.6rem;">
        <button type="button" class="secondary-btn" id="timer-reset-btn">Reset</button>
        <button type="button" class="gold-btn" id="timer-toggle-btn">
          ${ui.timerRunning ? 'Pause' : 'Start Timer'}
        </button>
      </div>
    </div>
  `;
}

function renderGoalView() {
  const weakest = getWeakestSubject(state);
  const goalPct = Math.min(100, Math.round((state.dailyCompleted / Math.max(1, state.dailyGoalTarget)) * 100));

  return `
    <div class="subview-header">
      <button type="button" class="back-pill-btn" data-open-view="home">${ICONS.back} <span>Back</span></button>
      <span class="tile-count-pill">${state.streakDays}-day streak</span>
    </div>

    <div class="subview-title-block">
      <h2>Today’s Goal &amp; Weak Spot</h2>
      <p>Complete quizzes, flashcards, or focus blocks to fill your daily ring.</p>
    </div>

    <div class="content-card">
      <div class="goal-bar-labels">
        <span class="goal-bar-title">Daily Sessions Completed</span>
        <span class="goal-bar-count">${state.dailyCompleted} / ${state.dailyGoalTarget}</span>
      </div>
      <div class="goal-track" style="height: 11px;">
        <div class="goal-track-fill" style="width: ${goalPct}%"></div>
      </div>

      <div class="chip-row" style="margin-top: 0.35rem;">
        ${[3, 4, 5, 6]
          .map(
            (target) => `
            <button type="button" class="filter-chip ${state.dailyGoalTarget === target ? 'is-active' : ''}" data-goal-target="${target}">
              Goal: ${target}/day
            </button>
          `
          )
          .join('')}
      </div>
    </div>

    <div class="content-card">
      <span class="subject-tag">Recommended Focus Next</span>
      <h3 class="note-title">${escapeHtml(weakest.subject.name)} (${weakest.score}% Confidence)</h3>
      <p class="note-summary">This is currently your lowest-confidence subject. A quick 3-minute quiz will lift it immediately.</p>
      <button type="button" class="continue-btn" id="practice-weakspot-btn" data-sub="${weakest.subject.id}">
        <span class="play-accent">${ICONS.play}</span>
        <span>Practice ${escapeHtml(weakest.subject.short)} Now</span>
      </button>
    </div>
  `;
}

function renderLibraryHubView() {
  return `
    <div class="subview-title-block">
      <h2>Study Library</h2>
      <p>Your offline notes, formulas, and flashcard decks.</p>
    </div>
    <section class="layout-grid">
      <button type="button" class="feature-tile-btn" data-open-view="notes">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.notes}</div>
          <span class="tile-count-pill">${state.notes.length} notes</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Study Notes</div>
          <div class="tile-sub">Formulas &amp; guides</div>
        </div>
      </button>

      <button type="button" class="feature-tile-btn" data-open-view="flashcards">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.flashcards}</div>
          <span class="tile-count-pill">${state.flashcards.length} cards</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Flashcards</div>
          <div class="tile-sub">Active recall deck</div>
        </div>
      </button>
    </section>
  `;
}

function renderPracticeHubView() {
  return `
    <div class="subview-title-block">
      <h2>Practice &amp; Focus</h2>
      <p>Test yourself offline, run a study timer, or plan exams.</p>
    </div>
    <section class="layout-grid">
      <button type="button" class="feature-tile-btn" data-open-view="quiz">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.quiz}</div>
          <span class="tile-count-pill">${state.quizzes.length} Qs</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Quick Quiz</div>
          <div class="tile-sub">Instant marking</div>
        </div>
      </button>

      <button type="button" class="feature-tile-btn" data-open-view="timer">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.timer}</div>
          <span class="tile-count-pill">25m</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Focus Timer</div>
          <div class="tile-sub">Study sprints</div>
        </div>
      </button>

      <button type="button" class="feature-tile-btn" data-open-view="planner" style="grid-column: span 2; min-height: 112px;">
        <div class="tile-top-row">
          <div class="tile-icon-box">${ICONS.planner}</div>
          <span class="tile-count-pill">${state.exams.length} exams</span>
        </div>
        <div class="tile-copy">
          <div class="tile-title">Study Planner &amp; Exam Dates</div>
          <div class="tile-sub">Daily checklist &amp; countdowns</div>
        </div>
      </button>
    </section>
  `;
}

function renderConfidenceSettingsView() {
  const overall = getOverallConfidence(state);

  return `
    <div class="subview-title-block">
      <h2>Confidence &amp; App Settings</h2>
      <p>100% standalone — all progress lives privately on this device.</p>
    </div>

    <div class="content-card gauge-box">
      ${renderSunriseGaugeSVG(overall)}
      <div class="gauge-big-num">${overall}%</div>
      <span class="tile-sub">Overall Sunrise Confidence</span>
    </div>

    <div class="content-card">
      <h3 class="note-title">Subject Confidence</h3>
      ${SUBJECTS.map((s) => {
        const sc = Number(state.subjectConfidence?.[s.id] ?? 75);
        return `
          <div class="subject-meter-row">
            <div class="subject-meter-top">
              <span>${escapeHtml(s.name)}</span>
              <span>${sc}%</span>
            </div>
            <div class="goal-track">
              <div class="goal-track-fill" style="width: ${sc}%"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="content-card">
      <h3 class="note-title">Standalone Controls</h3>
      <div class="dual-btn-row">
        <button type="button" class="secondary-btn" id="toggle-theme-btn">
          ${state.theme === 'night' ? '☀️ Cream Mode' : '🌙 Night Mode'}
        </button>
        <button type="button" class="secondary-btn" id="replay-intro-btn">
          ↻ 10s Intro
        </button>
      </div>
      <div class="dual-btn-row">
        <button type="button" class="secondary-btn" id="export-backup-btn">Export Backup</button>
        <button type="button" class="secondary-btn" id="reset-data-btn">Reset Demo</button>
      </div>
    </div>
  `;
}

/* ==========================================================================
   4. MAIN SHELL RENDERER & EVENT WIRING
   ========================================================================== */

function renderWorkspaceByView() {
  switch (ui.view) {
    case 'notes':
      return renderNotesView();
    case 'quiz':
      return renderQuizView();
    case 'flashcards':
      return renderFlashcardsView();
    case 'planner':
      return renderPlannerView();
    case 'timer':
      return renderTimerView();
    case 'goal':
      return renderGoalView();
    case 'library':
      return renderLibraryHubView();
    case 'practice':
      return renderPracticeHubView();
    case 'confidence':
      return renderConfidenceSettingsView();
    case 'home':
    default:
      return renderHomeWorkspace();
  }
}

function renderAppShell() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  applyTheme();

  appEl.innerHTML = `
    <div class="app-layout" id="app-layout">
      <!-- Top Bar with Emblem-Only Logo (Zero Letters in Header) -->
      <header class="app-topbar">
        <button type="button" class="topbar-emblem-btn" id="topbar-logo" aria-label="Home">
          ${renderEmblemSVG({ animated: false, uid: 'header' })}
        </button>
      </header>

      <main class="app-workspace">
        ${renderWorkspaceByView()}
      </main>

      <!-- Bottom Floating Icon-Only Dock -->
      <nav class="app-bottom-dock" aria-label="Primary Navigation">
        <button type="button" class="dock-slot ${ui.dockIndex === 0 ? 'is-active' : ''}" data-dock-tab="0" aria-label="Home">
          ${ICONS.homeDock}
        </button>
        <button type="button" class="dock-slot ${ui.dockIndex === 1 ? 'is-active' : ''}" data-dock-tab="1" aria-label="Library">
          ${ICONS.libraryDock}
        </button>
        <button type="button" class="dock-slot ${ui.dockIndex === 2 ? 'is-active' : ''}" data-dock-tab="2" aria-label="Practice">
          ${ICONS.practiceDock}
        </button>
        <button type="button" class="dock-slot ${ui.dockIndex === 3 ? 'is-active' : ''}" data-dock-tab="3" aria-label="Confidence">
          ${ICONS.confidenceDock}
        </button>
      </nav>
    </div>
  `;

  bindAppEvents();
}

function openView(targetView) {
  ui.view = targetView;
  if (targetView === 'home') ui.dockIndex = 0;
  else if (targetView === 'library' || targetView === 'notes' || targetView === 'flashcards') ui.dockIndex = 1;
  else if (targetView === 'practice' || targetView === 'quiz' || targetView === 'timer' || targetView === 'planner') ui.dockIndex = 2;
  else if (targetView === 'confidence' || targetView === 'goal') ui.dockIndex = 3;

  if (targetView === 'quiz') {
    ui.quizIndex = 0;
    ui.quizSelectedOption = null;
    ui.quizScore = 0;
    ui.quizFinished = false;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderAppShell();
}

function bindAppEvents() {
  // Top emblem: single click -> Home, double click -> replay 10s intro
  const topLogo = document.getElementById('topbar-logo');
  if (topLogo) {
    topLogo.addEventListener('click', () => {
      if (ui.view !== 'home') openView('home');
    });
    topLogo.addEventListener('dblclick', () => startTenSecondLoadingSequence());
  }

  // View navigation buttons
  document.querySelectorAll('[data-open-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-open-view');
      if (next) openView(next);
    });
  });

  // Bottom Dock Tabs
  const dockViews = ['home', 'library', 'practice', 'confidence'];
  document.querySelectorAll('[data-dock-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-dock-tab') || 0);
      ui.dockIndex = idx;
      ui.view = dockViews[idx] || 'home';
      renderAppShell();
    });
  });

  // Continue Studying button on Hero Card
  const continueBtn = document.getElementById('continue-study-btn');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      const lastSub = state.lastStudied?.subjectId || 'maths';
      ui.subjectFilter = lastSub;
      if (state.lastStudied?.type === 'quiz') openView('quiz');
      else if (state.lastStudied?.type === 'flashcard') openView('flashcards');
      else openView('notes');
    });
  }

  // Subject filter chips
  document.querySelectorAll('[data-filter-sub]').forEach((chip) => {
    chip.addEventListener('click', () => {
      ui.subjectFilter = chip.getAttribute('data-filter-sub') || 'all';
      ui.quizIndex = 0;
      ui.quizSelectedOption = null;
      ui.quizFinished = false;
      ui.cardIndex = 0;
      ui.cardFlipped = false;
      renderAppShell();
    });
  });

  // --- Notes Events ---
  const toggleNoteBtn = document.getElementById('toggle-new-note-btn');
  if (toggleNoteBtn) {
    toggleNoteBtn.addEventListener('click', () => {
      ui.showNewNoteForm = !ui.showNewNoteForm;
      renderAppShell();
    });
  }

  const newNoteForm = document.getElementById('new-note-form');
  if (newNoteForm) {
    newNoteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(newNoteForm);
      const subjectId = String(fd.get('subjectId') || 'maths');
      const title = String(fd.get('title') || '').trim();
      const formula = String(fd.get('formula') || '').trim();
      const summary = String(fd.get('summary') || '').trim();
      if (!title || !summary) return;

      const sub = getSubjectById(subjectId);
      const newNote = {
        id: `note-${Date.now()}`,
        subjectId,
        title,
        topic: sub.short,
        keyFormulas: formula ? [formula] : [],
        summary,
        bookmarked: true
      };
      state.notes.unshift(newNote);
      state.lastStudied = {
        type: 'note',
        id: newNote.id,
        subjectId,
        title: `${sub.name} — ${title}`
      };
      saveState(state);
      ui.showNewNoteForm = false;
      renderAppShell();
    });
  }

  document.querySelectorAll('[data-note-card]').forEach((cardEl) => {
    cardEl.addEventListener('click', () => {
      const id = cardEl.getAttribute('data-note-card');
      const found = state.notes.find((n) => n.id === id);
      if (found) {
        const sub = getSubjectById(found.subjectId);
        state.lastStudied = {
          type: 'note',
          id: found.id,
          subjectId: found.subjectId,
          title: `${sub.name} — ${found.topic || found.title}`
        };
        saveState(state);
      }
    });
  });

  // --- Quick Quiz Events ---
  const pool = state.quizzes.filter(
    (q) => ui.subjectFilter === 'all' || q.subjectId === ui.subjectFilter
  );
  document.querySelectorAll('[data-quiz-opt]').forEach((optBtn) => {
    optBtn.addEventListener('click', () => {
      const chosen = Number(optBtn.getAttribute('data-quiz-opt'));
      const currentQ = pool[Math.min(ui.quizIndex, pool.length - 1)];
      if (!currentQ) return;

      ui.quizSelectedOption = chosen;
      const sub = getSubjectById(currentQ.subjectId);
      state.lastStudied = {
        type: 'quiz',
        id: currentQ.id,
        subjectId: currentQ.subjectId,
        title: `${sub.name} — ${currentQ.topic}`
      };

      if (chosen === currentQ.correctIndex) {
        ui.quizScore += 1;
        state.subjectConfidence[currentQ.subjectId] = Math.min(
          100,
          Number(state.subjectConfidence[currentQ.subjectId] || 75) + 2
        );
      } else {
        state.subjectConfidence[currentQ.subjectId] = Math.max(
          40,
          Number(state.subjectConfidence[currentQ.subjectId] || 75) - 1
        );
      }
      saveState(state);
      renderAppShell();
    });
  });

  const nextQuizBtn = document.getElementById('next-quiz-btn');
  if (nextQuizBtn) {
    nextQuizBtn.addEventListener('click', () => {
      if (ui.quizIndex + 1 < pool.length) {
        ui.quizIndex += 1;
        ui.quizSelectedOption = null;
      } else {
        ui.quizFinished = true;
        state.dailyCompleted += 1;
        saveState(state);
      }
      renderAppShell();
    });
  }

  const restartQuizBtn = document.getElementById('restart-quiz-btn');
  if (restartQuizBtn) {
    restartQuizBtn.addEventListener('click', () => {
      ui.quizIndex = 0;
      ui.quizSelectedOption = null;
      ui.quizScore = 0;
      ui.quizFinished = false;
      renderAppShell();
    });
  }

  // --- Flashcards Events ---
  const flipBox = document.getElementById('flashcard-flip-box');
  if (flipBox) {
    flipBox.addEventListener('click', () => {
      ui.cardFlipped = !ui.cardFlipped;
      renderAppShell();
    });
  }

  const toggleNewCardBtn = document.getElementById('toggle-new-card-btn');
  if (toggleNewCardBtn) {
    toggleNewCardBtn.addEventListener('click', () => {
      ui.showNewCardForm = !ui.showNewCardForm;
      renderAppShell();
    });
  }

  const newCardForm = document.getElementById('new-card-form');
  if (newCardForm) {
    newCardForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(newCardForm);
      const subjectId = String(fd.get('subjectId') || 'maths');
      const front = String(fd.get('front') || '').trim();
      const back = String(fd.get('back') || '').trim();
      if (!front || !back) return;
      state.flashcards.unshift({
        id: `fc-${Date.now()}`,
        subjectId,
        front,
        back,
        mastered: false
      });
      saveState(state);
      ui.showNewCardForm = false;
      ui.cardIndex = 0;
      ui.cardFlipped = false;
      renderAppShell();
    });
  }

  const deck = state.flashcards.filter(
    (c) => ui.subjectFilter === 'all' || c.subjectId === ui.subjectFilter
  );
  const fcPracticeBtn = document.getElementById('fc-practice-btn');
  if (fcPracticeBtn && deck.length) {
    fcPracticeBtn.addEventListener('click', () => {
      const card = deck[ui.cardIndex % deck.length];
      card.mastered = false;
      ui.cardIndex = (ui.cardIndex + 1) % deck.length;
      ui.cardFlipped = false;
      saveState(state);
      renderAppShell();
    });
  }

  const fcGotItBtn = document.getElementById('fc-gotit-btn');
  if (fcGotItBtn && deck.length) {
    fcGotItBtn.addEventListener('click', () => {
      const card = deck[ui.cardIndex % deck.length];
      if (!card.mastered) {
        card.mastered = true;
        state.subjectConfidence[card.subjectId] = Math.min(
          100,
          Number(state.subjectConfidence[card.subjectId] || 75) + 1
        );
      }
      const sub = getSubjectById(card.subjectId);
      state.lastStudied = {
        type: 'flashcard',
        id: card.id,
        subjectId: card.subjectId,
        title: `${sub.name} — Flashcards`
      };
      ui.cardIndex = (ui.cardIndex + 1) % deck.length;
      ui.cardFlipped = false;
      saveState(state);
      renderAppShell();
    });
  }

  // --- Study Planner Events ---
  document.querySelectorAll('[data-toggle-task]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-toggle-task');
      const task = state.tasks.find((t) => t.id === id);
      if (task) {
        task.done = !task.done;
        if (task.done) state.dailyCompleted += 1;
        saveState(state);
        renderAppShell();
      }
    });
  });

  const addTaskForm = document.getElementById('add-task-form');
  if (addTaskForm) {
    addTaskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addTaskForm);
      const title = String(fd.get('title') || '').trim();
      if (!title) return;
      state.tasks.unshift({
        id: `t-${Date.now()}`,
        title,
        subjectId: 'maths',
        done: false
      });
      saveState(state);
      renderAppShell();
    });
  }

  const toggleExamFormBtn = document.getElementById('toggle-exam-form-btn');
  if (toggleExamFormBtn) {
    toggleExamFormBtn.addEventListener('click', () => {
      ui.showNewExamForm = !ui.showNewExamForm;
      renderAppShell();
    });
  }

  const addExamForm = document.getElementById('add-exam-form');
  if (addExamForm) {
    addExamForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addExamForm);
      const title = String(fd.get('title') || '').trim();
      const daysAway = Number(fd.get('daysAway') || 7);
      if (!title) return;
      state.exams.push({
        id: `ex-${Date.now()}`,
        subjectId: 'maths',
        title,
        daysAway
      });
      state.exams.sort((a, b) => a.daysAway - b.daysAway);
      saveState(state);
      ui.showNewExamForm = false;
      renderAppShell();
    });
  }

  // --- Focus Timer Events ---
  document.querySelectorAll('[data-timer-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mins = Number(btn.getAttribute('data-timer-preset') || 25);
      stopFocusTimer();
      ui.timerModeMinutes = mins;
      ui.timerSecondsLeft = mins * 60;
      renderAppShell();
    });
  });

  const timerToggleBtn = document.getElementById('timer-toggle-btn');
  if (timerToggleBtn) {
    timerToggleBtn.addEventListener('click', () => {
      if (ui.timerRunning) {
        stopFocusTimer();
      } else {
        startFocusTimer();
      }
      renderAppShell();
    });
  }

  const timerResetBtn = document.getElementById('timer-reset-btn');
  if (timerResetBtn) {
    timerResetBtn.addEventListener('click', () => {
      stopFocusTimer();
      ui.timerSecondsLeft = ui.timerModeMinutes * 60;
      renderAppShell();
    });
  }

  // --- Goal & Weak-Spot Events ---
  document.querySelectorAll('[data-goal-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.dailyGoalTarget = Number(btn.getAttribute('data-goal-target') || 4);
      saveState(state);
      renderAppShell();
    });
  });

  const weakSpotBtn = document.getElementById('practice-weakspot-btn');
  if (weakSpotBtn) {
    weakSpotBtn.addEventListener('click', () => {
      ui.subjectFilter = weakSpotBtn.getAttribute('data-sub') || 'all';
      openView('quiz');
    });
  }

  // --- Confidence & Settings Events ---
  const themeBtn = document.getElementById('toggle-theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      state.theme = state.theme === 'night' ? 'light' : 'night';
      saveState(state);
      renderAppShell();
    });
  }

  const replayIntroBtn = document.getElementById('replay-intro-btn');
  if (replayIntroBtn) {
    replayIntroBtn.addEventListener('click', () => startTenSecondLoadingSequence());
  }

  const exportBackupBtn = document.getElementById('export-backup-btn');
  if (exportBackupBtn) {
    exportBackupBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'i-tutor-offline-backup.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const resetDataBtn = document.getElementById('reset-data-btn');
  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', () => {
      state = resetState();
      renderAppShell();
    });
  }
}

function startFocusTimer() {
  if (ui.timerIntervalId) clearInterval(ui.timerIntervalId);
  ui.timerRunning = true;
  ui.timerIntervalId = setInterval(() => {
    if (ui.timerSecondsLeft > 0) {
      ui.timerSecondsLeft -= 1;
      const liveEl = document.getElementById('timer-live-readout');
      if (liveEl) liveEl.textContent = formatTimer(ui.timerSecondsLeft);
    } else {
      stopFocusTimer();
      state.focusMinutesToday += ui.timerModeMinutes;
      state.dailyCompleted += 1;
      saveState(state);
      ui.timerSecondsLeft = ui.timerModeMinutes * 60;
      renderAppShell();
    }
  }, 1000);
}

function stopFocusTimer() {
  ui.timerRunning = false;
  if (ui.timerIntervalId) {
    clearInterval(ui.timerIntervalId);
    ui.timerIntervalId = null;
  }
}

/* ==========================================================================
   5. BOOT WITH 10-SECOND LOADING SEQUENCE
   ========================================================================== */

function startTenSecondLoadingSequence() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  if (activeAnimationFrame) {
    cancelAnimationFrame(activeAnimationFrame);
    activeAnimationFrame = null;
  }

  appEl.innerHTML = renderSplashScreenMarkup();

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
      if (pct >= phase.threshold) {
        currentPhase = phase.text;
      }
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

function registerOfflineServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

applyTheme();
registerOfflineServiceWorker();
startTenSecondLoadingSequence();
