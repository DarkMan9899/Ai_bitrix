const OpenAI = require("openai");
const memory = require("./memory");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function makeSummary(dialogId) {

    const history = memory.get(dialogId).slice(-20);

    // If there's no conversation history, return a minimal fallback
    if (!history.length) {
        return "• Conversation history not available";
    }

    try {

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0.2,
            messages: [
                {
                    role: "system",
                    content: `
You are a CRM assistant.

Analyze the conversation and write a SHORT operator briefing.

Write in Armenian.
Max 5 lines.
Bullet style.

Include:
• customer name if known
• course / language interest
• level if known
• interest level (low / medium / high)
• best next action for the operator

No greetings. No long sentences.
`
                },
                ...history
            ]
        });

        return completion.choices[0].message.content.trim();

    } catch (e) {

        console.error("SUMMARY ERROR:", e.message);

        // Return a safe fallback so the handoff flow is never blocked
        const lead = history
            .filter(m => m.role === "user")
            .map(m => m.content)
            .join(" | ")
            .slice(0, 200);

        return `• Summary generation failed\n• Last messages: ${lead || "none"}`;
    }
}

module.exports = makeSummary;