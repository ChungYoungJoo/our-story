// 데이터 출입구. 화면(views/*)은 remote.js / local.js 를 직접 부르지 않고 전부 여기를 거친다.
//
// 가족 규모의 데이터라 시작할 때 통째로 받아 메모리에 들고, 화면은 그 배열을 읽는다.
// 쓰기는 백엔드에 보낸 뒤 같은 내용을 메모리에도 반영한다(다시 전체를 받아오지 않는다).

import * as local from './local.js';
import * as remote from './remote.js';
import { SUPABASE_URL, SUPABASE_KEY, DEFAULT_MEMBERS } from './config.js';
import { today, monthOf, shiftDay, MAX_STORIES_PER_DAY } from './util.js';

export async function createStore() {
  const backend = SUPABASE_URL && SUPABASE_KEY ? remote : local;

  const store = {
    mode: backend.mode,
    label: backend.label,
    error: null,
    members: [],
    stories: [],
    ideas: [],
    replies: [],

    async reload() {
      try {
        const data = await backend.loadAll();
        store.members = data.members || [];
        store.stories = data.stories || [];
        store.ideas = data.ideas || [];
        store.replies = data.replies || [];
        store.error = null;
        if (store.members.length === 0) await seed();
      } catch (err) {
        // 연결이 안 되더라도 앱이 멈추지 않게 하고, 화면에 사정을 알린다.
        store.error = err.message || String(err);
      }
      sortAll();
    },

    /* ---------- 가족 ---------- */

    memberById(id) {
      return store.members.find((m) => m.id === id) || null;
    },
    // 로그인한 메일로 '나' 를 짚어 준다 (부모는 자기 메일을 적어 두면 고를 필요가 없다).
    memberByEmail(email) {
      if (!email) return null;
      const wanted = email.trim().toLowerCase();
      return store.members.find((m) => (m.email || '').toLowerCase() === wanted) || null;
    },
    livingMembers() {
      return store.members.filter((m) => !m.archived);
    },
    async addMember(row) {
      const saved = await backend.addMember({
        name: row.name,
        emoji: row.emoji || '🙂',
        role: row.role || 'child',
        email: row.email || null,
        sort_order: store.members.length,
        archived: false,
      });
      store.members.push(saved);
      return saved;
    },
    async editMember(id, changes) {
      const saved = await backend.editMember(id, changes);
      replace(store.members, id, saved || changes);
    },
    async dropMember(id) {
      // 글을 쓴 적 있는 사람은 지우지 않고 감춘다. 지난 기록이 이름을 잃지 않게.
      const used =
        store.stories.some((s) => s.member_id === id) ||
        store.ideas.some((i) => i.member_id === id) ||
        store.replies.some((r) => r.member_id === id);
      if (used) return store.editMember(id, { archived: true });
      await backend.dropMember(id);
      store.members = store.members.filter((m) => m.id !== id);
    },

    /* ---------- 하루 기록 ---------- */

    storiesOn(iso) {
      return store.stories.filter((s) => s.happened_on === iso);
    },
    // 한 사람이 그날 쓴 이야기들. 하루에 여러 개 쓸 수 있다(최대 MAX_STORIES_PER_DAY).
    storiesOf(memberId, iso) {
      return store.stories.filter((s) => s.member_id === memberId && s.happened_on === iso);
    },
    storyOf(memberId, iso) {
      return store.storiesOf(memberId, iso)[0] || null;
    },
    roomLeft(memberId, iso) {
      return MAX_STORIES_PER_DAY - store.storiesOf(memberId, iso).length;
    },
    // 그 달에 기록이 있는 날들을 최근 날짜부터.
    daysIn(ym, memberId) {
      const days = new Map();
      for (const s of store.stories) {
        if (monthOf(s.happened_on) !== ym) continue;
        if (memberId && s.member_id !== memberId) continue;
        if (!days.has(s.happened_on)) days.set(s.happened_on, []);
        days.get(s.happened_on).push(s);
      }
      return [...days.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([iso, stories]) => ({ iso, stories }));
    },
    // "작년 오늘" — 같은 월·일의 지난 해 기록.
    onThisDay(iso = today()) {
      const tail = iso.slice(5);
      return store.stories.filter((s) => s.happened_on.slice(5) === tail && s.happened_on < iso);
    },
    async addStory(row) {
      // 화면에서도 막지만, 여러 기기에서 동시에 쓰는 경우가 있으니 여기서도 본다.
      if (store.roomLeft(row.member_id, row.happened_on) <= 0) {
        throw new Error(`하루에 ${MAX_STORIES_PER_DAY}개까지만 쓸 수 있어요.`);
      }
      const saved = await backend.addStory({
        happened_on: row.happened_on,
        member_id: row.member_id,
        mood: row.mood || null,
        body: row.body,
      });
      store.stories.push(saved);
      sortAll();
      return saved;
    },
    async editStory(id, changes) {
      const saved = await backend.editStory(id, changes);
      replace(store.stories, id, saved || changes);
    },
    async dropStory(id) {
      await dropReplies(id);
      await backend.dropStory(id);
      store.stories = store.stories.filter((s) => s.id !== id);
    },

    /* ---------- 추천 ---------- */

    ideasWhere({ status, kind }) {
      return store.ideas.filter(
        (i) => (!status || i.status === status) && (!kind || i.kind === kind),
      );
    },
    async addIdea(row) {
      const saved = await backend.addIdea({
        member_id: row.member_id,
        kind: row.kind,
        title: row.title,
        reason: row.reason || null,
        link: row.link || null,
        status: 'want',
        done_on: null,
        review: null,
      });
      store.ideas.unshift(saved);
      return saved;
    },
    async editIdea(id, changes) {
      const saved = await backend.editIdea(id, changes);
      replace(store.ideas, id, saved || changes);
    },
    async dropIdea(id) {
      await dropReplies(id);
      await backend.dropIdea(id);
      store.ideas = store.ideas.filter((i) => i.id !== id);
    },

    /* ---------- 반응·한마디 ---------- */

    repliesFor(targetId) {
      return store.replies.filter((r) => r.target_id === targetId);
    },
    async addReply(row) {
      const saved = await backend.addReply({
        target_type: row.target_type,
        target_id: row.target_id,
        member_id: row.member_id,
        emoji: row.emoji || null,
        body: row.body || null,
      });
      store.replies.push(saved);
      return saved;
    },
    async dropReply(id) {
      await backend.dropReply(id);
      store.replies = store.replies.filter((r) => r.id !== id);
    },

    /* ---------- 통계 ---------- */

    statsOf(memberId) {
      const mine = store.stories
        .filter((s) => s.member_id === memberId)
        .map((s) => s.happened_on)
        .sort();
      const dates = new Set(mine);
      const last = mine[mine.length - 1] || null;

      // 며칠 연속으로 썼는지. 오늘 아직 안 썼어도 어제까지 이어졌으면 끊긴 게 아니다.
      let streak = 0;
      let cursor = dates.has(today()) ? today() : shiftDay(today(), -1);
      while (dates.has(cursor)) {
        streak += 1;
        cursor = shiftDay(cursor, -1);
      }
      return {
        stories: dates.size,
        ideas: store.ideas.filter((i) => i.member_id === memberId).length,
        streak,
        last,
      };
    },

    // 가족 화면의 내보내기용.
    snapshot() {
      return {
        members: store.members,
        stories: store.stories,
        ideas: store.ideas,
        replies: store.replies,
      };
    },
    async importAll(data) {
      await backend.replaceAll(data);
      await store.reload();
    },
  };

  async function seed() {
    for (const [index, member] of DEFAULT_MEMBERS.entries()) {
      const saved = await backend.addMember({ ...member, sort_order: index, archived: false });
      store.members.push(saved);
    }
  }

  async function dropReplies(targetId) {
    // replies.target_id 는 story/idea 를 함께 가리키는 칼럼이라 외래키 연쇄삭제가 걸려 있지 않다.
    for (const reply of store.repliesFor(targetId)) {
      await backend.dropReply(reply.id);
    }
    store.replies = store.replies.filter((r) => r.target_id !== targetId);
  }

  function sortAll() {
    store.members.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    store.stories.sort((a, b) =>
      a.happened_on === b.happened_on
        ? String(a.created_at).localeCompare(String(b.created_at))
        : a.happened_on < b.happened_on
          ? 1
          : -1,
    );
    store.ideas.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    store.replies.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  function replace(list, id, changes) {
    const row = list.find((r) => r.id === id);
    if (row) Object.assign(row, changes);
  }

  await store.reload();
  return store;
}
