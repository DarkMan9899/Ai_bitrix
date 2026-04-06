const leads = new Map();

const TTL = 1000 * 60 * 60 * 48; // 48 ժամ

function ensure(dialogId) {

    if (!leads.has(dialogId)) {

        leads.set(dialogId, {
            name: null,
            language: null,
            goal: null,
            level: null,
            format: null, // 🔥 NEW
            phone: null,
            ts: Date.now() // 🔥 NEW
        });

    }

    return leads.get(dialogId);
}

function update(dialogId, data) {

    const lead = ensure(dialogId);

    const updated = {
        ...lead,
        ...data,
        ts: Date.now() // 🔥 update timestamp
    };

    leads.set(dialogId, updated);
}

function get(dialogId) {

    const lead = leads.get(dialogId);

    if (!lead) return ensure(dialogId);

    // 🔥 TTL CHECK
    if (Date.now() - lead.ts > TTL) {
        leads.delete(dialogId);
        return ensure(dialogId);
    }

    return lead;
}

module.exports = { get, update };