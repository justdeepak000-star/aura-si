CREATE POLICY "Users can view own avatar" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT, avatar_url TEXT, persona TEXT NOT NULL DEFAULT 'jarvis',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL,
  content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX memories_user_idx ON public.memories (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own memories" ON public.memories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX conversations_user_idx ON public.conversations (user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own conversations" ON public.conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations ON DELETE CASCADE,
  user_id UUID NOT NULL, role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL, image_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own messages" ON public.messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL,
  name TEXT NOT NULL, path TEXT NOT NULL, mime_type TEXT, size BIGINT,
  kind TEXT NOT NULL DEFAULT 'file', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_files_user_idx ON public.user_files (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_files TO authenticated;
GRANT ALL ON public.user_files TO service_role;
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own files" ON public.user_files FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER conversations_touch BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Users read own files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  file_id uuid REFERENCES public.user_files(id) ON DELETE CASCADE,
  source_name text NOT NULL, chunk_index integer NOT NULL DEFAULT 0, content text NOT NULL,
  embedding vector(1536) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own knowledge" ON public.knowledge_chunks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX knowledge_chunks_user_idx ON public.knowledge_chunks (user_id, created_at DESC);
CREATE INDEX knowledge_chunks_embedding_idx ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(query_embedding vector(1536), match_count integer DEFAULT 5, similarity_threshold double precision DEFAULT 0.2)
RETURNS TABLE (id uuid, source_name text, content text, similarity double precision)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT k.id, k.source_name, k.content, 1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks k
  WHERE k.user_id = auth.uid() AND 1 - (k.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 20)
$$;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, integer, double precision) TO authenticated;

CREATE TABLE public.aura_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  plan text NOT NULL CHECK (plan IN ('ultra','flash')), status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan)
);
GRANT SELECT ON public.aura_subscriptions TO authenticated;
GRANT ALL ON public.aura_subscriptions TO service_role;
ALTER TABLE public.aura_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscriptions" ON public.aura_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE TABLE public.aura_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, email text,
  plan text NOT NULL CHECK (plan IN ('ultra','flash')), amount integer NOT NULL,
  utr_number text NOT NULL UNIQUE CHECK (utr_number ~ '^[0-9]{12}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.aura_payment_requests TO authenticated;
GRANT ALL ON public.aura_payment_requests TO service_role;
ALTER TABLE public.aura_payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own or admin all" ON public.aura_payment_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users submit own pending" ON public.aura_payment_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending' AND ((plan='ultra' AND amount=400) OR (plan='flash' AND amount=800)));
CREATE POLICY "Admins review" ON public.aura_payment_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.review_payment(_id uuid, _approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.aura_payment_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.aura_payment_requests WHERE id = _id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not pending'; END IF;
  UPDATE public.aura_payment_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, reviewed_at = now() WHERE id = _id;
  IF _approve THEN
    INSERT INTO public.aura_subscriptions (user_id, plan, status, current_period_end)
    VALUES (r.user_id, r.plan, 'active', now() + interval '30 days')
    ON CONFLICT (user_id, plan) DO UPDATE SET status='active', current_period_end = GREATEST(public.aura_subscriptions.current_period_end, now()) + interval '30 days';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.review_payment(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.review_payment(uuid, boolean) TO authenticated;