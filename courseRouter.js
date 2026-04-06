function normalize(text = "") {
    return text
        .toLowerCase()
        .normalize("NFC")
        .trim();
}

function detectCourse(text) {
    if (!text) return null;
    const t = normalize(text);

    /* ===== ENGLISH ===== */
    if (
        t.includes("english") ||
        t.includes("անգլ") ||
        t.includes("инглиш")
    ) return "english";

    /* ===== RUSSIAN ===== */
    if (
        t.includes("russian") ||
        t.includes("рус") ||
        t.includes("ռուս")
    ) return "russian";

    /* ===== GERMAN ===== */
    if (
        t.includes("german") ||
        t.includes("deutsch") ||
        t.includes("нем") ||
        t.includes("գերմ")
    ) return "german";

    /* ===== FRENCH ===== */
    if (
        t.includes("french") ||
        t.includes("франц") ||
        t.includes("француз") ||
        t.includes("ֆրանս")
    ) return "french";

    /* ===== SPANISH ===== */
    if (
        t.includes("spanish") ||
        t.includes("испан") ||
        t.includes("espanol") ||
        t.includes("իսպան")
    ) return "spanish";

    /* ===== IELTS ===== */
    if (t.includes("ielts")) return "ielts";

    /* ===== KIDS ===== */
    if (
        t.includes("kids") ||
        t.includes("երեխ") ||
        t.includes("ребен")
    ) return "kids";

    return null;
}

module.exports = detectCourse;