BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper: admin check (supports user_type/role/app_role)
CREATE OR REPLACE FUNCTION public.is_admin_user(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid
      AND (
        p.user_type = 'admin'
        OR p.role = 'admin'
        OR p.app_role = 'admin'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO anon, authenticated;

-- Audit table (security events)
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  user_id uuid NULL,
  order_id uuid NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.audit_events IS 'Security/audit events emitted by backend routes.';
COMMENT ON COLUMN public.audit_events.event_type IS 'Event name, e.g. RENOMINATION_UPLOADED, RENOMINATION_VIEWED.';

CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON public.audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_order_id ON public.audit_events(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON public.audit_events(event_type);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='audit_events' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_events', r.policyname);
  END LOOP;
END$$;

CREATE POLICY audit_events_admin_select
  ON public.audit_events
  FOR SELECT
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY audit_events_owner_select
  ON public.audit_events
  FOR SELECT
  USING (user_id = auth.uid());

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END$$;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY profiles_select_admin
  ON public.profiles
  FOR SELECT
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_admin
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- PAYOUT ACCOUNTS
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='payout_accounts' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.payout_accounts', r.policyname);
  END LOOP;
END$$;

CREATE POLICY payout_accounts_owner_select
  ON public.payout_accounts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY payout_accounts_owner_insert
  ON public.payout_accounts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY payout_accounts_owner_update
  ON public.payout_accounts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY payout_accounts_admin_select
  ON public.payout_accounts
  FOR SELECT
  USING (public.is_admin_user(auth.uid()));

-- TICKETS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='tickets' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tickets', r.policyname);
  END LOOP;
END$$;

CREATE POLICY tickets_select_owner
  ON public.tickets
  FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY tickets_select_admin
  ON public.tickets
  FOR SELECT
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY tickets_insert_owner
  ON public.tickets
  FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY tickets_update_owner
  ON public.tickets
  FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY tickets_delete_owner
  ON public.tickets
  FOR DELETE
  USING (seller_id = auth.uid());

CREATE POLICY tickets_admin_all
  ON public.tickets
  FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- Public tickets view (safe fields)
DROP VIEW IF EXISTS public.tickets_public;
DROP FUNCTION IF EXISTS public.get_tickets_public();

CREATE FUNCTION public.get_tickets_public()
RETURNS TABLE (
  id uuid,
  event_id uuid,
  seller_id uuid,
  seller_name text,
  status text,
  price numeric,
  currency text,
  sector text,
  row_label text,
  seat_label text,
  section_label text,
  created_at timestamptz,
  title text,
  sale_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.event_id,
    t.seller_id,
    t.seller_name,
    t.status,
    t.price,
    t.currency,
    t.sector,
    t.row_label,
    t.seat_label,
    t.section_label,
    t.created_at,
    t.title,
    t.sale_type
  FROM public.tickets t
  WHERE t.status IN ('active', 'available');
$$;

CREATE VIEW public.tickets_public AS
  SELECT * FROM public.get_tickets_public();

GRANT EXECUTE ON FUNCTION public.get_tickets_public() TO anon, authenticated;
GRANT SELECT ON public.tickets_public TO anon, authenticated;

-- TICKET_UPLOADS
ALTER TABLE public.ticket_uploads ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ticket_uploads' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ticket_uploads', r.policyname);
  END LOOP;
END$$;

CREATE POLICY ticket_uploads_owner_select
  ON public.ticket_uploads
  FOR SELECT
  USING (user_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY ticket_uploads_owner_insert
  ON public.ticket_uploads
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY ticket_uploads_owner_update
  ON public.ticket_uploads
  FOR UPDATE
  USING (user_id = auth.uid() OR seller_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY ticket_uploads_admin_all
  ON public.ticket_uploads
  FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY ticket_uploads_buyer_select
  ON public.ticket_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.tickets t ON t.id = o.ticket_id
      WHERE o.buyer_id = auth.uid()
        AND t.ticket_upload_id = ticket_uploads.id
        AND (
          o.status IN ('paid', 'delivered', 'completed')
          OR upper(coalesce(o.payment_state, '')) = 'AUTHORIZED'
        )
    )
  );

-- TICKET_FILES
ALTER TABLE public.ticket_files ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ticket_files' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ticket_files', r.policyname);
  END LOOP;
END$$;

CREATE POLICY ticket_files_owner_select
  ON public.ticket_files
  FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY ticket_files_owner_insert
  ON public.ticket_files
  FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY ticket_files_owner_update
  ON public.ticket_files
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY ticket_files_admin_all
  ON public.ticket_files
  FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY ticket_files_buyer_select
  ON public.ticket_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.tickets t ON t.id = o.ticket_id
      JOIN public.ticket_uploads tu ON tu.id = t.ticket_upload_id
      WHERE o.buyer_id = auth.uid()
        AND (
          tu.sha256 = ticket_files.sha256
          OR tu.storage_path = ticket_files.storage_path
        )
        AND (
          o.status IN ('paid', 'delivered', 'completed')
          OR upper(coalesce(o.payment_state, '')) = 'AUTHORIZED'
        )
    )
  );

-- TICKET_FILES_UNIFIED
ALTER TABLE public.ticket_files_unified ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ticket_files_unified' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ticket_files_unified', r.policyname);
  END LOOP;
END$$;

CREATE POLICY ticket_files_unified_owner_select
  ON public.ticket_files_unified
  FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY ticket_files_unified_owner_insert
  ON public.ticket_files_unified
  FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY ticket_files_unified_owner_update
  ON public.ticket_files_unified
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY ticket_files_unified_admin_all
  ON public.ticket_files_unified
  FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY ticket_files_unified_buyer_select
  ON public.ticket_files_unified
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.tickets t ON t.id = o.ticket_id
      JOIN public.ticket_uploads tu ON tu.id = t.ticket_upload_id
      WHERE o.buyer_id = auth.uid()
        AND (
          tu.sha256 = ticket_files_unified.sha256
          OR tu.storage_path = ticket_files_unified.storage_path
        )
        AND (
          o.status IN ('paid', 'delivered', 'completed')
          OR upper(coalesce(o.payment_state, '')) = 'AUTHORIZED'
        )
    )
  );

-- ORDERS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='orders' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', r.policyname);
  END LOOP;
END$$;

CREATE POLICY orders_select_participants
  ON public.orders
  FOR SELECT
  USING (
    buyer_id = auth.uid()
    OR seller_id = auth.uid()
    OR user_id = auth.uid()
  );

CREATE POLICY orders_insert_buyer
  ON public.orders
  FOR INSERT
  WITH CHECK (
    buyer_id = auth.uid()
    OR user_id = auth.uid()
  );

CREATE POLICY orders_admin_all
  ON public.orders
  FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- ORDER_MESSAGES
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='order_messages' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_messages', r.policyname);
  END LOOP;
END$$;

CREATE POLICY order_messages_select_participants
  ON public.order_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (
          o.buyer_id = auth.uid()
          OR o.seller_id = auth.uid()
          OR public.is_admin_user(auth.uid())
        )
    )
  );

CREATE POLICY order_messages_insert_participants
  ON public.order_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

CREATE POLICY order_messages_update_own
  ON public.order_messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY order_messages_delete_own
  ON public.order_messages
  FOR DELETE
  USING (sender_id = auth.uid());

-- SUPPORT_TICKETS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.support_tickets', r.policyname);
  END LOOP;
END$$;

CREATE POLICY support_tickets_select_own
  ON public.support_tickets
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY support_tickets_insert_own
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY support_tickets_admin_all
  ON public.support_tickets
  FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- SUPPORT_MESSAGES
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='support_messages' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.support_messages', r.policyname);
  END LOOP;
END$$;

CREATE POLICY support_messages_select_own
  ON public.support_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND (t.user_id = auth.uid() OR public.is_admin_user(auth.uid()))
    )
  );

CREATE POLICY support_messages_insert_own
  ON public.support_messages
  FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND (t.user_id = auth.uid() OR public.is_admin_user(auth.uid()))
    )
  );

CREATE POLICY support_messages_admin_all
  ON public.support_messages
  FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- SUPPORT_ATTACHMENTS
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='support_attachments' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.support_attachments', r.policyname);
  END LOOP;
END$$;

CREATE POLICY support_attachments_select_own
  ON public.support_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = support_attachments.ticket_id
        AND (t.user_id = auth.uid() OR public.is_admin_user(auth.uid()))
    )
  );

CREATE POLICY support_attachments_insert_own
  ON public.support_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = support_attachments.ticket_id
        AND (t.user_id = auth.uid() OR public.is_admin_user(auth.uid()))
    )
  );

CREATE POLICY support_attachments_admin_all
  ON public.support_attachments
  FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- RATINGS
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ratings' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ratings', r.policyname);
  END LOOP;
END$$;

CREATE POLICY ratings_select_related
  ON public.ratings
  FOR SELECT
  USING (
    rater_id = auth.uid()
    OR target_id = auth.uid()
    OR public.is_admin_user(auth.uid())
  );

CREATE POLICY ratings_insert_own
  ON public.ratings
  FOR INSERT
  WITH CHECK (rater_id = auth.uid());

CREATE POLICY ratings_update_own
  ON public.ratings
  FOR UPDATE
  USING (rater_id = auth.uid())
  WITH CHECK (rater_id = auth.uid());

CREATE POLICY ratings_delete_own
  ON public.ratings
  FOR DELETE
  USING (rater_id = auth.uid());

CREATE POLICY ratings_admin_all
  ON public.ratings
  FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- WALLET_MOVEMENTS
ALTER TABLE public.wallet_movements ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='wallet_movements' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.wallet_movements', r.policyname);
  END LOOP;
END$$;

CREATE POLICY wallet_movements_select_own
  ON public.wallet_movements
  FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE POLICY wallet_movements_admin_all
  ON public.wallet_movements
  FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- Indices
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_ticket_id ON public.orders(ticket_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON public.order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_ticket_uploads_user_id ON public.ticket_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_uploads_seller_id ON public.ticket_uploads(seller_id);
CREATE INDEX IF NOT EXISTS idx_ticket_uploads_sha256 ON public.ticket_uploads(sha256);
CREATE INDEX IF NOT EXISTS idx_ticket_files_owner_user_id ON public.ticket_files(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_files_sha256 ON public.ticket_files(sha256);
CREATE INDEX IF NOT EXISTS idx_ticket_files_unified_owner_user_id ON public.ticket_files_unified(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_files_unified_sha256 ON public.ticket_files_unified(sha256);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON public.support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket_id ON public.support_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ratings_target_id ON public.ratings(target_id);
CREATE INDEX IF NOT EXISTS idx_wallet_movements_user_id ON public.wallet_movements(user_id);

-- Sync is_nominated/is_nominada
UPDATE public.ticket_uploads
SET
  is_nominated = COALESCE(is_nominated, is_nominada, false),
  is_nominada = COALESCE(is_nominada, is_nominated, false)
WHERE is_nominated IS NULL OR is_nominada IS NULL;

CREATE OR REPLACE FUNCTION public.sync_ticket_upload_nominated_flags()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_nominated IS NULL AND NEW.is_nominada IS NOT NULL THEN
    NEW.is_nominated := NEW.is_nominada;
  ELSIF NEW.is_nominada IS NULL AND NEW.is_nominated IS NOT NULL THEN
    NEW.is_nominada := NEW.is_nominated;
  ELSE
    NEW.is_nominated := COALESCE(NEW.is_nominated, NEW.is_nominada, false);
    NEW.is_nominada := COALESCE(NEW.is_nominada, NEW.is_nominated, false);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ticket_upload_nominated ON public.ticket_uploads;
CREATE TRIGGER trg_sync_ticket_upload_nominated
BEFORE INSERT OR UPDATE ON public.ticket_uploads
FOR EACH ROW
EXECUTE FUNCTION public.sync_ticket_upload_nominated_flags();

COMMIT;
