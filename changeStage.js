const axios = require("axios");
const WEBHOOK =
    "https://polyglot.bitrix24.ru/rest/1/gyp9dq0k87n3ey58/";
const TARGET_STAGE = "UC_XYNAZP";

async function moveToOperatorStage(auth, dealId){

    if(!dealId){
        console.log("❌ NO DEAL ID");
        return;
    }

    console.log("🚀 MOVE REQUEST | DEAL:", dealId);

    try{
        /* ================= UPDATE STAGE ================= */
        const res = await axios.post(
            WEBHOOK + "crm.deal.update.json",
            {
                id: dealId,
                fields: {
                    STAGE_ID: TARGET_STAGE
                }
            }
        );

        if(res.data?.error){

            console.log("❌ UPDATE ERROR:", res.data);
            return;
        }

        console.log("✅ DEAL MOVED TO:", TARGET_STAGE);

    }catch(e){

        console.log(
            "🔥 STAGE CHANGE ERROR:",
            e.response?.data || e.message
        );
    }
}

module.exports = moveToOperatorStage;