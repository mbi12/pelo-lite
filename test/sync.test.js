import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server.js';

test('i-tutor v4: full account system, admissions approval, and complete in-app editing across all modules', async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Initial GET /api/sync
    const res1 = await fetch(`${baseUrl}/api/sync`);
    assert.equal(res1.status, 200);
    const snap1 = await res1.json();
    assert.ok(snap1.profiles.some((p) => p.role === 'admissions'));
    assert.ok(snap1.profiles.some((p) => p.status === 'pending'));
    assert.ok(snap1.timetables.length >= 6);
    assert.ok(snap1.assignments.length >= 3);
    assert.ok(snap1.notes.length >= 6);
    assert.ok(snap1.quizzes.length >= 8);
    assert.ok(snap1.flashcards.length >= 6);

    // 2. Test New Join Application -> Admissions Approval -> Full In-App Edits
    const actions1 = [
      {
        type: 'UPSERT_ACCOUNT',
        payload: {
          id: 'acc-new-joiner',
          name: 'Zanele Mthembu',
          role: 'student',
          subtitle: 'Grade 12 · Applicant',
          grade: 'Grade 12',
          pin: '5678',
          email: 'zanele@example.com',
          phone: '+27 71 999 0000',
          status: 'pending',
          subjects: ['Mathematics', 'Accounting'],
          selected_plan: '3-Subject Core Package',
          notes: 'New applicant via Join portal'
        }
      }
    ];

    const resPending = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: actions1 })
    });
    const snapPending = await resPending.json();
    const pendingUser = snapPending.profiles.find((p) => p.id === 'acc-new-joiner');
    assert.equal(pendingUser.status, 'pending');

    // 3. Admissions accepts applicant & edits timetable, assignment, note, quiz, flashcard, room, broadcast, attendance & tuition plans
    const actions2 = [
      {
        type: 'UPSERT_ACCOUNT',
        payload: {
          ...pendingUser,
          status: 'active',
          subtitle: 'Grade 12 · Accepted by Admissions'
        }
      },
      {
        type: 'UPSERT_TIMETABLE',
        payload: {
          ...snapPending.timetables[0],
          topic: 'Edited Topic: Advanced Trig Identities'
        }
      },
      {
        type: 'UPSERT_ASSIGNMENT',
        payload: {
          ...snapPending.assignments[0],
          title: 'Edited Remote Worksheet 4: Trig Proofs'
        }
      },
      {
        type: 'UPSERT_STUDY_NOTE',
        payload: {
          ...snapPending.notes[0],
          title: 'Edited Trig Formula Guide'
        }
      },
      {
        type: 'UPSERT_QUIZ',
        payload: {
          id: 'q-custom-edit',
          subject: 'Mathematics',
          topic: 'Algebra',
          question: 'Solve 3x = 15',
          options: ['3', '5', '12', '45'],
          correct_index: 1,
          explanation: 'Divide both sides by 3.'
        }
      },
      {
        type: 'UPSERT_FLASHCARD',
        payload: {
          id: 'fc-custom-edit',
          subject: 'Accounting',
          front: 'Net Profit formula?',
          back: 'Gross Profit + Other Income - Operating Expenses'
        }
      },
      {
        type: 'UPDATE_TUITION_INFO',
        payload: {
          headline: 'Updated Tuition Headline by Admissions',
          intro: snapPending.tuitionInfo.intro,
          plans: [
            ...snapPending.tuitionInfo.plans,
            {
              id: 'plan-holiday',
              name: 'Holiday Boot Camp',
              price: 'R750 / camp',
              numericRate: 750,
              badge: 'Seasonal',
              features: ['5-day intensive exam prep']
            }
          ],
          contacts: {
            ...snapPending.tuitionInfo.contacts,
            phone: '+27 11 555 8899'
          }
        }
      }
    ];

    const resEdited = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: actions2 })
    });
    assert.equal(resEdited.status, 200);
    const snapEdited = await resEdited.json();

    assert.equal(snapEdited.profiles.find((p) => p.id === 'acc-new-joiner').status, 'active');
    assert.equal(snapEdited.timetables[0].topic, 'Edited Topic: Advanced Trig Identities');
    assert.equal(
      snapEdited.assignments.find((a) => a.id === snapPending.assignments[0].id).title,
      'Edited Remote Worksheet 4: Trig Proofs'
    );
    assert.equal(snapEdited.notes.find((n) => n.id === snapPending.notes[0].id).title, 'Edited Trig Formula Guide');
    assert.ok(snapEdited.quizzes.some((q) => q.id === 'q-custom-edit'));
    assert.ok(snapEdited.flashcards.some((f) => f.id === 'fc-custom-edit'));
    assert.equal(snapEdited.tuitionInfo.headline, 'Updated Tuition Headline by Admissions');
    assert.ok(snapEdited.tuitionInfo.plans.some((p) => p.id === 'plan-holiday'));
    assert.equal(snapEdited.tuitionInfo.contacts.phone, '+27 11 555 8899');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
