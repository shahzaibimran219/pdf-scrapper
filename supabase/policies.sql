-- Enable RLS and owner-only policies for Resume and ResumeHistory
-- Note: Our Prisma models store userId as TEXT (cuid()), while auth.uid() returns UUID.
-- We cast auth.uid() to text to compare.

alter table public."Resume" enable row level security;
create policy "owner-read-write" on public."Resume"
  for all using (auth.uid()::text = "userId") with check (auth.uid()::text = "userId");

alter table public."ResumeHistory" enable row level security;
create policy "owner-read-write" on public."ResumeHistory"
  for all using (auth.uid()::text = "userId") with check (auth.uid()::text = "userId");


