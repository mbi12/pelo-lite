import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server.js';

test('i-tutor offline-sync API: timetables, remote assignments, study groups, broadcasts & tuition info', async () => {
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
    assert.ok(snap1.timetables.length >= 6);
    assert.ok(snap1.assignments.length >= 3);
    assert.ok(snap1.assignments[0].offline_pack_content.length > 10);
    assert.ok(snap1.tuitionInfo.plans.length >= 4);
    assert.ok(snap1.tuitionInfo.contacts.phone);

    // 2. Replay Offline Outbox Actions via POST /api/sync
    const outboxActions = [
      {
        type: 'ADD_TIMETABLE',
        payload: {
          id: 'tt-test-offline',
          day_of_week: 'Friday',
          start_time: '17:00',
          end_time: '18:00',
          subject: 'Mathematics',
          topic: 'Euclidean Geometry Offline Drill',
          teacher_name: 'Ms. Naledi Khumalo',
          location_mode: 'Saved Offline',
          grade_group: 'Grade 12',
          owner_id: null,
          is_official: true
        }
      },
      {
        type: 'CREATE_ASSIGNMENT',
        payload: {
          id: 'asg-test-remote',
          title: 'Remote Weekend Euclidean Geometry Task',
          subject: 'Mathematics',
          grade_group: 'Grade 12',
          teacher_id: 'tch-naledi',
          teacher_name: 'Ms. Naledi Khumalo',
          due_date: '2026-12-06',
          max_marks: 25,
          instructions: 'Complete offline and submit.',
          offline_pack_content: '1) Prove cyclic quad PQRS [10 marks]'
        }
      },
      {
        type: 'CREATE_STUDY_GROUP',
        payload: {
          id: 'room-grp-test',
          room_type: 'group',
          name: 'Euclidean Geometry Study Group',
          subject: 'Mathematics',
          participant_ids: ['stu-thabo', 'stu-amahle'],
          members_label: 'Members: Thabo, Amahle',
          created_by_name: 'Thabo Mokoena'
        }
      },
      {
        type: 'SEND_MESSAGE',
        payload: {
          id: 'msg-test-1',
          room_id: 'room-grp-test',
          sender_id: 'stu-thabo',
          sender_name: 'Thabo Mokoena',
          sender_role: 'student',
          body: 'Let us solve Question 1 together!'
        }
      },
      {
        type: 'SEND_BROADCAST',
        payload: {
          id: 'bc-test-1',
          title: 'Weekend Geometry Pack Ready',
          body: 'Please open the app once online so the Euclidean pack downloads to your phone.',
          author_name: 'Kgomotso Dlamini (Admin)',
          author_role: 'admin',
          audience: 'students_parents',
          priority: 'important'
        }
      },
      {
        type: 'SUBMIT_ENQUIRY',
        payload: {
          id: 'eq-test-1',
          full_name: 'Siphesihle Zulu',
          contact_detail: '+27 82 555 0192',
          student_grade: 'Grade 11',
          selected_plan: '3-Subject Core Package',
          message: 'Interested in Maths & Physical Sciences'
        }
      }
    ];

    const res2 = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: outboxActions })
    });
    assert.equal(res2.status, 200);
    const snap2 = await res2.json();

    assert.ok(snap2.timetables.some((t) => t.id === 'tt-test-offline'));
    assert.ok(snap2.assignments.some((a) => a.id === 'asg-test-remote'));
    assert.ok(snap2.rooms.some((r) => r.id === 'room-grp-test'));
    assert.ok(snap2.messages.some((m) => m.id === 'msg-test-1'));
    assert.ok(snap2.broadcasts.some((b) => b.id === 'bc-test-1'));
    assert.ok(snap2.enquiries.some((e) => e.id === 'eq-test-1'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
