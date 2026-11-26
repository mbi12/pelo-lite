import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server.js';

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

    // 3. Initial GET /api/sync
    const res1 = await fetch(`${baseUrl}/api/sync`);
    assert.equal(res1.status, 200);
    const snap1 = await res1.json();
    assert.ok(snap1.profiles.some((p) => p.role === 'admissions'));
    assert.ok(snap1.profiles.some((p) => p.role === 'admin'));
    assert.ok(snap1.assignments.length >= 3);

    // 4. Test Admin Homework PDF+Photo upload AND Chat PDF+Video+Photo message sync
    const testAssignId = 'asg-test-media-pack';
    const testMsgId = 'msg-test-media-chat';
    const testAccId = 'acc-test-joiner';

    const mediaActions = [
      {
        type: 'UPSERT_ACCOUNT',
        payload: {
          id: testAccId,
          name: 'Zanele Mthembu',
          role: 'student',
          subtitle: 'Grade 12 · Accepted',
          grade: 'Grade 12',
          pin: '5678',
          email: 'zanele@example.com',
          phone: '+27 71 999 0000',
          status: 'active',
          subjects: ['Mathematics'],
          selected_plan: '3-Subject Core Package',
          notes: 'Test learner'
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

    // 5. Clean up temporary test entities
    await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actions: [
          { type: 'DELETE_ASSIGNMENT', payload: { id: testAssignId } },
          { type: 'DELETE_MESSAGE', payload: { id: testMsgId } },
          { type: 'DELETE_ACCOUNT', payload: { id: testAccId } }
        ]
      })
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
