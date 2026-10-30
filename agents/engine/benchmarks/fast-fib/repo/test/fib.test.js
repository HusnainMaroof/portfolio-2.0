const assert = require("node:assert/strict");
const { fib } = require("../src/fib");
const t = setTimeout(() => { console.error("too slow"); process.exit(1); }, 1000);
assert.equal(fib(0), 0n);
assert.equal(fib(1), 1n);
assert.equal(fib(10), 55n);
assert.equal(fib(90), 2880067194370816120n);
clearTimeout(t);
console.log("fib ok");
