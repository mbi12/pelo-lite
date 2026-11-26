import { isNativeApp } from './nativeRuntime.js';
const KEY = 'itutor_message_alerts_v1';

export function getAlertSettings(userId) {
  try {
    return { enabled: true, sound: true, browser: false, ...JSON.parse(localStorage.getItem(`${KEY}:${userId}`) || '{}') };
  } catch {
    return { enabled: true, sound: true, browser: false };
  }
}

export function saveAlertSettings(userId, settings) {
  try { localStorage.setItem(`${KEY}:${userId}`, JSON.stringify(settings)); } catch { /* Storage may be unavailable. */ }
}

// Baseline on account change: signing in must not announce the whole history.
export function createMessageTracker() {
  let account = null;
  let seen = new Set();
  return (userId, messages, visibleRoomIds) => {
    if (account !== userId || !userId) {
      account = userId;
      seen = new Set(messages.map((m) => m.id));
      return [];
    }
    const incoming = [];
    for (const message of messages) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      if (message.sender_id !== userId && visibleRoomIds.has(message.room_id)) incoming.push(message);
    }
    return incoming;
  };
}

let audio;
export function unlockNotificationAudio() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ||= new Audio();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch { /* Unsupported or blocked by device settings. */ }
}

export function playNotificationSound() {
  if (!audio || audio.state !== 'running') return;
  try {
    const now = audio.currentTime;
    for (const [offset, frequency] of [[0, 660], [0.14, 880]]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.12, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.24);
    }
  } catch { /* Alerts should never interrupt chat. */ }
}

export async function showBrowserMessageAlert(count) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    // No private message text on the lock screen.
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification('i-tutor · New message', {
      body: count > 1 ? `You have ${count} new messages. Open i-tutor to read them.` : 'Open i-tutor to read your new message.',
      icon: '/icon.svg', tag: 'itutor-messages', data: { view: 'messages' }
    });
  } catch { /* Browser notifications are optional. */ }
}

const DEVICE_KEY = 'itutor_push_device_v1';
export function getPushDevice() {
  try { return JSON.parse(localStorage.getItem(DEVICE_KEY) || 'null'); } catch { return null; }
}

async function pushRequest(path, body) {
  const response = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Push setup failed. Please retry.');
  return result;
}

export async function disableClosedAppNotifications() {
  const device = getPushDevice();
  if (isNativeApp()) return;
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  // Revoke with the browser first: sign-out remains safe even without internet.
  if (subscription && !(await subscription.unsubscribe())) throw new Error('Could not turn off device notifications. Please retry.');
  if (device) {
    try {
      await pushRequest('/api/push/unsubscribe', { endpoint: device.endpoint, deviceToken: device.deviceToken });
    } catch { /* Expired endpoint is also removed on the next server delivery. */ }
  }
  try { localStorage.removeItem(DEVICE_KEY); } catch { /* Optional storage. */ }
}

export async function enableClosedAppNotifications(user, { sound = true } = {}) {
  if (isNativeApp()) throw new Error('Android push needs Firebase configuration. Browser push is available on the website.');
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Push is not supported here. On iPhone/iPad, add i-tutor to the Home Screen and open it there (iOS 16.4+).');
  }
  // Request while the user gesture is still active (especially important on iOS).
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Allow notifications in your browser or phone settings, then retry.');
  const response = await fetch('/api/push/config', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  const config = await response.json();
  if (!response.ok || !config.enabled) throw new Error('Closed-app notifications need server setup before they can be enabled.');
  const previous = getPushDevice();
  if (previous && previous.userId !== user.id) await disableClosedAppNotifications();
  const registration = await navigator.serviceWorker.ready;
  const raw = config.publicKey.replace(/-/g, '+').replace(/_/g, '/');
  const applicationServerKey = Uint8Array.from(atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')), (char) => char.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && previous?.publicKey !== config.publicKey) {
    await disableClosedAppNotifications();
    subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  const deviceToken = previous?.userId === user.id ? previous.deviceToken :
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, '0')).join('');
  const device = { userId: user.id, deviceToken, endpoint: subscription.endpoint, publicKey: config.publicKey };
  try {
    // Require durable local capability storage before binding a shared device.
    localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
    await pushRequest('/api/push/subscribe', {
      userId: user.id, pin: String(user.pin || ''), subscription: subscription.toJSON(), deviceToken, sound
    });
  } catch (err) {
    await disableClosedAppNotifications().catch(() => {});
    throw err;
  }
  return device;
}
