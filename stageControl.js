const axios = require("axios");

const WEBHOOK = "https://polyglot.bitrix24.ru/rest/1/dy1kskylkf0p3en5/";

const ALLOWED_STAGES = new Set([
    "UC_R4WNE3"
    // "UC_E7WXW8"
]);

/* =========================================================
   STAGE CACHE — 60 seconds per dialog
   Prevents a Bitrix API call on every single message
========================================================= */

const stageCache = new Map();
const CACHE_TTL  = 60 * 1000; // 60 seconds

function getCached(dealId) {
    const entry = stageCache.get(dealId);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) {
        stageCache.delete(dealId);
        return null;
    }
    return entry.allowed;
}

function setCache(dealId, allowed) {
    stageCache.set(dealId, { allowed, ts: Date.now() });
}

/* =========================================================
   BITRIX CALL
========================================================= */

async function callBitrix(method, data = {}, retry = true) {

    try {

        const res = await axios.post(
            WEBHOOK + method,
            data,
            { timeout: 30000 }
        );

        return res.data;

    } catch (e) {

        if (retry && (e.code === "ETIMEDOUT" || e.code === "ECONNRESET")) {
            console.log("⚠️ Bitrix timeout retry:", method);
            return callBitrix(method, data, false);
        }

        console.log("BITRIX ERROR:", e.response?.data || e.message);
        return null;
    }
}

/* =========================================================
   MAIN EXPORT
========================================================= */

async function isAIAllowed(auth, dealId) {

    if (!dealId) {
        console.log("NO DEAL → AI BLOCKED");
        return false;
    }

    // Return cached result if still fresh
    const cached = getCached(dealId);
    if (cached !== null) {
        console.log("DEAL STAGE (cached):", cached ? "ALLOWED" : "BLOCKED");
        return cached;
    }

    const res = await callBitrix("crm.deal.get.json", { id: dealId });

    if (!res || res.error || !res.result) {
        console.log("DEAL LOAD ERROR → AI BLOCKED");
        return false;
    }

    const stage   = res.result.STAGE_ID;
    const allowed = ALLOWED_STAGES.has(stage);

    console.log("DEAL STAGE:", stage, "→", allowed ? "ALLOWED" : "BLOCKED");

    setCache(dealId, allowed);

    return allowed;
}

module.exports = isAIAllowed;