BEGIN;

CREATE OR REPLACE FUNCTION public.settle_webpay_order_payment(
  p_order_id uuid,
  p_ticket_id uuid,
  p_buy_order text,
  p_webpay_token text,
  p_authorization_code text,
  p_payment_type_code text,
  p_card_last4 text,
  p_installments_number integer,
  p_paid_at timestamptz,
  p_payment_payload jsonb,
  p_amount_clp integer,
  p_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_order.ticket_id IS DISTINCT FROM p_ticket_id THEN
    RAISE EXCEPTION 'ORDER_TICKET_MISMATCH';
  END IF;

  IF coalesce(v_order.buy_order, '') <> coalesce(p_buy_order, '') THEN
    RAISE EXCEPTION 'BUY_ORDER_MISMATCH';
  END IF;

  IF p_session_id IS NOT NULL
     AND coalesce(v_order.session_id, '') <> ''
     AND v_order.session_id IS DISTINCT FROM p_session_id THEN
    RAISE EXCEPTION 'SESSION_ID_MISMATCH';
  END IF;

  SELECT *
  INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  IF coalesce(v_order.status, '') = 'paid' THEN
    RETURN jsonb_build_object(
      'applied', false,
      'already_paid', true,
      'order_id', v_order.id,
      'ticket_id', v_ticket.id
    );
  END IF;

  IF coalesce(v_order.status, '') = 'canceled' THEN
    RAISE EXCEPTION 'ORDER_CANCELED';
  END IF;

  UPDATE public.orders
  SET
    status = 'paid',
    payment_state = 'AUTHORIZED',
    webpay_token = p_webpay_token,
    webpay_authorization_code = p_authorization_code,
    webpay_payment_type_code = p_payment_type_code,
    webpay_card_last4 = p_card_last4,
    webpay_installments_number = p_installments_number,
    payment_payload = coalesce(p_payment_payload, '{}'::jsonb),
    total_paid_clp = p_amount_clp,
    paid_at = coalesce(p_paid_at, now()),
    updated_at = now()
  WHERE id = v_order.id;

  UPDATE public.tickets
  SET
    status = 'sold'
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'applied', true,
    'already_paid', false,
    'order_id', v_order.id,
    'ticket_id', v_ticket.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_webpay_order_payment(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  timestamptz,
  jsonb,
  integer,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.settle_webpay_order_payment(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  timestamptz,
  jsonb,
  integer,
  text
) FROM anon;

REVOKE ALL ON FUNCTION public.settle_webpay_order_payment(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  timestamptz,
  jsonb,
  integer,
  text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.settle_webpay_order_payment(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  timestamptz,
  jsonb,
  integer,
  text
) TO service_role;

COMMIT;
