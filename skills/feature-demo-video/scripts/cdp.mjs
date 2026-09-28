// Hold Chrome touch emulation on for the agent-browser session's active page.
// usage: node cdp.mjs touch on|off   (lib.mjs holdTouchEmulation() runs this and kills it after the segment)
// Emulation only lasts as long as the CDP session that set it, so this process stays alive until killed.
// Emulation.setEmitTouchEventsForMouse is deliberately not used: with it on, `mouse down` hangs.
import { ab } from './lib.mjs';

const wsUrl = ab('get', 'cdp-url').split('\n').pop().replace(/^"|"$/g, '');
const pageUrl = JSON.parse(ab('eval', 'location.href', '--json')).data?.result ?? '';
const on = process.argv[3] !== 'off';
const ws = new WebSocket(wsUrl);
const pending = new Map();
let id = 0;

const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const message = { id: ++id, method, params };

    if (sessionId) {
        message.sessionId = sessionId;
    }

    pending.set(message.id, { resolve, reject });
    ws.send(JSON.stringify(message));
});

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const waiting = pending.get(message.id);

    if (waiting) {
        pending.delete(message.id);
        if (message.error) {
            waiting.reject(new Error(JSON.stringify(message.error)));
        } else {
            waiting.resolve(message.result);
        }
    }
};

ws.onopen = async () => {
    try {
        const { targetInfos } = await send('Target.getTargets');
        const pages = targetInfos.filter((target) => target.type === 'page');
        const target = pages.find((page) => page.url === pageUrl) ?? pages[0];
        const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
        await send('Emulation.setTouchEmulationEnabled', { enabled: on, maxTouchPoints: on ? 5 : 1 }, sessionId);
        // Page URLs can carry tokens, so report only the state.
        console.log(JSON.stringify({ touch: on }));
        process.on('SIGTERM', () => {
            ws.close();
            process.exit(0);
        });
        setInterval(() => {}, 1 << 30);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
        ws.close();
    }
};
