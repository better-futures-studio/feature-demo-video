# Catch-up team demo

The first demo made this way, from the HeyJet app (Laravel + Inertia): a private page where an owner swipes through unanswered reviews on their phone. Phone segment 402x874, then a desktop segment 1280x720; ~106 s; light and dark takes.

- `script.json` — the narration, 14 lines. Note the shape: casual opener, what it is and why, what's not built yet, then each thing the user can do, the limits (confirm before posting publicly, six-second undo, skipped cards come back, links last seven days), and a short desktop pass.
- `driver.mjs` — the take. Worth copying: tagging buttons without test ids, the scrollable-element hunt in beat B, `after` on beat C, waiting for the undo bar in D, the real email in I2.

Its selectors, sign-in and seed belong to that app, so it won't run elsewhere. Read it as a pattern.
