// Offline tests: tools, cart rules, orders, availability, simulator, admin API. No API keys needed.
process.env.DB_PATH = ":memory:";
process.env.ADMIN_KEY = "k";
process.env.WA_TOKEN = "";
process.env.PHONE_ID = "";
process.env.GROQ_API_KEY = "";
process.env.ANTHROPIC_API_KEY = "";

const assert = require("assert");
const tools = require("../src/tools");
const menu = require("../src/menu");
const wa = require("../src/whatsapp");
const { handleIncoming } = require("../routes/whatsapp");
const app = require("..");

const P = "911111111111";
const run = (n, i) => tools.run(P, n, i);

(async () => {
  // validation
  assert(run("add_to_cart", { item_id: "nope" }).error, "unknown item rejected");
  assert(run("add_to_cart", { item_id: "latte" }).error, "latte needs size");
  assert(run("add_to_cart", { item_id: "latte", size: "M" }).error, "latte needs hot/iced");
  assert(run("add_to_cart", { item_id: "cortado", size: "S", milk: "almond" }).error, "bad milk");
  assert(run("add_to_cart", { item_id: "americano", size: "M", temperature: "hot", milk: "oat" }).error, "no milk on americano");
  assert(run("add_to_cart", { item_id: "cappuccino", size: "M", temperature: "iced" }).error, "cappuccino is hot only");
  assert(run("add_to_cart", { item_id: "latte", size: "M", temperature: "hot", quantity: 99 }).error, "qty cap");

  // happy path + pricing (latte M 190 + oat 30 = 220 x2, espresso single 100 auto temp)
  let r = run("add_to_cart", { item_id: "latte", size: "M", temperature: "iced", milk: "oat", quantity: 2 });
  assert(r.ok && r.cart.total === 440, "latte oat x2 = 440, got " + r.cart.total);
  r = run("add_to_cart", { item_id: "espresso", size: "single" });
  assert(r.ok && r.cart.total === 540, "total 540");
  r = run("remove_from_cart", { line: 2 });
  assert(r.cart.total === 440, "removed espresso");

  // sold out blocks adding and checkout
  menu.setAvailable("flatwhite", false);
  assert(run("add_to_cart", { item_id: "flatwhite", size: "M" }).error, "sold out blocked");
  run("add_to_cart", { item_id: "mocha", size: "M", temperature: "hot" });
  menu.setAvailable("mocha", false);
  assert(run("place_order", { customer_name: "A" }).error, "checkout blocks sold-out line");
  run("remove_from_cart", { line: 2 });

  // order + event
  let emitted = null;
  tools.bus.once("order", (o) => (emitted = o));
  r = run("place_order", { customer_name: "Nikunj" });
  assert(r.ok && r.total === 440 && emitted && emitted.id === r.order_id, "order placed and event emitted");
  assert(run("view_cart", {}).empty, "cart cleared after order");
  assert(run("place_order", { customer_name: "x" }).error, "empty cart rejected");

  // server: simulator + admin (fallback LLM since no key)
  await handleIncoming(P, "Hi");
  assert(wa.takeCaptured(P)[0]?.interactive?.type === "list", "shared incoming handler is available to polling");

  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, b, h = {}) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify(b) }).then((x) => x.json());

  let out = await post("/simulate", { text: "menu" });
  const list = out.replies[0].interactive;
  assert(list.type === "list" && list.action.sections[0].rows.length === menu.items.length, "menu list sent");

  out = await post("/simulate", { id: "item:cortado" });
  assert(/Cortado/.test(out.replies[0].text.body) && /warm milk/.test(out.replies[0].text.body), "item detail via fallback");

  assert((await fetch(base + "/api/orders")).status === 401, "admin needs key");
  const orders = await fetch(base + "/api/orders?key=k").then((x) => x.json());
  assert(orders.length === 1 && orders[0].name === "Nikunj" && orders[0].items[0].unit_price === 220, "order visible to admin");
  const adminPage = await fetch(base + "/admin");
  assert(adminPage.status === 200 && (await adminPage.text()).includes("Orders"), "admin dashboard served");

  const patch = await fetch(base + `/api/orders/${orders[0].id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-key": "k" }, body: JSON.stringify({ status: "ready" }) });
  assert(patch.status === 200, "status update");
  assert((await fetch(base + `/api/orders/${orders[0].id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-key": "k" }, body: JSON.stringify({ status: "bogus" }) })).status === 400, "bad status rejected");

  // webhook verify handshake
  process.env.VERIFY_TOKEN = "vt";
  assert((await fetch(base + "/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=123").then((x) => x.text())) === "123", "webhook verify ok");
  assert((await fetch(base + "/webhook?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=123")).status === 403, "webhook verify rejects bad token");
  assert((await fetch(base + "/twilio", { method: "POST" })).status === 404, "Twilio webhook removed");

  server.close();
  console.log("ALL TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error("TEST FAILED:", e.message);
  process.exit(1);
});
