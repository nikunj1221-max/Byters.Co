

const EventEmitter = require("events");
const db = require("./db");
const { shop, items, MILK_ALTS, findItem, isAvailable, priceRange } = require("./menu");

const bus = new EventEmitter();

function getCart(phone) {
  const row = db.prepare("SELECT items FROM carts WHERE phone = ?").get(phone);
  return row ? JSON.parse(row.items) : [];
}

function saveCart(phone, cart) {
  db.prepare(
    "INSERT INTO carts(phone, items) VALUES (?, ?) ON CONFLICT(phone) DO UPDATE SET items = excluded.items"
  ).run(phone, JSON.stringify(cart));
}

function cartTotal(cart) {
  return cart.reduce((sum, l) => sum + l.unit_price * l.qty, 0);
}

function cartView(cart) {
  return {
    lines: cart.map((l, idx) => ({
      line: idx + 1,
      text: `${l.qty}x ${l.name} (${l.size}, ${l.temp}, ${l.milk} milk)`,
      line_total: l.unit_price * l.qty,
    })),
    total: cartTotal(cart),
    currency: shop.currency,
  };
}

// ---- tool implementations. Each takes (phone, input) and returns a JSON-able object ----

const impl = {
  get_menu() {
    return items.map((i) => ({
      id: i.id,
      name: i.name,
      price: priceRange(i),
      available: isAvailable(i.id),
    }));
  },

  add_to_cart(phone, { item_id, size, quantity = 1, milk = "regular", temperature }) {
    const item = findItem(item_id);
    if (!item) return { error: "Unknown item_id", valid_ids: items.map((i) => i.id) };
    if (!isAvailable(item.id)) return { error: `${item.name} is sold out right now` };

    const sizeKeys = Object.keys(item.sizes);
    if (!size) {
      if (sizeKeys.length === 1) size = sizeKeys[0];
      else return { error: "size is required, ask the customer", options: sizeKeys };
    }
    if (!item.sizes[size]) return { error: "Invalid size for this item", options: sizeKeys };

    if (!temperature) {
      if (item.served.length === 1) temperature = item.served[0];
      else return { error: "temperature is required, ask the customer", options: item.served };
    }
    if (!item.served.includes(temperature)) {
      return { error: `${item.name} is only served ${item.served.join(" or ")}` };
    }

    let surcharge = 0;
    if (milk !== "regular") {
      if (!item.milk_based) return { error: `${item.name} has no milk, so milk choice does not apply` };
      if (!(milk in MILK_ALTS)) return { error: "Unknown milk option", options: ["regular", ...Object.keys(MILK_ALTS)] };
      surcharge = MILK_ALTS[milk];
    }

    const qty = Math.floor(Number(quantity));
    if (!(qty >= 1 && qty <= 10)) return { error: "quantity must be between 1 and 10" };

    const cart = getCart(phone);
    cart.push({
      item_id: item.id,
      name: item.name,
      size,
      qty,
      milk,
      temp: temperature,
      unit_price: item.sizes[size].price + surcharge,
    });
    saveCart(phone, cart);
    return { ok: true, cart: cartView(cart) };
  },

  view_cart(phone) {
    const cart = getCart(phone);
    return cart.length ? cartView(cart) : { empty: true };
  },

  remove_from_cart(phone, { line }) {
    line = Number(line); // some models send numbers as strings
    const cart = getCart(phone);
    if (!Number.isInteger(line) || line < 1 || line > cart.length) {
      return { error: "Invalid line number", cart: cartView(cart) };
    }
    cart.splice(line - 1, 1);
    saveCart(phone, cart);
    return { ok: true, cart: cart.length ? cartView(cart) : { empty: true } };
  },

  clear_cart(phone) {
    saveCart(phone, []);
    return { ok: true };
  },

  place_order(phone, { customer_name }) {
    const cart = getCart(phone);
    if (!cart.length) return { error: "Cart is empty" };

    // re-check availability at checkout time
    const gone = cart.filter((l) => !isAvailable(l.item_id)).map((l) => l.name);
    if (gone.length) return { error: `Sold out meanwhile: ${gone.join(", ")}. Remove them first.` };

    const total = cartTotal(cart);
    const name = (customer_name || "").trim() || null;
    const info = db
      .prepare("INSERT INTO orders(phone, name, items, total) VALUES (?, ?, ?, ?)")
      .run(phone, name, JSON.stringify(cart), total);
    saveCart(phone, []);

    const order = { id: info.lastInsertRowid, phone, name, items: cart, total, status: "new" };
    bus.emit("order", order);
    return {
      ok: true,
      order_id: order.id,
      total,
      currency: shop.currency,
      note: "Payment is at the counter when picking up",
    };
  },
};

// ---- tool schemas sent to Claude ----

const definitions = [
  {
    name: "get_menu",
    description: "List all menu items with id, price and live availability.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_to_cart",
    description:
      "Add a drink to the customer's cart. Only call once you know the item, size, and (if the drink can be hot or iced) the temperature. Ask the customer for anything missing instead of guessing.",
    input_schema: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "Menu item id, e.g. latte" },
        size: { type: "string", description: "Size key from the menu, e.g. S, M, L, single, double" },
        quantity: { type: "integer", description: "1 to 10, default 1" },
        milk: { type: "string", description: "regular, oat or soy. Only for milk-based drinks. Default regular" },
        temperature: { type: "string", enum: ["hot", "iced"] },
      },
      required: ["item_id"],
    },
  },
  {
    name: "view_cart",
    description: "Show the current cart and total.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "remove_from_cart",
    description: "Remove one line from the cart by its line number (1-based).",
    input_schema: {
      type: "object",
      properties: { line: { type: "integer" } },
      required: ["line"],
    },
  },
  {
    name: "clear_cart",
    description: "Empty the cart.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "place_order",
    description:
      "Place the order for everything in the cart. Only call after the customer has seen the cart total and explicitly confirmed. Ask for their name for the pickup if you do not have it.",
    input_schema: {
      type: "object",
      properties: { customer_name: { type: "string" } },
      required: ["customer_name"],
    },
  },
];

function run(phone, name, input) {
  const fn = impl[name];
  if (!fn) return { error: `Unknown tool ${name}` };
  try {
    return fn(phone, input || {});
  } catch (e) {
    console.error("tool error", name, e);
    return { error: "Tool failed" };
  }
}

module.exports = { definitions, run, bus, getCart };
