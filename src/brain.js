// Pelo Unrestricted Personal AI Brain — Built for Huawei P40 (Files, Messages, Calls, Apps, Hardware & Shell)

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
  files_app: {
    name: 'Huawei Files',
    icon: '📂',
    pkg: 'com.huawei.hidisk',
    uri: 'intent:#Intent;package=com.huawei.hidisk;end',
    intentUri: 'intent:#Intent;package=com.huawei.hidisk;end',
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
  facebook: {
    name: 'Facebook',
    icon: '📘',
    pkg: 'com.facebook.katana',
    uri: 'fb://facewebmodal/f?href=https://www.facebook.com',
    intentUri: 'intent://www.facebook.com/#Intent;package=com.facebook.katana;scheme=https;end',
    fallbackUrl: 'https://m.facebook.com'
  },
  messenger: {
    name: 'Messenger',
    icon: '💭',
    pkg: 'com.facebook.orca',
    uri: 'fb-messenger://threads',
    intentUri: 'intent://threads/#Intent;package=com.facebook.orca;scheme=fb-messenger;end',
    fallbackUrl: 'https://www.messenger.com'
  },
  snapchat: {
    name: 'Snapchat',
    icon: '👻',
    pkg: 'com.snapchat.android',
    uri: 'snapchat://',
    intentUri: 'intent://#Intent;package=com.snapchat.android;scheme=snapchat;end',
    fallbackUrl: 'https://web.snapchat.com'
  },
  twitter: {
    name: 'X (Twitter)',
    icon: '𝕏',
    pkg: 'com.twitter.android',
    uri: 'twitter://timeline',
    intentUri: 'intent://timeline#Intent;package=com.twitter.android;scheme=twitter;end',
    fallbackUrl: 'https://x.com'
  },
  gallery: {
    name: 'Huawei Gallery',
    icon: '🖼️',
    pkg: 'com.huawei.photos',
    uri: 'intent:#Intent;package=com.huawei.photos;end',
    intentUri: 'intent:#Intent;package=com.huawei.photos;end',
    fallbackUrl: null
  },
  calculator: {
    name: 'Calculator',
    icon: '🧮',
    pkg: 'com.huawei.calculator',
    uri: 'intent:#Intent;package=com.huawei.calculator;end',
    intentUri: 'intent:#Intent;package=com.huawei.calculator;end',
    fallbackUrl: null
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

function formatBytes(bytes) {
  const b = Number(bytes || 0);
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(2)} GB`;
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

/**
 * Split multi-intent commands ("delete all .apk files nd text Mom I'm outside")
 * while keeping message bodies intact when a segment starts with a dictation verb.
 */
function splitCompoundSegments(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();

  // Keep pure single-dictation commands intact so "and" inside message text isn't chopped
  if (/^(remember|save note|note:|text |sms |whatsapp |message |send (?:a )?(?:message|sms|text|whatsapp)|reply |create file |shell |exec |run command )/i.test(lower)) {
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
 * Optional Cloud LLM Upgrade (Groq / OpenAI / Gemini) with Unrestricted Tool Schema
 */
async function tryCloudLlm({ text, context, llmConfig }) {
  if (!llmConfig || !llmConfig.apiKey) return null;
  const provider = (llmConfig.provider || 'groq').toLowerCase();
  const apiKey = String(llmConfig.apiKey).trim();
  if (!apiKey) return null;

  const systemPrompt = `You are Pelo, an unrestricted personal AI phone controller for the user's Huawei P40 (EMUI / HMS).
Phone state: ${JSON.stringify(context.device)}
Contacts: ${JSON.stringify(context.contacts.map((c) => ({ name: c.name, phone: c.phone })))}
Files on P40: ${JSON.stringify((context.files || []).slice(0, 25).map((f) => ({ id: f.id, name: f.name, folder: f.folder, trashed: f.trashed })))}
Recent messages: ${JSON.stringify((context.comms || []).slice(0, 6))}
Memories: ${JSON.stringify(context.memories.map((m) => m.fact))}

Respond ONLY with valid JSON:
{
  "reply": "natural, concise spoken reply",
  "intents": [
    // Supported action objects:
    // {"kind": "file_delete", "query": "filename", "extension": "apk", "folder": "Screenshots", "permanent": false}
    // {"kind": "file_restore", "query": "filename"}
    // {"kind": "file_empty_trash"}
    // {"kind": "file_organize"}
    // {"kind": "file_create", "name": "note.txt", "content": "file text"}
    // {"kind": "sms", "name": "Mom", "phone": "+31...", "message": "text"}
    // {"kind": "whatsapp", "name": "Alex", "phone": "+31...", "message": "text"}
    // {"kind": "read_messages"}
    // {"kind": "call", "name": "Mom", "phone": "+31..."}
    // {"kind": "setting", "setting": "flashlight"|"wifi"|"bluetooth"|"dnd"|"powerSaver"|"wakeLock", "value": true|false}
    // {"kind": "slider", "setting": "brightness"|"volume", "value": 0-100}
    // {"kind": "open_app", "app": "whatsapp"|"petal_maps"|"appgallery"|"files_app"|"camera"|"spotify"|"youtube"|"telegram"|"settings"}
    // {"kind": "navigate", "destination": "place"}
    // {"kind": "alarm", "timeHhmm": "07:30", "label": "Wake up"}
    // {"kind": "timer", "seconds": 300, "label": "Timer"}
    // {"kind": "task", "title": "reminder"}
    // {"kind": "memory", "fact": "fact"}
    // {"kind": "clipboard", "text": "text to copy"}
    // {"kind": "find_my_phone"}
    // {"kind": "shell_exec", "command": "ls -la Download"}
    // {"kind": "weather"}
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
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
 * Parse natural-language segment into unrestricted Huawei P40 intents
 */
function parseSegmentBuiltIn(segment, context) {
  const s = segment.trim();
  const low = s.toLowerCase();
  const intents = [];
  const replies = [];

  // --------------------------------------------------------------------------
  // A. FILE MANAGEMENT: DELETE, CLEAN JUNK, RESTORE, EMPTY TRASH, ORGANIZE, CREATE, LIST
  // --------------------------------------------------------------------------

  // A1. Empty Trash ("empty trash", "clear trash bin")
  if (/\b(empty (?:the )?trash|clear (?:the )?trash|purge trash)\b/i.test(low)) {
    intents.push({ kind: 'file_empty_trash' });
    replies.push('Permanently emptying your Huawei P40 `.pelo-trash` bin.');
    return { intents, replies };
  }

  // A2. Restore / Undo Deleted Files ("restore ...", "undo delete", "recover ...")
  const restoreMatch = s.match(/^(?:restore|undelete|recover|undo delete(?:\s+of)?)\s*(.*)$/i);
  if (restoreMatch) {
    const query = (restoreMatch[1] || '').replace(/^file\s+/i, '').trim();
    intents.push({ kind: 'file_restore', query });
    replies.push(query ? `Restoring **"${query}"** from `.concat('`.pelo-trash` back to its folder.') : 'Restoring your trashed files back to their original folders.');
    return { intents, replies };
  }

  // A3. Organize Downloads ("organize my downloads", "sort downloads folder")
  if (/\b(organize|sort|tidy)\b.*\b(download|files|folder|storage)\b/i.test(low)) {
    intents.push({ kind: 'file_organize' });
    replies.push('Organizing your Huawei P40 **Download** folder into clean `Documents/`, `Images/`, `APKs/`, and `Archives/` subfolders.');
    return { intents, replies };
  }

  // A4. Create a File ("create file notes.txt saying hello world")
  const createFileMatch = s.match(/^(?:create|make|write)\s+(?:a\s+)?file\s+(?:named\s+|called\s+)?([^\s]+)(?:\s+(?:with|saying|containing|:)\s+(.+))?$/i);
  if (createFileMatch) {
    const name = createFileMatch[1].replace(/["'`]/g, '').trim();
    const content = (createFileMatch[2] || '').trim();
    intents.push({ kind: 'file_create', name, content });
    replies.push(`Created **${name}** in \`/storage/emulated/0/Documents/\` on your Huawei P40.`);
    return { intents, replies };
  }

  // A5. Delete / Remove / Clean Files ("delete old.apk", "delete all .apk files", "clean junk files", "delete screenshots")
  const isFileDelete =
    /\b(delete|remove|erase|wipe|shred|clean)\b/i.test(low) &&
    (/\b(file|files|folder|apk|apks|tmp|temp|junk|cache|screenshot|screenshots|download|downloads|pdf|photo|image|duplicate)\b/i.test(low) ||
      /\.[a-z0-9]{2,4}\b/i.test(low));

  if (isFileDelete) {
    const permanent = /\b(permanent|permanently|shred|forever)\b/i.test(low);
    const extMatch = low.match(/\.([a-z0-9]{2,4})\b/) || low.match(/\ball\s+(apk|pdf|tmp|jpg|png|zip)s?\b/);

    if (/\b(junk|temp|cache)\b/i.test(low) && !extMatch) {
      intents.push({ kind: 'file_delete', extension: 'junk', permanent });
      replies.push('Cleaning APK installers & temporary cache files from your Huawei P40.');
      return { intents, replies };
    }

    if (extMatch) {
      const ext = extMatch[1];
      // Check if user named a specific file like "delete invoice-november.pdf" vs "delete all .pdf files"
      const specificFileMatch = s.match(/(?:delete|remove|erase|shred)\s+(?:the\s+)?(?:file\s+)?["'`]?([a-z0-9_.\-]+\.[a-z0-9]{2,4})["'`]?/i);
      if (specificFileMatch && !/\ball\b/i.test(low)) {
        const fname = specificFileMatch[1];
        intents.push({ kind: 'file_delete', query: fname, permanent });
        replies.push(`${permanent ? 'Permanently deleting' : 'Moving'} **${fname}** ${permanent ? 'from Huawei P40 storage' : 'to `.pelo-trash` (undoable)'}.`);
        return { intents, replies };
      }

      intents.push({ kind: 'file_delete', extension: ext, permanent });
      replies.push(`${permanent ? 'Permanently deleting' : 'Deleting'} all **.${ext}** files on your Huawei P40.`);
      return { intents, replies };
    }

    if (/\bscreenshots?\b/i.test(low) && /\b(all|clear|clean)\b/i.test(low)) {
      intents.push({ kind: 'file_delete', folder: 'Screenshots', permanent });
      replies.push('Deleting screenshots from `/storage/emulated/0/DCIM/Screenshots`.');
      return { intents, replies };
    }

    // Extract target query phrase after delete/remove
    const targetMatch = s.match(/(?:permanently\s+)?(?:delete|remove|erase|shred)\s+(?:the\s+)?(?:file\s+)?(.+)$/i);
    const cleanQuery = (targetMatch ? targetMatch[1] : s)
      .replace(/\s+(?:in|from)\s+(?:my\s+)?(?:downloads?|phone|storage|screenshots?)$/i, '')
      .replace(/["'`]/g, '')
      .trim();

    intents.push({ kind: 'file_delete', query: cleanQuery, permanent });
    replies.push(`${permanent ? 'Permanently deleting' : 'Deleting'} files matching **"${cleanQuery}"** on your Huawei P40.`);
    return { intents, replies };
  }

  // A6. List / Show Files ("show my files", "what files are in downloads")
  if (/\b(show (?:my )?files|list files|my downloads|what files|storage space|free space)\b/i.test(low)) {
    const activeFiles = (context.files || []).filter((f) => !f.trashed);
    const top = activeFiles.slice(0, 6);
    replies.push(
      `📂 **Huawei P40 Storage** (${context.device.storageUsedGb} GB / ${context.device.storageTotalGb} GB used · ${activeFiles.length} indexed files):\n` +
      (top.length
        ? top.map((f) => `• **${f.name}** (${formatBytes(f.sizeBytes)} · \`${f.folder}\`)`).join('\n')
        : '• Folder is clean!')
    );
    intents.push({ kind: 'open_files_tab' });
    return { intents, replies };
  }

  // --------------------------------------------------------------------------
  // B. UNRESTRICTED MESSAGING: DIRECT SMS, WHATSAPP, TELEGRAM, REPLY, READ INBOX
  // --------------------------------------------------------------------------

  // B1. Reply to Last Message ("reply saying On my way!", "reply to last message Yes see u at 7")
  const replyLastMatch = s.match(/^reply(?:\s+to\s+(?:the\s+)?last\s+(?:message|text|sms|whatsapp))?(?:\s+(?:saying|with|that|:))?\s+(.+)$/i);
  if (replyLastMatch) {
    const body = replyLastMatch[1].trim();
    const lastInbound = (context.comms || []).find((c) => c.direction === 'inbound') || (context.comms || [])[0];
    if (lastInbound) {
      const kind = lastInbound.channel === 'whatsapp' ? 'whatsapp' : 'sms';
      intents.push({
        kind,
        name: lastInbound.contactName || 'Sender',
        phone: lastInbound.address,
        message: body
      });
      replies.push(`Replying via **${kind.toUpperCase()}** to **${lastInbound.contactName || lastInbound.address}**: *"${body}"*.`);
      return { intents, replies };
    }
  }

  // B2. Read Recent Messages / Texts ("read my messages", "check my texts", "last sms")
  if (/\b(read (?:my )?(?:messages|texts|sms)|check (?:my )?(?:messages|texts|inbox)|latest (?:messages|texts|sms)|last (?:message|text|sms))\b/i.test(low)) {
    intents.push({ kind: 'read_messages' });
    const recent = (context.comms || []).slice(0, 4);
    replies.push(
      recent.length
        ? `💬 **Latest Huawei P40 Messages:**\n` +
          recent.map((c) => `• **[${c.channel.toUpperCase()}] ${c.contactName || c.address}**: "${c.body}"`).join('\n')
        : 'No messages synced yet — polling your Huawei P40 inbox now.'
    );
    return { intents, replies };
  }

  // B3. WhatsApp Messaging ("whatsapp Mom I'm outside", "send whatsapp to Alex saying yo")
  const waMatch = s.match(/^(?:send\s+(?:a\s+)?)?whatsapp(?:\s+message)?(?:\s+to)?\s+([a-z0-9+]+)(?:\s+(?:saying|that|:))?\s+(.+)$/i);
  if (waMatch) {
    const target = waMatch[1].trim();
    const message = waMatch[2].trim();
    const contact = findContact(context.contacts, target);
    const phone = contact ? (contact.whatsapp || contact.phone) : (target.startsWith('+') || /^\d{7,}$/.test(target) ? target : '');
    intents.push({ kind: 'whatsapp', name: contact ? contact.name : target, phone, message });
    replies.push(`Sending **WhatsApp** to **${contact ? contact.name : target}**: *"${message}"*.`);
    return { intents, replies };
  }

  // B4. Direct SMS / Generic "Send message to X ..." ("send message to Mom I'm outside", "text Alex yo", "message +316... hello")
  const smsMatch = s.match(/^(?:send\s+(?:a\s+)?)?(?:text|sms|message)(?:\s+to)?\s+([a-z0-9+]+)(?:\s+(?:saying|that|:))?\s+(.+)$/i);
  if (smsMatch) {
    const target = smsMatch[1].trim();
    const message = smsMatch[2].trim();
    const contact = findContact(context.contacts, target);
    const phone = contact ? contact.phone : (target.startsWith('+') || /^\d{7,}$/.test(target) ? target : '');
    intents.push({ kind: 'sms', name: contact ? contact.name : target, phone, message });
    replies.push(`Dispatched **SMS** to **${contact ? contact.name : target}**${phone ? ` (${phone})` : ''}: *"${message}"*.`);
    return { intents, replies };
  }

  // B5. Telegram ("telegram Alex check this")
  const tgMatch = s.match(/^(?:send\s+(?:a\s+)?)?telegram(?:\s+to)?\s+([a-z0-9_@+]+)\s+(?:saying\s+)?(.+)$/i);
  if (tgMatch) {
    intents.push({ kind: 'telegram', name: tgMatch[1], message: tgMatch[2] });
    replies.push(`Dispatched **Telegram** message to **${tgMatch[1]}**: *"${tgMatch[2]}"*.`);
    return { intents, replies };
  }

  // --------------------------------------------------------------------------
  // C. SHELL / GOD-MODE / CLIPBOARD / FIND MY PHONE
  // --------------------------------------------------------------------------

  // C1. Direct Shell Execution ("run command df -h", "shell ls -la Download", "exec pm list packages")
  const shellMatch = s.match(/^(?:run command|shell|exec|terminal)\s+`?(.+?)`?$/i);
  if (shellMatch) {
    const command = shellMatch[1].trim();
    intents.push({ kind: 'shell_exec', command });
    replies.push(`Queued shell execution on Huawei P40 Super-Agent: \`${command}\`.`);
    return { intents, replies };
  }

  // C2. Clipboard ("copy 123456 to clipboard")
  const clipMatch = s.match(/^copy\s+["'`]?(.+?)["'`]?\s+to\s+(?:my\s+)?clipboard$/i);
  if (clipMatch) {
    intents.push({ kind: 'clipboard', text: clipMatch[1] });
    replies.push(`Copied **"${clipMatch[1]}"** to your Huawei P40 clipboard.`);
    return { intents, replies };
  }

  // C3. Find My Phone ("find my phone", "ring my phone")
  if (/\b(find my phone|ring my phone|where is my phone|locate my p40)\b/i.test(low)) {
    intents.push({ kind: 'find_my_phone' });
    replies.push('Triggering **Find My Huawei P40** max-volume siren, haptic SOS & voice beacon!');
    return { intents, replies };
  }

  // --------------------------------------------------------------------------
  // D. ROUTINES, MEMORY, CALLS, NAVIGATION, HARDWARE, ALARMS, TIMERS, TASKS
  // --------------------------------------------------------------------------

  // D1. Saved Routine Match
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

  // D2. Personal Memory Storage & Recall
  const memMatch = s.match(/^(?:pelo\s+)?(?:please\s+)?(?:remember(?:\s+that)?|save\s+note:?|note:?|keep in mind(?:\s+that)?)\s+(.+)$/i);
  if (memMatch) {
    const fact = memMatch[1].trim();
    intents.push({ kind: 'memory', fact });
    replies.push(`Saved to Pelo memory: *"${fact}"*.`);
    return { intents, replies };
  }

  if (/\b(what do you remember|my memories|what(?:'s| is) my (?:gate|code|password|pin|address|bike|flight|locker|wifi|buzzer))\b/i.test(low)) {
    const keywordMatch = low.match(/what(?:'s| is) my\s+([a-z0-9\s]+)/i);
    const kw = keywordMatch ? keywordMatch[1].trim() : '';
    const hits = kw
      ? context.memories.filter((m) => m.fact.toLowerCase().includes(kw))
      : context.memories.slice(0, 5);

    replies.push(
      hits.length > 0
        ? `Here's what I have in memory:\n${hits.map((h) => `• ${h.fact}`).join('\n')}`
        : `I don't have a saved note matching "${kw || 'that'}" yet. Say *"Remember my ${kw || 'code'} is ..."* anytime!`
    );
    return { intents, replies };
  }

  // D3. Phone Call
  const callMatch = s.match(/^(?:please\s+)?(?:call|dial|phone|ring)\s+(.+)$/i);
  if (callMatch && !low.includes('remind me')) {
    const target = callMatch[1].trim();
    const contact = findContact(context.contacts, target);
    const phone = contact ? contact.phone : target.replace(/[^\d+]/g, '');
    intents.push({ kind: 'call', name: contact ? contact.name : target, phone });
    replies.push(phone ? `Dialing **${contact ? contact.name : target}** (${phone}) on your Huawei P40.` : `Save **${target}**'s number in Contacts to speed-dial them.`);
    return { intents, replies };
  }

  // D4. Petal Maps Navigation
  const navMatch = s.match(/(?:navigate to|directions to|route to|take me to|map of|where is)\s+(.+)$/i);
  if (navMatch) {
    const destination = navMatch[1].replace(/\s+on\s+petal\s*maps$/i, '').trim();
    intents.push({ kind: 'navigate', destination });
    replies.push(`Launching **Petal Maps** route to **${destination}**.`);
    return { intents, replies };
  }

  // D5. Media Play
  const playMatch = s.match(/^(?:play|listen to)\s+(.+?)(?:\s+on\s+(spotify|youtube))?$/i);
  if (playMatch) {
    const query = playMatch[1].trim();
    const platform = (playMatch[2] || 'spotify').toLowerCase();
    intents.push({ kind: 'media_play', query, platform });
    replies.push(`Playing *"${query}"* on **${platform === 'youtube' ? 'YouTube' : 'Spotify'}**.`);
    return { intents, replies };
  }

  // D6. Timer & Alarm & Task
  if (/\btimer\b/i.test(low)) {
    const secs = parseDurationSeconds(low) || 60;
    const minsLabel = secs >= 60 ? `${Math.round((secs / 60) * 10) / 10} min` : `${secs} sec`;
    intents.push({ kind: 'timer', seconds: secs, label: `${minsLabel} Timer` });
    replies.push(`Started a **${minsLabel}** live timer.`);
    return { intents, replies };
  }

  if (/\b(alarm|wake me)\b/i.test(low)) {
    const parsed = parseTimeHhmm(low) || { hour: 7, min: 30, hhmm: '07:30' };
    intents.push({ kind: 'alarm', timeHhmm: parsed.hhmm, hour: parsed.hour, min: parsed.min, label: 'Pelo Wake Alarm' });
    replies.push(`Alarm armed for **${parsed.hhmm}**.`);
    return { intents, replies };
  }

  const taskMatch = s.match(/^(?:remind me to|add (?:a )?task:?|todo:?|don't let me forget to)\s+(.+)$/i);
  if (taskMatch) {
    intents.push({ kind: 'task', title: taskMatch[1].trim() });
    replies.push(`Added reminder: **"${taskMatch[1].trim()}"**.`);
    return { intents, replies };
  }

  // D7. Hardware Toggles & Sliders
  if (/\b(flashlight|torch|flash light|led light)\b/i.test(low)) {
    const nextVal = /\b(off|disable|stop)\b/i.test(low) ? false : /\b(on|enable|start)\b/i.test(low) ? true : !context.device.flashlight;
    intents.push({ kind: 'setting', setting: 'flashlight', value: nextVal });
    replies.push(`Huawei P40 rear flashlight turned **${nextVal ? 'ON 🔦' : 'OFF'}**.`);
    return { intents, replies };
  }

  if (/\b(vibrate|buzz|haptic|sos)\b/i.test(low)) {
    const isSos = /\bsos\b/i.test(low);
    intents.push({ kind: 'vibrate', pattern: isSos ? 'sos' : 'pulse' });
    replies.push(isSos ? 'Sending **SOS Morse vibration** pulse.' : 'Buzzing Huawei P40 haptic motor.');
    return { intents, replies };
  }

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

  if (/\b(wi-?fi|wlan)\b/i.test(low)) {
    const val = /\boff|disable\b/.test(low) ? false : /\bon|enable\b/.test(low) ? true : !context.device.wifi;
    intents.push({ kind: 'setting', setting: 'wifi', value: val });
    replies.push(`Wi-Fi toggled **${val ? 'ON' : 'OFF'}**.`);
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

  if (/\b(lock (?:my )?(?:screen|phone))\b/i.test(low)) {
    intents.push({ kind: 'system_bridge', command: 'lock_screen', label: 'Lock Huawei P40 Screen' });
    replies.push('Sent **Lock Screen** command to Huawei P40.');
    return { intents, replies };
  }

  if (/\b(screenshot|screen capture|capture screen)\b/i.test(low)) {
    intents.push({ kind: 'system_bridge', command: 'screenshot', label: 'Capture Huawei P40 Screenshot' });
    replies.push('Sent **Capture Screenshot** command to Huawei P40.');
    return { intents, replies };
  }

  if (/\b(camera|take a photo|selfie|scan room|vision lens)\b/i.test(low)) {
    intents.push({ kind: 'open_camera_lens' });
    replies.push('Opening your **Huawei P40 Leica Camera Lens**.');
    return { intents, replies };
  }

  // Open Native Apps
  const openMatch = low.match(/\b(?:open|launch|start)\s+(.+)$/i);
  if (openMatch) {
    const targetApp = openMatch[1].trim();
    const aliasMap = [
      ['whatsapp', 'whatsapp'], ['petal', 'petal_maps'], ['map', 'petal_maps'],
      ['appgallery', 'appgallery'], ['app gallery', 'appgallery'], ['health', 'huawei_health'],
      ['file', 'files_app'], ['spotify', 'spotify'], ['music', 'spotify'], ['youtube', 'youtube'],
      ['telegram', 'telegram'], ['instagram', 'instagram'], ['insta', 'instagram'],
      ['tiktok', 'tiktok'], ['facebook', 'facebook'], ['fb', 'facebook'],
      ['messenger', 'messenger'], ['snapchat', 'snapchat'], ['snap', 'snapchat'],
      ['twitter', 'twitter'], ['x', 'twitter'], ['gallery', 'gallery'], ['photo', 'gallery'],
      ['calc', 'calculator'], ['phone', 'dialer'], ['dialer', 'dialer'],
      ['message', 'messages'], ['sms', 'messages'], ['mail', 'email'],
      ['setting', 'settings'], ['optimizer', 'optimizer']
    ];
    const found = aliasMap.find(([kw]) => targetApp.includes(kw));
    if (found) {
      const appInfo = HUAWEI_P40_APPS[found[1]];
      intents.push({ kind: 'open_app', app: found[1], appInfo });
      replies.push(`Launching **${appInfo.icon} ${appInfo.name}** on your Huawei P40.`);
      return { intents, replies };
    }
  }

  if (/\b(weather|temperature|forecast|rain|outside)\b/i.test(low)) {
    intents.push({ kind: 'weather' });
    replies.push('Checking live local weather telemetry...');
    return { intents, replies };
  }

  if (/\b(battery|charge|status|how is my phone|telemetry)\b/i.test(low)) {
    const d = context.device;
    const activeFiles = (context.files || []).filter((f) => !f.trashed).length;
    replies.push(
      `📱 **${d.deviceModel}** Status:\n` +
      `• Battery: **${d.batteryLevel}%** ${d.charging ? '(⚡ Charging)' : ''}\n` +
      `• Storage: **${d.storageUsedGb} GB / ${d.storageTotalGb} GB** (${activeFiles} tracked files)\n` +
      `• Brightness **${d.brightness}%** · Volume **${d.volume}%** · Super-Agent **${d.bridgeOnline ? 'ONLINE 🟢' : 'Standby'}**`
    );
    return { intents, replies };
  }

  const mathAns = safeMathEval(s);
  if (mathAns !== null) {
    replies.push(`🧮 That comes out to **${mathAns}**.`);
    return { intents, replies };
  }

  if (/^(hi|hie|hey|hello|yo|sup|what can you do)\b/i.test(low)) {
    replies.push(
      `Hey ${context.device.ownerName}! I have full control ready for your **Huawei P40**:\n` +
      `• **Files:** *"Delete all .apk files"*, *"Organize my Downloads"*, *"Restore ..."*\n` +
      `• **Messages:** *"Send SMS to Mom saying I'm outside"*, *"WhatsApp Alex ..."*, *"Read my messages"*\n` +
      `• **Hardware & Shell:** *"Turn on torch"*, *"Find my phone"*, *"Run command df -h"*`
    );
    return { intents, replies };
  }

  replies.push(
    `Ready on your P40 for: *"${s}"*. Try *"Delete file ..."*, *"Send SMS to ..."*, *"Run command ..."*, or connect a free Groq/OpenAI key in **Settings** for open-ended reasoning.`
  );
  intents.push({ kind: 'QuickSearchSuggestion', query: s });
  return { intents, replies };
}

/**
 * Execute all parsed intents against Store + Huawei P40 Super-Agent Queue
 */
async function processCommand({ text, store, telemetry = {}, llmConfig = null }) {
  const telePatch = {};
  if (typeof telemetry.batteryLevel === 'number') telePatch.batteryLevel = telemetry.batteryLevel;
  if (typeof telemetry.charging === 'boolean') telePatch.charging = telemetry.charging;
  if (telemetry.networkType) telePatch.networkType = String(telemetry.networkType);
  if (Object.keys(telePatch).length > 0) {
    await store.updateDeviceState(telePatch);
  }

  const context = await store.getBootstrap();
  await store.addMessage({ role: 'user', content: text, actions: [], source: 'user' });

  const cloudResult = await tryCloudLlm({ text, context, llmConfig });

  let allIntents = [];
  let replyParts = [];

  if (cloudResult && Array.isArray(cloudResult.intents)) {
    allIntents = cloudResult.intents;
    replyParts = [cloudResult.reply || 'Executed on your Huawei P40.'];
  } else {
    const segments = splitCompoundSegments(text);
    for (const seg of segments) {
      const { intents, replies } = parseSegmentBuiltIn(seg, context);
      allIntents.push(...intents);
      replyParts.push(...replies);
    }
  }

  // Expand Routine steps
  const expandedIntents = [];
  for (const intent of allIntents) {
    if (intent.kind === 'routine' && intent.routine) {
      await store.incrementRoutineRun(intent.routine.id);
      for (const step of intent.routine.steps || []) {
        if (step.type === 'set_setting') expandedIntents.push({ kind: 'setting', setting: step.setting, value: step.value });
        else if (step.type === 'set_slider') expandedIntents.push({ kind: 'slider', setting: step.setting, value: step.value });
        else if (step.type === 'open_app') expandedIntents.push({ kind: 'open_app', app: step.app, appInfo: HUAWEI_P40_APPS[step.app] });
        else if (step.type === 'start_timer') expandedIntents.push({ kind: 'timer', seconds: step.seconds || 1500, label: step.label || 'Routine Timer' });
        else if (step.type === 'check_weather') expandedIntents.push({ kind: 'weather' });
      }
    } else {
      expandedIntents.push(intent);
    }
  }

  const clientActions = [];
  const devicePatch = {};

  for (const item of expandedIntents) {
    // ---- FILE ACTIONS ----
    if (item.kind === 'file_delete') {
      const delRes = await store.deleteFiles({
        id: item.id,
        query: item.query,
        extension: item.extension,
        folder: item.folder,
        permanent: Boolean(item.permanent)
      });

      const pattern = item.extension ? `.${item.extension}` : (item.query || item.folder || '');
      for (const aff of delRes.affected) {
        await store.enqueueBridgeCommand({
          commandType: 'file_delete',
          label: `${item.permanent ? 'Shred' : 'Trash'} ${aff.name}`,
          payload: { path: aff.originalPath || aff.path, name: aff.name, permanent: Boolean(item.permanent) }
        });
      }
      if (delRes.affected.length === 0 && pattern) {
        await store.enqueueBridgeCommand({
          commandType: 'file_delete',
          label: `Delete P40 files matching "${pattern}"`,
          payload: { pattern, permanent: Boolean(item.permanent) }
        });
      }

      if (delRes.count > 0) {
        replyParts.push(
          `🗑️ **${delRes.count} file${delRes.count === 1 ? '' : 's'}** (${formatBytes(delRes.freedBytes)}) ${item.permanent ? 'permanently deleted' : 'moved to `.pelo-trash`'}: ` +
          delRes.affected.map((a) => `\`${a.name}\``).join(', ')
        );
      }

      clientActions.push({
        type: 'browser_file_delete',
        query: item.query || '',
        extension: item.extension || '',
        affectedNames: delRes.affected.map((a) => a.name),
        label: `🗑️ Deleted ${delRes.count || ''} File(s)`
      });
    } else if (item.kind === 'file_restore') {
      const res = await store.restoreFiles({ query: item.query });
      for (const r of res.restored) {
        await store.enqueueBridgeCommand({
          commandType: 'file_restore',
          label: `Restore ${r.name}`,
          payload: { name: r.name }
        });
      }
      if (res.count > 0) {
        replyParts.push(`♻️ Restored **${res.count}** file(s): ${res.restored.map((r) => `\`${r.name}\``).join(', ')}.`);
      }
      clientActions.push({ type: 'open_files_tab', label: '📂 View Restored Files' });
    } else if (item.kind === 'file_empty_trash') {
      const res = await store.emptyTrash();
      await store.enqueueBridgeCommand({ commandType: 'file_empty_trash', label: 'Empty .pelo-trash', payload: {} });
      replyParts.push(`🔥 Purged **${res.count}** trashed file(s) permanently.`);
    } else if (item.kind === 'file_organize') {
      const res = await store.organizeDownloads();
      await store.enqueueBridgeCommand({ commandType: 'file_organize', label: 'Organize P40 Downloads', payload: {} });
      replyParts.push(`✨ Sorted **${res.movedCount}** file(s) into categorized subfolders.`);
      clientActions.push({ type: 'open_files_tab', label: '📂 Open P40 File Manager' });
    } else if (item.kind === 'file_create') {
      const fpath = `/storage/emulated/0/Documents/${item.name}`;
      await store.createFileEntry({ name: item.name, folder: 'Documents', sizeBytes: (item.content || '').length || 64, path: fpath });
      await store.enqueueBridgeCommand({
        commandType: 'file_create',
        label: `Create ${item.name}`,
        payload: { path: fpath, name: item.name, content: item.content || '' }
      });
      clientActions.push({
        type: 'browser_file_create',
        name: item.name,
        content: item.content || '',
        label: `📄 Created ${item.name}`
      });
    } else if (item.kind === 'open_files_tab') {
      clientActions.push({ type: 'open_files_tab', label: '📂 Open P40 File Manager' });

    // ---- DIRECT MESSAGING & COMMS ----
    } else if (item.kind === 'sms') {
      const encodedMsg = encodeURIComponent(item.message || '');
      const uri = `sms:${item.phone || ''}?body=${encodedMsg}`;
      await store.logComm({
        channel: 'sms',
        direction: 'outbound',
        contactName: item.name || '',
        address: item.phone || '',
        body: item.message || '',
        status: context.device.bridgeOnline ? 'sent_via_p40_sim' : 'queued_sim_and_intent'
      });
      await store.enqueueBridgeCommand({
        commandType: 'send_sms_direct',
        label: `Direct SIM SMS → ${item.name || item.phone}`,
        payload: { name: item.name, phone: item.phone, message: item.message }
      });
      clientActions.push({
        type: 'deep_link',
        icon: '✉️',
        label: context.device.bridgeOnline ? `✅ Sent SIM SMS to ${item.name}` : `✉️ Send SMS to ${item.name}`,
        subtitle: item.message,
        uri
      });
    } else if (item.kind === 'whatsapp') {
      const cleanPhone = String(item.phone || '').replace(/[^\d]/g, '');
      const encodedMsg = encodeURIComponent(item.message || '');
      const uri = cleanPhone
        ? `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`
        : `whatsapp://send?text=${encodedMsg}`;
      await store.logComm({
        channel: 'whatsapp',
        direction: 'outbound',
        contactName: item.name || '',
        address: item.phone || '',
        body: item.message || '',
        status: 'dispatched'
      });
      await store.enqueueBridgeCommand({
        commandType: 'send_whatsapp',
        label: `WhatsApp → ${item.name}`,
        payload: { name: item.name, phone: cleanPhone, message: item.message }
      });
      clientActions.push({
        type: 'deep_link',
        icon: '💬',
        label: `WhatsApp ${item.name}`,
        subtitle: item.message,
        uri,
        fallbackUrl: cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMsg}` : null
      });
    } else if (item.kind === 'telegram') {
      const encodedMsg = encodeURIComponent(item.message || '');
      await store.logComm({
        channel: 'telegram',
        direction: 'outbound',
        contactName: item.name,
        address: item.name,
        body: item.message,
        status: 'dispatched'
      });
      clientActions.push({
        type: 'deep_link',
        icon: '✈️',
        label: `Telegram ${item.name}`,
        uri: `tg://msg?text=${encodedMsg}`,
        fallbackUrl: 'https://web.telegram.org'
      });
    } else if (item.kind === 'read_messages') {
      await store.enqueueBridgeCommand({
        commandType: 'read_sms_inbox',
        label: 'Sync P40 SMS Inbox',
        payload: {}
      });
      clientActions.push({ type: 'open_files_tab', subtab: 'comms', label: '💬 Open Messages Log' });

    // ---- SHELL / CLIPBOARD / FIND PHONE ----
    } else if (item.kind === 'shell_exec') {
      await store.enqueueBridgeCommand({
        commandType: 'shell_exec',
        label: `Shell: ${item.command.slice(0, 40)}`,
        payload: { command: item.command }
      });
      clientActions.push({
        type: 'bridge_queued',
        command: 'shell_exec',
        label: `💻 P40 Shell: ${item.command.slice(0, 28)}`
      });
    } else if (item.kind === 'clipboard') {
      devicePatch.clipboardText = item.text;
      await store.enqueueBridgeCommand({
        commandType: 'clipboard_set',
        label: 'Set P40 Clipboard',
        payload: { text: item.text }
      });
      clientActions.push({
        type: 'clipboard_copy',
        text: item.text,
        label: '📋 Copied to Clipboard'
      });
    } else if (item.kind === 'find_my_phone') {
      await store.enqueueBridgeCommand({
        commandType: 'find_my_phone',
        label: 'Find My Huawei P40 Siren',
        payload: {}
      });
      clientActions.push({ type: 'find_my_phone', label: '🚨 Ringing P40 Beacon' });

    // ---- HARDWARE / CALLS / APPS / ALARMS / TIMERS / TASKS / MEMORY ----
    } else if (item.kind === 'setting') {
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
      clientActions.push({ type: 'open_camera_lens', label: '📷 Open P40 Vision Lens' });
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
        fallbackUrl: `https://www.openstreetmap.org/search?query=${encoded}`
      });
    } else if (item.kind === 'call') {
      const uri = `tel:${item.phone || ''}`;
      await store.enqueueBridgeCommand({
        commandType: 'call_direct',
        label: `Direct Call → ${item.name}`,
        payload: { name: item.name, phone: item.phone }
      });
      clientActions.push({
        type: 'deep_link',
        icon: '📞',
        label: `Call ${item.name}`,
        subtitle: item.phone || 'Tap to dial',
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
      clientActions.push({ type: 'task_created', task, label: `✅ Reminder Saved: ${task.title}` });
    } else if (item.kind === 'memory') {
      const mem = await store.addMemory({ category: 'personal', fact: item.fact });
      clientActions.push({ type: 'memory_saved', memory: mem, label: '🧠 Saved to Pelo Memory' });
    } else if (item.kind === 'weather') {
      clientActions.push({ type: 'fetch_live_weather', label: '🌤️ Live Huawei P40 Weather Lookup' });
    } else if (item.kind === 'system_bridge') {
      await store.enqueueBridgeCommand({
        commandType: item.command,
        label: item.label || item.command,
        payload: { command: item.command }
      });
      clientActions.push({
        type: 'bridge_queued',
        command: item.command,
        label: `📲 Sent to P40: ${item.label || item.command}`
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

  const finalReply = replyParts.filter(Boolean).join('\n\n');

  const assistantMsg = await store.addMessage({
    role: 'assistant',
    content: finalReply,
    actions: clientActions,
    source: cloudResult ? 'cloud-llm' : 'pelo-neural'
  });

  const updatedBootstrap = await store.getBootstrap();

  return {
    reply: finalReply,
    assistantMessage: assistantMsg,
    actions: clientActions,
    bootstrap: updatedBootstrap
  };
}

module.exports = {
  HUAWEI_P40_APPS,
  processCommand
};
