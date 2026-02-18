require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const askGPT = require("./gpt");
const extractPhone = require("./leadDetector");
const wantsHuman = require("./intentDetector");
const { getState, markReady, asked, shouldTransfer } = require("./handoff");
const { closeDialog, isClosed } = require("./closedDialogs");
const extractDealId = require("./dealParser");
const isAIAllowed = require("./stageControl");
const changeStage = require("./changeStage");
const enqueue = require("./dialogQueue");


const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* =========================================================
   INSTALL → Register Bitrix Chat Bot
   ========================================================= */

app.post("/bitrix/install", async (req, res) => {

    console.log("\n========== INSTALL POST ==========");
    console.log(req.body);

    const auth = req.body.auth;
    const restUrl = `https://${auth.domain}/rest/imbot.register.json`;

    try {
        const result = await axios.post(restUrl, {
            auth: auth.access_token,
            CODE: "polyglot_ai_sales",
            TYPE: "O",
            EVENT_HANDLER: "https://ai.polyglotacademy.am/bitrix/events",
            PROPERTIES: {
                NAME: "Polyglot AI",
                COLOR: "GREEN",
                WORK_POSITION: "AI Sales Operator"
            }
        });

        console.log("BOT REGISTERED:", result.data);

    } catch (e) {
        console.log("BOT REGISTER ERROR:", e.response?.data || e.message);
    }

    res.send("OK");
});

/* =========================================================
   EVENTS → AI Sales Logic
   ========================================================= */

app.post("/bitrix/events", async (req, res) => {

    const event = req.body.event;
    if (event !== "ONIMBOTMESSAGEADD")
        return res.send("IGNORED");

    const params = req.body.data.PARAMS;
    const bot = Object.values(req.body.data.BOT)[0];

    if (params.SYSTEM === "Y")
        return res.send("SYSTEM");

    if (params.FROM_USER_ID == bot.user_id)
        return res.send("SELF");

    const dialogId = params.DIALOG_ID;
    const message = params.MESSAGE;

    console.log("USER:", message);

    /* ========= CLOSED DIALOG ========= */

    if (isClosed(dialogId)) {
        console.log("DIALOG CLOSED");
        return res.send("CLOSED");
    }

    /* ========= DEAL STAGE CONTROL ========= */

    const dealId = extractDealId(params);

    if (dealId && !isAIAllowed(dealId)) {
        console.log("AI BLOCKED BY STAGE");
        return res.send("BLOCKED_STAGE");
    }

    /* ========= PHONE DETECT ========= */

    const phone = extractPhone(message);
    if (phone) {
        console.log("PHONE DETECTED:", phone);
        markReady(dialogId);
    }

    /* ========= HUMAN REQUEST ========= */

    if (wantsHuman(message) && shouldTransfer(dialogId)) {

        console.log("TRANSFER TO HUMAN");

        try {
            const transferUrl = `https://${bot.domain}/rest/imopenlines.bot.session.transfer.json`;

            await axios.post(transferUrl, {
                auth: bot.access_token,
                DIALOG_ID: dialogId,
                USER_ID: 1
            });

            if (dealId)
                await changeStage(dealId, "WON");

            closeDialog(dialogId);

        } catch (e) {
            console.log("TRANSFER ERROR:", e.response?.data || e.message);
        }

        return res.send("TRANSFERRED");
    }

    /* ========= GPT REPLY ========= */
    res.send("OK"); // ⚡ անմիջապես պատասխանում ենք Bitrix-ին

    enqueue(dialogId, async () => {

        let reply;
        try {
            reply = await askGPT(dialogId, message);
        } catch (e) {
            console.log("GPT ERROR:", e.message);
            reply = "Կներեք, տեխնիկական խնդիր առաջացավ 🙏";
        }

        // Bitrix session unlock սպասում
        await new Promise(r=>setTimeout(r,1500));

        try {
            await axios.post(`https://${bot.domain}/rest/imbot.message.add.json`, {
                auth: bot.access_token,
                DIALOG_ID: dialogId,
                MESSAGE: reply
            });

            console.log("AI REPLIED");

        } catch (e) {
            console.log("SEND ERROR:", e.response?.data || e.message);
        }

    });


});

/* ========================================================= */

app.get("/", (req, res) => {
    res.send("Bitrix AI bot running 🚀");
});

app.listen(5005, () => {
    console.log("Server running on port 5005");
});
