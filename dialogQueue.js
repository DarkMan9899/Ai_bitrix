const queues = new Map();

function enqueue(dialogId, job){

    const prev = queues.get(dialogId) || Promise.resolve();

    const next = prev
        .catch(()=>{}) // որ չկոտրվի հերթը
        .then(job);

    queues.set(dialogId, next);
}

module.exports = enqueue;
