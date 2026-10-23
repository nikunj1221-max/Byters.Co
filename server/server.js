require("dotenv").config();
const path = require("path");
const express = require("express");
const db = require("./src/db");
const menu = require("./src/menu");
const wa = require("./src/whatsapp");
const llm = require("./src/llm");
const { router: whatsappRoutes } = require("./routes/whatsapp");

const app = express();
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf; // needed for webhook signature check
    },
  })
);
app.use(whatsappRoutes);

// ---------- staff dashboard API ----------

function adminOnly(req, res, next) {
  const key = req.get("x-admin-key") || req.query.key;
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return res.sendStatus(401);
  next();
}

app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));

app.get("/api/orders", adminOnly, (_req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 100").all();
  res.json(rows.map((r) => ({ ...r, items: JSON.parse(r.items) })));
});

const STATUSES = ["new", "preparing", "ready", "completed", "cancelled"];

app.patch("/api/orders/:id", adminOnly, async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "bad status" });
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.sendStatus(404);
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, order.id);

  // Tell the customer on WhatsApp when their order moves
  const msgs = {
    preparing: `Your order #${order.id} is being prepared.`,
    ready: `Your order #${order.id} is ready for pickup! Total ${menu.shop.currency}${order.total}, pay at the counter.`,
    cancelled: `Your order #${order.id} was cancelled. Please contact the staff if this is unexpected.`,
  };
  if (msgs[status]) wa.sendText(order.phone, msgs[status]).catch(() => {});
  res.json({ ok: true });
});

app.get("/api/menu", adminOnly, (_req, res) => {
  res.json(menu.items.map((i) => ({ id: i.id, name: i.name, available: menu.isAvailable(i.id) })));
});

app.post("/api/menu/:id/availability", adminOnly, (req, res) => {
  if (!menu.findItem(req.params.id)) return res.sendStatus(404);
  menu.setAvailable(req.params.id, Boolean(req.body?.available));
  res.json({ ok: true });
});

app.get("/health", (_req, res) => res.json({ ok: true, live: wa.LIVE }));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Bot running on :${PORT} | WhatsApp: ${wa.LIVE ? "Meta Cloud API" : "dry-run (use POST /simulate)"} | LLM: ${llm.provider() || "offline fallback"}`);
  });
}

module.exports = app;
