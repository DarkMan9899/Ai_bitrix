const axios = require("axios");

// որտեղ AI-ը պետք է աշխատի
const ALLOWED_STAGES = new Set([
    "UC_R4WNE3" // Նոր հայտ
]);

/* =========================================================
   UNIVERSAL BITRIX CALL (OAuth compatible)
   ========================================================= */

async function callBitrix(crmAuth, method, data = {}, retry = true) {

    try {

        const url = `https://${crmAuth.domain}/rest/${method}`;

        const res = await axios.post(
            url,
            {
                auth: crmAuth.access_token,
                ...data
            },
            { timeout: 15000 }
        );

        return res.data;

    } catch (e) {

        // retry timeout
        if (retry && (e.code === "ETIMEDOUT" || e.code === "ECONNRESET")) {
            console.log("⚠️ Bitrix timeout retry:", method);
            return callBitrix(crmAuth, method, data, false);
        }

        // CRM permission չկա → AI լռում է
        if (e.response?.data?.error_description === "Access denied.") {
            console.log("🚫 CRM ACCESS DENIED deal", data.id);
            return null;
        }

        console.log("BITRIX ERROR:", e.response?.data || e.message);
        return null;
    }
}

/* ========================================================= */

async function isAIAllowed(crmAuth, dealId) {

    if (!dealId) return false;

    const res = await callBitrix(
        crmAuth,
        "crm.deal.get.json",
        { id: dealId }
    );

    if (!res || !res.result) return false;

    const stage = res.result.STAGE_ID;

    console.log("REAL DEAL STAGE:", stage);

    return ALLOWED_STAGES.has(stage);
}

module.exports = isAIAllowed;
