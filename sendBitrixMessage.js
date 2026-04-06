const axios = require("axios");
const agent = require("./httpAgent");

async function sendBitrixMessage(bot, dialogId, message, retry = 0) {

    try {

        if (!dialogId) {
            console.log("❌ SEND FAIL → dialogId empty");
            return false;
        }

        if (!message || !message.trim()) {
            console.log("❌ SEND FAIL → message empty");
            return false;
        }

        const url = `${bot.client_endpoint}imbot.message.add.json`;

        const payload = {
            auth: bot.access_token,
            DIALOG_ID: dialogId,
            MESSAGE: message
        };

        console.log("📤 SEND TO BITRIX:", dialogId);

        const res = await axios.post(
            url,
            payload,
            {
                timeout: 15000,
                httpsAgent: agent   // ✅ keep-alive socket pooling applied
            }
        );

        if (res.data?.error) {

            console.log("BITRIX SEND FAIL:", res.data);

            if (retry < 6) {
                const wait = 1500 + retry * 2000;
                console.log("⏳ RETRY IN", wait);
                await new Promise(r => setTimeout(r, wait));
                return sendBitrixMessage(bot, dialogId, message, retry + 1);
            }

            console.log("❌ FINAL SEND FAIL");
            return false;
        }

        console.log("✅ SENT TO BITRIX");
        return true;

    } catch (e) {

        const err = e.response?.data || e.message;
        console.log("BITRIX SEND ERROR:", err);

        if (retry < 6) {
            const wait = 1500 + retry * 2000;
            console.log("⏳ RETRY IN", wait);
            await new Promise(r => setTimeout(r, wait));
            return sendBitrixMessage(bot, dialogId, message, retry + 1);
        }

        console.log("❌ FINAL SEND FAIL");
        return false;
    }
}

module.exports = sendBitrixMessage;