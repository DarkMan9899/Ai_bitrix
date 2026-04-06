function detectName(text = "") {
    const clean = String(text).trim();

    const patterns = [
        /* ===== Armenian ===== */
        /իմ անունը\s+([Ա-Ֆա-ֆA-Za-z]+)/i,
        /անունս\s+([Ա-Ֆա-ֆA-Za-z]+)\s+է/i,
        /ես\s+([Ա-Ֆա-ֆA-Za-z]+)\s+եմ/i,
        /([Ա-Ֆա-ֆ][ա-ֆ]{2,})\s+եմ/i,
        /կոչվում եմ\s+([Ա-Ֆա-ֆA-Za-z]+)/i,

        /* ===== Russian ===== */
        /меня зовут\s+([А-Яа-яA-Za-z]+)/i,
        /моё имя\s+([А-Яа-яA-Za-z]+)/i,
        /я\s+([А-Яа-яA-Za-z]{3,})/i,

        /* ===== English ===== */
        /my name is\s+([A-Za-z]+)/i,
        /i(?:'m| am)\s+([A-Za-z]{3,})/i,
        /call me\s+([A-Za-z]+)/i
    ];

    for (const p of patterns) {
        const match = clean.match(p);
        if (match?.[1]) {
            return capitalize(match[1]);
        }
    }

    // ✅ fallback: single-word probable name
    const words = clean.split(/\s+/);

    if (words.length === 1) {
        const word = words[0];

        const blacklist = [
            "ցանկանում", "ուզում", "բարև", "բարեւ",
            "hello", "hi", "привет",
            "want", "learn", "хочу",
            "գին", "price", "սովորել"
        ];

        const lower = word.toLowerCase();

        const looksLikeName =
            !blacklist.includes(lower) &&
            /^[\p{L}]{2,}$/u.test(word);

        if (looksLikeName) {
            return capitalize(word);
        }
    }

    return null;
}

function capitalize(name = "") {
    return name.charAt(0).toUpperCase() + name.slice(1);
}

module.exports = detectName;