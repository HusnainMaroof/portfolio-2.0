src/discount.js:3 percent > 100 makes the price negative (no clamp). src/discount.js:4 Math.round(discounted * 100 / 100) rounds to whole units, not cents.
