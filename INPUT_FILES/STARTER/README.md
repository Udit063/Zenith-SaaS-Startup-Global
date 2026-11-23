# Zenith SaaS — Stripe Webhook Integration

Secure Node.js webhook listener that captures `checkout.session.completed` events from Stripe, verifies their signatures, maps them to an internal 9-field JSON schema, and forwards them to a local receiver endpoint.

## Requirements

- Node.js 20+
- No external npm packages needed

## Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `WEBHOOK_PORT` | `4242` | Port for the webhook listener |
| `RECEIVER_URL` | `http://127.0.0.1:4545/internal/events` | Internal receiver endpoint |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe endpoint signing secret (`whsec_...`) |
| `FORWARD_TIMEOUT_MS` | `3000` | HTTP timeout for forwarding requests (ms) |

## Setup & Run

```bash
cd INPUT_FILES/STARTER
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
```

Set `STRIPE_WEBHOOK_SECRET=whsec_local_fixture_only` in `.env` for local fixture testing.

**Terminal 1 — Start the mock receiver:**
```bash
node ../MOCK_RECEIVER/receiver.js
```

**Terminal 2 — Start the webhook listener:**
```bash
node src/listener.js
```

## Testing

### Pre-flight: Verify input files are intact
```bash
node ../TESTS/verify_inputs.js
```

### Local Fixture Test
```bash
node ../TESTS/send_signed_fixture.js
```
Expected: `HTTP 200` with `{"received":true}`.

### Edge Case Tests

**Invalid signature:**
```bash
node -e "fetch('http://127.0.0.1:4242/webhooks/stripe',{method:'POST',headers:{'content-type':'application/json','stripe-signature':'t=0,v1=bad'},body:'{}'}).then(r=>r.text().then(t=>console.log(r.status,t)))"
```
Expected: `400`

**Missing signature header:**
```bash
node -e "fetch('http://127.0.0.1:4242/webhooks/stripe',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(r=>r.text().then(t=>console.log(r.status,t)))"
```
Expected: `400`

**Duplicate event (run fixture twice):**
```bash
node ../TESTS/send_signed_fixture.js
node ../TESTS/send_signed_fixture.js
```
First returns `200`, second also returns `200` but receiver logs show only one delivery.

### Stripe CLI Test (Optional)

Requires authorized Stripe test-account access:

```bash
stripe login
stripe listen --forward-to localhost:4242/webhooks/stripe
```

Copy the printed `whsec_...` secret into your `.env` as `STRIPE_WEBHOOK_SECRET`, restart the listener, then:

```bash
stripe trigger checkout.session.completed
```

> Use a different `STRIPE_WEBHOOK_SECRET` value for Stripe CLI vs local fixture tests.

## Signature Security

Every incoming request must include a valid `stripe-signature` header containing a timestamp (`t`) and HMAC-SHA256 digest (`v1`). The listener:

1. Rejects requests with missing or malformed signature headers (HTTP 400)
2. Computes HMAC-SHA256 over `{timestamp}.{raw_body}` using the endpoint secret
3. Uses timing-safe comparison to prevent timing attacks
4. Rejects signatures older than 5 minutes to prevent replay attacks
5. Only parses the JSON body after successful verification

## Schema Mapping

| # | Internal Field | Stripe Source Path | Type | Notes |
|---|---|---|---|---|
| 1 | `event_id` | `event.id` | `string` | Required |
| 2 | `event_type` | `event.type` | `const` | Always `checkout.session.completed` |
| 3 | `transaction_id` | `event.data.object.id` | `string` | Checkout session ID |
| 4 | `payment_intent` | `event.data.object.payment_intent` | `string \| null` | Nullable |
| 5 | `customer_email` | `event.data.object.customer_details.email` | `string \| null` | Nullable (parent may be null) |
| 6 | `amount_total` | `event.data.object.amount_total` | `integer` | Smallest currency unit (paise for INR) |
| 7 | `currency` | `event.data.object.currency` | `string` | Lowercase |
| 8 | `payment_status` | `event.data.object.payment_status` | `string` | Required |
| 9 | `occurred_at` | `event.created` | `string` | Unix timestamp → ISO 8601 UTC |

## Idempotency Policy

The listener maintains an in-memory Set of processed `event_id` values. If Stripe retries delivery of an event that was already forwarded successfully, the duplicate is silently skipped — the receiver never sees it twice. This Set resets on server restart, which is acceptable for the local integration scope.

## Error Handling

| Scenario | HTTP Status | Behavior |
|---|---|---|
| Invalid/missing signature | `400` | Request rejected before parsing |
| Non-checkout event | `200` | Acknowledged but ignored |
| Receiver returns non-2xx | `502` | Error returned to caller |
| Receiver timeout | `504` | Timeout error after configured ms |
| Payload > 1MB | `413` | Request rejected |
