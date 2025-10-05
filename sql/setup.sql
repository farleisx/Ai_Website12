-- ==========================================
-- 1️⃣ Create credits table
-- ==========================================
create table if not exists credits (
    user_id uuid primary key references auth.users(id) on delete cascade,
    credits integer not null default 5,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- ==========================================
-- 2️⃣ Function to initialize credits for new user
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into credits(user_id, credits) values (new.id, 5);
    return new;
end;
$$ language plpgsql;

-- ==========================================
-- 3️⃣ Trigger on auth.users table (Supabase built-in)
-- ==========================================
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ==========================================
-- 4️⃣ Function to reset all credits daily
-- ==========================================
create or replace function public.reset_credits()
returns void as $$
begin
    update credits set credits = 5, updated_at = now();
end;
$$ language plpgsql;

-- ==========================================
-- 5️⃣ Schedule daily reset using pg_cron
-- ==========================================
-- Make sure pg_cron is installed in your Supabase project
-- This will run every day at midnight UTC
select cron.schedule('reset_daily_credits', '0 0 * * *', $$call public.reset_credits()$$);
