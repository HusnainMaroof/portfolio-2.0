const assert = require("node:assert/strict");
const { slugify } = require("../src/slug");
assert.equal(slugify("Hello World!"), "hello-world");
assert.equal(slugify("  Crème brûlée  recipe "), "creme-brulee-recipe");
assert.equal(slugify("a--b__c"), "a-b-c");
assert.equal(slugify("100% Pure"), "100-pure");
assert.equal(slugify("---"), "");
assert.equal(slugify(""), "");
console.log("slug ok");
