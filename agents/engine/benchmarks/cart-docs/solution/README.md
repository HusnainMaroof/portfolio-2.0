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
