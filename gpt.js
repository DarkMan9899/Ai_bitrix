const OpenAI = require("openai");
const memory = require("./memory");
const prompt = require("./prompt");
const knowledge = require("./knowledge");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/* =========================================================
   MAIN CHAT
   ========================================================= */

async function askGPT(dialogId, userText){

    // պահում ենք user message-ը
    memory.add(dialogId, "user", userText);

    // կառուցում ենք messages-ը ճիշտ հերթականությամբ
    const messages = [
        {
            role: "system",
            content: prompt
        },
        {
            role: "system",
            content: "ՕԳՏԱԳՈՐԾԻՐ ՍՏՈՐԵՎ ՏՐՎԱԾ ՏԵՂԵԿԱՏՎՈՒԹՅՈՒՆԸ ՊԱՏԱՍԽԱՆԵԼԻՍ:\n" + knowledge
        },
        ...memory.get(dialogId)
    ];

    try {

        const completion = await Promise.race([
            openai.chat.completions.create({
                model:"gpt-4o-mini",
                messages,
                temperature:0.55
            }),
            new Promise((_, reject)=>
                setTimeout(()=>reject(new Error("OPENAI TIMEOUT")),8000)
            )
        ]);

        const reply = completion.choices[0].message.content.trim();

        // պահում ենք assistant պատասխանը
        memory.add(dialogId, "assistant", reply);

        return reply;

    } catch (err) {

        console.log("OPENAI ERROR:", err.message);

        return "Կներեք, փոքր տեխնիկական խնդիր առաջացավ 🙏";
    }
}

/* =========================================================
   SUMMARY FOR CRM MANAGER
   ========================================================= */

async function makeSummary(dialogId){

    const chat = memory.get(dialogId)
        .map(m => `${m.role}: ${m.content}`)
        .join("\n");

    try {

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.2,
            messages: [
                {
                    role: "system",
                    content: "Դու վաճառքի օգնական ես։ Ամփոփիր հաճախորդին մենեջերի համար 2-3 նախադասությամբ։"
                },
                {
                    role: "user",
                    content: chat
                }
            ]
        });

        return completion.choices[0].message.content.trim();

    } catch (err) {

        console.log("SUMMARY ERROR:", err.message);
        return "Չհաջողվեց ստեղծել ամփոփում";
    }
}

/* ========================================================= */

module.exports = askGPT;
module.exports.makeSummary = makeSummary;
