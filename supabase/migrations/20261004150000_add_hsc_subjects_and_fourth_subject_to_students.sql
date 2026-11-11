/*
# Add HSC Humanities subjects and 4th subject columns to students

1. Modified Tables
- `students`
  - `hsc_subjects` (text) - JSON array of HSC Humanities group subjects
    e.g. ["Bangla","English","ICT"]
  - `fourth_subject` (text) - HSC 4th subject choice
2. Security
- No RLS changes. Existing policies still apply.
3. Notes
- `hsc_subjects` is shown in the student profile form as a multi-select
  "Subjects" field when an HSC student selects a Group.
- Humanities subjects: Bangla, English, ICT, Civics, Sociology,
  Islamic History and Culture, Logic, Economic, Islamic Studies.
  Default pre-selected: Bangla, English, ICT.
- Science subjects: Bangla, English, ICT, Physics, Chemistry, Biology.
  All six are pre-selected.
- Business Studies subjects: Bangla, English, ICT, Accounting,
  Business Organization and Management, Production Management and
  Marketing. All six are pre-selected.
- `fourth_subject` is shown as a "4th Subject" dropdown for HSC
  Humanities students, excluding the pre-selected core subjects
  (Bangla, English, ICT).
- Available 4th subjects (Humanities): Civics, Sociology, Islamic
  History and Culture, Logic, Economic, Islamic Studies.
- For Science students, `fourth_subject` is fixed to the single
  pre-selected option "Higher Math".
- For Business Studies students, `fourth_subject` is fixed to the
  single pre-selected option "Economics".
- Nullable text. No data loss.
*/

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS hsc_subjects text,
  ADD COLUMN IF NOT EXISTS fourth_subject text;
