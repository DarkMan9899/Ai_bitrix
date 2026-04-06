const states = new Map();

/* ================= GET STATE ================= */

function getState(dialogId){

    if(!dialogId) return null;

    if(!states.has(dialogId)){

        states.set(dialogId, {
            stage: "greeting",
            attempts: 0,
            askedPhone: false,
            lastAskedAt: 0,
            createdAt: Date.now()
        });

    }

    return states.get(dialogId);
}

/* ================= SET STAGE ================= */

function setStage(dialogId, newStage){

    const s = getState(dialogId);

    if(!s) return;

    s.stage = newStage;
}

/* ================= PHONE ASK ================= */

function markAskedPhone(dialogId){

    const s = getState(dialogId);

    if(!s) return;

    s.askedPhone = true;
    s.lastAskedAt = Date.now();
}

/* ================= HAS ASKED PHONE ================= */

function hasAskedPhone(dialogId){

    const s = getState(dialogId);

    if(!s) return false;

    return s.askedPhone === true;
}

/* ================= INCREASE ATTEMPTS ================= */

function increaseAttempts(dialogId){

    const s = getState(dialogId);

    if(!s) return;

    s.attempts++;
}

/* ================= RESET ================= */

function reset(dialogId){

    states.delete(dialogId);
}

/* ================= CLEAN OLD STATES ================= */

function cleanup(){

    const now = Date.now();

    const MAX = 6 * 60 * 60 * 1000; // 6 ժամ

    for(const [id, s] of states){

        if(now - s.createdAt > MAX){

            states.delete(id);
        }
    }
}

setInterval(cleanup, 60 * 60 * 1000);

/* ================= EXPORT ================= */

module.exports = {
    getState,
    setStage,
    markAskedPhone,
    hasAskedPhone,
    increaseAttempts,
    reset
};