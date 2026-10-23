const express = require("express");
const menu = require("../src/menu");
const wa = require("../src/whatsapp");
const llm = require("../src/llm");
const tools = require("../src/tools");

const router = express.Router();
const GREETINGS = new Set(["hi", "hii", "hello", "hey", "menu", "start", "/start"]);
const seen = new Set();

async function sendMenu(to) {
  await wa.sendList(to, {
    body: `Welcome to ${menu.shop.name}! Pick a drink to see ingredients and details, or just type what you want, e.g. "2 oat milk lattes".`,
    button: "View menu",
    title: "Drinks",
    rows: menu.items.map((i) => ({
      id: `item:${i.id}`,
      title: i.name,
      description: `${menu.priceRange(i)} | ${menu.isAvailable(i.id) ? i.taste : "Sold out"}`,
    })),
  });
}

function extractText(msg) {
  if (!msg || typeof msg !== "object") return null;
  if (msg.type === "text") return typeof msg.text?.body === "string" ? msg.text.body : null;
  if (msg.type === "interactive") {
    const id = msg.interactive?.list_reply?.id || msg.interactive?.button_reply?.id || "";
    if (id.startsWith("item:")) {
      const item = menu.findItem(id.slice(5));
      if (item) return `Tell me about the ${item.name}: ingredients, taste, caffeine, calories and sizes. Then ask if I want to order it.`;
    }
    if (id === "confirm_order") return "Yes, place my order.";
    if (id === "cancel_order") return "No, clear my cart.";
    return msg.interactive?.list_reply?.title || msg.interactive?.button_reply?.title || null;
  }
  return null;
}

async function handleIncoming(from, text) {
  try {
    if (typeof from !== "string" || !from.trim() || typeof text !== "string") {
      throw new TypeError("Incoming WhatsApp message must include a sender and text");
    }

    const t = text.trim().toLowerCase();
    if (GREETINGS.has(t)) return await sendMenu(from);

    const answer = await llm.reply(from, text);
    await wa.sendText(from, answer);
    const cart = tools.getCart(from);
    if (cart.length && /confirm|place (the|your|my)? ?order|shall i/i.test(answer)) {
      await wa.sendButtons(from, {
        body: "Ready to order?",
        buttons: [
          { id: "confirm_order", title: "Place order" },
          { id: "cancel_order", title: "Clear cart" },
        ],
      });
    }
  } catch (e) {
    console.error("handleIncoming error", e);
    if (typeof from !== "string" || !from.trim()) return;
    try {
      await wa.sendText(from, "Sorry, something went wrong on my side. Please try again in a moment.");
    } catch (sendError) {
      console.error("Failed to send handleIncoming error reply", sendError);
    }
  }
}

tools.bus.on("order", (order) => {
  const lines = order.items.map((l) => `${l.qty}x ${l.name} (${l.size}, ${l.temp}, ${l.milk} milk)`).join("\n");
  console.log(`New order #${order.id} total ${order.total}`);
  if (process.env.STAFF_PHONE) {
    wa.sendText(process.env.STAFF_PHONE, `New order #${order.id}${order.name ? " for " + order.name : ""}\n${lines}\nTotal: ${menu.shop.currency}${order.total}`).catch(() => {});
  }
});

router.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

router.post("/webhook", (req, res) => {
  if (!wa.validSignature(req)) return res.sendStatus(401);
  res.sendStatus(200);

  const value = req.body?.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (!msg || seen.has(msg.id)) return;
  seen.add(msg.id);
  if (seen.size > 5000) seen.clear();

  wa.markRead(msg.id);
  const text = extractText(msg);
  if (!text) {
    return wa.sendText(msg.from, "I can only read text messages for now. Type 'menu' to see our drinks.");
  }
  handleIncoming(msg.from, text).catch((e) => console.error("Unhandled WhatsApp message error", e));
});
if (!wa.LIVE) {
  router.post("/simulate", async (req, res) => {
    const { from = "919999999999", text, id } = req.body || {};
    const msg = id
      ? { type: "interactive", interactive: { list_reply: { id } } }
      : { type: "text", text: { body: String(text || "") } };
    const incomingText = extractText(msg);
    if (!incomingText) return res.json({ replies: [] });
    await handleIncoming(from, incomingText);
    res.json({ replies: wa.takeCaptured(from) });
  });
}

module.exports = { router, handleIncoming };
