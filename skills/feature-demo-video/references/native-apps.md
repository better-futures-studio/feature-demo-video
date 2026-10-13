# Native mobile apps (iOS simulator)

How to demo a native app the same way as a web app: the real app, driven at a human pace, timed to the voice. Learned on a SwiftUI iPad/iPhone app (October 2026). The browser tooling (`agent-browser`, `lib.mjs`, `compose.sh`) doesn't apply; the steps below replace it. Android hasn't been tried yet.

## Tools

- **Simulators:** Xcode's `xcrun simctl`. Create the device sizes you need (`xcrun simctl create "Demo iPhone SE" com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation <runtime>`); `xcrun simctl list devicetypes` and `list runtimes` show what's available.
- **Taps, typing, element lookup:** [AXe](https://github.com/cameroncooke/AXe) (`brew install cameroncooke/axe/axe`). `axe describe-ui` lists accessibility labels and frames, and `axe tap --label …` taps an element.
- **Recording:** `axe record-video` (see Recording).
- `ffmpeg` and Python with Pillow, for composing.

## Driving the app with AXe

- **Use `--tap-style physical` for every tap.** The default style reported success but didn't trigger SwiftUI buttons: the app looked broken when it wasn't. Before you call a button dead, retry it with `physical`.
- **Wait for elements, don't sleep:** `axe tap --label "Allow While Using App" --wait-timeout 20 …`. System alerts (location, camera, notifications) appear seconds after launch, sometimes later than you expect.
- **Tap by label, not coordinates.** Labels survive layout changes. When two elements share a label (a button and its text), add `--element-type Button`.
- **Keep one simulator booted while driving.** With two booted, AXe failed with "Timed out creating the simulator remote automation session". Shut the other down, and reboot a simulator if AXe stops seeing it.
- **Landscape-only apps on iPad:** AXe's frames were in landscape points, but no tap mapping (landscape or rotated) hit the target. Show those screens with the preview harness (below), or drive a portrait device.
- **Fast multi-tap gestures** (a hidden "tap the logo 5 times" admin entry) can't be triggered reliably: each physical tap takes too long. Reach those screens another way.
- **`axe type`** types into the focused field. For keypads drawn by the app, tap the digit buttons by label instead.
- zsh doesn't word-split `$VAR`, so `for f in $files` passes one long argument. Use `xargs` or a bash script.

## Fresh state before every take

- **The simulator keychain survives uninstall.** An app that keeps its auth token there opens signed in after a reinstall. For a fresh sign-in: `xcrun simctl keychain <udid> reset`, then add back any root certificate you need, then reinstall.
- **Permission prompts:**
  - `xcrun simctl privacy <udid> grant location <bundle>` didn't stop the location prompt until the simulator was rebooted. Simplest: tap the prompt away with AXe before recording.
  - Then relaunch the app (`simctl terminate` + `launch`), so the recording starts on a clean screen.
- **Clean status bar:** `xcrun simctl status_bar <udid> override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`. Clear it with `status_bar <udid> clear`.

## Reaching the local demo server

- **Override build settings on the `xcodebuild` command line** (`API_BASE_URL=127.0.0.1:<port>`): command-line settings win over `.xcconfig` values, so no project file changes.
- **HTTPS-only apps:**
  1. Make a throwaway certificate with `subjectAltName=IP:127.0.0.1` and `basicConstraints=critical,CA:TRUE`, and trust it in the simulator only: `xcrun simctl keychain <udid> add-root-cert cert.pem`. Delete it with the demo.
  2. Put a ~20-line Node `https` proxy in front of the demo server.
  3. In the proxy, rewrite absolute `http://127.0.0.1:<port>` URLs in JSON responses to the proxy's `https://` address, both plain and JSON-escaped (`http:\/\/`): the server builds URLs from its own address, and the app then calls them over HTTP.
  4. Set the `Host` header to the backend's own address, so signed URLs (temporary file links) still validate.
- **Release-looking builds:** debug-only controls (`#if DEBUG` buttons) don't belong in the video and change the layout. Build with the compilation conditions the release build uses (`SWIFT_ACTIVE_COMPILATION_CONDITIONS=STAGING` or similar), with every URL key pointed at the demo server.
- **Analytics and crash reporting SDKs report from simulators.** Set their keys to dummy values on the build command line (for example `POSTHOG_API_KEY=… SENTRY_DSN=…`) so no event leaves the machine.

## Screens you can't reach safely

Some screens sit behind a real third party you can't call: a card reader payment, a carrier SMS. To film them:
1. Add a **temporary preview harness**: an environment variable (`SIMCTL_CHILD_SCREEN=payment xcrun simctl launch …` sets `SCREEN` in the app) switches the root view to that screen with sample data.
2. Mark every line `TEMP-` and grep for the marker before every commit. Remove the harness the moment the screenshots are taken.
3. Say so in the narration: "this is the screen after a real payment, with sample data".
4. The harness is also how you check those screens on every device size.

## Recording

- **Use `axe record-video --fps 15 --scale 0.6 --output raw.mp4`** (stop it with SIGINT). Its timestamps follow the wall clock.
- **Avoid `simctl io recordVideo` for timed demos.** It writes a frame only when the screen changes:
  - Long still holds collapse, so the video drifts seconds away from your beat timeline.
  - The first frame is missing until something changes; forcing a change at the start (the status-bar override) only fixes the first frame.
- **Convert to a constant frame rate before anything else:** `ffmpeg -nostdin -i raw.mp4 -vf "fps=30,scale=-2:1600" -c:v libx264 -crf 18 -pix_fmt yuv420p cfr.mp4`.
- **`-ss` on a variable-frame-rate file returns the next frame, not the current one.** A still screen sampled at 5 s showed a button's pressed state from 10 s, which looked like a disabled button. Sample frames only from the constant-frame-rate file.
- **Write a beat timeline while driving:** record each beat's start relative to a T0 taken just after recording starts, and after each beat's actions wait until its voice line (plus a short tail) has played.
- **Check where each screen really appears before cutting.** A toast after sign-in delayed the next screen by 4 s, so its line ("here's the welcome screen") would have played over the old one. Set the beat's start to when the screen appears, not when the action ran.

## Composing

- **Speed up beats whose actions outrun their line.** Taps through AXe are slower than a person's (about 1–3 s each). Speed a segment to fit its line plus ~0.7 s, capped at **2.5×**; above that the taps look frantic. A beat that is mostly waiting (a sign-in toast, a spinner) can go to 3.5×. Hold the last frame (`tpad=stop_mode=clone`) when a beat is shorter than its line.
- **Phone framing:** overlay the video on a plain 1920×1080 background, then overlay a PNG of the background with a rounded-rectangle hole and a soft shadow outside it. This gives rounded corners without masking the video. Fit the phone to about 960 px tall.
- **Stills** (harness screens, a second device size): render each as a full 1080p frame with Pillow (rounded corners, shadow), make each a clip with `-loop 1 -t <seconds>`, and give each line's stills equal shares of the line.
- **iPad landscape screenshots come out rotated** from `simctl io screenshot` (the framebuffer is portrait). Rotate them 90° before using them.
- **Audio:** `adelay` each line to its beat's start in the output timeline (after speed-ups), `amix` with `normalize=0`, and mux it with the concatenated video.
- **A demo across devices:** live flow on one phone, then stills of the smallest supported phone, then the tablet ("the iPad looks exactly like before") when layouts adapt by size class.

## Disk

Xcode's derived data folders are several GB each. Reuse one `-derivedDataPath` for every build in a session, delete old ones, and check free space (`df -h /`) before long builds. "No space left on device" during `xcodebuild` ends the build.
