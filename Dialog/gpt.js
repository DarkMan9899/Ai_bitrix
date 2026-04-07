const OpenAI = require("openai");

const memory = require("./memory");
const { markAskedPhone, hasAskedPhone } = require("../dialogState");
const detectPhone = require("../Dialog/leadDetector");
const detectCourse = require("../courseRouter");
const { get: getLead, update: updateLead } = require("../Dialog/leadMemory");

const { getSmartContext } = require("../Context/smartContext");
const persona = require("../Context/persona.system");
const brain = require("../Context/brain.system");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* =========================================================
 STEP TRACKER
 1 = language
 2 = goal
 3 = level / kids age+grade
 4 = value presentation
 5 = phone
========================================================= */

const stepMap = new Map();

function getStep(id) {
    return stepMap.get(id) || 1;
}

function setStep(id, n) {
    stepMap.set(id, Math.max(1, Math.min(n, 5)));
}

function advanceStep(id) {
    const n = Math.min(getStep(id) + 1, 5);
    stepMap.set(id, n);
    return n;
}

/* =========================================================
 HELPERS
========================================================= */

function normalize(text = "") {
    return String(text)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^\p{L}\p{N}\s@.+-]/gu, "")
        .trim();
}

function cleanReply(text = "") {
    return String(text)
        .replace(/^["'\s]+|["'\s]+$/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function extractAge(text = "") {
    const t = String(text).toLowerCase();
    const match = t.match(/\b(5|6|7|8|9|10|11|12|13|14|15|16|17)\b/);
    return match ? Number(match[1]) : null;
}

function extractGrade(text = "") {
    const t = String(text).toLowerCase();
    const match = t.match(/\b([1-9]|10|11|12)\s*(դաս|class|grade)\b/);
    if (match) return match[1];

    const simple = t.match(/\b([1-9]|10|11|12)\b/);
    return simple ? simple[1] : null;
}

/* =========================================================
 INTENT DETECTORS
========================================================= */

function matchKeywords(text, keywords) {
    const t = normalize(text);
    return keywords.some(w => t.includes(w));
}

function isPriceQuestion(text = "") {
    return matchKeywords(text, [
        "գին", "գինը", "գների", "արժեք", "արժեքը",
        "price", "cost", "how much",
        "цена", "стоимость", "сколько стоит", "сколько"
    ]);
}

function isHumanIntent(text = "") {
    return matchKeywords(text, [
        "զանգ", "մասնագետ", "օպերատոր",
        "manager", "operator", "call me",
        "перезвон", "менеджер"
    ]);
}

function isInfoQuestion(text = "") {
    return matchKeywords(text, [
        "մանրամասն", "details", "подроб",
        "ինչպես է", "ինչպես է անցնում", "how does it work",
        "ակցիա", "զեղչ", "discount", "offer",
        "օնլայն", "online",
        "գրաֆիկ", "schedule", "расписание",
        "քանի հոգի", "group size",
        "ձայնագր", "recording",
        "վկայական", "certificate",
        "mentor", "support"
    ]);
}

function isTestResult(text = "") {
    return /^\d{1,3}$/.test(text.trim());
}

/* =========================================================
 FACT EXTRACTORS
========================================================= */

function extractGoal(text = "") {
    const t = normalize(text);
    if (t.includes("աշխատ") || t.includes("work") || t.includes("работ")) return "work";
    if (t.includes("ճամփ") || t.includes("travel") || t.includes("путеш")) return "travel";
    if (t.includes("երեխ") || t.includes("kids") || t.includes("ребен")) return "kids";
    if (t.includes("ielts") || t.includes("քնն") || t.includes("exam") || t.includes("экзам")) return "exam";
    if (t.includes("խոս") || t.includes("speaking") || t.includes("разгов")) return "speaking";
    return null;
}

function extractLevel(text = "") {
    const t = normalize(text);
    if (t.includes("a0") || t.includes("a1") || t.includes("զրոյից") || t.includes("beginner") || t.includes("начина")) return "beginner";
    if (t.includes("a2") || t.includes("b1") || t.includes("մի քիչ") || t.includes("some") || t.includes("сред")) return "intermediate";
    if (t.includes("b2") || t.includes("c1") || t.includes("c2") || t.includes("advanced") || t.includes("upper") || t.includes("продв")) return "advanced";
    return null;
}

function detectFormat(text = "") {
    const t = normalize(text);
    if (t.includes("խմբ") || t.includes("group") || t.includes("груп")) return "group";
    if (t.includes("անհատ") || t.includes("individual") || t.includes("индив")) return "individual";
    return null;
}

/* =========================================================
 STEP ADVANCE LOGIC
========================================================= */

function shouldAdvance(step, lead) {
    switch (step) {
        case 1:
            return !!lead.language;
        case 2:
            return !!lead.goal;
        case 3:
            if (lead.goal === "kids" && !lead.age) return false;
            if (lead.goal === "kids" && lead.age && !lead.grade) return false;
            return !!lead.level;
        case 4:
        case 5:
        default:
            return false;
    }
}

/* =========================================================
 STEP INSTRUCTIONS
========================================================= */

function getStepInstruction(step, lead) {
    const safe = (v, fallback = "") => v || fallback;

    switch (step) {
        case 1:
            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ԼԵԶՈՒ
- Եթե հաճախորդը չի ողջունել՝ սկսիր ջերմ ողջույնով։
- Ներկայացրու Polyglot Academy-ն։
- Տուր ՄԻԱՅՆ մեկ հարց՝ ո՞ր լեզուն է ուզում սովորել։
`;

        case 2:
            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ՆՊԱՏԱԿ
- Լեզու: ${safe(lead.language)}
- Կարճ հաստատիր լեզուն։
- Տուր ՄԻԱՅՆ մեկ հարց՝ ի՞նչ նպատակով է ցանկանում սովորել։
`;

        case 3:
            if (lead.goal === "kids" && !lead.age) {
                return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ՏԱՐԻՔ
- Խոսքը երեխայի մասին է։
- Տուր ՄԻԱՅՆ մեկ հարց՝ քանի՞ տարեկան է երեխան։
`;
            }

            if (lead.goal === "kids" && lead.age && !lead.grade) {
                return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ԴԱՍԱՐԱՆ
- Տուր ՄԻԱՅՆ մեկ հարց՝ ո՞ր դասարանում է սովորում երեխան։
`;
            }

            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ՄԱԿԱՐԴԱԿ
- Լեզու: ${safe(lead.language)}
- Նպատակ: ${safe(lead.goal)}
- Տուր ՄԻԱՅՆ մեկ հարց՝ ի՞նչ մակարդակ ունի։
`;

        case 4:
            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ԱՐԺԵՔԻ ՆԵՐԿԱՅԱՑՈՒՄ
- Լեզու: ${lead.language}
- Նպատակ: ${lead.goal}
- Մակարդակ: ${lead.level}
- Գրիր 2–3 կարճ նախադասությամբ՝ ինչ արդյունք կստանա։
- Միայն հետո բնական անցում արա հեռախոսահամարին։
`;

        case 5:
            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ՀԵՌԱԽՈՍ
- Եթե հեռախոսը չկա՝ խնդրիր հեռախոսահամարը։
- Եթե կա՝ շնորհակալություն հայտնիր։
`;

        default:
            return `Պատասխանիր բնական և տուր առավելագույնը մեկ հարց։`;
    }
}

/* =========================================================
 KNOWN FACTS
========================================================= */

function getKnownFacts(lead) {
    const facts = [
        lead.language ? `Language: ${lead.language}` : null,
        lead.goal ? `Goal: ${lead.goal}` : null,
        lead.age ? `Age: ${lead.age}` : null,
        lead.grade ? `Grade: ${lead.grade}` : null,
        lead.level ? `Level: ${lead.level}` : null,
        lead.format ? `Format: ${lead.format}` : null,
        lead.phone ? `Phone: collected` : null,
    ].filter(Boolean);

    return facts.length ? facts.join("\n") : "None collected yet";
}

/* =========================================================
 BUILD MESSAGES
========================================================= */

function buildMessages(dialogId, userText, stepOverride = null) {
    const step = stepOverride !== null ? stepOverride : getStep(dialogId);
    const lead = getLead(dialogId) || {};
    const history = memory.get(dialogId).slice(-10);
    const smartCtx = getSmartContext(userText, lead);
    const knownFacts = getKnownFacts(lead);
    const stepInstr = getStepInstruction(step, lead);

    const system = `
${persona}

${brain}

CONTEXT:
${smartCtx}

KNOWN FACTS (never ask about these again):
${knownFacts}

CRITICAL RULES:
- Reply in the SAME language as the client’s last message.
- If unclear → default to Armenian.
- Never mix languages.
- If information exists in KNOWN FACTS → NEVER ask for it again.
- Ask at most ONE question per reply.
- Never ask for phone number more than once.
- Never mention price or cost.
- If the client asks about process, promotions, schedule, recordings,
  certificate, methodology, trust, support, or benefits:
  answer naturally from CONTEXT first,
  then continue the current step with one soft question.
- Keep replies short (2–4 sentences).

STEP INSTRUCTION:
${stepInstr}

OUTPUT FORMAT:
Return STRICT JSON only:
{ "reply": "..." }
`;

    return [
        { role: "system", content: system },
        ...history,
        { role: "user", content: userText }
    ];
}

/* =========================================================
 CALL OPENAI
========================================================= */

async function callAI(messages) {
    try {
        const res = await openai.chat.completions.create({
            model: "gpt-4o",
            messages,
            temperature: 0.4,
            response_format: { type: "json_object" }
        });

        const raw = res.choices?.[0]?.message?.content || "{}";
        const data = JSON.parse(raw);
        return cleanReply(data.reply || "") || null;
    } catch (err) {
        console.error("AI ERROR:", err.message);
        return null;
    }
}

/* =========================================================
 MAIN
========================================================= */

async function askGPT(dialogId, userText) {
    memory.add(dialogId, "user", userText);

    let lead = getLead(dialogId) || {};

    if (isTestResult(userText)) {
        const score = Number(userText);
        const level = score > 70 ? "advanced" : score > 30 ? "intermediate" : "beginner";
        updateLead(dialogId, { level });
        setStep(dialogId, 5);

        const reply = "Շնորհակալություն արդյունքի համար 🙂 Խնդրեմ նշեք հեռախոսահամարը, որպեսզի մեր մասնագետը կապ հաստատի։";
        memory.add(dialogId, "assistant", reply);
        return reply;
    }

    const course = detectCourse(userText);
    const goal = extractGoal(userText);
    const level = extractLevel(userText);
    const format = detectFormat(userText);
    const phone = detectPhone(userText);

    if (course && !lead.language) updateLead(dialogId, { language: course });
    if (goal && !lead.goal) updateLead(dialogId, { goal });
    if (level && !lead.level) updateLead(dialogId, { level });
    if (format && !lead.format) updateLead(dialogId, { format });
    if (phone && !lead.phone) updateLead(dialogId, { phone });

    const age = extractAge(userText);
    const grade = extractGrade(userText);

    if ((goal === "kids") || lead.goal === "kids") {
        if (age && !lead.age) updateLead(dialogId, { age });
        if (grade && !lead.grade) updateLead(dialogId, { grade });
    }

    let freshLead = getLead(dialogId) || {};

    if (isHumanIntent(userText) && getStep(dialogId) !== 5) {
        setStep(dialogId, 5);
    }

    let step = getStep(dialogId);

    // ✅ price question should NOT skip the funnel
    // it should continue from the current step naturally
    const isPrice = isPriceQuestion(userText);

    if (shouldAdvance(step, freshLead)) {
        step = advanceStep(dialogId);
    }

    const messages = buildMessages(dialogId, userText, isPrice ? step : null);
    let reply = await callAI(messages);

    if (!reply) {
        reply = step === 5
            ? "Խնդրեմ նշեք հեռախոսահամարը, որպեսզի օգնենք ճիշտ ծրագրով 🙂"
            : "Հասկացա 🙂 Շարունակե՞նք 🙂";
    }

    memory.add(dialogId, "assistant", reply);

    if (step === 4) {
        updateLead(dialogId, { presented: true });
    }

    const l = getLead(dialogId) || {};

    if (!l.language) setStep(dialogId, 1);
    else if (!l.goal) setStep(dialogId, 2);
    else if (l.goal === "kids" && !l.age) setStep(dialogId, 3);
    else if (l.goal === "kids" && l.age && !l.grade) setStep(dialogId, 3);
    else if (!l.level) setStep(dialogId, 3);
    else if (!l.presented) setStep(dialogId, 4);
    else if (!l.phone) setStep(dialogId, 5);
    else setStep(dialogId, 5);

    if (getStep(dialogId) === 5 && !l.phone && !hasAskedPhone(dialogId)) {
        markAskedPhone(dialogId);
    }

    return reply;
}

module.exports = askGPT;
