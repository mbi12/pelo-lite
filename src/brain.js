// Pelo Hybrid Neural Phone Brain — Built for Huawei P40 (EMUI / HarmonyOS / HMS)

const HUAWEI_P40_APPS = {
  whatsapp: {
    name: 'WhatsApp',
    icon: '💬',
    pkg: 'com.whatsapp',
    uri: 'whatsapp://app',
    intentUri: 'intent://send#Intent;package=com.whatsapp;scheme=whatsapp;end',
    fallbackUrl: 'https://web.whatsapp.com'
  },
  petal_maps: {
    name: 'Petal Maps',
    icon: '🗺️',
    pkg: 'com.petalmaps.app',
    uri: 'geo:0,0?q=',
    intentUri: 'intent://0,0?q=#Intent;scheme=geo;package=com.petalmaps.app;end',
    fallbackUrl: 'https://www.petalmaps.com'
  },
  appgallery: {
    name: 'Huawei AppGallery',
    icon: '🛍️',
    pkg: 'com.huawei.appmarket',
    uri: 'appmarket://home',
    intentUri: 'intent://home#Intent;scheme=appmarket;package=com.huawei.appmarket;end',
    fallbackUrl: 'https://appgallery.huawei.com'
  },
  huawei_health: {
    name: 'Huawei Health',
    icon: '❤️',
    pkg: 'com.huawei.health',
    uri: 'huaweischeme://healthapp/home/main',
    intentUri: 'intent://healthapp/home/main#Intent;scheme=huaweischeme;package=com.huawei.health;end',
    fallbackUrl: null
  },
  camera: {
    name: 'P40 Leica Camera',
    icon: '📷',
    pkg: 'com.huawei.camera',
    uri: 'pelo://camera',
    intentUri: 'intent:#Intent;action=android.media.action.STILL_IMAGE_CAMERA;end',
    fallbackUrl: null
  },
  spotify: {
    name: 'Spotify',
    icon: '🎵',
    pkg: 'com.spotify.music',
    uri: 'spotify:app',
    intentUri: 'intent:#Intent;package=com.spotify.music;scheme=spotify;end',
    fallbackUrl: 'https://open.spotify.com'
  },
  youtube: {
    name: 'YouTube',
    icon: '▶️',
    pkg: 'com.google.android.youtube',
    uri: 'https://m.youtube.com',
    intentUri: 'https://m.youtube.com',
    fallbackUrl: 'https://m.youtube.com'
  },
  telegram: {
    name: 'Telegram',
    icon: '✈️',
    pkg: 'org.telegram.messenger',
    uri: 'tg://resolve',
    intentUri: 'intent://resolve#Intent;scheme=tg;package=org.telegram.messenger;end',
    fallbackUrl: 'https://web.telegram.org'
  },
  instagram: {
    name: 'Instagram',
    icon: '📸',
    pkg: 'com.instagram.android',
    uri: 'instagram://app',
    intentUri: 'intent://instagram.com/#Intent;package=com.instagram.android;scheme=https;end',
    fallbackUrl: 'https://www.instagram.com'
  },
  tiktok: {
    name: 'TikTok',
    icon: '🎬',
    pkg: 'com.zhiliaoapp.musically',
    uri: 'snssdk1233://feed',
    intentUri: 'intent://feed#Intent;scheme=snssdk1233;package=com.zhiliaoapp.musically;end',
    fallbackUrl: 'https://www.tiktok.com'
  },
  dialer: {
    name: 'Phone Dialer',
    icon: '📞',
    pkg: 'com.huawei.contacts',
    uri: 'tel:',
    intentUri: 'tel:',
    fallbackUrl: null
  },
  messages: {
    name: 'Messages (SMS)',
    icon: '✉️',
    pkg: 'com.android.mms',
    uri: 'sms:',
    intentUri: 'sms:',
    fallbackUrl: null
  },
  email: {
    name: 'Huawei Email',
    icon: '📧',
    pkg: 'com.huawei.email',
    uri: 'mailto:',
    intentUri: 'mailto:',
    fallbackUrl: null
  },
  settings: {
    name: 'EMUI Settings',
    icon: '⚙️',
    pkg: 'com.android.settings',
    uri: 'intent:#Intent;action=android.settings.SETTINGS;end',
    intentUri: 'intent:#Intent;action=android.settings.SETTINGS;end',
    fallbackUrl: null
  },
  optimizer: {
    name: 'Huawei Optimizer',
    icon: '🛡️',
    pkg: 'com.huawei.systemmanager',
    uri: 'intent:#Intent;package=com.huawei.systemmanager;end',
    intentUri: 'intent:#Intent;package=com.huawei.systemmanager;end',
    fallbackUrl: null
  }
};

/**
 * Split multi-intent user commands ("turn on torch nd set a 5m timer and dim screen to 30%")
 * without splitting inside message/note payloads ("text Mom I'm safe and heading home").
 */
function splitCompoundSegments(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();

  // Do not split if the utterance is a message/memory dictation
  if (/^(remember|save note|note:|note that|text |sms |whatsapp |message |email |say )/i.test(lower)) {
    return [trimmed];
  }

  return trimmed
    .split(/\s+(?:and|nd|then|also)\s+|\s*;\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function findContact(contacts, queryName) {
  if (!queryName) return null;
  const q = queryName.trim().toLowerCase();
  return (
    contacts.find((c) => c.name.toLowerCase() === q) ||
    contacts.find((c) => c.name.toLowerCase().includes(q) || c.relationship.toLowerCase() === q) ||
    null
  );
}

function parseTimeHhmm(str) {
  // Matches "7:30 am", "06:45", "8pm", "19:20"
  const m = str.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3] ? m[3].toLowerCase() : null;
  if (mer === 'pm' && hour < 12) hour += 12;
  if (mer === 'am' && hour === 12) hour = 0;
  if (hour > 23 || min > 59) return null;
  return {
    hour,
    min,
    hhmm: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  };
}

function parseDurationSeconds(str) {
  let total = 0;
  const hr = str.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const mn = str.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/i);
  const sc = str.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i);
  if (hr) total += Math.round(parseFloat(hr[1]) * 3600);
  if (mn) total += Math.round(parseFloat(mn[1]) * 60);
  if (sc) total += Math.round(parseFloat(sc[1]));
  return total > 0 ? total : null;
}

function safeMathEval(expr) {
  // Clean common English math words
  const cleaned = expr
    .toLowerCase()
    .replace(/what(?:'s| is)\s+/g, '')
    .replace(/calculate\s+/g, '')
    .replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/g, '($1/100)*$2')
    .replace(/x/g, '*')
    .replace(/÷/g, '/')
    .replace(/[^0-9+\-*/().%\s]/g, '')
    .trim();

  if (!cleaned || !/\d/.test(cleaned) || !/[+\-*/%]/.test(cleaned)) return null;
  try {
    // Restricted arithmetic evaluation
    const val = Function(`"use strict"; return (${cleaned});`)();
    if (typeof val === 'number' && Number.isFinite(val)) {
      return Math.round(val * 10000) / 10000;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Optional Cloud LLM Upgrade (Groq / OpenAI / Gemini) if user configures an API key
 */
async function tryCloudLlm({ text, context, llmConfig }) {
  if (!llmConfig || !llmConfig.apiKey) return null;
  const provider = (llmConfig.provider || 'groq').toLowerCase();
  const apiKey = String(llmConfig.apiKey).trim();
  if (!apiKey) return null;

  const systemPrompt = `You are Pelo, a concise, capable personal AI controller for the user's Huawei P40 (EMUI / HMS, prefers Petal Maps & AppGallery).
Current phone state: ${JSON.stringify(context.device)}
Saved contacts: ${JSON.stringify(context.contacts.map((c) => ({ name: c.name, phone: c.phone })))}
Memories: ${JSON.stringify(context.memories.map((m) => m.fact))}
Routines: ${JSON.stringify(context.routines.map((r) => ({ id: r.id, name: r.name, trigger: r.triggerPhrase })))}

Respond ONLY with valid JSON matching:
{
  "reply": "natural, brief spoken response",
  "intents": [
    // Zero or more structured actions:
    // {"kind": "setting", "setting": "flashlight"|"wifi"|"bluetooth"|"dnd"|"powerSaver"|"wakeLock", "value": true|false}
    // {"kind": "slider", "setting": "brightness"|"volume", "value": 0-100}
    // {"kind": "vibrate", "pattern": "pulse"|"sos"}
    // {"kind": "open_app", "app": "whatsapp"|"petal_maps"|"appgallery"|"camera"|"spotify"|"youtube"|"telegram"|"instagram"|"tiktok"|"settings"|"optimizer"}
    // {"kind": "navigate", "destination": "place name"}
    // {"kind": "call", "name": "contact", "phone": "+..."}
    // {"kind": "whatsapp", "name": "contact", "phone": "+...", "message": "text"}
    // {"kind": "sms", "name": "contact", "phone": "+...", "message": "text"}
    // {"kind": "alarm", "timeHhmm": "07:30", "label": "Wake up"}
    // {"kind": "timer", "seconds": 300, "label": "Timer"}
    // {"kind": "task", "title": "task text"}
    // {"kind": "memory", "fact": "fact to remember"}
    // {"kind": "weather", "location": "city or current"}
    // {"kind": "system_bridge", "command": "lock_screen"|"screenshot"|"read_notifications"}
  ]
}`;

  try {
    let endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    let model = llmConfig.model || 'llama-3.3-70b-versatile';
    if (provider === 'openai') {
      endpoint = 'https://api.openai.com/v1/chat/completions';
      model = llmConfig.model || 'gpt-4o-mini';
    } else if (provider === 'gemini') {
      endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
      model = llmConfig.model || 'gemini-2.0-flash';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const rawJson = data.choices?.[0]?.message?.content;
    return rawJson ? JSON.parse(rawJson) : null;
  } catch {
    return null;
  }
}

/**
 * Parse a single natural-language segment into structured Pelo intents
 */
function parseSegmentBuiltIn(segment, context) {
  const s = segment.trim();
  const low = s.toLowerCase();
  const intents = [];
  const replies = [];

  // 1. Check saved Routine match first ("good morning", "going out", "driving mode", "goodnight", etc.)
  const matchedRoutine = context.routines.find((r) => {
    const trig = r.triggerPhrase.toLowerCase();
    const nm = r.name.toLowerCase();
    return low === trig || low === nm || low.includes(`run ${nm}`) || low.includes(`run ${trig}`) || low.includes(`${trig} routine`) || low === `im ${trig}` || low === `i'm ${trig}`;
  });
  if (matchedRoutine) {
    intents.push({ kind: 'routine', routine: matchedRoutine });
    replies.push(`Running your **${matchedRoutine.icon} ${matchedRoutine.name}** routine on your P40.`);
    return { intents, replies };
  }

  // 2. Personal Memory Storage ("remember ...", "note: ...")
  const memMatch = s.match(/^(?:pelo\s+)?(?:please\s+)?(?:remember(?:\s+that)?|save\s+note:?|note:?|keep in mind(?:\s+that)?)\s+(.+)$/i);
  if (memMatch) {
    const fact = memMatch[1].trim();
    intents.push({ kind: 'memory', fact });
    replies.push(`Got it — saved to your personal memory: *"${fact}"*.`);
    return { intents, replies };
  }

  // 3. Memory Recall ("what did I tell you to remember", "what is my gate / code / password / address")
  if (/\b(what do you remember|my memories|what(?:'s| is) my (?:gate|code|password|pin|address|bike|flight|locker|wifi))\b/i.test(low)) {
    const keywordMatch = low.match(/what(?:'s| is) my\s+([a-z0-9\s]+)/i);
    const kw = keywordMatch ? keywordMatch[1].trim() : '';
    const hits = kw
      ? context.memories.filter((m) => m.fact.toLowerCase().includes(kw))
      : context.memories.slice(0, 5);

    if (hits.length > 0) {
      replies.push(`Here's what I have in memory:\n${hits.map((h) => `• ${h.fact}`).join('\n')}`);
    } else {
      replies.push(`I don't have a saved note matching "${kw || 'that'}" yet. Say *"Remember my ${kw || 'code'} is ..."* anytime!`);
    }
    return { intents, replies };
  }

  // 4. WhatsApp Messaging ("whatsapp Mom I'm outside", "send whatsapp to Alex saying yo")
  const waMatch = s.match(/^(?:send\s+(?:a\s+)?)?whatsapp(?:\s+message)?(?:\s+to)?\s+([a-z0-9+]+)(?:\s+(?:saying|that|:))?\s+(.+)$/i);
  if (waMatch) {
    const target = waMatch[1].trim();
    const message = waMatch[2].trim();
    const contact = findContact(context.contacts, target);
    const phone = contact ? (contact.whatsapp || contact.phone) : (target.startsWith('+') || /^\d{7,}$/.test(target) ? target : '');
    intents.push({
      kind: 'whatsapp',
      name: contact ? contact.name : target,
      phone,
      message
    });
    replies.push(`Prepared WhatsApp to **${contact ? contact.name : target}**: *"${message}"*.`);
    return { intents, replies };
  }

  // 5. SMS / Text ("text Alex I'm 5m away", "sms Mom call me")
  const smsMatch = s.match(/^(?:send\s+(?:a\s+)?)?(?:text|sms)(?:\s+to)?\s+([a-z0-9+]+)(?:\s+(?:saying|that|:))?\s+(.+)$/i);
  if (smsMatch) {
    const target = smsMatch[1].trim();
    const message = smsMatch[2].trim();
    const contact = findContact(context.contacts, target);
    const phone = contact ? contact.phone : (target.startsWith('+') || /^\d{7,}$/.test(target) ? target : '');
    intents.push({
      kind: 'sms',
      name: contact ? contact.name : target,
      phone,
      message
    });
    replies.push(`Ready to send SMS to **${contact ? contact.name : target}**: *"${message}"*.`);
    return { intents, replies };
  }

  // 6. Phone Call ("call Mom", "dial +31612345678")
  const callMatch = s.match(/^(?:please\s+)?(?:call|dial|phone|ring)\s+(.+)$/i);
  if (callMatch && !low.includes('remind me')) {
    const target = callMatch[1].trim();
    const contact = findContact(context.contacts, target);
    const phone = contact ? contact.phone : target.replace(/[^\d+]/g, '');
    intents.push({
      kind: 'call',
      name: contact ? contact.name : target,
      phone
    });
    replies.push(phone
      ? `Dialing **${contact ? contact.name : target}** (${phone}) on your P40.`
      : `Add **${target}**'s number in Contacts so I can speed-dial them directly.`);
    return { intents, replies };
  }

  // 7. Petal Maps Navigation ("navigate to ...", "directions to ...", "map to ...", "where is ...")
  const navMatch = s.match(/(?:navigate to|directions to|route to|take me to|map of|find|where is)\s+(.+)$/i);
  if (navMatch && !low.includes('my phone') && !low.includes('my gate')) {
    const destination = navMatch[1].replace(/\s+on\s+petal\s*maps$/i, '').trim();
    intents.push({ kind: 'navigate', destination });
    replies.push(`Opening **Petal Maps** navigation to **${destination}**.`);
    return { intents, replies };
  }

  // 8. Spotify / YouTube Search ("play Burna Boy on spotify", "play lofi beats")
  const playMatch = s.match(/^(?:play|listen to)\s+(.+?)(?:\s+on\s+(spotify|youtube))?$/i);
  if (playMatch) {
    const query = playMatch[1].trim();
    const platform = (playMatch[2] || 'spotify').toLowerCase();
    intents.push({ kind: 'media_play', query, platform });
    replies.push(`Launching **${platform === 'youtube' ? 'YouTube' : 'Spotify'}** for *"${query}"*.`);
    return { intents, replies };
  }

  // 9. Countdown Timer ("set a timer for 5 mins", "3 min pasta timer")
  if (/\btimer\b/i.test(low)) {
    const secs = parseDurationSeconds(low) || 60;
    const minsLabel = secs >= 60 ? `${Math.round((secs / 60) * 10) / 10} min` : `${secs} sec`;
    intents.push({ kind: 'timer', seconds: secs, label: `${minsLabel} Timer` });
    replies.push(`Started a **${minsLabel}** live timer on your P40.`);
    return { intents, replies };
  }

  // 10. Alarm ("set alarm for 7:30 am", "wake me up at 06:45")
  if (/\b(alarm|wake me)\b/i.test(low)) {
    const parsed = parseTimeHhmm(low) || { hour: 7, min: 30, hhmm: '07:30' };
    intents.push({ kind: 'alarm', timeHhmm: parsed.hhmm, hour: parsed.hour, min: parsed.min, label: 'Pelo Wake Alarm' });
    replies.push(`Alarm armed for **${parsed.hhmm}** (synced to Pelo + Android Clock intent).`);
    return { intents, replies };
  }

  // 11. Tasks / Reminders ("remind me to ...", "add task ...")
  const taskMatch = s.match(/^(?:remind me to|add (?:a )?task:?|todo:?|don't let me forget to)\s+(.+)$/i);
  if (taskMatch) {
    const title = taskMatch[1].trim();
    intents.push({ kind: 'task', title });
    replies.push(`Added reminder: **"${title}"**.`);
    return { intents, replies };
  }

  // 12. Flashlight / Torch
  if (/\b(flashlight|torch|flash light|led light)\b/i.test(low)) {
    const turnOff = /\b(off|disable|stop|kill)\b/i.test(low);
    const turnOn = /\b(on|enable|start|shine)\b/i.test(low);
    const nextVal = turnOff ? false : turnOn ? true : !context.device.flashlight;
    intents.push({ kind: 'setting', setting: 'flashlight', value: nextVal });
    replies.push(`Huawei P40 rear flashlight turned **${nextVal ? 'ON 🔦' : 'OFF'}**.`);
    return { intents, replies };
  }

  // 13. Vibrate / Haptics / SOS
  if (/\b(vibrate|buzz|haptic|sos)\b/i.test(low)) {
    const isSos = /\bsos\b/i.test(low);
    intents.push({ kind: 'vibrate', pattern: isSos ? 'sos' : 'pulse' });
    replies.push(isSos ? 'Sending **SOS Morse vibration** pulse to your P40.' : 'Buzzing Huawei P40 haptic motor.');
    return { intents, replies };
  }

  // 14. Screen Brightness
  if (/\b(brightness|dim|brighten|screen light)\b/i.test(low)) {
    const numMatch = low.match(/(\d{1,3})\s*%?/);
    let val = context.device.brightness;
    if (numMatch) val = Math.max(0, Math.min(100, parseInt(numMatch[1], 10)));
    else if (/\b(max|full)\b/.test(low)) val = 100;
    else if (/\b(dim|low|dark|night)\b/.test(low)) val = 20;
    else if (/\b(up|brighter|increase)\b/.test(low)) val = Math.min(100, val + 25);
    else if (/\b(down|lower|decrease)\b/.test(low)) val = Math.max(5, val - 25);

    intents.push({ kind: 'slider', setting: 'brightness', value: val });
    replies.push(`Screen brightness set to **${val}%**.`);
    return { intents, replies };
  }

  // 15. Volume / Mute / Unmute
  if (/\b(volume|louder|quieter|mute|unmute|sound)\b/i.test(low)) {
    const numMatch = low.match(/(\d{1,3})\s*%?/);
    let val = context.device.volume;
    if (/\bmute\b/.test(low)) val = 0;
    else if (/\bunmute\b/.test(low)) val = 65;
    else if (numMatch) val = Math.max(0, Math.min(100, parseInt(numMatch[1], 10)));
    else if (/\b(max|full)\b/.test(low)) val = 100;
    else if (/\b(up|louder|increase|raise)\b/.test(low)) val = Math.min(100, val + 20);
    else if (/\b(down|quieter|lower|decrease)\b/.test(low)) val = Math.max(0, val - 20);

    intents.push({ kind: 'slider', setting: 'volume', value: val });
    replies.push(`Phone volume set to **${val}%**.`);
    return { intents, replies };
  }

  // 16. Wi-Fi / Bluetooth / DND / Power Saver / Keep Screen Awake
  if (/\b(wi-?fi|wlan)\b/i.test(low)) {
    const val = /\boff|disable\b/.test(low) ? false : /\bon|enable\b/.test(low) ? true : !context.device.wifi;
    intents.push({ kind: 'setting', setting: 'wifi', value: val });
    replies.push(`Wi-Fi toggled **${val ? 'ON' : 'OFF'}** (queued to P40 system bridge).`);
    return { intents, replies };
  }

  if (/\bbluetooth\b/i.test(low)) {
    const val = /\boff|disable\b/.test(low) ? false : /\bon|enable\b/.test(low) ? true : !context.device.bluetooth;
    intents.push({ kind: 'setting', setting: 'bluetooth', value: val });
    replies.push(`Bluetooth toggled **${val ? 'ON' : 'OFF'}**.`);
    return { intents, replies };
  }

  if (/\b(dnd|do not disturb|silent mode|silence phone)\b/i.test(low)) {
    const val = /\boff|disable\b/.test(low) ? false : true;
    intents.push({ kind: 'setting', setting: 'dnd', value: val });
    replies.push(`Do Not Disturb **${val ? 'ENABLED 🔕' : 'DISABLED 🔔'}**.`);
    return { intents, replies };
  }

  if (/\b(power saver|battery saver|ultra battery|save battery)\b/i.test(low)) {
    const val = /\boff|disable\b/.test(low) ? false : true;
    intents.push({ kind: 'setting', setting: 'powerSaver', value: val });
    replies.push(`Huawei Optimizer Power Saver **${val ? 'ON 🔋' : 'OFF'}**.`);
    return { intents, replies };
  }

  if (/\b(keep screen awake|wake lock|stay awake|screen on)\b/i.test(low)) {
    const val = /\boff|disable|stop\b/.test(low) ? false : true;
    intents.push({ kind: 'setting', setting: 'wakeLock', value: val });
    replies.push(`Huawei P40 Screen Wake Lock **${val ? 'ACTIVE ☀️' : 'RELEASED'}**.`);
    return { intents, replies };
  }

  // 17. Lock Screen / Screenshot / Camera Vision
  if (/\b(lock (?:my )?(?:screen|phone))\b/i.test(low)) {
    intents.push({ kind: 'system_bridge', command: 'lock_screen', label: 'Lock Huawei P40 Screen' });
    replies.push('Sent **Lock Screen** command to Huawei P40 Accessibility Bridge.');
    return { intents, replies };
  }

  if (/\b(screenshot|screen capture|capture screen)\b/i.test(low)) {
    intents.push({ kind: 'system_bridge', command: 'screenshot', label: 'Capture Huawei P40 Screenshot' });
    replies.push('Sent **Capture Screenshot** command to Huawei P40 Bridge.');
    return { intents, replies };
  }

  if (/\b(camera|take a photo|selfie|scan room|vision lens)\b/i.test(low)) {
    intents.push({ kind: 'open_camera_lens' });
    replies.push('Opening your **Huawei P40 Leica Camera Lens** right inside Pelo.');
    return { intents, replies };
  }

  // 18. Open Native Apps ("open whatsapp", "launch appgallery", "open petal maps", "open settings")
  const openMatch = low.match(/\b(?:open|launch|start)\s+(.+)$/i);
  if (openMatch) {
    const targetApp = openMatch[1].trim();
    const aliasMap = [
      ['whatsapp', 'whatsapp'],
      ['petal', 'petal_maps'],
      ['map', 'petal_maps'],
      ['appgallery', 'appgallery'],
      ['app gallery', 'appgallery'],
      ['store', 'appgallery'],
      ['health', 'huawei_health'],
      ['spotify', 'spotify'],
      ['music', 'spotify'],
      ['youtube', 'youtube'],
      ['telegram', 'telegram'],
      ['instagram', 'instagram'],
      ['insta', 'instagram'],
      ['tiktok', 'tiktok'],
      ['phone', 'dialer'],
      ['dialer', 'dialer'],
      ['message', 'messages'],
      ['sms', 'messages'],
      ['mail', 'email'],
      ['setting', 'settings'],
      ['optimizer', 'optimizer']
    ];
    const found = aliasMap.find(([kw]) => targetApp.includes(kw));
    if (found) {
      const appInfo = HUAWEI_P40_APPS[found[1]];
      intents.push({ kind: 'open_app', app: found[1], appInfo });
      replies.push(`Launching **${appInfo.icon} ${appInfo.name}** on your Huawei P40.`);
      return { intents, replies };
    }
  }

  // 19. Weather Inquiry
  if (/\b(weather|temperature|forecast|rain|outside)\b/i.test(low)) {
    intents.push({ kind: 'weather' });
    replies.push('Checking live local weather telemetry for your Huawei P40...');
    return { intents, replies };
  }

  // 20. Battery / Phone Status Inquiry
  if (/\b(battery|charge|status|how is my phone|telemetry)\b/i.test(low)) {
    const d = context.device;
    const openTasks = context.tasks.filter((t) => !t.completed).length;
    const activeAlarms = context.alarms.filter((a) => a.enabled).length;
    replies.push(
      `📱 **${d.deviceModel}** Status:\n` +
      `• Battery: **${d.batteryLevel}%** ${d.charging ? '(⚡ Charging)' : ''}\n` +
      `• Brightness **${d.brightness}%** · Volume **${d.volume}%** · DND **${d.dnd ? 'ON' : 'OFF'}**\n` +
      `• **${openTasks}** active reminder${openTasks === 1 ? '' : 's'} · **${activeAlarms}** armed alarm${activeAlarms === 1 ? '' : 's'}`
    );
    return { intents, replies };
  }

  // 21. Quick Math
  const mathAns = safeMathEval(s);
  if (mathAns !== null) {
    replies.push(`🧮 That comes out to **${mathAns}**.`);
    return { intents, replies };
  }

  // 22. Pending Tasks Query
  if (/\b(my tasks|my reminders|todo list|what(?:'s| is) on my list)\b/i.test(low)) {
    const pending = context.tasks.filter((t) => !t.completed);
    replies.push(
      pending.length
        ? `You have **${pending.length}** open reminder${pending.length === 1 ? '' : 's'}:\n${pending.map((t) => `• ${t.title}`).join('\n')}`
        : 'Your task list is completely clear right now!'
    );
    return { intents, replies };
  }

  // 23. Friendly Conversational Fallback with Action Suggestions
  if (/^(hi|hey|hello|yo|sup|good afternoon|good evening|who are you|what can you do)\b/i.test(low)) {
    replies.push(
      `Hey ${context.device.ownerName}! I'm **${context.device.assistantName}**, locked in and ready on your **Huawei P40** (${context.device.batteryLevel}% battery). ` +
      `Tell me to toggle your **flashlight**, launch **Petal Maps** or **WhatsApp**, run a **routine**, set a **timer/alarm**, or **remember** anything for you.`
    );
    return { intents, replies };
  }

  replies.push(
    `I heard: *"${s}"*. Want me to save that as a **reminder**, **search it**, or trigger a **P40 action**? ` +
    `(Tip: try *"Remind me to ${s}"*, *"Open Petal Maps"*, or add a free Groq/OpenAI key in **Settings** for open-ended general Q&A!)`
  );
  intents.push({ kind: 'QuickSearchSuggestion', query: s });
  return { intents, replies };
}

/**
 * Main entry point: takes user command + current DB bootstrap context + optional telemetry & LLM config,
 * executes state mutations & bridge queueing via store, and returns client-executable action descriptors!
 */
async function processCommand({ text, store, telemetry = {}, llmConfig = null }) {
  // Update live battery/network telemetry from phone if sent
  const telePatch = {};
  if (typeof telemetry.batteryLevel === 'number') telePatch.batteryLevel = telemetry.batteryLevel;
  if (typeof telemetry.charging === 'boolean') telePatch.charging = telemetry.charging;
  if (telemetry.networkType) telePatch.networkType = String(telemetry.networkType);
  if (Object.keys(telePatch).length > 0) {
    await store.updateDeviceState(telePatch);
  }

  const context = await store.getBootstrap();
  await store.addMessage({ role: 'user', content: text, actions: [], source: 'user' });

  // Try optional Cloud LLM first if configured
  const cloudResult = await tryCloudLlm({ text, context, llmConfig });

  let allIntents = [];
  let replyText = '';

  if (cloudResult && Array.isArray(cloudResult.intents)) {
    allIntents = cloudResult.intents;
    replyText = cloudResult.reply || 'Done!';
  } else {
    const segments = splitCompoundSegments(text);
    const replyParts = [];
    for (const seg of segments) {
      const { intents, replies } = parseSegmentBuiltIn(seg, context);
      allIntents.push(...intents);
      replyParts.push(...replies);
    }
    replyText = replyParts.join('\n\n');
  }

  // Expand any Routine intents into concrete step intents
  const expandedIntents = [];
  for (const intent of allIntents) {
    if (intent.kind === 'routine' && intent.routine) {
      await store.incrementRoutineRun(intent.routine.id);
      for (const step of intent.routine.steps || []) {
        if (step.type === 'set_setting') {
          expandedIntents.push({ kind: 'setting', setting: step.setting, value: step.value });
        } else if (step.type === 'set_slider') {
          expandedIntents.push({ kind: 'slider', setting: step.setting, value: step.value });
        } else if (step.type === 'open_app') {
          expandedIntents.push({ kind: 'open_app', app: step.app, appInfo: HUAWEI_P40_APPS[step.app] });
        } else if (step.type === 'start_timer') {
          expandedIntents.push({ kind: 'timer', seconds: step.seconds || 1500, label: step.label || 'Routine Timer' });
        } else if (step.type === 'check_weather') {
          expandedIntents.push({ kind: 'weather' });
        }
      }
    } else {
      expandedIntents.push(intent);
    }
  }

  // Execute intents against Store + Bridge Queue & build Rich Client Action Cards
  const clientActions = [];
  const devicePatch = {};

  for (const item of expandedIntents) {
    if (item.kind === 'setting') {
      devicePatch[item.setting] = Boolean(item.value);
      await store.enqueueBridgeCommand({
        commandType: `set_${item.setting}`,
        label: `${item.setting.toUpperCase()} → ${item.value ? 'ON' : 'OFF'}`,
        payload: { setting: item.setting, value: Boolean(item.value) }
      });
      clientActions.push({
        type: 'hardware_setting',
        setting: item.setting,
        value: Boolean(item.value),
        label: `${item.setting === 'flashlight' ? '🔦 Flashlight' : item.setting === 'wakeLock' ? '☀️ Keep Awake' : item.setting.toUpperCase()} ${item.value ? 'ON' : 'OFF'}`
      });
    } else if (item.kind === 'slider') {
      const clamped = Math.max(0, Math.min(100, Math.round(Number(item.value))));
      devicePatch[item.setting] = clamped;
      await store.enqueueBridgeCommand({
        commandType: `set_${item.setting}`,
        label: `${item.setting.toUpperCase()} → ${clamped}%`,
        payload: { setting: item.setting, value: clamped }
      });
      clientActions.push({
        type: 'hardware_slider',
        setting: item.setting,
        value: clamped,
        label: `${item.setting === 'brightness' ? '🔆 Brightness' : '🔊 Volume'} → ${clamped}%`
      });
    } else if (item.kind === 'vibrate') {
      clientActions.push({
        type: 'vibrate',
        pattern: item.pattern || 'pulse',
        label: item.pattern === 'sos' ? '📳 SOS Morse Vibration' : '📳 Haptic Pulse'
      });
    } else if (item.kind === 'open_camera_lens') {
      clientActions.push({
        type: 'open_camera_lens',
        label: '📷 Open P40 Vision Lens'
      });
    } else if (item.kind === 'open_app') {
      const info = item.appInfo || HUAWEI_P40_APPS[item.app] || HUAWEI_P40_APPS.settings;
      await store.enqueueBridgeCommand({
        commandType: 'launch_package',
        label: `Launch ${info.name}`,
        payload: { package: info.pkg, uri: info.uri }
      });
      clientActions.push({
        type: 'deep_link',
        icon: info.icon,
        label: `Open ${info.name}`,
        uri: info.uri,
        intentUri: info.intentUri,
        fallbackUrl: info.fallbackUrl
      });
    } else if (item.kind === 'navigate') {
      const encoded = encodeURIComponent(item.destination);
      const geoUri = `geo:0,0?q=${encoded}`;
      const petalWeb = `https://www.openstreetmap.org/search?query=${encoded}`;
      await store.enqueueBridgeCommand({
        commandType: 'navigate_petal_maps',
        label: `Petal Maps → ${item.destination}`,
        payload: { destination: item.destination, uri: geoUri }
      });
      clientActions.push({
        type: 'deep_link',
        icon: '🗺️',
        label: `Petal Maps: ${item.destination}`,
        uri: geoUri,
        intentUri: `intent://0,0?q=${encoded}#Intent;scheme=geo;package=com.petalmaps.app;end`,
        fallbackUrl: petalWeb
      });
    } else if (item.kind === 'whatsapp') {
      const cleanPhone = String(item.phone || '').replace(/[^\d]/g, '');
      const encodedMsg = encodeURIComponent(item.message || '');
      const uri = cleanPhone
        ? `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`
        : `whatsapp://send?text=${encodedMsg}`;
      clientActions.push({
        type: 'deep_link',
        icon: '💬',
        label: `WhatsApp ${item.name}`,
        subtitle: item.message,
        uri,
        fallbackUrl: cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMsg}` : null
      });
    } else if (item.kind === 'sms') {
      const encodedMsg = encodeURIComponent(item.message || '');
      const uri = `sms:${item.phone || ''}?body=${encodedMsg}`;
      clientActions.push({
        type: 'deep_link',
        icon: '✉️',
        label: `Send SMS to ${item.name}`,
        subtitle: item.message,
        uri
      });
    } else if (item.kind === 'call') {
      const uri = `tel:${item.phone || ''}`;
      clientActions.push({
        type: 'deep_link',
        icon: '📞',
        label: `Call ${item.name}`,
        subtitle: item.phone || 'Tap to open dialer',
        uri
      });
    } else if (item.kind === 'media_play') {
      const encoded = encodeURIComponent(item.query);
      const isYt = item.platform === 'youtube';
      clientActions.push({
        type: 'deep_link',
        icon: isYt ? '▶️' : '🎵',
        label: `${isYt ? 'YouTube' : 'Spotify'}: ${item.query}`,
        uri: isYt ? `https://m.youtube.com/results?search_query=${encoded}` : `spotify:search:${encoded}`,
        fallbackUrl: isYt ? `https://m.youtube.com/results?search_query=${encoded}` : `https://open.spotify.com/search/${encoded}`
      });
    } else if (item.kind === 'timer') {
      const targetEpochMs = Date.now() + Number(item.seconds) * 1000;
      const created = await store.addAlarm({
        label: item.label || 'Timer',
        timeHhmm: `${Math.ceil(item.seconds / 60)}m`,
        days: 'Timer',
        enabled: true,
        kind: 'timer',
        durationSec: Number(item.seconds),
        targetEpochMs
      });
      clientActions.push({
        type: 'timer_started',
        alarm: created,
        seconds: Number(item.seconds),
        targetEpochMs,
        label: `⏱️ ${item.label} Running`
      });
    } else if (item.kind === 'alarm') {
      const [hh, mm] = String(item.timeHhmm || '07:30').split(':').map((n) => parseInt(n, 10) || 0);
      const created = await store.addAlarm({
        label: item.label || 'Wake Alarm',
        timeHhmm: item.timeHhmm || '07:30',
        days: 'Daily',
        enabled: true,
        kind: 'alarm'
      });
      const androidAlarmIntent =
        `intent:#Intent;action=android.intent.action.SET_ALARM;` +
        `i.android.intent.extra.alarm.HOUR=${hh};` +
        `i.android.intent.extra.alarm.MINUTES=${mm};` +
        `S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(created.label)};` +
        `B.android.intent.extra.alarm.SKIP_UI=false;end`;

      await store.enqueueBridgeCommand({
        commandType: 'set_system_alarm',
        label: `System Alarm ${created.timeHhmm}`,
        payload: { hour: hh, minutes: mm, message: created.label }
      });

      clientActions.push({
        type: 'alarm_created',
        alarm: created,
        label: `⏰ Alarm Set: ${created.timeHhmm}`,
        uri: androidAlarmIntent
      });
    } else if (item.kind === 'task') {
      const task = await store.addTask({ title: item.title });
      clientActions.push({
        type: 'task_created',
        task,
        label: `✅ Reminder Saved: ${task.title}`
      });
    } else if (item.kind === 'memory') {
      const mem = await store.addMemory({ category: 'personal', fact: item.fact });
      clientActions.push({
        type: 'memory_saved',
        memory: mem,
        label: '🧠 Saved to Pelo Memory'
      });
    } else if (item.kind === 'weather') {
      clientActions.push({
        type: 'fetch_live_weather',
        label: '🌤️ Live Huawei P40 Weather Lookup'
      });
    } else if (item.kind === 'system_bridge') {
      await store.enqueueBridgeCommand({
        commandType: item.command,
        label: item.label || item.command,
        payload: { command: item.command }
      });
      clientActions.push({
        type: 'bridge_queued',
        command: item.command,
        label: `📲 Sent to P40 Bridge: ${item.label || item.command}`
      });
    } else if (item.kind === 'QuickSearchSuggestion') {
      const encoded = encodeURIComponent(item.query);
      clientActions.push({
        type: 'suggestion_bar',
        query: item.query,
        searchUrl: `https://duckduckgo.com/?q=${encoded}`,
        label: `🔎 Search Web for "${item.query}"`
      });
    }
  }

  if (Object.keys(devicePatch).length > 0) {
    await store.updateDeviceState(devicePatch);
  }

  const assistantMsg = await store.addMessage({
    role: 'assistant',
    content: replyText,
    actions: clientActions,
    source: cloudResult ? 'cloud-llm' : 'pelo-neural'
  });

  const updatedBootstrap = await store.getBootstrap();

  return {
    reply: replyText,
    assistantMessage: assistantMsg,
    actions: clientActions,
    bootstrap: updatedBootstrap
  };
}

module.exports = {
  HUAWEI_P40_APPS,
  processCommand
};
