-- Our Story — Supabase 스키마
-- 사용법: Supabase 프로젝트 > SQL Editor 에 이 파일을 붙여 Run.
--
-- 이 앱은 **머니노트와 같은 Supabase 프로젝트(secqbdcobmqocznsbftm)의 public 스키마**를 쓴다.
-- 무료 플랜이 활성 프로젝트 2개까지라서 새로 만들지 않고 얹었다 (2026-09-22 확인:
-- 그 프로젝트에는 categories, expenses 뿐이어서 아래 표 이름과 겹치지 않는다).
-- 표마다 정책이 따로라서 머니노트의 anon 키로는 여기 기록을 읽을 수 없다.
--
-- ⚠ 표를 더 만들 때는 이름이 겹치는지 먼저 볼 것. create table if not exists 는 이미 있으면
--   오류 없이 넘어가고, 앱이 남의 표를 읽게 된다.

create extension if not exists "pgcrypto";

-- 들어올 수 있는 메일 주소. 여기 없는 주소로는 로그인해도 아무것도 보이지 않는다.
-- ★ 아래 insert 의 주소를 우리 가족 주소로 바꿔서 실행하세요.
create table if not exists family_emails (
  email       text primary key,
  note        text,
  created_at  timestamptz not null default now()
);

-- 네이버 주소는 쓰지 않는다: 네이버가 메일 속 로그인 링크를 미리 열어 소진시켜 버린다
-- (2026-09-22 확인. 누르지 않았는데 토큰이 otp_expired 가 됐다).
insert into family_emails (email, note) values
  ('milove99@gmail.com', '엄마')
on conflict (email) do nothing;

-- 우리 식구
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text not null default '🙂',
  role        text not null default 'child' check (role in ('parent', 'child')),
  email       text,                      -- 이 주소로 로그인하면 자동으로 이 사람이 된다 (없어도 됨)
  sort_order  int  not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 이미 members 를 만들어 둔 뒤에 이 파일을 다시 실행하는 경우를 위해
alter table members add column if not exists email text;

-- 하루 기록: 그날 있었던 일과 기분
create table if not exists stories (
  id           uuid primary key default gen_random_uuid(),
  happened_on  date not null,
  member_id    uuid not null references members(id) on delete restrict,
  mood         text,
  body         text not null check (length(btrim(body)) > 0),
  created_at   timestamptz not null default now()
);

create index if not exists stories_by_day on stories (happened_on desc);

-- 한 사람이 하루에 쓸 수 있는 개수를 5개로 막는다.
-- 화면(js/util.js 의 MAX_STORIES_PER_DAY)도 5다 — 숫자를 바꾸면 두 곳을 같이 바꿀 것.
-- (2026-09-22 에는 '하루 한 개' 유일 인덱스였다. 2026-09-23 에 5개로 바꿨다)
create or replace function stories_per_day_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  written int;
begin
  select count(*) into written
  from stories
  where member_id = new.member_id
    and happened_on = new.happened_on;

  if written >= 5 then
    raise exception '하루에 5개까지만 쓸 수 있어요';
  end if;

  return new;
end;
$$;

drop trigger if exists stories_max_per_day on stories;
create trigger stories_max_per_day
  before insert on stories
  for each row execute function stories_per_day_limit();

-- 추천: 책 · 가볼 곳 · 해보기 · 볼거리 · 먹을거리
create table if not exists ideas (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete restrict,
  kind        text not null check (kind in ('book', 'place', 'todo', 'watch', 'food')),
  title       text not null check (length(btrim(title)) > 0),
  reason      text,
  link        text,
  status      text not null default 'want' check (status in ('want', 'done')),
  done_on     date,
  review      text,
  created_at  timestamptz not null default now()
);

create index if not exists ideas_by_status on ideas (status, created_at desc);

-- 반응(이모지)과 한마디. story/idea 를 함께 가리키기 때문에 외래키를 걸지 않는다.
-- 그래서 글을 지울 때 앱(store.js)이 여기 줄을 먼저 지운다.
create table if not exists replies (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('story', 'idea')),
  target_id    uuid not null,
  member_id    uuid not null references members(id) on delete restrict,
  emoji        text,
  body         text,
  created_at   timestamptz not null default now(),
  check (emoji is not null or body is not null)
);

create index if not exists replies_by_target on replies (target_id);

-- 같은 사람이 같은 글에 같은 이모지를 두 번 누르지 않게 한다 (앱에서는 누르면 취소)
create unique index if not exists replies_one_emoji
  on replies (target_id, member_id, emoji)
  where emoji is not null;

-- ---------------------------------------------------------------------------
-- 접근 정책 (가족만)
--
-- 매직링크로 로그인한 사람의 메일 주소가 family_emails 에 있어야 읽고 쓸 수 있다.
-- 로그인하지 않은 사람(anon)에게는 아무 정책도 주지 않는다 — 배포 주소를 알아도,
-- publishable key 를 알아도 아무것도 보이지 않는다.
--
-- 남이 매직링크로 가입하는 것 자체는 막지 않는다(막고 싶으면 Supabase 의
-- Authentication > Sign In / Providers 에서 신규 가입을 끄고 가족을 초대하면 된다).
-- 가입해도 family_emails 에 없으면 이 정책들이 전부 거절한다.
-- ---------------------------------------------------------------------------

-- 로그인한 메일이 가족인지 판단한다.
-- security definer 라서 family_emails 의 정책과 상관없이 판단할 수 있다.
create or replace function is_family()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from family_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function is_family() from public;
grant execute on function is_family() to authenticated;

alter table family_emails enable row level security;
alter table members       enable row level security;
alter table stories       enable row level security;
alter table ideas         enable row level security;
alter table replies       enable row level security;

-- 예전에 전체 허용으로 만들어 둔 정책이 있으면 치운다 (이 파일을 다시 실행하는 경우)
drop policy if exists open_all on members;
drop policy if exists open_all on stories;
drop policy if exists open_all on ideas;
drop policy if exists open_all on replies;

-- 가족 목록은 자기 줄만 볼 수 있게 한다 (남의 메일 주소가 보이지 않도록)
drop policy if exists see_own_row on family_emails;
create policy see_own_row on family_emails
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists family_only on members;
create policy family_only on members
  for all to authenticated using (is_family()) with check (is_family());

drop policy if exists family_only on stories;
create policy family_only on stories
  for all to authenticated using (is_family()) with check (is_family());

drop policy if exists family_only on ideas;
create policy family_only on ideas
  for all to authenticated using (is_family()) with check (is_family());

drop policy if exists family_only on replies;
create policy family_only on replies
  for all to authenticated using (is_family()) with check (is_family());
