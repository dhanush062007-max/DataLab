-- Enable RLS on all core tables
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE statistical_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to allow re-running this migration safely)
DROP POLICY IF EXISTS "Public datasets are viewable by everyone." ON datasets;
DROP POLICY IF EXISTS "Users can view their own datasets." ON datasets;
DROP POLICY IF EXISTS "Users can insert their own datasets." ON datasets;
DROP POLICY IF EXISTS "Users can update their own datasets." ON datasets;
DROP POLICY IF EXISTS "Users can delete their own datasets." ON datasets;

DROP POLICY IF EXISTS "Users can manage their own ml_experiments." ON ml_experiments;
DROP POLICY IF EXISTS "Users can manage their own statistical_tests." ON statistical_tests;

DROP POLICY IF EXISTS "Profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile." ON profiles;


-- ==========================================
-- Datasets Policies
-- ==========================================

-- 1. Anyone can view public datasets
CREATE POLICY "Public datasets are viewable by everyone."
ON datasets FOR SELECT
USING (status = 'PUBLISHED');

-- 2. Users can view their own datasets regardless of visibility
CREATE POLICY "Users can view their own datasets."
ON datasets FOR SELECT
USING (auth.uid() = owner_id);

-- 3. Users can insert their own datasets
CREATE POLICY "Users can insert their own datasets."
ON datasets FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- 4. Users can update their own datasets
CREATE POLICY "Users can update their own datasets."
ON datasets FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- 5. Users can delete their own datasets
CREATE POLICY "Users can delete their own datasets."
ON datasets FOR DELETE
USING (auth.uid() = owner_id);

-- ==========================================
-- ML Experiments Policies
-- ==========================================

-- 1. Users can do everything with their own experiments
CREATE POLICY "Users can manage their own ml_experiments."
ON ml_experiments FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);


-- ==========================================
-- Statistical Tests Policies
-- ==========================================

-- 1. Users can do everything with their own tests
CREATE POLICY "Users can manage their own statistical_tests."
ON statistical_tests FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);


-- ==========================================
-- Profiles Policies
-- ==========================================

-- 1. Anyone can view public profiles (needed for showing author names)
CREATE POLICY "Profiles are viewable by everyone."
ON profiles FOR SELECT
USING (true);

-- 2. Users can update their own profile
CREATE POLICY "Users can update own profile."
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Users can insert their own profile
CREATE POLICY "Users can insert own profile."
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);
