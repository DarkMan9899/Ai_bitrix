const axios = require("axios");

async function transferToOperator(dialogId, auth) {

    try {

        const chatId = dialogId.replace("chat", "");

        const url = `${auth.client_endpoint}imopenlines.bot.session.transfer.json`;

        await axios.post(
            url,
            {
                auth: auth.access_token,
                CHAT_ID: chatId
            },
            { timeout: 15000 }  // ✅ added — prevents indefinite hang
        );

        console.log("🔁 TRANSFERRED TO OPERATOR");

    } catch (e) {

        console.log(
            "TRANSFER ERROR:",
            e.response?.data || e.message
        );
    }
}

module.exports = transferToOperator;