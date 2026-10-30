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
