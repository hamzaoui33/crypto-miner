-- Telegram Mini App Clicker Game - Database Schema
-- Optimized for high-concurrency with proper indexing and RLS

-- ============================================
-- TABLE: users
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id BIGINT PRIMARY KEY,                          -- Telegram User ID (PK)
  username VARCHAR(255),                          -- Telegram username (nullable)
  first_name VARCHAR(255) NOT NULL,               -- User's first name
  balance BIGINT DEFAULT 0,                       -- Total coins (supports trillions)
  max_energy INTEGER DEFAULT 1000,                -- Maximum energy capacity
  current_energy INTEGER DEFAULT 1000,            -- Current energy level
  last_energy_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- For offline energy calc
  multitap_level INTEGER DEFAULT 1,               -- Tap power level
  energy_limit_level INTEGER DEFAULT 1,           -- Energy cap level
  referred_by BIGINT,                             -- Referrer user ID (FK)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Account creation timestamp
);

-- ============================================
-- TABLE: tasks
-- ============================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Task identifier
  title VARCHAR(255) NOT NULL,                    -- Task title
  reward INTEGER NOT NULL,                        -- Coin reward amount
  type VARCHAR(50) NOT NULL,                      -- 'telegram', 'twitter', 'youtube', etc.
  link TEXT NOT NULL                              -- Task completion link
);

-- ============================================
-- TABLE: user_tasks (Junction Table)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_tasks (
  user_id BIGINT NOT NULL,                        -- User who completed the task
  task_id UUID NOT NULL,                          -- Reference to task
  status VARCHAR(50) NOT NULL DEFAULT 'completed', -- 'completed', 'claimed'
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Completion timestamp
  PRIMARY KEY (user_id, task_id)
);

-- ============================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================
ALTER TABLE public.users 
  ADD CONSTRAINT users_referred_by_fkey 
  FOREIGN KEY (referred_by) 
  REFERENCES public.users(id) 
  ON DELETE SET NULL;

ALTER TABLE public.user_tasks 
  ADD CONSTRAINT user_tasks_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.users(id) 
  ON DELETE CASCADE;

ALTER TABLE public.user_tasks 
  ADD CONSTRAINT user_tasks_task_id_fkey 
  FOREIGN KEY (task_id) 
  REFERENCES public.tasks(id) 
  ON DELETE CASCADE;

-- ============================================
-- INDEXES (Optimized for High-Concurrency)
-- ============================================
-- Leaderboard queries (top players by balance)
CREATE INDEX IF NOT EXISTS idx_users_balance ON public.users(balance DESC);

-- Referral lookups (find all users referred by someone)
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by);

-- User task lookups (get all tasks for a user)
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON public.user_tasks(user_id);

-- Task status filtering (get completed vs claimed tasks)
CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON public.user_tasks(status);

-- ============================================
-- HELPER FUNCTION (Telegram ID from JWT)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_telegram_user_id() 
RETURNS BIGINT AS $$
BEGIN
  RETURN (auth.jwt() ->> 'user_id')::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

-- Users Policies
CREATE POLICY users_select_policy ON public.users 
  FOR SELECT TO authenticated 
  USING (id = public.get_telegram_user_id());

CREATE POLICY users_insert_policy ON public.users 
  FOR INSERT TO authenticated 
  WITH CHECK (id = public.get_telegram_user_id());

CREATE POLICY users_update_policy ON public.users 
  FOR UPDATE TO authenticated 
  USING (id = public.get_telegram_user_id());

-- Tasks Policies (public read for all authenticated users)
CREATE POLICY tasks_select_policy ON public.tasks 
  FOR SELECT TO authenticated 
  USING (true);

-- User Tasks Policies
CREATE POLICY user_tasks_select_policy ON public.user_tasks 
  FOR SELECT TO authenticated 
  USING (user_id = public.get_telegram_user_id());

CREATE POLICY user_tasks_insert_policy ON public.user_tasks 
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = public.get_telegram_user_id());

CREATE POLICY user_tasks_update_policy ON public.user_tasks 
  FOR UPDATE TO authenticated 
  USING (user_id = public.get_telegram_user_id());

-- ============================================
-- DATA API GRANTS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_tasks TO service_role;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
-- INSERT INTO public.tasks (title, reward, type, link) VALUES
--   ('Join our Telegram Channel', 50000, 'telegram', 'https://t.me/YourChannel'),
--   ('Follow on X', 50000, 'twitter', 'https://twitter.com/YourHandle'),
--   ('Subscribe to YouTube', 50000, 'youtube', 'https://youtube.com/YourChannel');