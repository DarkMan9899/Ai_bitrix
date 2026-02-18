module.exports = function extractDealId(params) {

    if (!params) return null;

    const sessionData = params.CHAT_ENTITY_DATA_1;

    // երբ դեռ deal գոյություն չունի
    if (!sessionData || typeof sessionData !== "string")
        return null;

    const parts = sessionData.split("|");

    // փնտրում ենք DEAL keyword
    const dealIndex = parts.indexOf("DEAL");

    if (dealIndex === -1) return null;

    return parts[dealIndex + 1] || null;
};
