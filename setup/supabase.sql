-- הרץ בלשונית SQL ב-Supabase לאחר יצירת פרויקט.
-- Authentication → Providers: הפעל Email וסיסמה.

create table if not exists public.shlishuk_draft (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.shlishuk_draft enable row level security;

drop policy if exists "shlishuk_draft_select_public" on public.shlishuk_draft;
create policy "shlishuk_draft_select_public"
on public.shlishuk_draft for select
to anon, authenticated
using (true);

drop policy if exists "shlishuk_draft_write_authenticated" on public.shlishuk_draft;
create policy "shlishuk_draft_write_authenticated"
on public.shlishuk_draft for insert
to authenticated
with check (true);

drop policy if exists "shlishuk_draft_update_authenticated" on public.shlishuk_draft;
create policy "shlishuk_draft_update_authenticated"
on public.shlishuk_draft for update
to authenticated
using (true)
with check (true);

-- פרסום ישיר מהאפליקציה (מפתח anon) — מתאים לדף מבצעים; כל בעל הקישור ומפתח ה-anon יכול לדרוס.
drop policy if exists "shlishuk_draft_anon_insert" on public.shlishuk_draft;
drop policy if exists "shlishuk_draft_anon_update" on public.shlishuk_draft;

create policy "shlishuk_draft_anon_insert"
on public.shlishuk_draft for insert
to anon
with check (true);

create policy "shlishuk_draft_anon_update"
on public.shlishuk_draft for update
to anon
using (true)
with check (true);

insert into public.shlishuk_draft (id, payload)
values ('default', '{"title":"","logoImage":null,"heroImage":null,"secondaryImage":null,"offerImages":[],"socialLinks":{"facebook":"","instagram":""}}'::jsonb)
on conflict (id) do nothing;

-- משתמש אדמין: Authentication → Users → Add user (או הרשמה מותרת מאותו מסך).
-- אם ההתחברות נכשלת מהדפדפן המקומי: Authentication → URL configuration → להוסיף ל־Redirect URLs את http://localhost:5173 ובמידת הצורך http://localhost:5173/admin

-- ────────────────────────────────────────────────────────────────
-- Storage: bucket ציבורי לתמונות הדף (קל ומהיר במקום base64 ב-payload)
-- ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('shlishuk-images', 'shlishuk-images', true)
on conflict (id) do update set public = true;

-- מאפשר ל-anon להעלות/לעדכן/למחוק קבצים בתוך הbucket הזה בלבד.
-- מתאים לדף מבצעים פנימי; אין שמות אובייקט קבועים אז אין הגנת RLS לפי id.
drop policy if exists "shlishuk_images_anon_select" on storage.objects;
create policy "shlishuk_images_anon_select"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'shlishuk-images');

drop policy if exists "shlishuk_images_anon_insert" on storage.objects;
create policy "shlishuk_images_anon_insert"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'shlishuk-images');

drop policy if exists "shlishuk_images_anon_update" on storage.objects;
create policy "shlishuk_images_anon_update"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'shlishuk-images')
with check (bucket_id = 'shlishuk-images');

drop policy if exists "shlishuk_images_anon_delete" on storage.objects;
create policy "shlishuk_images_anon_delete"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'shlishuk-images');
