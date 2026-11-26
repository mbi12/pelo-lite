import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server.js';
import { authenticateAccount, applyActionToVault } from '../public/js/offlineStore.js';

test('i-tutor v5: accounts, admissions, homework & chat media uploads (PDF/Photo/Video), and built-in viewer assets', async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Verify Built-In Opener static assets & sample media serve cleanly
    const pdfJsRes = await fetch(`${baseUrl}/vendor/pdfjs/pdf.min.js`);
    assert.equal(pdfJsRes.status, 200);
    const pdfWorkerRes = await fetch(`${baseUrl}/vendor/pdfjs/pdf.worker.min.js`);
    assert.equal(pdfWorkerRes.status, 200);
    const samplePdfRes = await fetch(`${baseUrl}/samples/trig-identities-worksheet.pdf`);
    assert.equal(samplePdfRes.status, 200);
    const sampleDiagRes = await fetch(`${baseUrl}/samples/newton-pulley-diagram.svg`);
    assert.equal(sampleDiagRes.status, 200);
    const officialFlyerRes = await fetch(`${baseUrl}/assets/itutor-official-flyer.jpg`);
    assert.equal(officialFlyerRes.status, 200);

    // 2. Test binary media upload endpoint (/api/upload) & signed upload endpoint (/api/upload-sign)
    const signRes = await fetch(`${baseUrl}/api/upload-sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'homework-scan.pdf', contentType: 'application/pdf' })
    });
    assert.equal(signRes.status, 200);
    const signJson = await signRes.json();
    assert.ok(signJson.objectName);

    const fakePdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF', 'utf8');
    const upRes = await fetch(`${baseUrl}/api/upload?name=admin-homework.pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: fakePdfBytes
    });
    assert.equal(upRes.status, 200);
    const upJson = await upRes.json();
    assert.equal(upJson.ok, true);
    assert.ok(upJson.url);

    // 3. Initial GET /api/sync — verify official Botswana Pula prices, P100 Registration Fee, Francistown contacts & Flyer
    const res1 = await fetch(`${baseUrl}/api/sync`);
    assert.equal(res1.status, 200);
    const snap1 = await res1.json();
    assert.ok(snap1.profiles.some((p) => p.role === 'admissions'));
    assert.ok(snap1.profiles.some((p) => p.role === 'admin'));
    const adminAuth = authenticateAccount(snap1, 'itutor@gmail.com', 'vinny@123');
    assert.equal(adminAuth.ok, true);
    assert.equal(adminAuth.profile.role, 'admin');
    const badAuth = authenticateAccount(snap1, 'itutor@gmail.com', 'wrong-pass');
    assert.equal(badAuth.ok, false);
    assert.ok(snap1.assignments.length >= 3);
    assert.equal(snap1.tuitionInfo.registration_fee, 'P100');
    assert.ok(snap1.tuitionInfo.contacts.address.includes('Francistown, Minestone Plot No. 1589'));
    assert.equal(snap1.tuitionInfo.contacts.phone, '77 329 788');
    assert.equal(snap1.tuitionInfo.contacts.email, 'i-tutor@gmail.com');
    assert.ok(snap1.tuitionInfo.plans.some((pl) => pl.name.includes('Breakthrough Classes') && pl.price.includes('P500')));
    assert.ok(snap1.tuitionInfo.plans.some((pl) => pl.name.includes('JCE Level')));
    assert.ok(snap1.tuitionInfo.plans.some((pl) => pl.name.includes('Form 4') && pl.price.includes('P750')));
    assert.ok(Array.isArray(snap1.tuitionInfo.flyers) && snap1.tuitionInfo.flyers.length >= 1);

    // 3b. Test Admin adding a temporary flyer & price package and restoring original state
    const origFlyers = snap1.tuitionInfo.flyers;
    const origPlans = snap1.tuitionInfo.plans;
    const testFlyer = {
      id: 'flyer-test-admin',
      title: 'Test Exam Revision Flyer',
      badge: 'Holiday Camp',
      subtitle: 'JCE & BGCSE Intensive Revision',
      attachment: {
        id: 'att-flyer-test',
        name: 'itutor-official-flyer.jpg',
        kind: 'image',
        mime: 'image/jpeg',
        url: '/assets/itutor-official-flyer.jpg'
      }
    };
    const testPlan = {
      id: 'plan-test-admin',
      name: 'BGCSE Holiday Bootcamp',
      price: 'P350 / week',
      numericRate: 350,
      badge: 'Holiday Special',
      features: ['Past paper drills', 'Free extra lessons included']
    };
    const origCustomSubjects = Array.isArray(snap1.tuitionInfo.custom_subjects)
      ? snap1.tuitionInfo.custom_subjects
      : [];
    const resFlyerUpdate = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actions: [
          {
            type: 'UPDATE_TUITION_INFO',
            payload: {
              flyers: [testFlyer, ...origFlyers],
              plans: [...origPlans, testPlan],
              custom_subjects: [...origCustomSubjects, 'Setswana', 'Biology']
            }
          }
        ]
      })
    });
    assert.equal(resFlyerUpdate.status, 200);
    const snapAfterFlyer = await resFlyerUpdate.json();
    assert.ok(snapAfterFlyer.tuitionInfo.flyers.some((f) => f.id === 'flyer-test-admin'));
    assert.ok(snapAfterFlyer.tuitionInfo.plans.some((p) => p.id === 'plan-test-admin'));
    assert.ok(snapAfterFlyer.tuitionInfo.custom_subjects.includes('Setswana'));
    assert.ok(snapAfterFlyer.tuitionInfo.custom_subjects.includes('Biology'));

    // Restore original flyers, plans & custom_subjects cleanly
    await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actions: [
          {
            type: 'UPDATE_TUITION_INFO',
            payload: { flyers: origFlyers, plans: origPlans, custom_subjects: origCustomSubjects }
          }
        ]
      })
    });

    // 4. Test Admin Homework PDF+Photo upload AND Chat PDF+Video+Photo message sync
    const testAssignId = 'asg-test-media-pack';
    const testMsgId = 'msg-test-media-chat';
    const testAccId = 'acc-test-joiner';
    const testNoteId = 'note-test-subj-studio';

    const mediaActions = [
      {
        type: 'UPSERT_ACCOUNT',
        payload: {
          id: testAccId,
          name: 'Zanele Mthembu',
          role: 'student',
          subtitle: 'Form 4 · Accepted',
          grade: 'Form 4',
          pin: '5678',
          email: 'zanele@example.com',
          phone: '+267 71 999 000',
          status: 'active',
          subjects: ['Mathematics', 'Double Science'],
          selected_plan: 'BGCSE / IGCSE — Form 4 (Best 6)',
          notes: 'Test learner',
          avatar: '🦉',
          subject_notes: {
            Mathematics: { group: 'Group A · Exam Sprint', note: 'Strong trigonometry progress' }
          }
        }
      },
      {
        type: 'UPSERT_STUDY_NOTE',
        payload: {
          id: testNoteId,
          subject: 'Mathematics',
          title: 'Teacher Organized Trig Handout',
          grade_group: 'BGCSE / Form 4',
          summary: 'Organized by teacher under Mathematics with PDF handout.',
          formulas: ['sin²x + cos²x = 1'],
          author_name: 'Ms. Naledi Khumalo',
          author_id: 'tch-naledi',
          attachments: [
            {
              id: 'att-note-pdf',
              name: 'trig-identities-worksheet.pdf',
              kind: 'pdf',
              mime: 'application/pdf',
              size: 2948,
              url: '/samples/trig-identities-worksheet.pdf'
            }
          ]
        }
      },
      {
        type: 'UPSERT_ASSIGNMENT',
        payload: {
          id: testAssignId,
          title: 'Admin Uploaded Trig PDF & Diagram Homework',
          subject: 'Mathematics',
          grade_group: 'Grade 12',
          teacher_id: 'admin-1',
          teacher_name: 'Kgomotso Dlamini (Admin)',
          due_date: '2026-12-10',
          max_marks: 40,
          instructions: 'Complete all questions in the attached PDF and diagram.',
          offline_pack_content: '',
          attachments: [
            {
              id: 'att-test-pdf',
              name: 'admin-homework.pdf',
              kind: 'pdf',
              mime: 'application/pdf',
              size: fakePdfBytes.length,
              url: upJson.url
            },
            {
              id: 'att-test-img',
              name: 'newton-pulley-diagram.svg',
              kind: 'image',
              mime: 'image/svg+xml',
              size: 1940,
              url: '/samples/newton-pulley-diagram.svg'
            }
          ]
        }
      },
      {
        type: 'SEND_MESSAGE',
        payload: {
          id: testMsgId,
          room_id: 'room-1on1-maths',
          sender_id: 'admin-1',
          sender_name: 'Kgomotso Dlamini',
          sender_role: 'admin',
          body: 'Sharing PDF worksheet, diagram photo, and walkthrough video!',
          attachments: [
            {
              id: 'att-chat-pdf',
              name: 'trig-identities-worksheet.pdf',
              kind: 'pdf',
              mime: 'application/pdf',
              size: 2948,
              url: '/samples/trig-identities-worksheet.pdf'
            },
            {
              id: 'att-chat-vid',
              name: 'trig-walkthrough.mp4',
              kind: 'video',
              mime: 'video/mp4',
              size: 1048576,
              url: upJson.url
            }
          ],
          created_at: new Date().toISOString()
        }
      }
    ];

    const resMedia = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: mediaActions })
    });
    assert.equal(resMedia.status, 200);
    const snapMedia = await resMedia.json();

    const savedAcc = snapMedia.profiles.find((p) => p.id === testAccId);
    assert.ok(savedAcc, 'Saved student exists with editable profile icon and subject_notes');
    assert.equal(savedAcc.avatar, '🦉');
    assert.equal(savedAcc.subject_notes?.Mathematics?.group, 'Group A · Exam Sprint');

    const savedNote = snapMedia.notes.find((n) => n.id === testNoteId);
    assert.ok(savedNote, 'Teacher subject note with PDF attachment exists');
    assert.equal(savedNote.subject, 'Mathematics');
    assert.equal(savedNote.grade_group, 'BGCSE / Form 4');
    assert.equal(savedNote.attachments.length, 1);

    const savedAsg = snapMedia.assignments.find((a) => a.id === testAssignId);
    assert.ok(savedAsg, 'Uploaded homework exists in snapshot');
    assert.equal(savedAsg.attachments.length, 2);
    assert.equal(savedAsg.attachments[0].kind, 'pdf');
    assert.equal(savedAsg.attachments[1].kind, 'image');

    const savedMsg = snapMedia.messages.find((m) => m.id === testMsgId);
    assert.ok(savedMsg, 'Uploaded chat media message exists in snapshot');
    assert.equal(savedMsg.attachments.length, 2);
    assert.equal(savedMsg.attachments[0].kind, 'pdf');
    assert.equal(savedMsg.attachments[1].kind, 'video');

    // 5. Test Direct 1:1 Room Creation, Multi-Message Send, Message Edit, and In-Flight Replay
    const testRoomId = `room-dir-test-${Date.now()}`;
    const testDirectMsgId = `msg-dir-test-${Date.now()}`;
    const resDirectChat = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actions: [
          {
            type: 'UPSERT_ROOM',
            payload: {
              id: testRoomId,
              room_type: 'direct',
              name: 'Ms. Naledi Khumalo · Thabo Mokoena',
              subject: 'Mathematics Progress Check-In',
              participant_ids: ['par-grace', 'tch-naledi', 'admin-itutor'],
              members_label: 'Direct 1:1 · Mrs. Grace Mokoena & Ms. Naledi Khumalo',
              created_by_name: 'Mrs. Grace Mokoena'
            }
          },
          {
            type: 'SEND_MESSAGE',
            payload: {
              id: testDirectMsgId,
              room_id: testRoomId,
              sender_id: 'par-grace',
              sender_name: 'Mrs. Grace Mokoena',
              sender_role: 'parent',
              body: 'Good afternoon Ms. Naledi, how is Thabo doing in Trigonometry?',
              attachments: [],
              created_at: new Date().toISOString()
            }
          }
        ]
      })
    });
    assert.equal(resDirectChat.status, 200);
    const snapDirect = await resDirectChat.json();
    assert.ok(snapDirect.rooms.some((r) => r.id === testRoomId && r.room_type === 'direct'));
    assert.ok(snapDirect.messages.some((m) => m.id === testDirectMsgId));

    // Edit the sent message
    const resEditMsg = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actions: [
          {
            type: 'UPSERT_MESSAGE',
            payload: {
              id: testDirectMsgId,
              room_id: testRoomId,
              sender_id: 'par-grace',
              sender_name: 'Mrs. Grace Mokoena',
              sender_role: 'parent',
              body: 'Good afternoon Ms. Naledi, how is Thabo doing in Trigonometry this week?',
              attachments: [],
              created_at: new Date().toISOString()
            }
          }
        ]
      })
    });
    assert.equal(resEditMsg.status, 200);
    const snapEdited = await resEditMsg.json();
    const editedMsg = snapEdited.messages.find((m) => m.id === testDirectMsgId);
    assert.ok(editedMsg && editedMsg.body.includes('this week?'));

    // Verify applyActionToVault replays in-flight pending messages without loss
    const clonedVault = JSON.parse(JSON.stringify(snapEdited));
    applyActionToVault(clonedVault, {
      type: 'SEND_MESSAGE',
      payload: {
        id: 'msg-inflight-1',
        room_id: testRoomId,
        sender_id: 'tch-naledi',
        sender_name: 'Ms. Naledi Khumalo',
        sender_role: 'teacher',
        body: 'He scored 88% on the practice drill!',
        attachments: [],
        created_at: new Date().toISOString()
      }
    });
    assert.ok(clonedVault.messages.some((m) => m.id === 'msg-inflight-1'));

    // Verify live presence heartbeat (?uid=...) & explicit sign-out (/api/presence offline:true)
    const resPresenceOn = await fetch(`${baseUrl}/api/sync?uid=tch-naledi`);
    assert.equal(resPresenceOn.status, 200);
    const snapPresOn = await resPresenceOn.json();
    const nalediOn = snapPresOn.profiles.find((p) => p.id === 'tch-naledi');
    assert.ok(nalediOn && nalediOn.last_seen_at);
    assert.ok(Date.now() - Date.parse(nalediOn.last_seen_at) < 15000);

    const resPresenceOff = await fetch(`${baseUrl}/api/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'tch-naledi', offline: true })
    });
    assert.equal(resPresenceOff.status, 200);
    const snapPresOff = await (await fetch(`${baseUrl}/api/sync`)).json();
    const nalediOff = snapPresOff.profiles.find((p) => p.id === 'tch-naledi');
    assert.ok(nalediOff && Date.now() - Date.parse(nalediOff.last_seen_at) >= 100000);

    // 6. Clean up temporary test entities
    await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actions: [
          { type: 'DELETE_ASSIGNMENT', payload: { id: testAssignId } },
          { type: 'DELETE_MESSAGE', payload: { id: testMsgId } },
          { type: 'DELETE_MESSAGE', payload: { id: testDirectMsgId } },
          { type: 'DELETE_ROOM', payload: { id: testRoomId } },
          { type: 'DELETE_ACCOUNT', payload: { id: testAccId } },
          { type: 'DELETE_STUDY_NOTE', payload: { id: testNoteId } }
        ]
      })
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
