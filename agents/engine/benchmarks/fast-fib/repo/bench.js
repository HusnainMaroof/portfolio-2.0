const { fib } = require("./src/fib");
const t0 = process.hrtime.bigint();
for (let i = 0; i < 3; i++) fib(30);
console.log("fib(30) ms:", Number(process.hrtime.bigint() - t0) / 3e6);
