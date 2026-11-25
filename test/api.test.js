import test from 'node:test';
import assert from 'node:assert/strict';

process.env.FORCE_MEMORY_STORE = '1';

const { createApp } = await import('../server.js');

async function withServer(fn) {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('i-tutor health, bootstrap analytics, quiz auto-grading, homework & Socratic AI coach', async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
    assert.equal(health.status, 'ok');
    assert.equal(health.brand, 'i-tutor');
    assert.equal(health.tagline, 'Confidence in learning');

    const boot = await fetch(`${baseUrl}/api/bootstrap`).then((r) => r.json());
    assert.ok(boot.users.length >= 5);
    assert.ok(boot.subjects.length >= 4);
    assert.ok(boot.analytics_by_student['stu-thabo'].overall_confidence > 0);

    // Submit quiz attempt and verify auto-grading
    const qzRes = await fetch(`${baseUrl}/api/quizzes/qz-math-trig/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu-thabo',
        answers: [0, 0, 0, 0],
        duration_secs: 95,
        confidence_after: 'confident'
      })
    }).then((r) => r.json());
    assert.equal(qzRes.attempt.score_percent, 100);
    assert.equal(qzRes.attempt.correct_count, 4);

    // Submit homework and grade it as tutor
    const hwRes = await fetch(`${baseUrl}/api/assignments/asg-1/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu-thabo',
        answer_text: 'LHS = (1 - sin²x)/(cosx sinx) = cos²x/(cosx sinx) = cosx/sinx = 1/tanx = RHS',
        student_confidence: 'confident'
      })
    }).then((r) => r.json());
    assert.equal(hwRes.submission.status, 'submitted');

    const gradeRes = await fetch(`${baseUrl}/api/submissions/${hwRes.submission.id}/grade`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marks_awarded: 20,
        tutor_feedback: 'Flawless proof!'
      })
    }).then((r) => r.json());
    assert.equal(gradeRes.submission.status, 'graded');
    assert.equal(gradeRes.submission.marks_awarded, 20);

    // Test Socratic AI Coach quadratic solver
    const coachRes = await fetch(`${baseUrl}/api/coach/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: 'stu-thabo',
        student_name: 'Thabo Mokoena',
        subject_id: 'sub-math',
        topic: 'Quadratic Equations & Inequalities',
        mode: 'step_by_step',
        prompt: 'x^2 - 5x + 6 = 0'
      })
    }).then((r) => r.json());
    assert.ok(coachRes.reply.steps.some((s) => s.includes('3') && s.includes('2')));
  });
});
