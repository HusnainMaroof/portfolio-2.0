const assert = require("node:assert/strict");
const { paginate } = require("../src/paginate");
const items = Array.from({ length: 23 }, (_, i) => i + 1);
assert.deepEqual(paginate(items, 1, 10).items, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.deepEqual(paginate(items, 3, 10).items, [21, 22, 23]);
assert.equal(paginate(items, 1, 10).totalPages, 3);
assert.equal(paginate([], 1, 10).totalPages, 0);
assert.equal(paginate(items.slice(0, 20), 1, 10).totalPages, 2);
console.log("paginate ok");
