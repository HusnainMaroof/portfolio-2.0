// parseDuration("1h30m") -> milliseconds. Units: h, m, s, ms. Throws on bad input.
function parseDuration(text) {
  if (typeof text !== "string" || !/^(\d+(h|ms|m|s))+$/.test(text)) throw new Error(`bad duration: ${text}`);
  const unit = { h: 3600000, m: 6000, s: 1000, ms: 1 };
  let total = 0;
  for (const [, n, u] of text.matchAll(/(\d+)(h|ms|m|s)/g)) total += Number(n) * unit[u];
  return total;
}

module.exports = { parseDuration };
