module.exports = function extractPhone(text) {
    const match = text.match(/\+?\d{8,15}/);
    return match ? match[0] : null;
};
