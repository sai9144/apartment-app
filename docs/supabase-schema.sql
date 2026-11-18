-- Supabase Schema for Green Valley Apartments
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Custom types
create type user_role as enum ('resident', 'guard', 'admin');
create type visitor_status as enum ('pending', 'approved', 'rejected', 'checked_in', 'checked_out');
create type complaint_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type complaint_priority as enum ('low', 'normal', 'high', 'urgent');
create type notice_priority as enum ('normal', 'high', 'urgent');

-- Tables
create table users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  phone text,
  apartment text,
  role user_role not null default 'resident',
  password_hash text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table apartments (
  id uuid primary key default uuid_generate_v4(),
  number text not null,
  tower text not null,
  floor int,
  bedrooms int,
  area_sqft int,
  created_at timestamptz default now()
);

create table visitors (
  id uuid primary key default uuid_generate_v4(),
  apartment text not null,
  resident_id uuid references users(id),
  visitor_name text not null,
  visitor_phone text,
  purpose text not null,
  vehicle_number text,
  expected_arrival timestamptz not null default now(),
  duration_mins int not null default 120,
  status visitor_status not null default 'pending',
  guard_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table notices (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null,
  priority notice_priority not null default 'normal',
  pinned boolean not null default false,
  author_id uuid references users(id),
  author_name text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table polls (
  id uuid primary key default uuid_generate_v4(),
  question text not null,
  options jsonb not null default '[]'::jsonb, -- [{id, text, votes}]
  votes jsonb not null default '{}'::jsonb,   -- {userId: optionId}
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table complaints (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null,
  category text not null,
  priority complaint_priority not null default 'normal',
  photos jsonb not null default '[]'::jsonb,
  resident_id uuid references users(id),
  resident_name text,
  apartment text,
  status complaint_status not null default 'open',
  assigned_to text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  from_user_id uuid references users(id),
  from_user_name text,
  to_user_id uuid references users(id),
  subject text,
  body text not null,
  read boolean not null default false,
  created_at timestamptz default now()
);

create table settings (
  id int primary key default 1,
  society_name text not null default 'Green Valley Apartments',
  address text,
  contact_email text,
  contact_phone text,
  gate_hours text,
  maintenance_phone text,
  updated_at timestamptz default now()
);
insert into settings (id) values (1) on conflict do nothing;

-- Row Level Security
alter table users enable row level security;
alter table apartments enable row level security;
alter table visitors enable row level security;
alter table notices enable row level security;
alter table polls enable row level security;
alter table complaints enable row level security;
alter table messages enable row level security;
alter table settings enable row level security;

-- Policies
-- Users: can read all, update own, admins manage all
create policy "Users readable by all authenticated" on users for select using (auth.role() = 'authenticated');
create policy "Users updatable by self" on users for update using (auth.uid() = id);
create policy "Users manageable by admin" on users for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

-- Apartments: readable by all, manageable by admin
create policy "Apartments readable" on apartments for select using (auth.role() = 'authenticated');
create policy "Apartments admin" on apartments for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

-- Visitors: residents see own, guards/admin see all
create policy "Visitors own" on visitors for select using (
  apartment = (select apartment from users where id = auth.uid())
);
create policy "Visitors guard/admin" on visitors for select using (
  exists (select 1 from users where id = auth.uid() and role in ('guard', 'admin'))
);
create policy "Visitors insert resident" on visitors for insert with check (
  auth.uid() = resident_id
);
create policy "Visitors update guard/admin" on visitors for update using (
  exists (select 1 from users where id = auth.uid() and role in ('guard', 'admin'))
);

-- Notices: all read, admin write
create policy "Notices readable" on notices for select using (auth.role() = 'authenticated');
create policy "Notices admin write" on notices for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

-- Polls: all read/vote, admin write
create policy "Polls readable" on polls for select using (auth.role() = 'authenticated');
create policy "Polls vote" on polls for update using (
  auth.role() = 'authenticated' and
  (votes->>auth.uid()::text) is null and
  (expires_at is null or expires_at > now())
);
create policy "Polls admin" on polls for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

-- Complaints: residents see own, admin/guard see all
create policy "Complaints own" on complaints for select using (
  resident_id = auth.uid()
);
create policy "Complaints staff" on complaints for select using (
  exists (select 1 from users where id = auth.uid() and role in ('guard', 'admin'))
);
create policy "Complaints insert resident" on complaints for insert with check (
  auth.uid() = resident_id
);
create policy "Complaints update staff" on complaints for update using (
  exists (select 1 from users where id = auth.uid() and role in ('guard', 'admin'))
);

-- Messages: users see own sent/received
create policy "Messages own" on messages for select using (
  from_user_id = auth.uid() or to_user_id = auth.uid()
);
create policy "Messages insert" on messages for insert with check (
  from_user_id = auth.uid()
);
create policy "Messages update read" on messages for update using (
  to_user_id = auth.uid()
);

-- Settings: all read, admin write
create policy "Settings readable" on settings for select using (auth.role() = 'authenticated');
create policy "Settings admin" on settings for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

-- Indexes
create index idx_visitors_apartment on visitors(apartment);
create index idx_visitors_status on visitors(status);
create index idx_complaints_resident on complaints(resident_id);
create index idx_complaints_status on complaints(status);
create index idx_notices_pinned on notices(pinned) where pinned = true;
create index idx_messages_to on messages(to_user_id);
create index idx_polls_expires on polls(expires_at) where expires_at is not null;

-- Triggers for updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger users_updated_at before update on users for each row execute function update_updated_at();
create trigger visitors_updated_at before update on visitors for each row execute function update_updated_at();
create trigger notices_updated_at before update on notices for each row execute function update_updated_at();
create trigger polls_updated_at before update on polls for each row execute function update_updated_at();
create trigger complaints_updated_at before update on complaints for each row execute function update_updated_at();
create trigger settings_updated_at before update on settings for each row execute function update_updated_at();

-- Realtime (enable in Supabase Dashboard: Database → Replication → Enable for tables)
-- alter publication supabase_realtime add table visitors, notices, polls, complaints, messages;