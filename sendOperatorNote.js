const axios = require("axios");

/* ================================================
   Called from index.js as:
   sendOperatorNote(bot, dialogId, summary, auth)
================================================ */

async function sendOperatorNote(bot, dialogId, text, auth) {

    try {

        const url = `${bot.client_endpoint}imbot.message.add.json`;

        await axios.post(
            url,
            {
                auth: bot.access_token,
                DIALOG_ID: dialogId,
                MESSAGE: `🧠 AI Վերլուծություն\n\n${text}`,
                SYSTEM: "Y"
            },
            { timeout: 15000 }
        );

        console.log("✅ OPERATOR NOTE SENT");

    } catch (e) {

        console.log(
            "OPERATOR NOTE ERROR:",
            e.response?.data || e.message
        );
    }
}

module.exports = sendOperatorNote;