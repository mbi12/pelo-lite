import { Router } from 'express';
import { store } from '../store.js';
import { computeStudentAnalytics } from '../confidence.js';
import { generateCoachReply } from '../coachEngine.js';

export const apiRouter = Router();

function buildHydratedPayload(snapshot) {
  const students = snapshot.users.filter((u) => u.role === 'student');
  const analytics_by_student = {};
  for (const stu of students) {
    analytics_by_student[stu.id] = computeStudentAnalytics(stu.id, snapshot);
  }
  return {
    ...snapshot,
    storage_mode: store.getStorageMode(),
    analytics_by_student
  };
}

apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    brand: 'i-tutor',
    tagline: 'Confidence in learning',
    version: '1.0.0',
    storage: store.getStorageMode()
  });
});

apiRouter.get('/bootstrap', async (_req, res) => {
  try {
    const snapshot = await store.fetchFullSnapshot();
    res.json(buildHydratedPayload(snapshot));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load i-tutor workspace.' });
  }
});

apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both email and password.' });
    }
    const user = await store.authenticateUser({ email, password });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password. (Demo accounts use password: itutor123)' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, grade, linked_student_id } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const user = await store.registerUser({ name, email, password, role, grade, linked_student_id });
    const snapshot = await store.fetchFullSnapshot();
    res.status(201).json({ user, snapshot: buildHydratedPayload(snapshot) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/students/:id/mood', async (req, res) => {
  try {
    const { mood } = req.body || {};
    if (!['stuck', 'building', 'confident'].includes(mood)) {
      return res.status(400).json({ error: 'Invalid confidence mood.' });
    }
    const user = await store.updateStudentMood({ studentId: req.params.id, mood });
    const snapshot = await store.fetchFullSnapshot();
    res.json({ user, analytics: computeStudentAnalytics(req.params.id, snapshot) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/subjects', async (req, res) => {
  try {
    const { name, code, grade_level, tutor_name, description, topics } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Subject name is required.' });
    const subject = await store.createSubject({ name, code, grade_level, tutor_name, description, topics });
    res.status(201).json({ subject });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/sessions', async (req, res) => {
  try {
    const { subject_id, title, topic } = req.body || {};
    if (!subject_id || !title || !topic) {
      return res.status(400).json({ error: 'Subject, session title, and topic are required.' });
    }
    const session = await store.createSession(req.body);
    res.status(201).json({ session });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/sessions/:id/recap', async (req, res) => {
  try {
    const session = await store.updateSessionRecap({
      sessionId: req.params.id,
      status: req.body?.status,
      lesson_recap: req.body?.lesson_recap,
      key_takeaways: req.body?.key_takeaways
    });
    res.json({ session });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/sessions/:id/attendance', async (req, res) => {
  try {
    const { student_id, status, confidence_checkin, note } = req.body || {};
    if (!student_id) return res.status(400).json({ error: 'student_id is required.' });
    const record = await store.upsertAttendance({
      sessionId: req.params.id,
      studentId: student_id,
      status,
      confidence_checkin,
      note
    });
    res.json({ attendance: record });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/help-requests', async (req, res) => {
  try {
    const { student_id, subject_id, topic, preferred_slot, notes } = req.body || {};
    if (!student_id || !subject_id || !topic || !preferred_slot) {
      return res.status(400).json({ error: 'Subject, topic, and preferred time slot are required.' });
    }
    const request = await store.createHelpRequest({ student_id, subject_id, topic, preferred_slot, notes });
    res.status(201).json({ request });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/help-requests/:id', async (req, res) => {
  try {
    const { status, tutor_response, create_session_payload } = req.body || {};
    const result = await store.resolveHelpRequest({
      requestId: req.params.id,
      status,
      tutor_response,
      create_session_payload
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/resources', async (req, res) => {
  try {
    const { subject_id, topic, title, content_body } = req.body || {};
    if (!subject_id || !topic || !title || !content_body) {
      return res.status(400).json({ error: 'Subject, topic, title, and study content are required.' });
    }
    const resource = await store.createResource(req.body);
    res.status(201).json({ resource });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/resources/:id/progress', async (req, res) => {
  try {
    const { student_id, bookmarked, completed } = req.body || {};
    if (!student_id) return res.status(400).json({ error: 'student_id is required.' });
    const progress = await store.toggleResourceProgress({
      resourceId: req.params.id,
      studentId: student_id,
      bookmarked,
      completed
    });
    res.json({ progress });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/quizzes', async (req, res) => {
  try {
    const { subject_id, topic, title, questions } = req.body || {};
    if (!subject_id || !topic || !title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Subject, topic, quiz title, and at least 1 question are required.' });
    }
    const quiz = await store.createQuiz(req.body);
    res.status(201).json({ quiz });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/quizzes/:id/attempt', async (req, res) => {
  try {
    const { student_id, answers, duration_secs, confidence_after } = req.body || {};
    if (!student_id || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'student_id and answers array are required.' });
    }
    const result = await store.submitQuizAttempt({
      quizId: req.params.id,
      studentId: student_id,
      answers,
      durationSecs: duration_secs,
      confidenceAfter: confidence_after
    });
    const snapshot = await store.fetchFullSnapshot();
    res.status(201).json({
      ...result,
      analytics: computeStudentAnalytics(student_id, snapshot)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/assignments', async (req, res) => {
  try {
    const { subject_id, topic, title, instructions } = req.body || {};
    if (!subject_id || !topic || !title || !instructions) {
      return res.status(400).json({ error: 'Subject, topic, title, and instructions are required.' });
    }
    const assignment = await store.createAssignment(req.body);
    res.status(201).json({ assignment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/assignments/:id/submit', async (req, res) => {
  try {
    const { student_id, answer_text, student_confidence } = req.body || {};
    if (!student_id || !answer_text) {
      return res.status(400).json({ error: 'Please write your solution before submitting.' });
    }
    const submission = await store.submitHomework({
      assignmentId: req.params.id,
      studentId: student_id,
      answerText: answer_text,
      studentConfidence: student_confidence || 'building'
    });
    res.status(201).json({ submission });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/submissions/:id/grade', async (req, res) => {
  try {
    const { marks_awarded, tutor_feedback } = req.body || {};
    if (marks_awarded === undefined || marks_awarded === null) {
      return res.status(400).json({ error: 'Marks awarded is required.' });
    }
    const submission = await store.gradeSubmission({
      submissionId: req.params.id,
      marksAwarded: marks_awarded,
      tutorFeedback: tutor_feedback
    });
    res.json({ submission });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/coach/ask', async (req, res) => {
  try {
    const { student_id, student_name, subject_id, topic, mode, prompt } = req.body || {};
    if (!student_id) return res.status(400).json({ error: 'student_id is required.' });
    const cleanPrompt = (prompt || '').trim() || 'Give me a practice problem';
    const reply = generateCoachReply({
      prompt: cleanPrompt,
      subjectId: subject_id || 'sub-math',
      topic: topic || '',
      mode: mode || 'step_by_step',
      studentName: student_name || 'Learner'
    });
    const saved = await store.saveCoachExchange({
      studentId: student_id,
      subjectId: subject_id || 'sub-math',
      topic: topic || '',
      mode: mode || 'step_by_step',
      studentPrompt: cleanPrompt,
      coachReply: reply
    });
    res.status(201).json({ messages: saved, reply });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/announcements', async (req, res) => {
  try {
    const { subject_id, title, body, author_name, audience, pinned } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: 'Title and announcement message are required.' });
    const announcement = await store.createAnnouncement({ subject_id, title, body, author_name, audience, pinned });
    res.status(201).json({ announcement });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/messages', async (req, res) => {
  try {
    const { student_id, channel, sender_id, sender_name, sender_role, recipient_id, recipient_name, body } = req.body || {};
    if (!student_id || !sender_id || !body) {
      return res.status(400).json({ error: 'Message content is required.' });
    }
    const message = await store.sendMessage({
      student_id,
      channel: channel || 'direct',
      sender_id,
      sender_name: sender_name || 'Member',
      sender_role: sender_role || 'student',
      recipient_id: recipient_id || null,
      recipient_name: recipient_name || null,
      body
    });
    res.status(201).json({ message });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
