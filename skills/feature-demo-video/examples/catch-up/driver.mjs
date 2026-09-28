// Catch-up team demo: phone first (the card stack, read more, swipe to post with the first-time confirm,
// undo, edit, skip, tap post, summary, expired link + resend, the real email), then a short desktop pass
// showing only what differs (open from the signed-in Reviews page, keyboard shortcuts, edit dialog).
// Each beat's id is a line in script.json; the beat lasts as long as that voice line.
// A reference from the HeyJet app (Laravel + Inertia): its selectors, seed and sign-in are that app's.
// Read it for the techniques; it won't run against another project.
const lib = await import(process.env.DEMO_LIB ?? new URL('../../scripts/lib.mjs', import.meta.url).href);
const { ab, sleep, evalJs, centerOf, moveTo, click, typeText, smoothScroll, swipe, holdTouchEmulation, waitFor, waitForText } = lib;
const { DEMO_DIR, createTake, freshBrowser, openAt, openEmail, readUrls, showFinger } = lib;

const TAKE = process.env.TAKE ?? `${DEMO_DIR}/take`;
const THEME = process.env.THEME ?? 'light';
const PHONE = { w: 402, h: 874, scale: 3 };
const DESK = { w: 1280, h: 720, scale: 1.5 };
const urls = readUrls();
const take = createTake(TAKE, THEME);
const { beat } = take;

await freshBrowser();

// ---------- setup, off camera: sign in so the desktop segment can show the Reviews page ----------
ab('open', urls.login_url);
ab('fill', 'input[name=email]', urls.login_email);
ab('fill', 'input[name=password]', urls.login_password);
ab('press', 'Enter');
await sleep(2500);

// ---------- phone segment ----------
openAt(urls.catch_up_url, PHONE, THEME);
const touch = await holdTouchEmulation();

try {
    ab('reload');
    waitForText('Margaret');
    // Forget the first-swipe confirmation from earlier takes, so the confirm sheet shows again.
    evalJs('localStorage.clear(); sessionStorage.clear(); true');
    ab('reload');
    waitForText('Margaret');
    showFinger();
    await moveTo(PHONE.w * 0.64, PHONE.h * 0.9, { duration: 10 });
    await sleep(500);

    take.startSegment('phone', PHONE);
    await sleep(1200);

    await beat('A', async () => {
        await sleep(2500);
        const card = centerOf('[data-testid="catchup-card"]');
        await moveTo(card.x + 40, card.y - 60, { duration: 1300 });
    });

    await beat('A2', async () => {
        await sleep(3000);
        await moveTo(PHONE.w * 0.4, PHONE.h * 0.62, { duration: 1500 });
    });

    await beat('B', async () => {
        // Buttons without a test id: tag the one we want, then drive it like any other selector.
        const hasMore = evalJs(`(() => { const b = [...document.querySelectorAll('[data-testid="catchup-card"] button')].find((el) => /Read full review/.test(el.textContent)); if (b) b.setAttribute('data-demo', 'more'); return !!b; })()`);

        if (hasMore) {
            await click('[data-demo="more"]');
        }

        await sleep(700);
        const scroll = evalJs(`(() => { const el = [...document.querySelectorAll('[data-testid="catchup-card"] *')].find((n) => /(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 4); if (!el) return null; el.setAttribute('data-demo', 'scroll'); return el.scrollHeight - el.clientHeight; })()`);

        if (scroll) {
            const box = centerOf('[data-demo="scroll"]');
            await moveTo(box.x + 30, box.y + 40, { duration: 700 });
            await smoothScroll('[data-demo="scroll"]', scroll, 1800);
            await sleep(700);
            await smoothScroll('[data-demo="scroll"]', -Math.round(scroll * 0.45), 1100);
        }
    });

    // Press Post in the confirm sheet as the line ends, so D starts on the fresh undo countdown.
    await beat('C', async () => {
        const card = centerOf('[data-testid="catchup-card"]');
        await swipe({ x: card.x - 60, y: card.y - 30 }, { x: card.x + card.w * 0.55, y: card.y - 55 }, { duration: 1100 });
        await sleep(700);
        const post = centerOf('[data-testid="catchup-swipe-confirm-post"]');
        await moveTo(post.x - 10, post.y - 6, { duration: 900 });
    }, { tail: -0.6, after: () => click('[data-testid="catchup-swipe-confirm-post"]', { settle: 120 }) });

    await beat('D', async () => {
        // The undo bar appears only after the card has flown out.
        waitFor('[data-testid="catchup-undo"]');
        const undo = centerOf('[data-testid="catchup-undo"]');
        await moveTo(undo.x - 20, undo.y - 70, { duration: 900 });
    }, { tail: 0.6 });

    await beat('E', async () => {
        await click('[data-testid="catchup-edit"]');
        await sleep(700);
        const text = centerOf('[data-testid="catchup-edit-text"]');
        await moveTo(text.x + text.w * 0.3, text.y + text.h * 0.3, { duration: 600 });
        evalJs(`(() => { const t = document.querySelector('[data-testid="catchup-edit-text"]'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); return true; })()`);
        await sleep(300);
        await typeText(' Say hi to the kids for us!');
        await sleep(500);
        await click('[data-testid="catchup-edit-post"]');
    }, { tail: 0.8 });

    await beat('F', async () => {
        await sleep(500);
        const card = centerOf('[data-testid="catchup-card"]');
        await swipe({ x: card.x + 70, y: card.y }, { x: card.x - card.w * 0.55, y: card.y + 20 }, { duration: 950 });
    }, { tail: 0.6 });

    await beat('G', async () => {
        await sleep(300);
        await click('[data-testid="catchup-post"]', { settle: 450 });
        await sleep(1500);
    });

    waitForText('All caught up');
    await beat('H', async () => {
        await moveTo(PHONE.w * 0.7, PHONE.h * 0.8, { duration: 900 });
    });

    await beat('I', async () => {
        ab('open', urls.expired_url);
        waitForText('no longer active');
        showFinger();
        await sleep(1200);
        await click('[data-testid="catchup-resend"]', { settle: 500 });
        waitFor('[data-testid="catchup-resent"]');
    }, { tail: 0.8 });

    // The real email the resend just logged, in a phone mail screen; tapping it opens the fresh link.
    await beat('I2', async () => {
        // email-body.html was saved from the app's log mailer after the resend above.
        await openEmail(`${DEMO_DIR}/email-body.html`, 'Your catch-up link', { theme: THEME, from: 'HeyJet', to: 'Dana' });
        showFinger();
        evalJs(`(() => { const a = [...document.querySelectorAll('a')].find((x) => /catch-up\\//.test(x.href)); a.setAttribute('data-demo', 'open'); return true; })()`);
        await moveTo(PHONE.w * 0.5, PHONE.h * 0.62, { duration: 10 });
        await sleep(1200);
        await click('[data-demo="open"]', { settle: 400 });
        waitFor('[data-testid="catchup-card"]');
        showFinger();
    }, { tail: 1.4 });

    take.stopSegment();
} finally {
    touch.kill('SIGTERM');
}

// ---------- desktop segment: only what's different ----------
// (The app's seed step added two more reviews and a fresh link here, off camera.)
openAt(urls.reviews_url, DESK, THEME);
waitForText('Open catch-up');
// The confirm sheet was shown on the phone; don't repeat it here.
evalJs('localStorage.setItem("catch-up:swipe-post-confirmed", "1"); true');
await moveTo(DESK.w * 0.55, DESK.h * 0.55, { duration: 10 });

take.startSegment('desktop', DESK);
await sleep(900);

await beat('K', async () => {
    await sleep(1800);
    await click('[data-testid="open-catch-up"]', { settle: 500 });
    waitForText('to catch up on');
    await sleep(500);
    await moveTo(DESK.w * 0.56, DESK.h * 0.45, { duration: 1100 });
});

await beat('L', async () => {
    evalJs('document.querySelector("[data-catchup-region]")?.focus(); true');
    await sleep(700);
    ab('press', 'e');
    await sleep(2200);
    ab('press', 'Escape');
    await sleep(900);
    ab('press', 'ArrowRight');
    await sleep(1600);
    ab('press', 'z');
    await sleep(1600);
    ab('press', 'ArrowLeft');
});

await beat('J', async () => {
    await moveTo(DESK.w * 0.7, DESK.h * 0.6, { duration: 900 });
}, { tail: 1.4 });

take.stopSegment();
take.save();
