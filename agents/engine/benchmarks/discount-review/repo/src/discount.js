// Returns the price after a percent discount, rounded to cents.
function applyDiscount(price, percent) {
  const discounted = price - (price * percent) / 100;
  return Math.round(discounted * 100 / 100);
}

module.exports = { applyDiscount };
