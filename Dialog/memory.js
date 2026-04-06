const store = {};
const times = {};

const MAX_HISTORY = 12;
const TTL = 1000 * 60 * 60 * 48; // 48 hours — matches leadMemory.js

function ensure(dialog) {
    if (!store[dialog]) {
        store[dialog] = [];
        times[dialog] = Date.now();
    }
}

function add(dialog, role, text) {

    if (!text || typeof text !== "string") return;

    ensure(dialog);

    times[dialog] = Date.now(); // refresh TTL on activity

    store[dialog].push({
        role,
        content: text.trim()
    });

    if (store[dialog].length > MAX_HISTORY) {
        store[dialog] = store[dialog].slice(-MAX_HISTORY);
    }
}

function get(dialog) {
    ensure(dialog);
    return store[dialog];
}

/* ================= CLEANUP — remove dialogs idle for 48h ================= */

function cleanup() {
    const now     = Date.now();
    let   removed = 0;

    for (const id in times) {
        if (now - times[id] > TTL) {
            delete store[id];
            delete times[id];
            removed++;
        }
    }

    if (removed > 0) {
        console.log(`Memory cleanup: removed ${removed} old conversations`);
    }
}

// Run every 6 hours
setInterval(cleanup, 6 * 60 * 60 * 1000);

module.exports = { add, get };