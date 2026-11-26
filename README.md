# i-tutor — Confidence in learning

Standalone, offline-first **i-tutor** application built with zero external internet dependencies.

## Brand Palette
- **Warm Alabaster Cream:** `#EDE5DA` / `#F6F1E7`
- **Matte Obsidian Charcoal:** `#1E1F1D`
- **Sunburst Gold:** `#F2B728`
- **Burnished 3D Gold:** `#B57A0D`

## Run Locally
```bash
npm start
```

## Message notifications
- Open **My Account → Notifications & Sounds**. Enable **Notify me when the app is closed**, then grant browser permission. Setup is per account/device, opt-in, and requires an active account and an internet connection.
- On **iPhone/iPad (iOS 16.4+)**, first use Safari → Share → Add to Home Screen, then open the installed app to enable push. Supported Android/desktop browsers can subscribe directly on HTTPS. OS/browser restrictions, force-stopping the browser, Silent Mode and Do Not Disturb may delay or suppress notifications; they are not guaranteed instant.
- New saved messages trigger **Web Push from the server**. The service worker can display notifications with no open page or polling. Notification taps open Messages; the user must sign in to read their conversations. No message body or sender name is sent to the push provider or displayed on the lock screen.
- In-app alerts have a short two-note chime, enabled after a tap/key press. Use **Test sound** to check volume. **Closed-app sounds are controlled by the operating system**, not Web Audio. Sound-off preferences are included in push delivery.
- Sign-out revokes the browser subscription first, even offline. Switching accounts requires opting in again. Turning off alerts also removes the device subscription. Expired provider endpoints are removed automatically on 404/410 responses.
- Push targets active, eligible room recipients, never the sender. Atomic server-side claims prevent duplicate alerts when the offline send queue retries. Push-provider errors do not undo a saved chat message. Delivery is best effort: temporary provider failures release the claim for a future resend, but there is no scheduled retry worker, delivery receipt, or exactly-once guarantee.
- While visible, chats poll every 1.5 seconds, other views every 5 seconds, plus network time. Hidden tabs may poll every 15 seconds when allowed. Push itself does not need these timers.

### Push server configuration
1. Apply `supabase/migrations/20261126_web_push.sql` to the app's Supabase project. Both tables have RLS enabled and no browser access; only the server service role can read/write subscriptions and delivery claims.
2. Generate VAPID signing keys with `node scripts/generate-push-keys.mjs`. This creates **git-ignored `.env.push`** without printing private material. It refuses to overwrite existing keys. Store the key pair durably; rotating it requires devices to re-subscribe.
3. Configure Vercel production variables: `VAPID_PUBLIC_KEY`, **`VAPID_PRIVATE_KEY` (sensitive)**, `VAPID_SUBJECT` (an HTTPS contact URL or `mailto:` address), and `PUSH_APP_ORIGIN` (the canonical HTTPS app origin). Existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required. Never expose the private/service-role keys in public assets. Deploy the code after configuring variables.
4. Preview deployments deliberately do not share production push credentials. For a push-enabled staging environment, use its own keys/origin. `/api/push/config` returns only readiness and the public VAPID key; an unconfigured server explains that push setup is pending rather than pretending registration succeeded.
5. Real-device acceptance test: sign in on two devices, enable push on the recipient, close its app/tab, send a message from the other device, verify the OS notification, tap it to open Messages. Verify muting, disabling, and signing out stop the corresponding alerts. Sending from an old deployment without this push integration does not trigger push.

Subscription registration checks the app's current account PIN on the server and never stores it in the push tables. This integrates with the existing custom account system, **not Supabase Auth**; it does not replace a broader authentication/security review of the legacy sync API.

Run `npm test` for sync/retry, recipient filtering, duplicate prevention, endpoint validation, preference, and closed-window service-worker regression tests. Push-provider/network behaviour is mocked in automated tests; real phone delivery still needs the acceptance test above.
