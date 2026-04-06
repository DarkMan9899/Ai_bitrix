module.exports = function extractPhone(text) {

    if (!text) return null;

    const cleaned = text
        .replace(/\s+/g, "")      // remove spaces
        .replace(/[-().]/g, "");  // remove -, (, ), .

    const match = cleaned.match(/\+?\d{8,15}/);

    if (!match) return null;

    return match[0];
};