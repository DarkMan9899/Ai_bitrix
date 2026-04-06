const OpenAI = require("openai");
const memory = require("./memory");
const {markAskedPhone, hasAskedPhone} = require("../dialogState");
const detectPhone = require("../Dialog/leadDetector");
const detectCourse = require("../courseRouter");
const detectName = require("../Dialog/detectName");
const {get: getLead, update: updateLead} = require("../Dialog/leadMemory");
const {getSmartContext} = require("../Context/smartContext");
const persona = require("../Context/persona.system");
const brain = require("../Context/brain.system");
const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});
/* =========================================================
STEP TRACKER
1 = name  2 = language  3 = goal  4 = level  5 = value  6 = phone
========================================================= */
const stepMap = new Map();

function getStep(id) {
    return stepMap.get(id) || 1;
}

function setStep(id, n) {
    stepMap.set(id, Math.max(1, Math.min(n, 6)));
}

function advanceStep(id) {
    const n = Math.min(getStep(id) + 1, 6);
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
        .replace(/[^\p{L}\p{N}\s@.+-]/gu, "") // պահում ենք @ . + -
        .trim();
}

function cleanReply(text = "") {
    return String(text)
        .replace(/^["'\s]+|["'\s]+$/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

// 🔥 ADD HERE
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
        "цена", "стоимость", "сколько стоит", "сколько",
        "ценник", "тариф"
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
        "մանրամասն", "մանրամասներ", "подроб", "details",
        "ինչպես է", "ինչպես է անցնում", "как проходит", "how does it work",
        "ինչ կա", "ինչ է ներառում", "что включает", "what's included",
        "պայմաններ", "պայմանները", "условия", "conditions",
        "գրաֆիկ", "ժամացույց", "расписание", "schedule",
        "դասավանդում", "ինչի դասավանդում", "сколько раз", "how many times"
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
    if (t.includes("a0") || t.includes("a1") || t.includes("զրոյից") ||
        t.includes("beginner") || t.includes("начина") || t.includes("нул")) return "beginner";
    if (t.includes("a2") || t.includes("b1") || t.includes("մի քիչ") ||
        t.includes("some") || t.includes("сред")) return "intermediate";
    if (t.includes("b2") || t.includes("c1") || t.includes("c2") ||
        t.includes("advanced") || t.includes("upper") || t.includes("продв")) return "advanced";
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
            return !!lead.name;
        case 2:
            return !!lead.language;
        case 3:
            return !!lead.goal;
        case 4:
            // 👇 ONLY IF KIDS
            if (lead.goal === "kids") return !!lead.age;
            return !!lead.level;
        case 5:
            if (lead.goal === "kids") return !!lead.grade;
            return false;
        case 6:
            // 👇 kids → level step becomes 6
            if (lead.goal === "kids") return !!lead.level;
            return false;
        default:
            return false;
    }
}

/* =========================================================
STEP INSTRUCTIONS
Each step tells the AI exactly one thing to do.
========================================================= */
function getStepInstruction(step, lead) {
    const safe = (v, fallback = "") => v ? v : fallback;
    switch (step) {
        case 1:
            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ԱՆՈՒՆ
- Եթե հաճախորդը չի ողջունել՝ սկսիր ջերմ ողջույնով։
- Ներկայացրու Polyglot Academy-ն։
- Տուր ՄԻԱՅՆ մեկ հարց՝ հարցրու անունը։
- Մի կրկնիր նույն հարցը նույն ձևով։
`;
        case 2:
            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ԼԵԶՈՒ
- Անուն: ${safe(lead.name, "հաճախորդ")}
- Ջերմորեն հիշատակիր անունը ("ջան")։
- Տուր ՄԻԱՅՆ մեկ հարց՝ ո՞ր լեզուն է ուզում սովորել։
- Մի կրկնիր նույն հարցը նույն ձևով։
`;
        case 3:
            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ՆՊԱՏԱԿ
- Անուն: ${safe(lead.name)}. Լեզու: ${safe(lead.language)}
- Տուր ՄԻԱՅՆ մեկ հարց՝ ի՞նչ նպատակով է ցանկանում սովորել։
- Մի կրկնիր նույն հարցը։
`;
        // 🔥 MAIN CHANGE
        case 4:
            // 👉 KIDS FLOW
            if (lead.goal === "kids" && !lead.age) {
                return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ՏԱՐԻՔ
- Խոսքը երեխայի մասին է։
- Տուր ՄԻԱՅՆ մեկ հարց՝ քանի՞ տարեկան է երեխան։
- Մի հարցրու մակարդակ։
`;
            }
            if (lead.goal === "kids" && lead.age && !lead.grade) {
                return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ԴԱՍԱՐԱՆ
- Տուր ՄԻԱՅՆ մեկ հարց՝ ո՞ր դասարանում է սովորում երեխան։
`;
            }
            // 👉 NORMAL FLOW
            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ՄԱԿԱՐԴԱԿ
- Անուն: ${safe(lead.name)}. Լեզու: ${safe(lead.language)}. Նպատակ: ${safe(lead.goal)}
- Կարճ հաստատիր նպատակը։
- Տուր ՄԻԱՅՆ մեկ հարց՝ ի՞նչ մակարդակ ունի։
`;
        case 5:
            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ԱՐԺԵՔԻ ՆԵՐԿԱՅԱՑՈՒՄ
- Անուն: ${lead.name || "հաճախորդ"}.
- Լեզու: ${lead.language}.
- Նպատակ: ${lead.goal}.
- Մակարդակ: ${lead.level}.
- Գրիր 2–3 կարճ և հստակ նախադասություն՝ կոնկրետ ինչ արդյունք է ստանալու դիմորդը։
- Օգտագործիր նրա նպատակը և մակարդակը։
- Խոսքը պետք է լինի վստահ, օգտակար և վաճառող։
- Պատրաստիր բնական անցում դեպի հաջորդ քայլ (կոնտակտի հարցում), բայց առանց ուղիղ հարցի։
`;
        case 6:
            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ՀԵՌԱԽՈՍ
- Եթե հեռախոսահամարը չկա՝
Տուր մեկ հարց՝ խնդրիր հեռախոսահամարը։
- Եթե արդեն հարցրել ես՝
Մի կրկնիր նույն ձևակերպումը։
- Եթե user-ը հարց է տալիս՝
Պատասխանիր կարճ և հետո կրկին խնդրիր։
- Եթե հեռախոսը կա՝
Շնորհակալություն հայտնիր և ասա, որ կապ կհաստատեն։
- Մի հիշատակիր գին։
`;
        default:
            return `
ԸՆԹԱՑԻՔԻ ՔԱՅԼ: ԸՆԴՀԱՆՈՒՐ
- Պատասխանիր բնական։
- Տուր առավելագույնը մեկ հարց։
`;
    }
}

/* =========================================================
KNOWN FACTS
========================================================= */
function getKnownFacts(lead) {
    const facts = [
        lead.name ? `Name: ${lead.name}` : null,
        lead.language ? `Language: ${lead.language}` : null,
        lead.goal ? `Goal: ${lead.goal}` : null,
        // 🔥 ADD THESE HERE
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
- If the client asks about process, promotions, schedule, recordings,
 certificate, methodology, trust, support, or benefits:
 answer naturally from CONTEXT first,
 then continue the current step with one soft question.
- Reply in the SAME language as the client’s last message.
- If unclear → default to Armenian.
- Never mix languages.
- If information exists in KNOWN FACTS → NEVER ask for it again.
- Use KNOWN FACTS naturally.
- Ask at most ONE question per reply.
- Never ask for phone number more than once.
- Do not repeat the same question; rephrase if needed.
- Never say: "I don’t know", "please wait".
- Do not use phrases like "the specialist will tell you".
- Never mention price or cost.
- You MAY mention durations or general numbers if helpful.
- Never invent facts, teachers, or schedules.
- If you cannot answer from CONTEXT:
give a short, helpful, approximate answer if possible,
or say that you will help clarify it during the call,
and continue the step naturally.
- Always guide the conversation forward.
- Always follow CRITICAL RULES over STEP INSTRUCTION if conflict exists.
- Keep replies natural, warm, and human.
- Keep replies short (2–4 sentences).
STEP INSTRUCTION:
${stepInstr}
OUTPUT FORMAT:
Return STRICT JSON only:
{ "reply": "..." }
- Do not add any text before or after JSON.
- Ensure valid JSON.
`;
    return [
        {role: "system", content: system},
        ...history,
        {role: "user", content: userText}
    ];
}

/* =========================================================
CALL OPENAI
========================================================= */
async function callAI(messages) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await openai.chat.completions.create(
            {
                model: "gpt-4o",
                messages,
                temperature: 0.4,
                response_format: {type: "json_object"}
            },
            {signal: controller.signal}
        );
        clearTimeout(timeout);
        const raw = res.choices?.[0]?.message?.content || "{}";
        const data = JSON.parse(raw);
        return cleanReply(data.reply || "") || null;
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === "AbortError") {
            console.error("OPENAI TIMEOUT");
            return null;
        }
        console.error("AI ERROR:", err.message);
        return null;
    }
}

/* =========================================================
MAIN
========================================================= */

async function askGPT(dialogId, userText) {
    // ===== Memory FIRST =====
    memory.add(dialogId, "user", userText);
    let lead = getLead(dialogId) || {};
    /* ===== Test result from level check ===== */
    if (isTestResult(userText)) {
        const score = Number(userText);
        const level = score > 70 ? "advanced" : score > 30 ? "intermediate" : "beginner";
        updateLead(dialogId, {level});
        setStep(dialogId, 6);
        const reply = "Շնորհակալություն արդյունքի համար։ Խնդրեմ նշեք հեռախոսահամար, որպեսզի մեր ավագ մասնագետը կարողանա Ձեզ համապատասխան դասընթաց առաջարկել:";
        memory.add(dialogId, "assistant", reply);
        if (!hasAskedPhone(dialogId)) markAskedPhone(dialogId);
        return reply;
    }
    /* ===== Extract facts ===== */
    let name = null;
    if (getStep(dialogId) === 1) {
        name = detectName(userText);
    }
    const course = detectCourse(userText);
    const goal = extractGoal(userText);
    const level = extractLevel(userText);
    const format = detectFormat(userText);
    const phone = detectPhone(userText);
    if (name && !lead.name) updateLead(dialogId, {name});
    if (course && !lead.language) updateLead(dialogId, {language: course});
    if (goal && !lead.goal) updateLead(dialogId, {goal});
    if (level && !lead.level) updateLead(dialogId, {level});
    if (format && !lead.format) updateLead(dialogId, {format});
    if (phone && !lead.phone) updateLead(dialogId, {phone});
    const age = extractAge(userText);
    const grade = extractGrade(userText);
    if ((goal === "kids") || lead.goal === "kids") {
        if (age && !lead.age) updateLead(dialogId, {age});
        if (grade && !lead.grade) updateLead(dialogId, {grade});
    }
    let freshLead = getLead(dialogId) || {};
    /* ===== Human / operator request ===== */
    if (isHumanIntent(userText) && getStep(dialogId) !== 6) {
        setStep(dialogId, 6);
        if (!freshLead.phone) {
            const reply = "Իհարկե 🙂 Խնդրեմ նշեք հեռախոսահամար, որպեսզի մեր ավագ մասնագետը կարողանա Ձեզ համապատասխան դասընթաց առաջարկել:";
            memory.add(dialogId, "assistant", reply);
            if (!hasAskedPhone(dialogId)) markAskedPhone(dialogId);
            return reply;
        }
        const reply = "Շնորհակալություն 🙂 Մեր մասնագետը շուտով կապ կհաստատի Ձեզ հետ:";
        memory.add(dialogId, "assistant", reply);
        return reply;
    }
    /* ===== Price question ===== */
    if (isPriceQuestion(userText)) {
        const currentStep = getStep(dialogId);
        const messages = buildMessages(dialogId, userText, currentStep);
        let reply = await callAI(messages);
        if (!reply) {
            reply = currentStep === 1
                ? "Բարև Ձեզ 🙂 Ես Անին եմ՝ Polyglot Academy-ից։ Ինչպե՞ս կարող եմ Ձեզ դիմել 🙂"
                : "Գինը կախված է ծրագրից և մակարդակից 🙂 Մի փոքր կպարզենք, որ ճիշտ տարբերակ առաջարկեմ։";
        }
        memory.add(dialogId, "assistant", reply);
        return reply;
    }
    /* ===== Step logic ===== */
    let step = getStep(dialogId);
    // Auto-skip language step
    if (step === 2 && freshLead.language) {
        setStep(dialogId, 3);
        step = 3;
    }
    // Advance step
    if (shouldAdvance(step, freshLead)) {
        step = advanceStep(dialogId);
        console.log(`STEP ADVANCED to ${step} | dialog: ${dialogId}`);
    }
    // Info question override
    const stepOverride = null;
    /* ===== Call AI ===== */
    const messages = buildMessages(dialogId, userText, stepOverride);
    let reply = await callAI(messages);
    if (!reply) {
        reply = "Հասկացա 🙂 Շարունակե՞նք 🙂";
    }
    memory.add(dialogId, "assistant", reply);
    if (step === 5) {
        updateLead(dialogId, {presented: true});
    }
    /* ===== Recalculate step ===== */
    if (stepOverride === null) {
        const l = getLead(dialogId) || {};
        if (!l.name) setStep(dialogId, 1);
        else if (!l.language) setStep(dialogId, 2);
        else if (!l.goal) setStep(dialogId, 3);
        else if (l.goal === "kids" && !l.age) setStep(dialogId, 4);
        else if (l.goal === "kids" && l.age && !l.grade) setStep(dialogId, 4);
        else if (!l.level) setStep(dialogId, 4); else if (!l.presented) setStep(dialogId, 5); // ✅ կարևոր
        else if (!l.phone) setStep(dialogId, 6);
        else setStep(dialogId, 6);
    }
    /* ===== Phone ask tracking ===== */
    const currentLead = getLead(dialogId) || {};
    if (getStep(dialogId) === 6 && !currentLead.phone && !hasAskedPhone(dialogId)) {
        markAskedPhone(dialogId);
    }
    console.log(`STEP: ${getStep(dialogId)} | LEAD:`, JSON.stringify(currentLead));
    return reply;
}

module.exports = askGPT;
