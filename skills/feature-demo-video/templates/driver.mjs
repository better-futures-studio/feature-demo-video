// Driver template: copy to $DEMO_DIR/driver.mjs next to take/script.json, then replace the
// beats. One beat per line in script.json, in order; each beat lasts as long as its voice line.
// See examples/catch-up/driver.mjs for a complete, working take.
// usage: DEMO_LIB=<skill>/scripts/lib.mjs TAKE=$DEMO_DIR/take THEME=light node driver.mjs
// The copy lives outside the skill, so it can't find lib.mjs on its own.
if (!process.env.DEMO_LIB) {
    throw new Error('Set DEMO_LIB=<skill>/scripts/lib.mjs');
}

const lib = await import(process.env.DEMO_LIB);
const { ab, sleep, centerOf, moveTo, click, swipe, holdTouchEmulation, waitFor, waitForText } = lib;
const { DEMO_DIR, createTake, freshBrowser, openAt, readUrls, showFinger } = lib;

const TAKE = process.env.TAKE ?? `${DEMO_DIR}/take`;
const THEME = process.env.THEME ?? 'light';
const PHONE = { w: 402, h: 874, scale: 3 };
const DESK = { w: 1280, h: 720, scale: 1.5 };
const urls = readUrls(); // $DEMO_DIR/urls.json, written by the project's seed step
const take = createTake(TAKE, THEME);
const { beat } = take;

await freshBrowser();

// Off camera: anything the viewer shouldn't sit through (sign-in, clearing localStorage, seeding).
// Sign in through the project's own login page. Selectors are the app's, so adjust them.
if (urls.login_url) {
    ab('open', urls.login_url);
    ab('fill', 'input[type=email], input[name=email]', urls.login_email);
    ab('fill', 'input[type=password]', urls.login_password);
    ab('press', 'Enter');
    await sleep(2500);
}

// ---------- phone segment (drop it when the feature isn't mobile-first) ----------
openAt(urls.start_url, PHONE, THEME);
const touch = await holdTouchEmulation();

try {
    ab('reload');
    waitForText('TODO: text that proves the page is ready');
    showFinger();
    await moveTo(PHONE.w * 0.6, PHONE.h * 0.85, { duration: 10 });

    take.startSegment('phone', PHONE);
    await sleep(1000);

    // Intro line: let the screen breathe; drift the finger toward what the line talks about.
    await beat('A', async () => {
        await sleep(2000);
        const main = centerOf('[data-testid="TODO"]');
        await moveTo(main.x, main.y - 40, { duration: 1200 });
    });

    // Land the key action exactly as the line ends (after), so the next line opens on its result.
    await beat('B', async () => {
        const card = centerOf('[data-testid="TODO"]');
        await swipe({ x: card.x - 60, y: card.y }, { x: card.x + card.w * 0.55, y: card.y }, { duration: 1000 });
    }, { tail: -0.5, after: () => click('[data-testid="TODO-confirm"]') });

    await beat('C', async () => {
        waitFor('[data-testid="TODO-appears-after-animation"]');
    });

    take.stopSegment();
} finally {
    touch.kill('SIGTERM');
}

// ---------- desktop segment: short, only what's different ----------
openAt(urls.desktop_url ?? urls.start_url, DESK, THEME);
waitForText('TODO');
await moveTo(DESK.w * 0.55, DESK.h * 0.55, { duration: 10 });

take.startSegment('desktop', DESK);
await sleep(900);

await beat('D', async () => {
    await click('[data-testid="TODO"]', { settle: 500 });
});

await beat('E', async () => {
    await moveTo(DESK.w * 0.7, DESK.h * 0.6, { duration: 900 });
}, { tail: 1.4 });

take.stopSegment();
take.save();
