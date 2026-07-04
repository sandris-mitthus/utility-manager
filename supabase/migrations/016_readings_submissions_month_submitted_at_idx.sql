-- Optimize monthly submissions queries for admin and Google Sheet sync

create index if not exists readings_submissions_month_submitted_at_idx
  on public.readings_submissions (month, submitted_at desc);
