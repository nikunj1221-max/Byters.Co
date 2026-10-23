const Anthropic = require("@anthropic-ai/sdk");
const db = require("./db");
const { shop, menuForPrompt } = require("./menu");
const tools = require("./tools");

// Provider is picked from env: GROQ_API_KEY (free) wins, else ANTHROPIC_API_KEY, else offline fallback.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = () => process.env.GROQ_MODEL || "llama-3.3-70b-versatile"; // check console.groq.com/docs/models if it errors
const ANTHROPIC_MODEL = () => process.env.MODEL || "claude-sonnet-5-5";

function provider() {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

function systemPrompt() {
  return `You are the WhatsApp assistant for ${shop.name}, a coffee shop. Open: ${shop.hours}.

What you do:
1. Answer questions about the menu: ingredients, taste, strength, caffeine, calories, allergens, sizes, prices, differences between drinks.
2. Recommend drinks. If the customer is unsure, ask one short question (taste, strength, milk, hot or iced), then suggest 1 or 2 drinks.
3. Take orders using the tools: add_to_cart, view_cart, remove_from_cart, clear_cart, place_order.

Rules:
- Use ONLY the menu data below. Never invent ingredients, prices, calories or allergens. If something is not in the data, say you are not sure and suggest asking the staff.
- Allergy questions: state only what the menu lists, then add "Please confirm with staff for severe allergies."
- Milk alternatives (oat, soy) cost extra as listed in shop.milk_alternatives and only apply to milk-based drinks.
- Never add something to the cart unless the customer clearly asked for it. If size or hot/iced is missing, ask.
- Before place_order: show the cart with total, ask for pickup name if unknown, and get an explicit yes. Payment is at the counter.
- If a drink is marked available:false, say it is sold out and suggest a similar one.
- You cannot take payments, deliver, or handle complaints. Point those to the staff.
- Stay on topic (the coffee shop). Politely decline unrelated requests.
- Style: WhatsApp chat. Short (under 80 words unless comparing drinks), friendly, plain text. You may use *bold* with single asterisks. No markdown headers or tables. Use ${shop.currency} for prices.

SHOP AND MENU DATA (live):
${JSON.stringify({ shop, items: menuForPrompt() })}`;
}

function recentHistory(phone, limit = 10) {
  const rows = db
    .prepare("SELECT role, content FROM messages WHERE phone = ? ORDER BY id DESC LIMIT ?")
    .all(phone, limit)
    .reverse();
  while (rows.length && rows[0].role !== "user") rows.shift(); // must start with a user turn
  return rows;
}

function saveTurn(phone, role, content) {
  db.prepare("INSERT INTO messages(phone, role, content) VALUES (?, ?, ?)").run(phone, role, content);
}

// Tiny offline fallback so the bot still answers when no API key is set
function fallbackReply(text) {
  const { items } = require("./menu");
  const t = text.toLowerCase();
  const hit = items.find((i) => t.includes(i.name.toLowerCase()) || t.includes(i.id));
  if (hit) {
    return `*${hit.name}*\nIngredients: ${hit.ingredients.join(", ")}\nTaste: ${hit.taste}\nCaffeine: ${hit.caffeine_mg} mg | Calories: ${hit.calories}\nAllergens: ${hit.allergens.join(", ") || "none listed"}\nServed: ${hit.served.join(" or ")}`;
  }
  return "AI replies are offline (no GROQ_API_KEY or ANTHROPIC_API_KEY set). Send 'menu' to browse drinks.";
}

// ---------------- Groq (OpenAI-compatible) ----------------

const groqTools = () =>
  tools.definitions.map((d) => ({
    type: "function",
    function: { name: d.name, description: d.description, parameters: d.input_schema },
  }));

async function groqCall(messages, attempt = 0) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL(),
      messages,
      tools: groqTools(),
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 600,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    // Llama sometimes emits a malformed tool call (400 tool_use_failed). One retry usually fixes it.
    if (res.status === 400 && attempt < 1) return groqCall(messages, attempt + 1);
    throw new Error(`Groq ${res.status}: ${body}`);
  }
  return (await res.json()).choices[0].message;
}

async function replyGroq(phone, userText) {
  const messages = [
    { role: "system", content: systemPrompt() },
    ...recentHistory(phone),
    { role: "user", content: userText },
  ];
  saveTurn(phone, "user", userText);

  for (let step = 0; step < 6; step++) {
    const msg = await groqCall(messages);
    if (!msg.tool_calls?.length) return (msg.content || "").trim();

    messages.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls });
    for (const call of msg.tool_calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // bad JSON from the model: let the tool report the missing fields
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(tools.run(phone, call.function.name, args)),
      });
    }
  }
  return "";
}

// ---------------- Anthropic ----------------

let anthropic = null;
async function replyAnthropic(phone, userText) {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages = [...recentHistory(phone), { role: "user", content: userText }];
  saveTurn(phone, "user", userText);

  for (let step = 0; step < 6; step++) {
    const res = await anthropic.messages.create({
      model: ANTHROPIC_MODEL(),
      max_tokens: 600,
      system: systemPrompt(),
      tools: tools.definitions,
      messages,
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (res.stop_reason !== "tool_use") return text;

    messages.push({ role: "assistant", content: res.content });
    messages.push({
      role: "user",
      content: res.content
        .filter((b) => b.type === "tool_use")
        .map((b) => ({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(tools.run(phone, b.name, b.input)) })),
    });
  }
  return "";
}

// ---------------- entry ----------------

async function reply(phone, userText) {
  const p = provider();
  if (!p) return fallbackReply(userText);

  let text = p === "groq" ? await replyGroq(phone, userText) : await replyAnthropic(phone, userText);
  if (!text) text = "Sorry, I got stuck on that. Could you say it again?";
  saveTurn(phone, "assistant", text);
  return text;
}

module.exports = { reply, provider };