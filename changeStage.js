const axios = require("axios");

const TARGET_STAGE = "UC_XYNAZP";

async function moveToOperatorStage(auth, dealId) {

    console.log("🚀 MOVE REQUEST | DEAL:", dealId);

    if (!dealId) {
        console.log("❌ NO DEAL ID");
        return;
    }

    try {

        /* ================= GET CURRENT DEAL ================= */

        const getUrl = `https://${auth.domain}/rest/crm.deal.get.json`;

        const getRes = await axios.post(getUrl, {
            auth: auth.access_token,
            id: dealId
        });

        console.log("📦 DEAL GET:", JSON.stringify(getRes.data));

        const deal = getRes.data?.result;
        if (!deal) {
            console.log("❌ DEAL NOT FOUND");
            return;
        }

        console.log("📊 CURRENT STAGE:", deal.STAGE_ID);
        console.log("📊 CATEGORY:", deal.CATEGORY_ID);

        if (deal.STAGE_ID === TARGET_STAGE) {
            console.log("ℹ️ ALREADY IN TARGET STAGE");
            return;
        }

        /* ================= UPDATE STAGE ================= */

        const updateUrl = `https://${auth.domain}/rest/crm.deal.update.json`;

        const updateRes = await axios.post(updateUrl, {
            auth: auth.access_token,
            id: dealId,
            fields: {
                STAGE_ID: TARGET_STAGE
            }
        });

        console.log("✅ UPDATE RESPONSE:", JSON.stringify(updateRes.data));

        /* ================= VERIFY ================= */

        const verifyRes = await axios.post(getUrl, {
            auth: auth.access_token,
            id: dealId
        });

        console.log("🔍 AFTER UPDATE STAGE:", verifyRes.data?.result?.STAGE_ID);

    } catch (e) {
        console.log("🔥 STAGE CHANGE ERROR:", e.response?.data || e.message);
    }
}

module.exports = moveToOperatorStage;
