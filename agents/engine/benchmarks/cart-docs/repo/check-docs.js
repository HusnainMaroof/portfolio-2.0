const fs = require("node:fs");
const t = fs.readFileSync("README.md", "utf8");
const api = t.split(/^## API\s*$/m)[1];
const fail = (m) => { console.error(m); process.exit(1); };
if (!api) fail("no '## API' section");
for (const fn of ["addItem", "removeItem", "total"]) if (!api.includes(fn)) fail(`missing ${fn}`);
if (!/```js[\s\S]+?```/.test(api)) fail("no ```js example");
if (!/qty must be positive/.test(api) || !/no item/.test(api)) fail("errors not documented");
console.log("docs ok");
