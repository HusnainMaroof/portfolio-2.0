const http = require("node:http");
const { loadConfig } = require("./config");

const { port, host } = loadConfig();
http.createServer((req, res) => res.end("ok")).listen(port, host);
