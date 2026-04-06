const fs = require("fs");
const path = require("path");
const FILE    = path.join(__dirname, "closedDialogs.json");
const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// Map<id, closedAtTimestamp>
let closed = new Map();

/* ================= LOAD ON START ================= */

try {
    if (fs.existsSync(FILE)) {
        const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

        if (Array.isArray(data)) {
            // 🔁 migrate old format
            data.forEach(id => closed.set(String(id), Date.now()));
        } else {
            // ✅ new format
            Object.entries(data).forEach(([id, ts]) => {
                if (typeof ts === "number") {
                    closed.set(String(id), ts);
                }
            });
        }

        console.log(`Loaded ${closed.size} closed dialogs`);
    }
} catch (e) {
    console.log("Closed dialog load error:", e.message);
}

/* ================= SAVE ================= */

function save() {
    try {
        const obj = Object.fromEntries(closed);
        fs.writeFileSync(FILE, JSON.stringify(obj), "utf8");
    } catch (e) {
        console.log("Closed dialog save error:", e.message);
    }
}

/* ================= CLEANUP ================= */

function cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [id, ts] of closed) {
        if (now - ts > MAX_AGE) {
            closed.delete(id);
            removed++;
        }
    }

    if (removed > 0) {
        console.log(`Cleanup: removed ${removed} old dialogs`);
        save();
    }
}

// run on start + every 24h
cleanup();
setInterval(cleanup, 24 * 60 * 60 * 1000);

/* ================= CORE ================= */

function closeDialog(id) {
    id = String(id);

    closed.set(id, Date.now());
    save();

    console.log("DIALOG CLOSED:", id);
}

/* ================= AUTO REOPEN ================= */

function reopenDialog(id) {
    id = String(id);

    if (closed.has(id)) {
        closed.delete(id);
        save();

        console.log("DIALOG REOPENED:", id);
    }
}

/* ================= SMART CHECK ================= */

function isClosed(id) {
    id = String(id);

    if (!closed.has(id)) return false;

    // 🔥 AUTO-REOPEN ON NEW MESSAGE
    closed.delete(id);
    save();

    console.log("AUTO REOPEN:", id);

    return false;
}

/* ================= OPTIONAL HARD CHECK ================= */
// եթե երբևէ ուզես ստուգել առանց reopen անելու

function isClosedStrict(id) {
    return closed.has(String(id));
}

/* ================= EXPORT ================= */

module.exports = {
    closeDialog,
    reopenDialog,
    isClosed,
    isClosedStrict
};