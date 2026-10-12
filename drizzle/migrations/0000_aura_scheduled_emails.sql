-- lovable-cron-fallback-reviewed: user requires minute-exact delivery while phone is off; no delay-until provider available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.aura_scheduled_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'email',
  to_email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aura_sched_kind CHECK (kind = 'email'),
  CONSTRAINT aura_sched_email CHECK (to_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aura_scheduled_tasks TO authenticated;
GRANT ALL ON public.aura_scheduled_tasks TO service_role;
ALTER TABLE public.aura_scheduled_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own scheduled" ON public.aura_scheduled_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own pending" ON public.aura_scheduled_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Users delete own pending" ON public.aura_scheduled_tasks FOR DELETE TO authenticated USING (auth.uid() = user_id AND status = 'pending');
CREATE INDEX aura_sched_due ON public.aura_scheduled_tasks (run_at) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.aura_dispatch_scheduled()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.aura_scheduled_tasks;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.aura_scheduled_tasks WHERE status = 'pending' AND run_at <= now()) THEN RETURN; END IF;
  FOR r IN
    UPDATE public.aura_scheduled_tasks SET status = 'sent', sent_at = now()
    WHERE id IN (SELECT id FROM public.aura_scheduled_tasks WHERE status = 'pending' AND run_at <= now() ORDER BY run_at LIMIT 50 FOR UPDATE SKIP LOCKED)
    RETURNING *
  LOOP
    PERFORM net.http_post(
      url := 'https://api.emailjs.com/api/v1.0/email/send',
      headers := '{"Content-Type":"application/json","origin":"https://aura-artifical.lovable.app"}'::jsonb,
      body := jsonb_build_object(
        'service_id','service_kqacpqb','template_id','template_aura_mail','user_id','lUednuFloEpfYtPz7',
        'template_params', jsonb_build_object('to_email', r.to_email, 'email', r.to_email, 'subject', r.subject, 'message', r.body)
      )
    );
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.aura_dispatch_scheduled() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('aura-dispatch-scheduled', '* * * * *', $$ SELECT public.aura_dispatch_scheduled(); $$);