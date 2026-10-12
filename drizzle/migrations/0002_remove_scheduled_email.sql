DO $$ BEGIN PERFORM cron.unschedule('aura-dispatch-scheduled'); EXCEPTION WHEN others THEN NULL; END $$;
DROP FUNCTION IF EXISTS public.aura_dispatch_scheduled();
COMMENT ON TABLE public.aura_google_accounts IS 'DEPRECATED: Gmail feature removed';
COMMENT ON TABLE public.aura_scheduled_tasks IS 'DEPRECATED: scheduled email removed';