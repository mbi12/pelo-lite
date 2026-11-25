# PELO — Personal AI Phone OS & Controller (Huawei P40 Edition)

**Pelo** is a personal AI assistant, hardware control deck, and native OS automation bridge built specifically for the **Huawei P40** (`1080×2340` OLED, EMUI 12 / HarmonyOS, zero Google Mobile Services reliance).

## Three-Tier Phone Control Architecture

1. **Direct Huawei P40 Browser Hardware Controls (Instant, Zero Extra Apps)**
   - Physical rear LED flashlight (`MediaStreamTrack` `{ torch: true }` + OLED soft fallback)
   - Tactile haptics & SOS Morse pulses (`navigator.vibrate`)
   - Screen Wake Lock (`navigator.wakeLock`) for Driving / Desk HUD mode
   - Live battery %, charging status & network speed telemetry (`getBattery`, `navigator.connection`)
   - Live rear Leica camera viewfinder modal
   - Polyphonic wake alarms & live ticking countdown timers
   - HMS-safe voice input + spoken TTS responses + live Open-Meteo weather

2. **Native Huawei EMUI & Android Intent Deep-Link Launcher**
   - **Petal Maps** (`com.petalmaps.app` / `geo:`) instead of GMS-dependent maps
   - **Huawei AppGallery** (`appmarket://`), **Huawei Health**, **Huawei Optimizer**
   - Pre-filled **WhatsApp**, **SMS**, **Phone Calls**, **Telegram**, **Spotify**, **YouTube**, **Instagram**, **TikTok**, and **Android Clock Alarms** (`android.intent.action.SET_ALARM`)

3. **Full OS System Bridge (`MacroDroid` ↔ `/api/bridge/*`)**
   - Downloadable pre-paired `Pelo-Huawei-P40-Bridge.json` blueprint for **MacroDroid** (available on Huawei AppGallery without GMS)
   - Queues & acknowledges system-level Wi-Fi, Bluetooth, DND, Brightness, Volume, Lock Screen, and Screenshot actions
   - Includes step-by-step Huawei **Optimizer → App Launch → Manage Manually** setup instructions so EMUI never kills background automation

## Persistence

- **Production (Vercel)**: Backed by **Supabase PostgreSQL** (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
- **Local / Offline**: Automatic zero-config `node:sqlite` (`data/pelo.db`) fallback

## Commands

```bash
npm install
npm test
npm start
```
