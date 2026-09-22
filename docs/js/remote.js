// Supabase(PostgREST) 백엔드.
// local.js 와 메서드 이름·행 모양이 같아야 한다.
//
// 모든 요청은 로그인한 사람의 access token 으로 보낸다. 서버 정책(RLS)이
// '가족으로 등록된 메일인지' 를 보고 통과시킨다 — supabase/schema.sql 참고.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { accessToken } from './auth.js';

export const mode = 'remote';
export const label = '가족과 공유 중';

const base = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1';

async function headers(extra) {
  const token = await accessToken();
  return Object.assign(
    {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    extra,
  );
}

async function call(path, options = {}) {
  let res;
  try {
    res = await fetch(`${base}/${path}`, options);
  } catch {
    throw new Error('서버에 닿지 못했어요. 인터넷 연결을 확인해 주세요.');
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error('로그인이 만료됐어요. 새로고침한 뒤 다시 로그인해 주세요.');
    }
    if (res.status === 403) {
      throw new Error('이 기록에 접근할 권한이 없어요. 가족으로 등록된 메일인지 확인해 주세요.');
    }
    throw new Error(`Supabase ${res.status} ${path} — ${detail.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const select = async (table, query) =>
  call(`${table}?${query}`, { headers: await headers() });

async function insert(table, row) {
  const rows = await call(table, {
    method: 'POST',
    headers: await headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  return rows[0];
}

async function patch(table, id, changes) {
  const rows = await call(`${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: await headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(changes),
  });
  return rows[0];
}

async function remove(table, id) {
  return call(`${table}?id=eq.${id}`, { method: 'DELETE', headers: await headers() });
}

// 로그인한 메일이 family_emails 에 있는지 서버에 물어본다.
// 정책이 막아 빈 목록이 오는 것과 '정말 기록이 없는 것' 을 구별하기 위한 것.
export async function amFamily() {
  const answer = await call('rpc/is_family', {
    method: 'POST',
    headers: await headers(),
    body: '{}',
  });
  return answer === true;
}

export async function loadAll() {
  // 가족 규모(한 해 수백 건)에서는 통째로 받아 와 클라이언트에서 다루는 게 가장 단순하다.
  const [members, stories, ideas, replies] = await Promise.all([
    select('members', 'select=*&order=sort_order.asc,created_at.asc'),
    select('stories', 'select=*&order=happened_on.desc,created_at.asc'),
    select('ideas', 'select=*&order=created_at.desc'),
    select('replies', 'select=*&order=created_at.asc'),
  ]);
  return { members, stories, ideas, replies };
}

export const addMember = (row) => insert('members', row);
export const editMember = (id, changes) => patch('members', id, changes);
export const dropMember = (id) => remove('members', id);

export const addStory = (row) => insert('stories', row);
export const editStory = (id, changes) => patch('stories', id, changes);
export const dropStory = (id) => remove('stories', id);

export const addIdea = (row) => insert('ideas', row);
export const editIdea = (id, changes) => patch('ideas', id, changes);
export const dropIdea = (id) => remove('ideas', id);

export const addReply = (row) => insert('replies', row);
export const dropReply = (id) => remove('replies', id);

export async function replaceAll() {
  // 공유 데이터를 통째로 덮어쓰는 건 위험해서 막아 둔다. 가져오기는 기기 저장 모드에서만.
  throw new Error('공유 모드에서는 데이터 가져오기를 지원하지 않습니다.');
}
