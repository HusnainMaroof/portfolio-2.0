const db = { a: 12.5, b: 7.25, c: 30 };

async function fetchOrder(id) {
  await new Promise((r) => setTimeout(r, 5));
  if (!(id in db)) throw new Error(`no order ${id}`);
  return { id, price: db[id] };
}

async function totalFor(ids) {
  let total = 0;
  ids.forEach(async (id) => {
    const order = await fetchOrder(id);
    total += order.price;
  });
  return total;
}

module.exports = { fetchOrder, totalFor };
