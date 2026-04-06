/* =========================================================
NORMALIZE
========================================================= */
function normalize(text = "") {
    return String(text).toLowerCase().trim();
}

/* =========================================================
CONTEXT BUILDER
Accepts userText and lead so it can guard context
based on what's already known.
========================================================= */
function getSmartContext(userText = "", lead = {}) {
    const t = normalize(userText);
    let context = "";
    context += `
Polyglot Academy:
Languages: English, Russian, German, French, Spanish
Adults:
- 3–4 months per level
- 1h lesson, 2x per week and task day
- group or individual format
- group cours working hours 20:00 or 21:00
- individual cours working hours Monday–Saturday, 10:00–21:00
Kids (English, Russian):
- from 5 years old
- individual only, 45 min, 2x per week
Working hours: Monday–Saturday, 10:00–21:00
ADVANTAGES:
- personal mentor support
- all lessons recorded and available after class
- official certificate
- small groups (max 5 students)
- Cambridge methodology
LICENSE & TRUST:
- officially licensed by Ministry of Education
- official certificate upon completion
- income tax refund available (up to 100,000 AMD)
SCHOOL SUPPORT (Grades 2–4):
- subjects: math, native language, English, Russian
- individual format
- includes: homework help, revision, confidence building
- first 30 min lesson is free
IELTS:
- 3 months
- group: 2x/week (1.5h) — 24 lessons total
- individual: 1h sessions
- goal: band 7+
- platform: Discord + recordings
ONLINE:
- study from anywhere
- flexible schedule
- same quality as in-person
SPEAKING COURSE English and Russian:
- 2 months
- levels: A1-A2, B1–B2
- focus: speaking, listening, vocabulary
LEVEL TEST:
https://bot.polyglotacademy.am/student-test_1
Client completes the test and then reports the result.
`;
    /* ================= PRICE — no numbers, redirect to specialist ================= */
    if (
        t.includes("գին") ||
        t.includes("price") ||
        t.includes("արժեք") ||
        t.includes("cost") ||
        t.includes("цена") ||
        t.includes("stoimost") ||
        t.includes("сколько")
    ) {
        context += `
PRICING:
Price depends on program, level, and format.
Offer to help choose the right option.
Do NOT mention any numbers.
`;
    }
    const levelTestKeywords = t.includes("тест") || t.includes("level") || t.includes("մակարդակ");
    if (levelTestKeywords) {
        context += `
LEVEL TEST:
https://bot.polyglotacademy.am/student-test_1
Client completes the test and then reports the result.
`;
    }
    return context.trim();
}

/* =========================================================
EXPORT
========================================================= */
module.exports = {getSmartContext};