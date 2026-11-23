SYSTEM REQUIREMENT: Node.js 20+; no npm dependencies required for the supplied files.
1. Open terminal A: cd INPUT_FILES/STARTER && node ../MOCK_RECEIVER/receiver.js
2. Open terminal B: cd INPUT_FILES/STARTER && cp .env.example .env (Windows: copy .env.example .env), then edit .env.
3. Terminal B: node src/listener.js
4. In terminal C: cd INPUT_FILES/STARTER; run node ../TESTS/verify_inputs.js.
5. After implementing src/integration.js, use TEST_WEBHOOK_SECRET matching STRIPE_WEBHOOK_SECRET and run node ../TESTS/send_signed_fixture.js.
6. Optional actual Stripe CLI verification: stripe login; stripe listen --forward-to localhost:4242/webhooks/stripe; copy printed whsec_... into .env; stripe trigger checkout.session.completed.
Use distinct endpoint secrets for actual Stripe CLI and local fixture runs. Never commit .env.
Source docs: https://docs.stripe.com/webhooks and https://docs.stripe.com/stripe-cli
