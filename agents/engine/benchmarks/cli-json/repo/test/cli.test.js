const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const run = (...a) => execFileSync(process.execPath, ["src/cli.js", ...a], { encoding: "utf8" });
assert.equal(run(), "3 items, total 12.50\n");
const out = run("--json");
assert.equal(out.trim().split("\n").length, 1);
assert.deepEqual(JSON.parse(out), { items: 3, total: 12.5 });
console.log("cli ok");
