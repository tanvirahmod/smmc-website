-- Exams and exam marks for teacher result entry (multi-subject exams)
CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  program text NOT NULL,
  session text NOT NULL,
  subjects text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id text NOT NULL,
  subject text NOT NULL,
  cq numeric(5,2) NOT NULL DEFAULT 0,
  mcq numeric(5,2) NOT NULL DEFAULT 0,
  entered_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(exam_id, student_id, subject)
);
