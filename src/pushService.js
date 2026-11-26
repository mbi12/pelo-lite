import * as webpush from 'web-push';
import { createHash, timingSafeEqual } from 'node:crypto';

export const hash = (value) => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });

// Do not let a subscription turn the server into an arbitrary HTTP client.
export function validateSubscription(subscription) {
  let url;
  try { url = new URL(subscription?.endpoint); } catch { throw fail(400, 'Invalid push endpoint'); }
  const allowed = url.hostname === 'fcm.googleapis.com' ||
    url.hostname === 'updates.push.services.mozilla.com' ||
    url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.push.apple.com') ||
    url.hostname.endsWith('.notify.windows.com');
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !allowed || url.href.length > 2048) {
    throw fail(400, 'Unsupported push provider');
  }
  const { p256dh, auth } = subscription?.keys || {};
  if (typeof p256dh !== 'string' || !/^[\w-]+$/.test(p256dh) || Buffer.from(p256dh, 'base64url').length !== 65 ||
      typeof auth !== 'string' || !/^[\w-]+$/.test(auth) || Buffer.from(auth, 'base64url').length !== 16) {
    throw fail(400, 'Invalid subscription keys');
  }
  return { endpoint: url.href, keys: { p256dh, auth } };
}

export function canReceiveRoomPush(profile, room) {
  if (profile.status !== 'active' || profile.role === 'visitor') return false;
  if (['admin', 'admissions'].includes(profile.role)) return true;
  const member = (room.participant_ids || []).includes(profile.id);
  if (profile.role === 'parent') return member && room.room_type !== 'group';
  if (room.room_type === 'group' && room.subject) {
    const normalize = (s) => String(s).trim().toLowerCase();
    const subject = normalize(room.subject);
    return ['general', 'all subjects', 'free extra lessons'].includes(subject) ||
      (profile.subjects || []).some((s) => normalize(s) === 'all subjects' || normalize(s) === subject);
  }
  return member;
}

export function createPushService({ db, send = webpush.sendNotification.bind(webpush), env = process.env }) {
  const configured = () => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT &&
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.PUSH_APP_ORIGIN);
  const origin = () => new URL(env.PUSH_APP_ORIGIN).origin;
  const query = (value) => encodeURIComponent(value);

  async function subscribe({ userId, pin, subscription, deviceToken, sound = true, requestOrigin }) {
    if (!configured()) throw fail(503, 'Push notifications are not configured on the server yet.');
    if (requestOrigin !== origin()) throw fail(403, 'Enable notifications on the main i-tutor site.');
    if (typeof userId !== 'string' || !userId || typeof pin !== 'string' || pin.length > 256) throw fail(401, 'Sign in again.');
    if (typeof deviceToken !== 'string' || !/^[a-f0-9]{64}$/.test(deviceToken)) throw fail(400, 'Invalid device token');
    const clean = validateSubscription(subscription);
    const profiles = await db(`itutor_v2_profiles?id=eq.${query(userId)}&select=id,pin,status&limit=1`);
    const profile = profiles?.[0];
    const valid = profile && timingSafeEqual(Buffer.from(hash(String(profile.pin || ''))), Buffer.from(hash(pin)));
    if (!valid || profile.status !== 'active') throw fail(401, 'Sign in to an active account before enabling notifications.');
    // An endpoint belongs to one account at a time, so shared devices do not leak alerts.
    await db('itutor_push_subscriptions?on_conflict=endpoint_hash', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: { endpoint_hash: hash(clean.endpoint), user_id: userId, subscription: clean,
        token_hash: hash(deviceToken), sound: Boolean(sound), origin: origin(), updated_at: new Date().toISOString() }
    });
  }

  async function unsubscribe({ endpoint, deviceToken }) {
    if (typeof endpoint !== 'string' || typeof deviceToken !== 'string' || !/^[a-f0-9]{64}$/.test(deviceToken)) throw fail(400, 'Invalid device');
    // Possession of this random device capability is required, not just a user ID.
    await db(`itutor_push_subscriptions?endpoint_hash=eq.${hash(endpoint)}&token_hash=eq.${hash(deviceToken)}`, {
      method: 'DELETE', prefer: 'return=minimal'
    });
  }

  async function notifyMessages(actions, snapshot) {
    if (!configured() || snapshot.backend !== 'supabase') return;
    const ids = new Set(actions.filter((a) => a.type === 'SEND_MESSAGE').map((a) => a.payload?.id));
    if (!ids.size) return;
    const subscriptions = await db(`itutor_push_subscriptions?origin=eq.${query(origin())}&select=*`);
    const profiles = new Map((snapshot.profiles || []).map((p) => [p.id, p]));
    // Read persisted rows, never notification text/recipients supplied by the caller.
    for (const id of ids) {
      if (typeof id !== 'string') continue;
      const [message] = await db(`itutor_v2_messages?id=eq.${query(id)}&select=id,room_id,sender_id&limit=1`);
      if (!message) continue;
      const room = snapshot.rooms?.find((r) => r.id === message.room_id);
      if (!room) continue;
      const targets = subscriptions.filter((s) => s.user_id !== message.sender_id &&
        profiles.has(s.user_id) && canReceiveRoomPush(profiles.get(s.user_id), room));
      // Bound concurrent provider requests. Await completion before Vercel returns.
      for (let index = 0; index < targets.length; index += 8) {
        await Promise.allSettled(targets.slice(index, index + 8).map(async (target) => {
          const claimPath = `itutor_push_deliveries?message_id=eq.${query(message.id)}&endpoint_hash=eq.${target.endpoint_hash}`;
          const claim = await db('itutor_push_deliveries?on_conflict=message_id,endpoint_hash', {
            method: 'POST', prefer: 'resolution=ignore-duplicates,return=representation',
            body: { message_id: message.id, endpoint_hash: target.endpoint_hash }
          });
          if (!claim?.length) return;
          try {
            // Revalidate stored endpoints before performing outgoing requests too.
            const subscription = validateSubscription(target.subscription);
            await send(subscription, JSON.stringify({ type: 'message', id: message.id, sound: target.sound }), {
              TTL: 86400, urgency: 'high', timeout: 5000,
              vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
            });
          } catch (err) {
            if ([404, 410].includes(err.statusCode)) {
              await db(`itutor_push_subscriptions?endpoint_hash=eq.${target.endpoint_hash}`, { method: 'DELETE', prefer: 'return=minimal' });
            } else {
              await db(claimPath, { method: 'DELETE', prefer: 'return=minimal' });
              console.warn('Push provider delivery failed; message remains saved.');
            }
          }
        }));
      }
    }
  }

  return { configured, subscribe, unsubscribe, notifyMessages,
    publicConfig: () => ({ enabled: configured(), publicKey: configured() ? env.VAPID_PUBLIC_KEY : null }) };
}
