import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_TOLERANCE = 300;
const processedEvents = new Set();

export async function verifyAndParseEvent(rawBody, stripeSignature, webhookSecret) {
  if (!stripeSignature || !webhookSecret) {
    const err = new Error('Missing signature or webhook secret');
    err.statusCode = 400;
    throw err;
  }

  const parts = Object.fromEntries(
    stripeSignature.split(',').map(p => {
      const [k, ...v] = p.split('=');
      return [k, v.join('=')];
    })
  );

  if (!parts.t || !parts.v1) {
    const err = new Error('Invalid signature format');
    err.statusCode = 400;
    throw err;
  }

  const timestamp = Number(parts.t);
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > SIGNATURE_TOLERANCE) {
    const err = new Error('Signature timestamp outside tolerance');
    err.statusCode = 400;
    throw err;
  }

  const expected = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(parts.v1, 'utf8');

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    const err = new Error('Invalid signature');
    err.statusCode = 400;
    throw err;
  }

  return JSON.parse(rawBody.toString('utf8'));
}

export function mapPaymentEvent(event) {
  const session = event.data.object;
  return {
    event_id: event.id,
    event_type: event.type,
    transaction_id: session.id,
    payment_intent: session.payment_intent ?? null,
    customer_email: session.customer_details?.email ?? null,
    amount_total: session.amount_total,
    currency: session.currency,
    payment_status: session.payment_status,
    occurred_at: new Date(event.created * 1000).toISOString(),
  };
}

export async function forwardEvent(mapped, endpointUrl, timeoutMs) {
  if (processedEvents.has(mapped.event_id)) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapped),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = new Error(`Receiver responded with ${res.status}`);
      err.statusCode = 502;
      throw err;
    }

    processedEvents.add(mapped.event_id);
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Receiver request timed out');
      err.statusCode = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
