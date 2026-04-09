-- Create admin users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  is_super_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Super admins can view all admin users" 
  ON public.admin_users FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins can insert admin users" 
  ON public.admin_users FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  );

-- Create API keys table for storing provider credentials
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE, -- e.g., 'openai', 'anthropic', 'elevenlabs'
  api_key TEXT, -- encrypted API key
  api_secret TEXT, -- for providers that need additional secrets
  base_url TEXT, -- custom endpoint URL if needed
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- API keys policies (only admins can access)
CREATE POLICY "Admins can view API keys" 
  ON public.api_keys FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert API keys" 
  ON public.api_keys FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update API keys" 
  ON public.api_keys FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete API keys" 
  ON public.api_keys FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE id = auth.uid()
    )
  );

-- Insert default super admin (aslan@renascence.io)
-- Note: This requires the user to sign up first, then we update their admin status
-- The password Admin123! will be set during sign up

-- Insert initial API key placeholders for all providers
INSERT INTO public.api_keys (provider, enabled) VALUES
  ('openai', FALSE),
  ('anthropic', FALSE),
  ('google', FALSE),
  ('meta', FALSE),
  ('mistral', FALSE),
  ('xai', FALSE),
  ('cohere', FALSE),
  ('ai21', FALSE),
  ('deepseek', FALSE),
  ('qwen', FALSE),
  ('zhipu', FALSE),
  ('kimi', FALSE),
  ('baidu', FALSE),
  ('elevenlabs', FALSE),
  ('playht', FALSE),
  ('microsoft', FALSE),
  ('suno', FALSE),
  ('udio', FALSE),
  ('stability', FALSE),
  ('midjourney', FALSE),
  ('runway', FALSE),
  ('luma', FALSE),
  ('pika', FALSE),
  ('haiper', FALSE),
  ('kuaishou', FALSE),
  ('ideogram', FALSE),
  ('recraft', FALSE),
  ('playground', FALSE),
  ('alibaba', FALSE),
  ('pixverse', FALSE),
  ('shengshu', FALSE),
  ('fishaudio', FALSE)
ON CONFLICT (provider) DO NOTHING;
