-- Our Story 변경 (2026-09-23)
-- "한 사람이 하루에 한 개" → "한 사람이 하루에 5개까지"
--
-- 이미 만들어 둔 표를 고치는 스크립트다. 머니노트와 같은 프로젝트
-- (secqbdcobmqocznsbftm)의 SQL Editor 에 붙여 Run 하면 된다.
-- 두 번 실행해도 안전하다.

-- 1) 하루 한 개만 허용하던 유일 인덱스를 없앤다
drop index if exists stories_one_per_day;

-- 2) 대신 하루 5개까지로 막는다.
--    화면(js/util.js 의 MAX_STORIES_PER_DAY)도 5다. 숫자를 바꾸려면 두 곳을 같이 바꿀 것.
create or replace function stories_per_day_limit()
returns trigger
language plpgsql
security definer          -- 정책과 상관없이 정확히 세기 위해
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

-- 3) 확인: 아래가 0줄이면 유일 인덱스가 사라진 것
select indexname from pg_indexes
where tablename = 'stories' and indexname = 'stories_one_per_day';
