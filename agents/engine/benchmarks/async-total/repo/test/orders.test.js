const assert = require("node:assert/strict");
const { totalFor } = require("../src/orders");
(async () => {
  assert.equal(await totalFor(["a", "b", "c"]), 49.75);
  assert.equal(await totalFor([]), 0);
  await assert.rejects(() => totalFor(["a", "zzz"]), /no order zzz/);
  console.log("orders ok");
})().catch((e) => { console.error(e); process.exit(1); });
