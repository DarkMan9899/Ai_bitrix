const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "closedDialogs.json");

let closed = new Set();

// load on start
try {
    if (fs.existsSync(FILE)) {
        const data = JSON.parse(fs.readFileSync(FILE));
        closed = new Set(data);
    }
} catch (e) {
    console.log("Closed dialog cache load error", e.message);
}

// save helper
function save() {
    try {
        fs.writeFileSync(FILE, JSON.stringify([...closed]));
    } catch (e) {
        console.log("Closed dialog cache save error", e.message);
    }
}

module.exports = {

    closeDialog(id) {
        closed.add(id);
        save();
        console.log("DIALOG CLOSED:", id);
    },

    isClosed(id) {
        return closed.has(id);
    }

};
