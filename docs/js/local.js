// 이 기기에만 저장하는 백엔드 (localStorage).
// remote.js 와 메서드 이름·행 모양이 같아야 한다. 한쪽만 고치면 config.js 를
// 비운 상태에서 조용히 깨진다.

import { uid } from './util.js';

const KEY = 'our-story.db.v1';

export const mode = 'local';
export const label = '이 기기에만 저장';

function blank() {
  return { members: [], stories: [], ideas: [], replies: [] };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    return Object.assign(blank(), JSON.parse(raw));
  } catch {
    return blank();
  }
}

function write(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function stamp(row) {
  return { id: uid(), created_at: new Date().toISOString(), ...row };
}

async function insert(table, row) {
  const db = read();
  const saved = stamp(row);
  db[table].push(saved);
  write(db);
  return saved;
}

async function patch(table, id, changes) {
  const db = read();
  const row = db[table].find((r) => r.id === id);
  if (!row) throw new Error('고칠 항목을 찾지 못했습니다.');
  Object.assign(row, changes);
  write(db);
  return row;
}

async function remove(table, id) {
  const db = read();
  db[table] = db[table].filter((r) => r.id !== id);
  if (table === 'stories' || table === 'ideas') {
    // 지운 글에 달린 한마디가 남지 않게 같이 지운다.
    db.replies = db.replies.filter((r) => r.target_id !== id);
  }
  write(db);
}

export async function loadAll() {
  const db = read();
  return {
    members: db.members.slice(),
    stories: db.stories.slice(),
    ideas: db.ideas.slice(),
    replies: db.replies.slice(),
  };
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

// 데이터를 통째로 넣는다 (가족 화면의 '가져오기'). 기존 내용을 덮어쓴다.
export async function replaceAll(data) {
  write(Object.assign(blank(), data));
}
