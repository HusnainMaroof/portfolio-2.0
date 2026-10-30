"""Generates benchmarks/<id>/{bench.json, repo/, solution/}. Re-run after editing; it overwrites."""
import json
import os
import shutil

B = os.path.join(os.path.dirname(__file__), "..", "benchmarks")


def w(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8", newline="\n") as f:
        f.write(text.lstrip("\n"))


def bench(id, meta, repo, solution):
    shutil.rmtree(f"{B}/{id}", ignore_errors=True)
    w(f"{B}/{id}/bench.json", json.dumps({"id": id, **meta}, indent=2) + "\n")
    for p, t in repo.items():
        w(f"{B}/{id}/repo/{p}", t)
    for p, t in solution.items():
        w(f"{B}/{id}/solution/{p}", t)


# 1 coding: implement slugify
bench(
    "slugify",
    dict(
        title="Implement slugify()",
        category="coding",
        risk="low",
        brief='Implement slugify(text) in src/slug.js: lowercase, strip accents (é -> e), replace every run of characters that are not a-z or 0-9 with a single "-", and trim "-" from both ends. Empty input returns "". The tests in test/slug.test.js define the behaviour; do not change them.',
        files=["src/slug.js"],
        checks=[{"name": "tests", "cmd": "node test/slug.test.js"}],
    ),
    {
        "src/slug.js": """
function slugify(text) {
  throw new Error("not implemented");
}

module.exports = { slugify };
""",
        "test/slug.test.js": """
const assert = require("node:assert/strict");
const { slugify } = require("../src/slug");
assert.equal(slugify("Hello World!"), "hello-world");
assert.equal(slugify("  Crème brûlée  recipe "), "creme-brulee-recipe");
assert.equal(slugify("a--b__c"), "a-b-c");
assert.equal(slugify("100% Pure"), "100-pure");
assert.equal(slugify("---"), "");
assert.equal(slugify(""), "");
console.log("slug ok");
""",
    },
    {
        "src/slug.js": r"""
function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = { slugify };
"""
    },
)

# 2 debugging: pagination off by one
bench(
    "pagination",
    dict(
        title="Fix pagination bugs",
        category="debugging",
        risk="low",
        brief="Users report that page 1 of the product list skips the first items and the last partial page is missing from the page count. paginate(items, page, size) in src/paginate.js uses 1-based pages. Find the root cause and fix it. The tests in test/paginate.test.js describe the expected behaviour.",
        files=["src/paginate.js"],
        checks=[{"name": "tests", "cmd": "node test/paginate.test.js"}],
    ),
    {
        "src/paginate.js": """
// page is 1-based
function paginate(items, page, size) {
  const start = page * size;
  return {
    items: items.slice(start, start + size),
    page,
    totalPages: Math.floor(items.length / size),
  };
}

module.exports = { paginate };
""",
        "test/paginate.test.js": """
const assert = require("node:assert/strict");
const { paginate } = require("../src/paginate");
const items = Array.from({ length: 23 }, (_, i) => i + 1);
assert.deepEqual(paginate(items, 1, 10).items, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.deepEqual(paginate(items, 3, 10).items, [21, 22, 23]);
assert.equal(paginate(items, 1, 10).totalPages, 3);
assert.equal(paginate([], 1, 10).totalPages, 0);
assert.equal(paginate(items.slice(0, 20), 1, 10).totalPages, 2);
console.log("paginate ok");
""",
    },
    {
        "src/paginate.js": """
// page is 1-based
function paginate(items, page, size) {
  const start = (page - 1) * size;
  return {
    items: items.slice(start, start + size),
    page,
    totalPages: Math.ceil(items.length / size),
  };
}

module.exports = { paginate };
"""
    },
)

# 3 debugging: async forEach
ORDERS_HEAD = """
const db = { a: 12.5, b: 7.25, c: 30 };

async function fetchOrder(id) {
  await new Promise((r) => setTimeout(r, 5));
  if (!(id in db)) throw new Error(`no order ${id}`);
  return { id, price: db[id] };
}
"""
bench(
    "async-total",
    dict(
        title="Order total is always 0",
        category="debugging",
        risk="medium",
        brief="totalFor(ids) in src/orders.js should add up the prices of the given orders, but it always returns 0. Find the root cause and fix it. Orders must still be fetched with fetchOrder() (it is async). Tests: test/orders.test.js.",
        files=["src/orders.js"],
        checks=[{"name": "tests", "cmd": "node test/orders.test.js"}],
    ),
    {
        "src/orders.js": ORDERS_HEAD
        + """
async function totalFor(ids) {
  let total = 0;
  ids.forEach(async (id) => {
    const order = await fetchOrder(id);
    total += order.price;
  });
  return total;
}

module.exports = { fetchOrder, totalFor };
""",
        "test/orders.test.js": """
const assert = require("node:assert/strict");
const { totalFor } = require("../src/orders");
(async () => {
  assert.equal(await totalFor(["a", "b", "c"]), 49.75);
  assert.equal(await totalFor([]), 0);
  await assert.rejects(() => totalFor(["a", "zzz"]), /no order zzz/);
  console.log("orders ok");
})().catch((e) => { console.error(e); process.exit(1); });
""",
    },
    {
        "src/orders.js": ORDERS_HEAD
        + """
async function totalFor(ids) {
  const orders = await Promise.all(ids.map((id) => fetchOrder(id)));
  return orders.reduce((sum, o) => sum + o.price, 0);
}

module.exports = { fetchOrder, totalFor };
"""
    },
)

# 4 testing: tests must kill mutants
MUT_CHECK = 'node test/duration.test.js && for m in mutants/*.js; do if DURATION_IMPL=../$m node test/duration.test.js >/dev/null 2>&1; then echo "weak tests: mutant $m survived"; exit 1; fi; done; echo "all mutants killed"'
DURATION = r"""
// parseDuration("1h30m") -> milliseconds. Units: h, m, s, ms. Throws on bad input.
function parseDuration(text) {
  if (typeof text !== "string" || !/^(\d+(h|ms|m|s))+$/.test(text)) throw new Error(`bad duration: ${text}`);
  const unit = { h: 3600000, m: 60000, s: 1000, ms: 1 };
  let total = 0;
  for (const [, n, u] of text.matchAll(/(\d+)(h|ms|m|s)/g)) total += Number(n) * unit[u];
  return total;
}

module.exports = { parseDuration };
"""
bench(
    "duration-tests",
    dict(
        title="Write tests for parseDuration",
        category="testing",
        risk="low",
        brief='Write thorough tests for parseDuration in test/duration.test.js (plain node:assert, no test framework, exit non-zero on failure). The file MUST load the module with: const { parseDuration } = require(process.env.DURATION_IMPL || "../src/duration"); Cover every unit (h, m, s, ms), combinations, and invalid input that must throw. The check also runs your tests against broken versions of the module (mutants/), and every one of them must make your tests fail. Do not change src/ or mutants/.',
        files=["test/duration.test.js"],
        checks=[{"name": "tests-kill-mutants", "cmd": MUT_CHECK}],
    ),
    {
        "src/duration.js": DURATION,
        "test/duration.test.js": "// TODO: write tests\n",
        "mutants/m1-minutes.js": DURATION.replace("m: 60000", "m: 6000"),
        "mutants/m2-ms.js": DURATION.replace("ms: 1 }", "ms: 10 }"),
        "mutants/m3-no-throw.js": DURATION.replace("throw new Error(`bad duration: ${text}`);", "return 0;"),
        "mutants/m4-first-only.js": DURATION.replace("total += Number(n) * unit[u];", "{ total += Number(n) * unit[u]; break; }"),
        "mutants/m5-hours.js": DURATION.replace("h: 3600000", "h: 360000"),
    },
    {
        "test/duration.test.js": """
const assert = require("node:assert/strict");
const { parseDuration } = require(process.env.DURATION_IMPL || "../src/duration");
assert.equal(parseDuration("2h"), 7200000);
assert.equal(parseDuration("3m"), 180000);
assert.equal(parseDuration("4s"), 4000);
assert.equal(parseDuration("250ms"), 250);
assert.equal(parseDuration("1h30m"), 5400000);
assert.equal(parseDuration("1m1s1ms"), 61001);
for (const bad of ["", "abc", "10", "5x", "h1"]) assert.throws(() => parseDuration(bad));
console.log("duration ok");
"""
    },
)

# 5 coding/performance: fib
bench(
    "fast-fib",
    dict(
        title="Make fib() fast and exact",
        category="coding",
        risk="medium",
        brief="fib(n) in src/fib.js is exponential and loses precision for large n. Make it fast and exact: it must return a BigInt, fib(0) = 0n, fib(1) = 1n, and fib(90) must return in well under a second. Keep the same export. test/fib.test.js checks correctness; bench.js prints the time for fib(30) in ms, which must get lower.",
        files=["src/fib.js"],
        checks=[
            {"name": "tests", "cmd": "node test/fib.test.js"},
            {"name": "fib30-ms", "cmd": "node bench.js", "measure": True, "expect": "lower"},
        ],
    ),
    {
        "src/fib.js": """
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}

module.exports = { fib };
""",
        "test/fib.test.js": """
const assert = require("node:assert/strict");
const { fib } = require("../src/fib");
const t = setTimeout(() => { console.error("too slow"); process.exit(1); }, 1000);
assert.equal(fib(0), 0n);
assert.equal(fib(1), 1n);
assert.equal(fib(10), 55n);
assert.equal(fib(90), 2880067194370816120n);
clearTimeout(t);
console.log("fib ok");
""",
        "bench.js": """
const { fib } = require("./src/fib");
const t0 = process.hrtime.bigint();
for (let i = 0; i < 3; i++) fib(30);
console.log("fib(30) ms:", Number(process.hrtime.bigint() - t0) / 3e6);
""",
    },
    {
        "src/fib.js": """
function fib(n) {
  let a = 0n;
  let b = 1n;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}

module.exports = { fib };
"""
    },
)

# 6 research (read-only): the env var the code reads is APP_PORT, not PORT
bench(
    "config-port",
    dict(
        title="Which port does the server use?",
        category="research",
        risk="low",
        brief="Read-only investigation. The server is started with the environment variable PORT=8080 and the repo's config.json present. Which port does it actually listen on, and why? Trace the config loading through the code and cite file:line for each step. Do not change any file.",
        files=[],
        checks=[],
        reportMatch=["3001", "APP_PORT", r"config\.js"],
    ),
    {
        "src/defaults.js": """
module.exports = { port: 3000, host: "0.0.0.0" };
""",
        "src/config.js": """
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
""",
        "src/server.js": """
const http = require("node:http");
const { loadConfig } = require("./config");

const { port, host } = loadConfig();
http.createServer((req, res) => res.end("ok")).listen(port, host);
""",
        "config.json": '{ "port": 3001 }\n',
    },
    {"report.md": "Listens on 3001. src/config.js:9 reads env.APP_PORT, not PORT, so PORT=8080 is ignored; config.json port 3001 overrides defaults.js port 3000.\n"},
)

# 7 docs
bench(
    "cart-docs",
    dict(
        title="Document the cart API",
        category="docs",
        risk="low",
        brief='Add an "## API" section to README.md documenting every exported function of src/cart.js (addItem, removeItem, total): signature, what it returns, and the exact error messages it throws. Include at least one ```js usage example. Read the code; document it as it is.',
        files=["README.md"],
        checks=[{"name": "docs", "cmd": "node check-docs.js"}],
    ),
    {
        "src/cart.js": """
// A cart is a plain array of { sku, price, qty }.
function addItem(cart, sku, price, qty = 1) {
  if (qty <= 0) throw new Error("qty must be positive");
  const line = cart.find((l) => l.sku === sku);
  if (line) line.qty += qty;
  else cart.push({ sku, price, qty });
  return cart;
}

function removeItem(cart, sku) {
  const i = cart.findIndex((l) => l.sku === sku);
  if (i < 0) throw new Error(`no item ${sku}`);
  cart.splice(i, 1);
  return cart;
}

function total(cart) {
  return Math.round(cart.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
}

module.exports = { addItem, removeItem, total };
""",
        "README.md": "# Cart\n\nA tiny shopping cart module.\n",
        "check-docs.js": r"""
const fs = require("node:fs");
const t = fs.readFileSync("README.md", "utf8");
const api = t.split(/^## API\s*$/m)[1];
const fail = (m) => { console.error(m); process.exit(1); };
if (!api) fail("no '## API' section");
for (const fn of ["addItem", "removeItem", "total"]) if (!api.includes(fn)) fail(`missing ${fn}`);
if (!/```js[\s\S]+?```/.test(api)) fail("no ```js example");
if (!/qty must be positive/.test(api) || !/no item/.test(api)) fail("errors not documented");
console.log("docs ok");
""",
    },
    {
        "README.md": """
# Cart

A tiny shopping cart module.

## API

- `addItem(cart, sku, price, qty = 1)`: adds or increases a line, returns the cart. Throws "qty must be positive" when qty <= 0.
- `removeItem(cart, sku)`: removes the line, returns the cart. Throws "no item <sku>" when missing.
- `total(cart)`: sum of price * qty, rounded to cents.

```js
const { addItem, total } = require("./src/cart");
const cart = addItem([], "pen", 1.5, 2);
total(cart); // 3
```
"""
    },
)

# 8 coding: CLI flag
CLI_HEAD = """
const lines = [
  { sku: "a", price: 2.5, qty: 2 },
  { sku: "b", price: 7.5, qty: 1 },
];

const items = lines.reduce((n, l) => n + l.qty, 0);
const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
"""
bench(
    "cli-json",
    dict(
        title="Add a --json flag to the CLI",
        category="coding",
        risk="low",
        brief='src/cli.js prints a summary like "3 items, total 12.50". Add a --json flag: with it, print exactly one line of JSON {"items": <count>, "total": <number>} instead. Without the flag the output must not change. Tests: test/cli.test.js.',
        files=["src/cli.js"],
        checks=[{"name": "tests", "cmd": "node test/cli.test.js"}],
    ),
    {
        "src/cli.js": CLI_HEAD + "console.log(`${items} items, total ${total.toFixed(2)}`);\n",
        "test/cli.test.js": r"""
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const run = (...a) => execFileSync(process.execPath, ["src/cli.js", ...a], { encoding: "utf8" });
assert.equal(run(), "3 items, total 12.50\n");
const out = run("--json");
assert.equal(out.trim().split("\n").length, 1);
assert.deepEqual(JSON.parse(out), { items: 3, total: 12.5 });
console.log("cli ok");
""",
    },
    {
        "src/cli.js": CLI_HEAD
        + 'if (process.argv.includes("--json")) console.log(JSON.stringify({ items, total }));\n'
        + "else console.log(`${items} items, total ${total.toFixed(2)}`);\n"
    },
)

# 9 review (read-only): two planted bugs
bench(
    "discount-review",
    dict(
        title="Review the discount function",
        category="review",
        risk="low",
        brief="Read-only code review of src/discount.js. applyDiscount(price, percent) must return the discounted price rounded to cents and never below 0. List every correctness bug with file:line, severity, and a concrete input that shows it. Do not change any file.",
        files=[],
        checks=[],
        reportMatch=[
            r"(negative|below (0|zero)|> ?100|over 100|more than 100|greater than 100|exceed)",
            r"(round|cents)",
        ],
    ),
    {
        "src/discount.js": """
// Returns the price after a percent discount, rounded to cents.
function applyDiscount(price, percent) {
  const discounted = price - (price * percent) / 100;
  return Math.round(discounted * 100 / 100);
}

module.exports = { applyDiscount };
"""
    },
    {"report.md": "src/discount.js:3 percent > 100 makes the price negative (no clamp). src/discount.js:4 Math.round(discounted * 100 / 100) rounds to whole units, not cents.\n"},
)

print("benchmarks written")
