const queues = new Map();
const buffers = new Map();

function enqueue(dialogId, text, job) {

    if (!buffers.has(dialogId)) {
        buffers.set(dialogId, {
            messages: [],
            timer: null,
            firstMessageTime: Date.now()
        });
    }

    const buffer = buffers.get(dialogId);

    buffer.messages.push(text);

    if (buffer.timer) {
        clearTimeout(buffer.timer);
    }

    const messageCount = buffer.messages.length;

    // Dynamic delay: wait a little longer if client is still typing
    let delay;

    if (messageCount === 1) {
        delay = 2000;   // 2 seconds
    } else if (messageCount <= 3) {
        delay = 4000;   // 4 seconds
    } else {
        delay = 6000;   // 6 seconds
    }

    buffer.timer = setTimeout(() => {

        const combinedText = buffer.messages.join(" ");

        buffers.delete(dialogId);

        const prev = queues.get(dialogId) || Promise.resolve();

        const next = prev
            .catch(() => {})
            .then(() => job(combinedText));

        queues.set(dialogId, next);

    }, delay);
}

module.exports = enqueue;