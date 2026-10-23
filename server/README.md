# Brew Corner WhatsApp bot

Coffee shop bot on Meta's WhatsApp Cloud API. Answers menu questions from `menu.json`, takes orders via an LLM, stores carts/orders in SQLite, and has a staff dashboard at `/admin`.

## Run locally (no Meta account needed)

```bash
npm install
cp .env.example .env      # set ANTHROPIC_API_KEY and ADMIN_KEY at minimum
npm test                  # offline tests, no keys needed
npm start
```

Without `WA_TOKEN`/`PHONE_ID` the bot runs in dry-run mode: outgoing messages print to the console and `POST /simulate` lets you chat with it.

```bash
curl -s localhost:3000/simulate -H 'Content-Type: application/json' -d '{"text":"menu"}'
curl -s localhost:3000/simulate -H 'Content-Type: application/json' -d '{"id":"item:latte"}'
curl -s localhost:3000/simulate -H 'Content-Type: application/json' -d '{"text":"what is the difference between a latte and a flat white?"}'
curl -s localhost:3000/simulate -H 'Content-Type: application/json' -d '{"text":"2 oat milk iced lattes in medium please"}'
curl -s localhost:3000/simulate -H 'Content-Type: application/json' -d '{"text":"yes place it, name is Nikunj"}'
```

Open `http://localhost:3000/admin?key=<ADMIN_KEY>` to see orders. Changing an order to preparing/ready/cancelled messages the customer on WhatsApp.

## Connect real WhatsApp

1. In Meta for Developers, create a Business app and add the WhatsApp product.
2. In WhatsApp > API Setup, put the Phone Number ID in `PHONE_ID` and a Cloud API access token in `WA_TOKEN`.
3. In App settings > Basic, put the App Secret in `APP_SECRET` to enable webhook signature checks.
4. Expose your server: `npx ngrok http 3000` or `cloudflared tunnel --url http://localhost:3000`.
5. In WhatsApp > Configuration > Webhook, set callback URL to `https://<tunnel>/webhook`, use the same random value for `VERIFY_TOKEN` in Meta and `.env`, and subscribe to `messages`.
6. Set `ADMIN_KEY`, `DB_PATH`, and an LLM provider key as required, then start the server.
7. Message the WhatsApp test number to verify the integration.

## How it works

| File | Job |
|---|---|
| `menu.json` | Menu, ingredients, prices, shop info. Edit this to change the menu. |
| `src/llm.js` | System prompt + Claude tool-calling loop + chat history per phone number |
| `src/tools.js` | add_to_cart, view_cart, remove_from_cart, clear_cart, place_order with validation |
| `src/whatsapp.js` | Meta Cloud API send text/list/buttons, signature check, dry-run capture |
| `server.js` | Express app, staff dashboard API, and health check |
| `routes/whatsapp.js` | Meta webhook, message handling, order notifications, and local simulator |
| `public/admin.html` | Staff dashboard |

The LLM never sets prices. Prices, sizes and milk surcharges are computed in `tools.js` from `menu.json`, and sold-out items are blocked in code at add and at checkout.

## Deploy

Render/Railway/any VPS: `npm install && npm start`, set the env vars, put a persistent disk at `DB_PATH` (SQLite file), then update the webhook URL in Meta.
