-- ============================================================
-- Clox Platform Schema
-- ============================================================

-- --------------------------------------------------------
-- 1. Profiles - extended user data beyond auth.users
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,
  company         TEXT,
  job_title       TEXT,
  country         TEXT,
  city            TEXT,
  use_case        TEXT,
  role            TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin' | 'super_admin'
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"   ON public.profiles FOR SELECT  USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own"   ON public.profiles FOR INSERT  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"   ON public.profiles FOR UPDATE  USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own"   ON public.profiles FOR DELETE  USING (auth.uid() = id);

-- Super admin can read all profiles
CREATE POLICY "profiles_admin_select" ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

-- --------------------------------------------------------
-- 2. Credits - per-user balance
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_usd NUMERIC(12, 6) NOT NULL DEFAULT 10.000000, -- $10 trial default
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credits_select_own"   ON public.credits FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "credits_insert_own"   ON public.credits FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "credits_update_own"   ON public.credits FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "credits_admin_select" ON public.credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );
CREATE POLICY "credits_admin_update" ON public.credits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

-- --------------------------------------------------------
-- 3. Usage Logs - every AI call recorded
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,        -- 'google' | 'openai' | 'anthropic' etc.
  model           TEXT NOT NULL,
  prompt_tokens   INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(12, 6) NOT NULL DEFAULT 0,
  is_free_domain  BOOLEAN NOT NULL DEFAULT false,
  domain          TEXT,                 -- email domain of user e.g. 'renascence.io'
  chat_type       TEXT NOT NULL DEFAULT 'text', -- 'text' | 'image' | 'audio' | 'video'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_select_own"    ON public.usage_logs FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "usage_insert_own"    ON public.usage_logs FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "usage_admin_select"  ON public.usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

-- Service role insert (used from API routes via service key)
CREATE POLICY "usage_service_insert" ON public.usage_logs FOR INSERT
  WITH CHECK (true);

-- --------------------------------------------------------
-- 4. Invoices - billing records
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usd  NUMERIC(12, 2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'paid', -- 'paid' | 'pending' | 'failed'
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_own"   ON public.invoices FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "invoices_admin_select" ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

-- --------------------------------------------------------
-- 5. Skills - library of AI skills
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  engine          TEXT NOT NULL,  -- 'claude' | 'gpt' | 'gemini' | 'all'
  source_url      TEXT,
  system_prompt   TEXT NOT NULL,  -- the prompt injected when skill is active
  tags            TEXT[] DEFAULT '{}',
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skills_select_public"  ON public.skills FOR SELECT  USING (is_public = true OR auth.uid() = created_by);
CREATE POLICY "skills_insert_admin"   ON public.skills FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );
CREATE POLICY "skills_update_admin"   ON public.skills FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );
CREATE POLICY "skills_delete_admin"   ON public.skills FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

-- --------------------------------------------------------
-- 6. User Skills - which skills a user has enabled
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id    UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_skills_select_own"  ON public.user_skills FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "user_skills_insert_own"  ON public.user_skills FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_skills_update_own"  ON public.user_skills FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "user_skills_delete_own"  ON public.user_skills FOR DELETE  USING (auth.uid() = user_id);

-- --------------------------------------------------------
-- 7. Auto-create profile + credits trigger on signup
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_domain TEXT;
  free_domains TEXT[] := ARRAY['renascence.io', 'gaiarealty.ae'];
BEGIN
  -- Extract domain from email
  user_domain := split_part(NEW.email, '@', 2);

  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert credits: $10 for everyone (free domains also get $10 for accounting purposes)
  INSERT INTO public.credits (user_id, balance_usd)
  VALUES (NEW.id, 10.000000)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------
-- 8. Seed initial skills for Claude
-- --------------------------------------------------------
INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
VALUES
  (
    'Humanizer',
    'Makes AI-generated text sound more natural and human. Avoids robotic phrasing and over-formal language.',
    'claude',
    'https://github.com/blader/humanizer',
    'When responding, write as a thoughtful human would. Use natural language, contractions, and conversational tone. Avoid bullet points unless explicitly requested. Vary sentence length. Avoid words like "certainly", "absolutely", "delve", "foster", "leverage", "synergy". Sound like a smart person writing a message, not a document.',
    ARRAY['writing', 'tone', 'humanizer'],
    true
  ),
  (
    'Code Reviewer',
    'Reviews code for bugs, performance issues, and best practices.',
    'claude',
    'https://github.com/ComposioHQ/awesome-claude-skills',
    'You are an expert code reviewer. When reviewing code: 1) Check for bugs and security vulnerabilities, 2) Suggest performance improvements, 3) Ensure best practices are followed, 4) Comment on code readability and maintainability. Be specific, constructive, and provide corrected code snippets where relevant.',
    ARRAY['code', 'review', 'engineering'],
    true
  ),
  (
    'Research Analyst',
    'Deep research and structured analysis on any topic.',
    'claude',
    'https://github.com/ComposioHQ/awesome-claude-skills',
    'You are a research analyst. When asked to research a topic: structure your response with an executive summary, key findings, supporting evidence, and conclusions. Cite reasoning clearly. Identify gaps in available information. Present multiple perspectives where relevant.',
    ARRAY['research', 'analysis'],
    true
  ),
  (
    'Product Manager',
    'Helps write PRDs, user stories, and product strategy documents.',
    'claude',
    'https://github.com/ComposioHQ/awesome-claude-skills',
    'You are an experienced product manager. Help write clear PRDs, user stories in "As a [user], I want [goal] so that [benefit]" format, and product strategy. Focus on user value, measurable outcomes, and clear acceptance criteria. Always ask clarifying questions about the target user before writing.',
    ARRAY['product', 'strategy', 'prd'],
    true
  ),
  (
    'SQL Expert',
    'Writes optimized SQL queries and explains database design.',
    'all',
    'https://github.com/ComposioHQ/awesome-claude-skills',
    'You are a SQL expert. Write clean, optimized SQL queries with proper indexing considerations. Explain query execution plans when relevant. Use CTEs for readability. Warn about N+1 problems and suggest joins. Support PostgreSQL syntax by default unless specified otherwise.',
    ARRAY['sql', 'database', 'engineering'],
    true
  ),
  (
    'Email Drafter',
    'Writes professional, clear, and concise emails.',
    'all',
    null,
    'You are an expert at writing professional emails. Write emails that are clear, direct, and appropriately formal. Use short paragraphs. State the purpose in the first sentence. End with a clear call to action. Avoid unnecessary filler phrases.',
    ARRAY['email', 'writing', 'communication'],
    true
  )
ON CONFLICT DO NOTHING;
