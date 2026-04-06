require("dotenv").config();

/* =========================================================
   ENV VALIDATION — crash early with a clear message
========================================================= */

if (!process.env.OPENAI_API_KEY) {
    console.error("❌ MISSING ENV: OPENAI_API_KEY is not set. Exiting.");
    process.exit(1);
}

const express    = require("express");
const bodyParser = require("body-parser");

const askGPT              = require("./Dialog/gpt");
const enqueue             = require("./Dialog/dialogQueue");
const sendBitrixMessage   = require("./sendBitrixMessage");
const makeSummary         = require("./Dialog/makeSummary");
const sendOperatorNote    = require("./sendOperatorNote");
const extractPhone        = require("./Dialog/leadDetector");
const moveToOperatorStage = require("./changeStage");
const extractDealId       = require("./dealParser");
const isAIAllowed         = require("./stageControl");
const transferToOperator  = require("./handoff");
const { isClosed, closeDialog } = require("./closedDialogs");
const { update: updateLead }    = require("./Dialog/leadMemory");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* =========================================================
   WORKING HOURS (Yerevan time, UTC+4)
   Mon–Sat 10:00–21:00
========================================================= */

function isWorkingHours() {
    const now  = new Date();
    const hour = new Date(now.getTime() + 4 * 60 * 60 * 1000).getUTCHours();
    const day  = new Date(now.getTime() + 4 * 60 * 60 * 1000).getUTCDay(); // 0=Sun
    if (day === 0) return false;          // closed Sunday
    return hour >= 10 && hour < 21;
}

/* =========================================================
   HELPERS
========================================================= */

function normalizeDialogId(params = {}) {

    let dialogId =
        params.DIALOG_ID ||
        params.TO_CHAT_ID ||
        params.CHAT_ID    ||
        null;

    if (!dialogId) return null;

    dialogId = String(dialogId).trim();

    if (!dialogId) return null;

    if (dialogId.startsWith("chat")) return dialogId;

    if (/^\d+$/.test(dialogId)) return `chat${dialogId}`;

    return dialogId;
}

/* =========================================================
   EVENTS → AI CHAT
========================================================= */

app.post("/bitrix/events", async (req, res) => {

    try {

        const body = req.body || {};

        if (body.event !== "ONIMBOTMESSAGEADD") {
            return res.send("IGNORED");
        }

        const params = body.data?.PARAMS || {};
        const bot    = body.data?.BOT ? Object.values(body.data.BOT)[0] : null;
        const auth   = body.auth;

        if (!auth) {
            console.log("NO AUTH IN EVENT");
            return res.send("NO_AUTH");
        }

        if (!bot) {
            console.log("NO BOT DATA IN EVENT");
            return res.send("NO_BOT");
        }

        if (params.SYSTEM === "Y")                                    return res.send("SYSTEM");
        if (String(params.FROM_USER_ID) === String(bot.user_id))      return res.send("SELF");

        const message    = (params.MESSAGE || "").trim();
        const dialogId   = normalizeDialogId(params);
        const sessionData = params.CHAT_ENTITY_DATA_1;

        console.log("USER:", message);
        console.log("DIALOG ID:", dialogId);
        console.log("SESSION DATA:", sessionData);

        if (!message)  { console.log("EMPTY MESSAGE");              return res.send("EMPTY"); }
        if (!dialogId) { console.log("DIALOG_ID_EMPTY IN PARAMS");  return res.send("NO_DIALOG"); }

        /* ===== CLOSED DIALOG GUARD ===== */

        if (isClosed(dialogId)) {
            console.log("DIALOG CLOSED — ignoring:", dialogId);
            return res.send("CLOSED");
        }

        // Respond to Bitrix immediately
        res.send("OK");

        enqueue(dialogId, message, async (combinedText) => {

            try {

                /* ================= DEAL / STAGE CONTROL ================= */

                const dealId = extractDealId(sessionData);

                console.log("DEAL ID:", dealId);

                const allowed = await isAIAllowed(auth, dealId);

                if (!allowed) {
                    console.log("AI BLOCKED (wrong stage)");
                    return;
                }


                /* ================= WORKING HOURS ================= */

                if (!isWorkingHours()) {
                    console.log("OFF HOURS sending notice");

                    await sendBitrixMessage(
                        bot,
                        dialogId,
                        "Բարև 🙂 Աշխատա坯կայի坯 ժամեր坯 ե坯 Երկուշաբաթխ–Շաբաթխ 10:00–21:00։ Արակի坯 հնարավոր ժամի坯 կատասխա坯ե坯կ շարու坯ակել։ ❤️"
                    );

                    return;
                }

                /* ================= PHONE DETECTION ================= */

                const phone = extractPhone(combinedText);

                if (phone) {

                    console.log("PHONE DETECTED:", phone);

                    // ✅ Save phone to lead
                    updateLead(dialogId, { phone });

                    const summary = await makeSummary(dialogId);

                    await sendOperatorNote(bot, dialogId, summary, auth);

                    await sendBitrixMessage(
                        bot,
                        dialogId,
                        "Շնորհակալություն վստահության և հատակացված ժամանակի համար, մեր մասնագետները աշխատանքային ժամերին կապ կհաստատեն Ձեզ հետ կամ կարող եք նշել Ձեզ հարմար ժամ, այդ ժամին կզանգահարեն։ Լավ օր Ձեզ։❤️"
                    );

                    await moveToOperatorStage(auth, dealId);

                    // ✅ Transfer live chat session to operator
                    await transferToOperator(dialogId, auth);

                    // ✅ Mark dialog closed so bot stops replying
                    closeDialog(dialogId);

                    return;
                }

                /* ================= AI REPLY ================= */

                let reply;

                try {

                    console.log("➡️ GPT REQUEST");

                    reply = await askGPT(dialogId, combinedText);

                    console.log("⬅️ GPT:", reply);

                } catch (e) {

                    console.log("GPT ERROR:", e.message);

                    reply = "Կներեք, փոքր տեխնիկական խնդիր առաջացավ 🙏";
                }

                if (!reply || !reply.trim()) {
                    reply = "Կներեք, այս պահին չկարողացա պատասխան կազմել 🙏";
                }

                await sendBitrixMessage(bot, dialogId, reply);

            } catch (e) {

                console.log("QUEUE TASK ERROR:", e.message);
            }

        });

    } catch (e) {

        console.log("EVENT HANDLER ERROR:", e.message);

        if (!res.headersSent) {
            return res.status(500).send("ERROR");
        }
    }
});

/* ========================================================= */

app.get("/", (req, res) => {
    res.send("Bitrix AI bot running 🚀");
});

/* ========================================================= */

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});