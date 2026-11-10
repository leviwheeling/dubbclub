# DUBBCLUB

A Next.js store for the owner’s first stocked drop. PostgreSQL holds products, stock reservations, orders, shipping attempts, and email jobs. Stripe collects payment. The owner purchases postage through Shippo. Resend sends customer and owner notifications.

## Local preview

```sh
npm ci
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1
```

The collection preview works without credentials. To use the admin and order system, put a development PostgreSQL URL in `.env.local`, then run `npm run db:migrate`. All seeded pieces start as concepts with no price or stock. The app loads `.env.local`; the database and job commands use the same Next environment loader.

## Render preview

Use the Render Blueprint from a private Git repository. It defines a web service, PostgreSQL, and a two-minute scheduled job for email delivery and reconciliation. The generated `STORE_PREVIEW_PASSWORD` protects the web preview with username `dubbclub`. The health check and authenticated provider callbacks are outside the preview gate.

Enter shared settings from `.env.example` in the `dubbclub-provider-settings` environment group. Keep `APP_URL` set to the actual preview origin. Use separate provider test credentials and database for a preview that can place test orders. The Render blueprint contains no merchant credentials.

## Provider setup

- **Stripe.** Set the merchant test key and webhook secret. Enable cards, Apple Pay, Google Pay, Klarna, and Affirm in the store’s payment-method configuration. Stripe controls eligibility and display. Add the DUBBCLUB logo and colors in Stripe Branding using `public/wordmark.png`. Register `/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, and `refund.updated`. Keep the webhook event version aligned with the installed Stripe SDK. Configure sales tax registrations before enabling Stripe Tax. Refund from Stripe’s dashboard. Review partial refunds and adjust stock for returned goods in Inventory.
- **Shippo.** Set the test token and a ship-from address in `SHIPPO_FROM_ADDRESS_JSON`. Use keys `name`, `street1`, optional `street2`, `city`, `state`, `zip`, and `country` (`US`). Register tracking and transaction events at `/api/webhooks/shippo/<SHIPPO_WEBHOOK_SECRET>` using a secret URL-safe token. The dashboard buys one 4×6 label per order. An unknown purchase stays locked until Shippo confirms its outcome. Use the displayed attempt reference to match the transaction. Resolve cancellations or duplicate charges in Shippo’s dashboard.
- **Resend and IONOS.** Verify a sending subdomain in Resend and add its DNS records at IONOS. Keep the existing IONOS mailbox and use it as `SUPPORT_EMAIL` for replies. Set `RESEND_FROM` to a bare email address on the verified sending domain and `OWNER_EMAIL` to the owner’s private sign-in email. Set `RESEND_DROPS_SEGMENT_ID` to the segment used for Broadcasts. Signup consent is separate from checkout. The admin shows queued, accepted, or failed notification attempts. Delivery and bounce details are available in Resend.
- **Launch settings.** Check regional Shippo rates for the actual packed garments and set `FLAT_SHIPPING_CENTS`. Enter the approved shipping, return, and privacy copy in the matching settings. In `/admin/catalog`, add measurements, correct images, release dates in UTC, variant prices and on-hand quantities, and approve each item that is ready to sell.

## Verification and launch

```sh
npm run check
npm run build
TEST_DATABASE_URL=postgresql://.../dubbclub_test npm test
```

The test suite uses a separate PostgreSQL database named `dubbclub_test` and uses a temporary schema inside it. It intercepts shipping API calls locally. The storefront and admin can also run against local PostgreSQL with test credentials. Complete the hosted pilot with the owner’s connected accounts and verify Stripe wallet and installment eligibility with an appropriate cart, label printing, the first carrier scan, and Resend delivery. Connect the IONOS domain to Render and verify DNS and HTTPS. Set the production settings and switch `STORE_PUBLIC` and `STORE_CHECKOUT_ENABLED` to `true` after the pilot. Keep the preview database and provider keys separate from production.

[ImageGen prompt set](IMAGE-PROMPTS.md)
