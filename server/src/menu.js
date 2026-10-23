const fs = require("fs");
const path = require("path");
const db = require("./db");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "menu.json"), "utf8"));

const shop = data.shop;
const items = data.items;
const MILK_ALTS = shop.milk_alternatives;

function findItem(id) {
  return items.find((i) => i.id === id);
}

function soldOutIds() {
  return new Set(db.prepare("SELECT item_id FROM sold_out").all().map((r) => r.item_id));
}

function isAvailable(id) {
  return !db.prepare("SELECT 1 FROM sold_out WHERE item_id = ?").get(id);
}

function setAvailable(id, available) {
  if (available) db.prepare("DELETE FROM sold_out WHERE item_id = ?").run(id);
  else db.prepare("INSERT OR IGNORE INTO sold_out(item_id) VALUES (?)").run(id);
}

function priceRange(item) {
  const prices = Object.values(item.sizes).map((s) => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `${shop.currency}${min}` : `${shop.currency}${min}-${max}`;
}

// Menu as the LLM sees it, always reflecting live availability
function menuForPrompt() {
  const out = soldOutIds();
  return items.map((i) => ({ ...i, available: !out.has(i.id) }));
}

module.exports = { shop, items, MILK_ALTS, findItem, isAvailable, setAvailable, priceRange, menuForPrompt };
