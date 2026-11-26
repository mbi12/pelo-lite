# i-tutor Android

A Capacitor Android project that bundles the existing i-tutor UI and offline learning assets. It is **not** just a shortcut that loads a remote website.

## Current scope

- App name: **i-tutor**. Application ID: **`app.itutor.academy`** (confirm this before Play Store/Firebase registration).
- Minimum Android: **7.0 / API 24**, with an up-to-date Android System WebView. Target/compile SDK: **36**.
- The app launches from bundled HTML/CSS/JS, sample homework, icons and PDF reader assets, including when offline. Existing localStorage/IndexedDB data and offline outbox stay on the device. Cloud data must be synced at least once before it is available offline.
- Only `/api/*` requests are routed to **https://i-tutor-alpha.vercel.app**. Bundled assets remain local and signed storage uploads retain their original URL. Local development servers are not required on the phone.
- Native Android Back returns from a mobile chat thread, then to the hub, then minimizes the app. Resuming the app requests a fresh sync.
- Branded launcher icons and splash screen are included. Android backup and cleartext network traffic are disabled. Only the Internet permission is requested by the app manifest; Android's picker handles selected files.
- The website's service worker is deliberately not registered in the native app. Assets are included in the APK instead.

### Important: notifications

In-app message banners and sounds work while the app is open and syncing. **Closed-app push in this APK is not yet available.** Android WebView does not inherit browser Web Push subscriptions. The native notification checkbox is disabled with an explanation rather than pretending registration succeeded.

Native push needs a Firebase project/Android app registered with `app.itutor.academy`, the Firebase client configuration (`android/app/google-services.json`), native FCM registration/token lifecycle integration, and a server-side FCM sender with securely managed credentials and recipient authorization. None of those private credentials belong in Git or chat. The existing website's closed-app Web Push remains available independently.

## Build an installable test APK

### GitHub Actions (no local Android SDK needed)

The **Android APK** workflow runs when Android/app code is pushed to this session branch. It installs Node 22, Java 21 and Android SDK 36, runs automated tests, syncs bundled assets and runs Gradle `assembleDebug`.

1. Open the repository's **Actions → Android APK** workflow.
2. Open a successful run for the desired commit.
3. Download **`itutor-android-debug-<run number>`** from Artifacts (GitHub sign-in may be needed).
4. Unzip it and copy `app-debug.apk` to your Android phone.
5. Open the APK, allow installation from that browser/file manager if Android asks, then launch **i-tutor**.

Artifacts expire after 14 days. This is a **debug-signed test app**, not a Play Store release. Debug builds from different clean runners may use different signing keys; Android may require uninstalling an older test build before installing another, which deletes that build's local offline data. Export a backup first. Use a stable, privately held signing key for real releases.

### Android Studio / local build

Install Node **22+**, Java **21**, and Android Studio with SDK platform **36** and Build Tools **36.0.0**. Set `ANDROID_HOME` or configure the SDK location in Android Studio. Then:

```sh
npm ci
npm test
npm run android:sync
npm run android:open
```

Use Android Studio's Run button for a connected device/emulator. To build directly on macOS/Linux:

```sh
npm run android:apk
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

On Windows, run `npm run android:sync`, then `cd android` and `gradlew.bat assembleDebug`.

`mobile-www/`, copied Android web assets, Gradle outputs, SDK paths, Firebase configuration, and signing keys are ignored by Git. `npm run android:sync` recreates generated assets. Do not commit APK/AAB files or secrets.

To target a separate HTTPS backend, set `ITUTOR_API_ORIGIN` when running `npm run android:sync`. The value must be an HTTPS origin with no path/trailing slash. It is public build configuration, never a secret. The default is the live i-tutor API; test accounts/actions will therefore affect the live workspace. Use a staging deployment for destructive tests.

## Device acceptance checklist

- Install and launch; confirm the branded icon and standalone app (no browser URL bar).
- Sign in with your existing account while online; verify subjects, messages and homework match the website.
- Exchange messages with an account in the website, including attachments and edits.
- Open a sample PDF/photo/video, then reopen cached content in airplane mode.
- Queue a message offline, restart the app, reconnect, and verify it syncs exactly once.
- Check Android Back, keyboard, edge-to-edge layout and resume sync.
- Verify sign-out, role restrictions and account switching; do not assume browser push works in the APK.

The build workflow compiles the APK but does not replace a real emulator/device test.

## Google Play release (not performed)

A production release needs your confirmed application ID, versioning, a stable upload/signing key, a Play Console developer account, privacy policy/data-safety details and a signed Android App Bundle. The repository does not auto-publish releases or contain signing credentials. The existing custom PIN-based account/sync system also needs a security review before broader distribution; packaging the web app does not change its authentication model.
