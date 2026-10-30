const lines = [
  { sku: "a", price: 2.5, qty: 2 },
  { sku: "b", price: 7.5, qty: 1 },
];

const items = lines.reduce((n, l) => n + l.qty, 0);
const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
if (process.argv.includes("--json")) console.log(JSON.stringify({ items, total }));
else console.log(`${items} items, total ${total.toFixed(2)}`);
