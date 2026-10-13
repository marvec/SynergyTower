# SynergyTower for iOS and Android

The store apps are the web game (`../src`) inside a [Capacitor 8](https://capacitorjs.com) shell. There is one
codebase: the same bundle runs on the website, as an installed PWA and in the apps, and decides at runtime what to do
on each platform (`src/engine/platform.js`). The web bundle has no npm dependency; it talks to the native plugins through
the bridge Capacitor injects (`window.Capacitor`). The packages here only provide the native halves.

## Commands (from `mobile/`)

```bash
npm install          # once: Capacitor CLI, the iOS/Android runtimes and the plugins
npm run sync         # build the game into www/ (../scripts/build-app.js) and copy it into both native projects
npm run ios          # sync, then open the Xcode project (Run there, or Product > Archive for the App Store)
npm run android      # sync, then open Android Studio (Run, or Build > Generate Signed Bundle for Google Play)
sh icons.sh          # regenerate app icons and splash screens from ../public/icon.svg (rsvg-convert + ImageMagick)
```

Run `npm run sync` after every change to the game; the native projects only hold a copy of `www/`.
`www/`, `node_modules/` and the copied web assets inside `ios/` and `android/` are not committed.

## What differs in the app (all in `src/`, decided at runtime)

| | Website | App |
|---|---|---|
| Saves | localStorage | localStorage, mirrored to native storage (Preferences) and restored if iOS clears the WebView |
| Reminders | browser notifications while the tab is open in the background | local notifications scheduled when the app goes to the background, so they arrive after it was closed too; night ones move to 08:00 |
| Shop | demo checkout for Stock Options (labelled DEMO) | no checkout: Stock Options are earned in the tower (the stores only allow their own billing) |
| Tip jar ("Buy author a coffee") | yes | hidden (store rules on outside payments) |
| Title badges | C64 + App Store + Google Play | C64 only |
| Feedback form | in-game overlay with reCAPTCHA | opens synergytower.co.uk/feedback/ in the in-app browser (reCAPTCHA only works on the website's domain) |
| External links | new tab | in-app browser (Browser plugin) |
| Offline | service worker | the files are inside the app; no service worker |
| Analytics | Cloudflare + Umami on the production domain | Umami, tagged `app-ios` / `app-android` |
| Back button (Android) | n/a | acts as Escape (dialogs, menu); never quits by accident |
| Haptics | none | a short buzz on mistakes, crashes and level-ups (follows the sound effects setting) |

Both apps are locked to landscape (iOS `Info.plist`, Android `screenOrientation="sensorLandscape"`) and run full screen
with the system bars hidden (`SystemBars` in `capacitor.config.json`); the game fits inside the notch/safe areas
(`src/style.css`). On a phone browser in portrait the website suggests turning the phone sideways, or plays upright
with the HUD as a dock of big controls under the game (`src/scenes/portraitDock.js`).

## Before submitting to the stores

- **Signing (iOS)**: open `ios/App/App.xcodeproj`, target App > Signing & Capabilities, tick "Automatically manage
  signing" and pick your Team; then Product > Archive and Distribute App.
- **Signing (Android)**: create an upload key once (the command is in `android/keystore.properties.example`), copy that
  file to `android/keystore.properties` with your values (git-ignored, like `*.keystore`), then
  `cd android && ./gradlew bundleRelease` gives `app/build/outputs/bundle/release/app-release.aab` for Google Play.
  Without `keystore.properties` the bundle is built unsigned.
- **Versions**: bump `CFBundleShortVersionString`/`CFBundleVersion` (Xcode, target General) and `versionName`/`versionCode`
  (`android/app/build.gradle`) for every upload.
- **Xcode**: Xcode 26 needs the matching iOS platform (Xcode > Settings > Components) before it can build for a
  simulator or device.
- **Privacy labels / Data safety**: the app collects anonymous usage events (Umami, no cookies, no identifiers, no
  personal data) and nothing else; saves stay on the device. Declare "Usage data / App interactions, not linked to the
  user, not used for tracking" (App Store) and "App activity, not shared" (Google Play). Privacy policy URL:
  https://synergytower.co.uk/privacy/ (`public/privacy/index.html`, also linked from Menu > Settings in the game).
- **Notifications**: Android asks for permission when the player switches Reminders on (Menu > Settings) or accepts
  the offer after running out of coffee. The app does not use exact alarms (Google Play restricts them).
- **Store listing**: App Store guideline 4.2 (minimum functionality) is met by a full offline game with native
  notifications and haptics; screenshots can come from the website's `public/how-to-play/img/` grabs (landscape).
- **Encryption**: `ITSAppUsesNonExemptEncryption` is false (HTTPS only), so no export compliance questions.

## Testing on a device or emulator

`npm run android` and press Run, or from the command line:

```bash
cd android && ./gradlew assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n uk.co.synergytower.app/.MainActivity
```

Debug builds allow WebView debugging: open `chrome://inspect` in desktop Chrome to get a console (`__game` works there;
the `__mg`/`__trip` helpers are dev-server only).
