CREATE TABLE public.aura_google_accounts (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  refresh_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.aura_google_accounts TO service_role;
ALTER TABLE public.aura_google_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.aura_scheduled_tasks ADD COLUMN IF NOT EXISTS error text;

CREATE OR REPLACE FUNCTION public.aura_dispatch_scheduled()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.aura_scheduled_tasks WHERE status = 'pending' AND run_at <= now()) THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://aura-artifical.lovable.app/api/public/aura-dispatch',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
END $$;