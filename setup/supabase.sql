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

insert into public.shlishuk_draft (id, payload)
values ('default', '{"title":"","logoImage":null,"heroImage":null,"secondaryImage":null,"offerImages":[],"socialLinks":{"facebook":"","instagram":""}}'::jsonb)
on conflict (id) do nothing;

-- משתמש אדמין: Authentication → Users → Add user (או הרשמה מותרת מאותו מסך).
-- אם ההתחברות נכשלת מהדפדפן המקומי: Authentication → URL configuration → להוסיף ל־Redirect URLs את http://localhost:5173 ובמידת הצורך http://localhost:5173/admin
