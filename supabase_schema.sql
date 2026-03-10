-- Create custom type for quiz status
CREATE TYPE quiz_status AS ENUM ('waiting', 'active', 'finished');

-- Create Quizzes table
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    pin INTEGER UNIQUE, -- 4-digit game PIN (1000-9999)
    status quiz_status NOT NULL DEFAULT 'waiting',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration: if adding pin to an existing quizzes table, run:
-- ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS pin INTEGER UNIQUE;

-- Create Questions table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- e.g., ["Option A", "Option B", "Option C", "Option D"]
    correct_option TEXT NOT NULL,
    time_limit INTEGER NOT NULL DEFAULT 20, -- seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Participants table
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    nim_or_name TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Answers table
CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answered_option TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    response_time INTEGER NOT NULL, -- milliseconds taken to answer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable database replication for realtime on all tables
-- This is crucial for the Kahoot-like experience
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE quizzes;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE answers;

-- Enable Row Level Security (RLS)
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- Development Policies: Open access for simplicity during build phase.
-- NOTE: Update these policies before going to production!
CREATE POLICY "Allow public all access to quizzes" ON quizzes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access to questions" ON questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access to participants" ON participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access to answers" ON answers FOR ALL USING (true) WITH CHECK (true);
