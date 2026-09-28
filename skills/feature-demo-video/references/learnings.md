# Learnings

What the first team demos (September 2026) taught us. Read this before planning a new demo.

## What the team asked for (these define the skill)

- **A developer showing their team a feature they built.** Not an ad, not a launch video. Casual, first person, a little rough: "Hey everyone. So, um, I want to show you…". Filler words are welcome in the opener; don't polish them out.
- **Order of the narration:** what it is, how the user gets to it, the overall benefit, and where it's going. Be honest about what isn't built yet ("We don't send it automatically yet, but the idea is…"). Then walk through what the user can do, and the important behavior: limits, undo, expiry, what happens to skipped items, what's public.
- **No music, no captions, no title card.** The voice and the real screens carry it.
- **One consistent voice across the whole video.** Tone and accent must not change from line to line.
- **Each developer's own voice when they want it,** recorded by them and kept on their machine, never in a repo.
- **Audition voices as audio before re-recording video.**
- **Mobile first when the feature is mobile-first**, then a short desktop pass that shows only what's different (e.g. opening it from a signed-in page, keyboard shortcuts, a dialog instead of a sheet). Don't repeat on desktop what the phone already showed.
- **Light and dark takes**, both composed and shared.
- **Show every real screen the flow touches.** If the feature sends an email, show the real email (from the dev mailer, not a mockup) and tap through it. Show the expired and error screens, not just the happy path.
- **Don't transcribe or verify the voice automatically unless asked.** The user checks it by ear.

## Driving agent-browser (0.38)

- `--human` exists only for click, drag and `mouse move` (with `--seed` and `--duration`). There is no human typing and no smooth scroll: `typeText` (≈6.5 characters a second, longer after spaces and punctuation, the odd hesitation) and `smoothScroll` (eased JS scroll of an element) fill the gap.
- **Set the viewport after `open`.** Setting it before the first `open` relaunches the browser and the page is dropped. `openAt()` does it in the right order and reloads.
- **Chrome can't make a window narrower than 500 px.** A 402 px phone viewport records squeezed into the left of the frame. `compose.sh` fixes it in post: scale x by 500/viewport width, then crop back.
- **Touch emulation only lives as long as a CDP session holds it.** `holdTouchEmulation()` runs `cdp.mjs`, which keeps the session open (coarse pointer, 5 touch points) until it's killed at the end of the segment.
- **`Emulation.setEmitTouchEventsForMouse` makes `mouse down` hang.** Don't use it. Swipes work as mouse drags if the app handles pointer events.
- **The `--cursor` overlay can't be restyled.** Desktop segments use `--cursor`; phone segments use the fingertip from `finger.js`, re-injected after every navigation (`showFinger()`).
- **Close the browser and wait about 3 s before reopening** (`freshBrowser()`), or the old one takes the new one down with it, and a stray tab can hold the recording.
- **Mail buttons have `target="_blank"`.** Tapping one opens a new tab and the recording keeps filming the old one. `make-email.py` strips it.
- **Wait for elements that appear after animations** (`waitFor(selector)` before `centerOf(selector)`).
- **Tag elements without test ids** with `setAttribute('data-demo', …)` from `evalJs`, then drive them by `[data-demo=…]`.
- **Sign in, clear storage and seed off camera,** before `startSegment`.
- **Clear the browser session's storage before each take.** agent-browser keeps a named session's localStorage across `close`; a feature that remembers state there (dismissed cards, "don't ask again") opens differently on the next take.
- Every agent-browser call has a timeout (`AB_TIMEOUT_MS`, default 20 s) so a stuck command fails the take instead of wedging it.
- zsh doesn't word-split `$VAR` arguments, so `AB="agent-browser --session x"; $AB open …` fails. Use `scripts/ab` or call `agent-browser --session …` directly.

## Timing

- **Time beats to the voice, not the other way round.** Generate the voice first; the driver reads each line's duration and a beat lasts as long as its line plus a small tail.
- **Land key actions as a line ends** with `after`: e.g. pressing Post in a confirm sheet as the "it asks you to confirm" line ends (`tail: -0.6`), so the next line starts on the fresh result.
- Give the viewer a beat on each new screen before the pointer moves; start the pointer where the eye will go next.
- A typical demo: 14 lines, ~90 s of voice, ~105 s of video (phone ~80 s, desktop ~25 s).

## Environment

- **Serve built assets, not a hot-reload dev server.** A dev server that restarts or isn't running leaves pages blank mid-take.
- **Check the served app really uses the demo environment.** Some dev servers pass only an allowlist of environment variables to their workers (Laravel's `artisan serve` does unless `--no-reload`), so database and mock-URL overrides silently vanish and the app reads another config. Load a page that proves which database it's on before recording.
- **A fresh checkout may build without its env** and crash on load (e.g. a websocket client with no app key shows as a blank page). Check the browser console when a page is blank.
- **`ffmpeg -nostdin` everywhere.** Inside a `while read` loop ffmpeg eats the loop's stdin and later segments are silently dropped.
- An email can be rendered without sending if the flow you're filming doesn't send one; prefer the real sent mail when it does.

## Safety

- Local, throwaway database only; fictional people and businesses; `.test` emails; synthetic ids. Never a real customer.
- Every third-party call the flow makes goes to a local mock, a dev mailer, or is switched off. If you can't isolate one, stop.
- Never write test data to a live service intending to restore it afterwards. A local test once wrote a fake mapping to a production key-value store and took a live site down for two days; faking the files did not fake the network write.
- Sharing binds only to the Tailscale address, never `0.0.0.0` or the LAN.
