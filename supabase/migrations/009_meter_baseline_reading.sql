-- Baseline reading on meter (set by admin, not overwritten on public submission)

alter table public.meters
  add column if not exists baseline_reading numeric(12, 2);

update public.meters
set baseline_reading = previous_reading
where baseline_reading is null;

alter table public.meters
  alter column baseline_reading set default 0;

alter table public.meters
  alter column baseline_reading set not null;
