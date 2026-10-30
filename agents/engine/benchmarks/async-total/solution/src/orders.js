const db = { a: 12.5, b: 7.25, c: 30 };

async function fetchOrder(id) {
  await new Promise((r) => setTimeout(r, 5));
  if (!(id in db)) throw new Error(`no order ${id}`);
  return { id, price: db[id] };
}

async function totalFor(ids) {
  const orders = await Promise.all(ids.map((id) => fetchOrder(id)));
  return orders.reduce((sum, o) => sum + o.price, 0);
}

module.exports = { fetchOrder, totalFor };
