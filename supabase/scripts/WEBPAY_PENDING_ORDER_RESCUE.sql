-- WEBPAY_PENDING_ORDER_RESCUE.sql
-- Uso:
-- 1) Reemplaza ORDER_UUID por la orden real.
-- 2) Corre primero los bloques de diagnostico.
-- 3) Solo si confirmas que Webpay aprobo el cobro, usa el bloque de rescate RPC.

-- =========================================================
-- 1) Diagnostico basico de la orden
-- =========================================================
select
  o.id,
  o.ticket_id,
  o.buy_order,
  o.session_id,
  o.status,
  o.payment_state,
  o.amount_clp,
  o.total_clp,
  o.total_amount,
  o.total_paid_clp,
  o.webpay_token,
  o.webpay_authorization_code,
  o.webpay_payment_type_code,
  o.webpay_card_last4,
  o.payment_payload,
  o.created_at,
  o.paid_at
from orders o
where o.id = 'ORDER_UUID';

-- =========================================================
-- 2) Confirmar ticket asociado
-- =========================================================
select
  t.id,
  t.seller_id,
  t.status,
  t.ticket_upload_id,
  t.upload_bucket,
  t.upload_path,
  t.storage_bucket,
  t.storage_path
from tickets t
where t.id = (
  select o.ticket_id
  from orders o
  where o.id = 'ORDER_UUID'
);

-- =========================================================
-- 3) Confirmar que la RPC productiva exista
-- =========================================================
select
  p.proname
from pg_proc p
where p.proname = 'settle_webpay_order_payment';

-- =========================================================
-- 4) Rescate manual
-- Ejecutar solo si el pago SI fue aprobado por Webpay
-- =========================================================
select public.settle_webpay_order_payment(
  p_order_id := o.id,
  p_ticket_id := o.ticket_id,
  p_buy_order := o.buy_order,
  p_webpay_token := o.webpay_token,
  p_authorization_code := o.webpay_authorization_code,
  p_payment_type_code := o.webpay_payment_type_code,
  p_card_last4 := o.webpay_card_last4,
  p_installments_number := o.webpay_installments_number,
  p_paid_at := coalesce(o.paid_at, now()),
  p_payment_payload := coalesce(o.payment_payload, '{}'::jsonb),
  p_amount_clp := coalesce(
    o.total_paid_clp,
    o.total_clp::integer,
    o.total_amount::integer,
    o.amount_clp
  ),
  p_session_id := o.session_id
)
from orders o
where o.id = 'ORDER_UUID';

-- =========================================================
-- 5) Verificacion post-rescate
-- =========================================================
select
  o.id,
  o.status,
  o.payment_state,
  o.paid_at,
  o.total_paid_clp
from orders o
where o.id = 'ORDER_UUID';

select
  t.id,
  t.status
from tickets t
where t.id = (
  select o.ticket_id
  from orders o
  where o.id = 'ORDER_UUID'
);
