const crypto = require("crypto");

const GRAPH = "https://graph.facebook.com/v21.0";
const LIVE = Boolean(process.env.WA_TOKEN && process.env.PHONE_ID);
const captured = new Map();

async function send(to, payload) {
  const body = { messaging_product: "whatsapp", to, ...payload };
  if (!LIVE) {
    if (!captured.has(to)) captured.set(to, []);
    captured.get(to).push(payload);
    console.log(`[dry-run -> ${to}]`, JSON.stringify(payload));
    return;
  }

  const res = await fetch(`${GRAPH}/${process.env.PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("WhatsApp send failed", res.status, await res.text());
}

const sendText = (to, text) => send(to, { type: "text", text: { body: text.slice(0, 4000) } });

const sendList = (to, { body, button, title, rows }) =>
  send(to, {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: button.slice(0, 20),
        sections: [
          {
            title: title.slice(0, 24),
            rows: rows.slice(0, 10).map((row) => ({
              id: row.id,
              title: row.title.slice(0, 24),
              description: (row.description || "").slice(0, 72),
            })),
          },
        ],
      },
    },
  });

const sendButtons = (to, { body, buttons }) =>
  send(to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((button) => ({
          type: "reply",
          reply: { id: button.id, title: button.title.slice(0, 20) },
        })),
      },
    },
  });

function markRead(messageId) {
  if (!LIVE) return;
  return fetch(`${GRAPH}/${process.env.PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  }).catch((error) => console.error("WhatsApp mark-read failed", error));
}

function validSignature(req) {
  const secret = process.env.APP_SECRET;
  if (!secret) return true;

  const header = req.get("x-hub-signature-256") || "";
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody || "").digest("hex");
  const actualBuffer = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function takeCaptured(to) {
  const out = captured.get(to) || [];
  captured.delete(to);
  return out;
}

module.exports = { LIVE, sendText, sendList, sendButtons, markRead, validSignature, takeCaptured };
