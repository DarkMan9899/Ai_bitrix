module.exports = function extractDealId(sessionData) {

    if (!sessionData || typeof sessionData !== "string") {
        return null;
    }

    try {

        const parts = sessionData.split("|");

        const dealIndex = parts.indexOf("DEAL");

        if (dealIndex === -1) return null;

        const dealId = parts[dealIndex + 1];

        return dealId ? String(dealId) : null;

    } catch (e) {

        console.log("DEAL PARSE ERROR:", e.message);
        return null;
    }
};