# DB Map

Basado en usos de `.from(...)`, `.rpc(...)` y `storage.from(...)` y en `src/types/database.types.ts`.

## Tables

### event_requests
- `app/api/support/sell-request/route.js` — API route `/api/support/sell-request` (insert/select).

### events
- Campos nuevos: nomination_enabled_at, renomination_cutoff_hours, renomination_max_changes (renominacion).
- `app/admin/events/page.jsx` — Page `/admin/events` (insert/select/update).
- `app/admin/page.jsx` — Page `/admin` (delete/select).
- `app/api/checkout/preview/route.js` — API route `/api/checkout/preview` (select).
- `app/api/events/[id]/route.js` — API route `/api/events/[id]` (select).
- `app/api/events/route.js` — API route `/api/events` (select).
- `app/api/orders/[orderId]/route.js` — API route `/api/orders/[orderId]` (select).
- `app/api/orders/my/route.js` — API route `/api/orders/my` (select).
- `app/api/payments/webpay/preview/route.js` — API route `/api/payments/webpay/preview` (select).
- `app/api/tickets/my-publications/route.js` — API route `/api/tickets/my-publications` (select).
- `app/events/[id]/page.tsx` — Page `/events/[id]` (select).
- `app/page.js` — Page `/` (select).
- `app/sell/confirm/page.jsx` — Page `/sell/confirm` (select).
- `app/sell/page.jsx` — Page `/sell` (select).

### order_messages
- `app/api/orders/[orderId]/messages/route.js` — API route `/api/orders/[orderId]/messages` (insert/select).

### orders
- `app/api/cron/release-stale-holds/route.js` — API route `/api/cron/release-stale-holds` (select/update).
- `app/api/orders/[orderId]/messages/route.js` — API route `/api/orders/[orderId]/messages` (select).
- `app/api/orders/[orderId]/pdf/route.js` — API route `/api/orders/[orderId]/pdf` (select).
- `app/api/orders/[orderId]/renominated/route.js` — API route `/api/orders/[orderId]/renominated` (select/update).
- `app/api/orders/[orderId]/route.js` — API route `/api/orders/[orderId]` (select).
- `app/api/orders/approve/route.js` — API route `/api/orders/approve` (select/update).
- `app/api/orders/dispute/route.js` — API route `/api/orders/dispute` (select/update).
- `app/api/orders/download/route.js` — API route `/api/orders/download` (select).
- `app/api/orders/my-sales/route.js` — API route `/api/orders/my-sales` (select).
- `app/api/orders/my/route.js` — API route `/api/orders/my` (select).
- `app/api/payments/banchile/confirm/route.js` — API route `/api/payments/banchile/confirm` (select/update).
- `app/api/payments/webpay/create-session/route.js` — API route `/api/payments/webpay/create-session` (insert/update).
- `app/api/payments/webpay/return/route.js` — API route `/api/payments/webpay/return` (select/update).
- `app/api/payouts/run/route.js` — API route `/api/payouts/run` (select/update).
- `app/api/sellers/reputation/route.js` — API route `/api/sellers/reputation` (select).
- `app/api/tickets/[id]/pdf/route.js` — API route `/api/tickets/[id]/pdf` (select).
- `app/api/tickets/my-publications/route.js` — API route `/api/tickets/my-publications` (select).
- `app/payment/webpay/result/page.jsx` — Page `/payment/webpay/result` (select).
- `lib/trustSignals.js` — Shared lib (select).

### payout_accounts
- `app/api/payouts/run/route.js` — API route `/api/payouts/run` (select).
- `app/api/wallet/save/route.js` — API route `/api/wallet/save` (select/upsert).
- `app/dashboard/WalletSection.jsx` — Component (select).
- `lib/trustSignals.js` — Shared lib (select).

### profiles
- `app/admin/events/page.jsx` — Page `/admin/events` (select).
- `app/admin/page.jsx` — Page `/admin` (select).
- `app/admin/soporte/page.jsx` — Page `/admin/soporte` (select).
- `app/admin/users/page.jsx` — Page `/admin/users` (select/update).
- `app/api/auth/check-rut/route.js` — API route `/api/auth/check-rut` (select).
- `app/api/auth/rut-login/route.js` — API route `/api/auth/rut-login` (select).
- `app/api/checkout/preview/route.js` — API route `/api/checkout/preview` (select).
- `app/api/orders/[orderId]/messages/route.js` — API route `/api/orders/[orderId]/messages` (select).
- `app/api/orders/[orderId]/renominated/route.js` — API route `/api/orders/[orderId]/renominated` (select).
- `app/api/orders/[orderId]/route.js` — API route `/api/orders/[orderId]` (select).
- `app/api/orders/my-sales/route.js` — API route `/api/orders/my-sales` (select/update).
- `app/api/orders/my/route.js` — API route `/api/orders/my` (select).
- `app/api/payments/banchile/create-session/route.js` — API route `/api/payments/banchile/create-session` (select).
- `app/api/payments/webpay/create-session/route.js` — API route `/api/payments/webpay/create-session` (select).
- `app/api/payments/webpay/preview/route.js` — API route `/api/payments/webpay/preview` (select).
- `app/api/payouts/run/route.js` — API route `/api/payouts/run` (select).
- `app/api/profile/avatar/route.js` — API route `/api/profile/avatar` (update).
- `app/api/profile/onboarding-complete/route.ts` — API route `/api/profile/onboarding-complete` (update).
- `app/api/profile/onboarding-dismiss/route.ts` — API route `/api/profile/onboarding-dismiss` (update).
- `app/api/tickets/publish/route.js` — API route `/api/tickets/publish` (select).
- `app/api/wallet/save/route.js` — API route `/api/wallet/save` (select).
- `app/auth/callback/route.ts` — Route handler `/auth/callback` (insert/select).
- `app/dashboard/WalletSection.jsx` — Component (select).
- `app/events/[id]/page.jsx` — Page `/events/[id]` (select).
- `app/events/[id]/page.tsx` — Page `/events/[id]` (select).
- `app/sell/confirm/page.jsx` — Page `/sell/confirm` (select).
- `app/sell/page.jsx` — Page `/sell` (select).
- `app/support/admin/ticket/route.js` — Route handler `/support/admin/ticket` (select).
- `app/support/admin/tickets/route.js` — Route handler `/support/admin/tickets` (select).
- `app/support/admin/update/route.js` — Route handler `/support/admin/update` (select).
- `app/support/create/route.js` — Route handler `/support/create` (select).
- `app/support/message/route.js` — Route handler `/support/message` (select).
- `app/support/upload/route.js` — Route handler `/support/upload` (select).
- `hooks/useProfile.js` — Hook (select).
- `lib/profileActions.js` — Shared lib (select/update).
- `lib/trustSignals.js` — Shared lib (select).
- `middleware.js` — Middleware (select).

### support_messages
- `app/api/support/tickets/[id]/messages/route.js` — API route `/api/support/tickets/[id]/messages` (insert/select).
- `app/api/support/tickets/[id]/route.js` — API route `/api/support/tickets/[id]` (select).
- `app/api/support/tickets/route.js` — API route `/api/support/tickets` (insert).

### support_tickets
- `app/admin/page.jsx` — Page `/admin` (select).
- `app/api/support/tickets/[id]/messages/route.js` — API route `/api/support/tickets/[id]/messages` (select/update).
- `app/api/support/tickets/[id]/route.js` — API route `/api/support/tickets/[id]` (select).
- `app/api/support/tickets/route.js` — API route `/api/support/tickets` (insert/select).
- `app/support/admin/ticket/route.js` — Route handler `/support/admin/ticket` (select).
- `app/support/admin/tickets/route.js` — Route handler `/support/admin/tickets` (select).
- `app/support/admin/update/route.js` — Route handler `/support/admin/update` (update).
- `app/support/create/route.js` — Route handler `/support/create` (insert/select).
- `app/support/message/route.js` — Route handler `/support/message` (select/update).
- `app/support/my/ticket/route.js` — Route handler `/support/my/ticket` (select).
- `app/support/my/tickets/route.js` — Route handler `/support/my/tickets` (select).
- `app/support/upload/route.js` — Route handler `/support/upload` (select).
- `lib/profileActions.js` — Shared lib (insert/select).

### ticket_files
- `app/api/tickets/check/route.js` — API route `/api/tickets/check` (select).

### ticket_uploads
- `app/api/orders/[orderId]/pdf/route.js` — API route `/api/orders/[orderId]/pdf` (select).
- `app/api/tickets/[id]/pdf/route.js` — API route `/api/tickets/[id]/pdf` (select).
- `app/api/tickets/register/route.js` — API route `/api/tickets/register` (insert/select).
- `app/tickets/register/route.js` — Route handler `/tickets/register` (insert/select).

### tickets
- `app/api/checkout/preview/route.js` — API route `/api/checkout/preview` (select).
- `app/api/cron/release-stale-holds/route.js` — API route `/api/cron/release-stale-holds` (update).
- `app/api/events/[id]/tickets/route.js` — API route `/api/events/[id]/tickets` (select).
- `app/api/orders/[orderId]/pdf/route.js` — API route `/api/orders/[orderId]/pdf` (select).
- `app/api/orders/[orderId]/route.js` — API route `/api/orders/[orderId]` (select).
- `app/api/orders/download/route.js` — API route `/api/orders/download` (select).
- `app/api/orders/my-sales/route.js` — API route `/api/orders/my-sales` (select).
- `app/api/orders/my/route.js` — API route `/api/orders/my` (select).
- `app/api/payments/banchile/confirm/route.js` — API route `/api/payments/banchile/confirm` (update).
- `app/api/payments/banchile/create-session/route.js` — API route `/api/payments/banchile/create-session` (select).
- `app/api/payments/webpay/create-session/route.js` — API route `/api/payments/webpay/create-session` (select/update).
- `app/api/payments/webpay/preview/route.js` — API route `/api/payments/webpay/preview` (select).
- `app/api/payments/webpay/return/route.js` — API route `/api/payments/webpay/return` (update).
- `app/api/sellers/reputation/route.js` — API route `/api/sellers/reputation` (select).
- `app/api/tickets/[id]/pdf/route.js` — API route `/api/tickets/[id]/pdf` (select).
- `app/api/tickets/[id]/route.js` — API route `/api/tickets/[id]` (delete/select/update).
- `app/api/tickets/listing/route.js` — API route `/api/tickets/listing` (delete/select/update).
- `app/api/tickets/my-listings/route.js` — API route `/api/tickets/my-listings` (select).
- `app/api/tickets/my-publications/route.js` — API route `/api/tickets/my-publications` (select).
- `app/api/tickets/publish/route.js` — API route `/api/tickets/publish` (insert/select).
- `app/events/[id]/page.tsx` — Page `/events/[id]` (select).
- `lib/db/ticketSchema.js` — Shared lib (select).

## Storage buckets
- `app/api/profile/avatar/route.js` — bucket `avatars`.

### Dynamic bucket usage
- `app/api/orders/[orderId]/renominated/route.js` — storage.from(bucket) (bucket name is variable in code).
- `app/api/tickets/register/route.js` — storage.from(bucket) (bucket name is variable in code).
- `app/support/upload/route.js` — storage.from(bucket) (bucket name is variable in code).
- `app/tickets/register/route.js` — storage.from(bucket) (bucket name is variable in code).

## RPC

No `.rpc(...)` usages found in the repo.
