/* =========================================================
   NOTE: gpt.js has its own isHumanIntent() inline.
   This file is kept for compatibility but is not imported
   by the current version of gpt.js.
   If you want to centralize intent detection, import this
   file in gpt.js instead of the inline version.
========================================================= */

function normalize(text = "") {
    return text.toLowerCase().trim();
}

module.exports = function wantsHuman(text = "") {
    const t = normalize(text);

    const keywords = [
        "manager", "operator", "call me", "call",
        "перезвон", "оператор", "менеджер"
    ];

    if (t.length < 30 && keywords.some(k => t.includes(k))) {
        return true;
    }

    const phrases = [
        "can you call",
        "let me talk",
        "хочу поговорить"
    ];

    if (phrases.some(p => t.includes(p))) {
        return true;
    }

    return false;
};