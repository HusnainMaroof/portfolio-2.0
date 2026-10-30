const fs = require("node:fs");
const path = require("node:path");
const defaults = require("./defaults");

function loadConfig(env = process.env) {
  const file = path.join(__dirname, "..", "config.json");
  const fromFile = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const fromEnv = env.APP_PORT ? { port: Number(env.APP_PORT) } : {};
  return { ...defaults, ...fromFile, ...fromEnv };
}

module.exports = { loadConfig };
