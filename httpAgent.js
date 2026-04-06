const https = require("https");

const agent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    timeout: 30000,
    keepAliveMsecs: 10000
});

module.exports = agent;
