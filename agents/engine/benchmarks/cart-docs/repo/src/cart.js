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
