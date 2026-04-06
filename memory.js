const store = {};

function ensure(dialog){
    if(!store[dialog]) store[dialog] = [];
}

function add(dialog, role, text){
    ensure(dialog);

    // չենք պահում դատարկ կամ շատ երկար
    if(!text || typeof text !== "string") return;

    store[dialog].push({ role, content: text.trim() });

    // պահում ենք միայն վերջին 8 message (ոչ 20)
    if(store[dialog].length > 8)
        store[dialog].shift();
}

function get(dialog){
    ensure(dialog);
    return store[dialog];
}

function clear(dialog){
    delete store[dialog];
}

module.exports = { add, get, clear };
