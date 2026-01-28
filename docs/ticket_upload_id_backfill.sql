-- Backfill opcional de tickets.ticket_upload_id usando cercanía temporal
-- 1) Preview de candidatos (sin cambios)
SELECT
  t.id AS ticket_id,
  t.seller_id,
  t.created_at AS ticket_created_at,
  u.id AS upload_id,
  u.created_at AS upload_created_at,
  ABS(EXTRACT(EPOCH FROM (t.created_at - u.created_at))) AS diff_seconds,
  u.is_nominated,
  u.is_nominada
FROM public.tickets t
LEFT JOIN LATERAL (
  SELECT u.*
  FROM public.ticket_uploads u
  WHERE u.seller_id = t.seller_id
  ORDER BY ABS(EXTRACT(EPOCH FROM (t.created_at - u.created_at))) ASC
  LIMIT 1
) u ON TRUE
WHERE t.ticket_upload_id IS NULL
ORDER BY t.created_at DESC
LIMIT 50;

-- 2) Update (ventana 60 minutos = 3600s) y respetando unique parcial
UPDATE public.tickets t
SET ticket_upload_id = u.id
FROM LATERAL (
  SELECT u.id, u.created_at
  FROM public.ticket_uploads u
  WHERE u.seller_id = t.seller_id
  ORDER BY ABS(EXTRACT(EPOCH FROM (t.created_at - u.created_at))) ASC
  LIMIT 1
) u
WHERE t.ticket_upload_id IS NULL
  AND ABS(EXTRACT(EPOCH FROM (t.created_at - u.created_at))) <= 3600
  AND NOT EXISTS (
    SELECT 1 FROM public.tickets t2 WHERE t2.ticket_upload_id = u.id
  );

-- 3) Validación post-backfill (ajusta seller_id si necesitas)
SELECT
  t.id,
  t.status,
  t.ticket_upload_id,
  tu.is_nominated,
  tu.is_nominada
FROM public.tickets t
LEFT JOIN public.ticket_uploads tu ON tu.id = t.ticket_upload_id
WHERE t.seller_id = 'c490f8e3-8a72-411d-b313-0bc89ccc1de4'
ORDER BY t.created_at DESC;
