# Bulk Messages (admin)

Admin builds a WhatsApp message template step by step, gets Meta to approve it, and sends it to registered sellers in bulk. Built 25 Oct 2026. Related: [WHATSAPP_LISTING.md](WHATSAPP_LISTING.md) (the seller chat bot that shares the same WhatsApp number).

## 1. What it does

| Part | What the admin does |
|---|---|
| **Templates** | A four-step wizard (basics, message, examples, review) writes a template and submits it to Meta. Status shows as Draft, Pending, Approved, Rejected (with Meta's reason), Paused or Disabled. Only Approved templates can be sent. |
| **Campaigns** | A five-step wizard (template, audience, variables, test, review) freezes a list of sellers and sends the template to them. The campaign page shows progress, delivery counts, every seller's status and error, and lets admin pause, resume, cancel and download a CSV report. |
| **Replies** | A seller's answer to a bulk message is kept for admin to read for 90 days. The sidebar badge counts unread replies. |

Where: admin sidebar, Operations, **Bulk Messages** (`/admin/bulk-messages`). SUPER_ADMIN only.

## 2. Who can receive a message

Only **registered sellers** with a **verified WhatsApp number** (the one linked in Settings, WhatsApp listing). No other number is ever messaged, in any mode.

| Mode | Who it picks |
|---|---|
| All sellers | Every registered seller. Those without a linked number are skipped. |
| Filter | Seller type, "has listed a product by WhatsApp", name search. |
| Pick sellers | Tick sellers from the linked-seller list. |
| CSV | A file whose key column holds a WhatsApp number, registered phone or email. Each row is matched to a registered seller; unmatched rows are reported and never messaged. A bare 10-digit number is read as an Indian +91 number. Other columns can fill template variables. Up to 5,000 rows. |

Always skipped, and counted in the preview: sellers who have not linked WhatsApp, sellers who opted out, suspended accounts, CSV rows that match nobody, repeated rows.

## 3. Templates

- Name: lowercase letters, digits, underscores. Category: **Utility** (updates about something the seller already does with us) or **Marketing** (announcements, offers; costs more, can be muted). Language: en, hi, en_GB, en_US.
- Body up to 1024 characters, header and footer up to 60, up to 3 static buttons (quick reply, https link, phone number).
- Variables are `{{1}}`, `{{2}}` ... without gaps; the body cannot start or end with one and two cannot sit together; the header cannot have any. Each needs an example for Meta's review. The wizard and the server both check these rules.
- A submitted template cannot be edited (Meta's rule); make a new one. A template used by a campaign cannot be deleted.
- Status comes back by webhook (`message_template_status_update`) and the **Refresh status** button.
- v1 limits: text templates only (no image/video header), no buttons with a variable link.

## 4. Sending

1. **Create campaign** checks the template is Approved, that every `{{n}}` has a value (seller contact name, seller business name, fixed text, or a CSV column), resolves the audience and **freezes it** as one row per seller. Draft.
2. **Send now** (after a confirm dialog) sets it Running.
3. A sender inside the API process sends about 5 messages a second (`BULK_SEND_PER_SECOND`). It only uses the template message API (never plain text, which Meta drops outside 24 hours).
4. State lives in the database, so a restart or deploy resumes where it stopped. A Redis lock keeps two instances from sending at once.
5. A rate limit or Meta outage puts the seller back in the queue and pauses all sending for a minute (up to 3 tries per seller). Any other refusal marks that seller Failed with Meta's code and reason and carries on.
6. A seller who replied *unsubscribe* after the audience was frozen is not messaged.
7. When nothing is left, the campaign is Completed. Cancel marks everyone not yet sent as Failed ("Campaign cancelled").

Delivery receipts (sent, delivered, read, failed) arrive by webhook and update each seller; they only move forward. Counts on the campaign page come from these rows.

## 5. When a seller replies

Same WhatsApp number as the listing bot, so replies are routed in this order:

1. Not a registered, linked seller: unchanged (one "link your number" reply a day).
2. **An open listing wins.** A seller in the middle of listing a product is treated as typing the product; a broadcast never interrupts or starts a listing.
3. Real commands keep working: `list`, `help`, `add`, `stock`, `out of stock`, `resubmit`. So a seller can manage products straight after a broadcast.
4. **Anything else** (plain text such as "Thanks", a tapped quick-reply button) within 24 hours of a bulk message is saved under Replies, with one short acknowledgement per campaign and no AI call. After 24 hours, or if no bulk message was sent, the old "did not understand" reply applies.
5. Photos with no open listing still start a listing.

**Opting out.** `unsubscribe`, `opt out`, `stop messages`, `stop updates`, `stop all` always switch bulk messages off (even mid-listing). A plain `stop` right after a bulk message does the same; during a listing `stop` still cancels the listing. `subscribe` switches them back on. Opted-out sellers are skipped by every later campaign.

## 6. Setup

1. Meta app: copy the **WhatsApp Business Account ID** (WhatsApp, API Setup) into `META_WABA_ID` (Render and `backend/.env`).
2. The access token must include **whatsapp_business_management** (templates) as well as messaging. A system-user permanent token is recommended; the 24-hour test token works for trying.
3. Meta app webhook (WhatsApp, Configuration): subscribe to `messages` **and** `message_template_status_update`.
4. Real sending needs the production WhatsApp number. The free test number only reaches up to 5 verified recipients.
5. Optional: `BULK_SEND_PER_SECOND` (default 5), `BULK_MAX_RECIPIENTS` (default 5000).

Without `META_WABA_ID` the wizard still works but **Submit to Meta** answers "Meta template access is not set up".

## 7. API (all `SUPER_ADMIN`, base `/api/v1/admin/bulk-messages`)

`GET /summary` (unread replies) · `GET|POST /templates`, `GET|PUT|DELETE /templates/:id`, `POST /templates/:id/submit`, `POST /templates/:id/refresh` · `POST /audience/preview` · `POST /test-send` · `GET|POST /campaigns`, `GET /campaigns/:id`, `GET /campaigns/:id/recipients`, `GET /campaigns/:id/export`, `POST /campaigns/:id/start|pause|resume|cancel` · `GET /replies`, `POST /replies/:id/read`, `POST /replies/read-all`.

## 8. Data

`bulk_templates`, `bulk_campaigns`, `bulk_recipients` (frozen audience and send log; unique per campaign and seller; message id indexed for receipts), `bulk_replies` (deleted after 90 days), and `seller_profiles.whatsappOptedOutAt`. Audit log entries (ids and counts only, never message text or numbers): `BULK_TEMPLATE_SUBMITTED`, `BULK_CAMPAIGN_STARTED`, `_PAUSED`, `_RESUMED`, `_CANCELLED`, `_EXPORTED`.

## 9. Troubleshooting

| What admin sees | Cause and fix |
|---|---|
| "Meta template access is not set up" | `META_WABA_ID` or the token's `whatsapp_business_management` permission is missing (section 6). |
| Template stays Pending | Meta is reviewing (minutes to a day). Press Refresh status. If webhook events are not arriving, subscribe to `message_template_status_update`. |
| Template Rejected | The reason from Meta is shown. Make a new template with changed wording (marketing wording in a Utility template is a common cause). |
| Seller Failed, code 131049 | Meta did not deliver a marketing message to protect the seller from too many marketing messages. Not retried. |
| Seller Failed, code 131026 | The number is not on WhatsApp or cannot receive the message. |
| Seller Failed, code 131030 | Test number only: the seller is not on the test recipient list. |
| Seller Failed, code 132001 | The template name or language is not approved on this WhatsApp account. |
| Campaign stuck at Running, nothing sending | Meta rate limit pause (one minute) or Redis unreachable (the sender needs it for its lock). Check the logs for `[bulk]`. |
| Everyone shows Sent but never Delivered | The Meta webhook is not reaching the API; check the webhook URL and App Secret (see WHATSAPP_LISTING.md). |

## 10. Not built yet

Scheduling a campaign for later; images or video in a template header and links with a variable; replying to a seller from the portal (free text works only inside 24 hours); email as a second channel; a history of who was sent what beyond the campaign records.
