const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "dialogState.json");

let state = {};

// load on start
try {
    if (fs.existsSync(FILE)) {
        state = JSON.parse(fs.readFileSync(FILE));
    }
} catch (e) {
    console.log("STATE LOAD ERROR", e.message);
}

// save helper
function save() {
    try {
        fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        console.log("STATE SAVE ERROR", e.message);
    }
}

function getState(id){
    if(!state[id]) {
        state[id] = {
            ready:false,
            askedPhone:false
        };
        save();
    }
    return state[id];
}

function markReady(id){
    getState(id).ready = true;
    save();
}

function asked(id){
    getState(id).askedPhone = true;
    save();
}

function shouldTransfer(id){
    return getState(id)?.askedPhone === true;
}

module.exports = { getState, markReady, asked, shouldTransfer };
