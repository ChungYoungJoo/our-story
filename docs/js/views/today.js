// 오늘 화면 — 그날 있었던 일을 쓰고, 가족이 쓴 걸 본다.
//
// 쓰는 칸과 올라간 글은 분리한다. 저장하면 내 글도 남의 글과 똑같은 카드로 보이고,
// 고치고 싶을 때만 '고치기' 로 그 카드가 편집 상태가 된다.
// 한 사람이 하루에 MAX_STORIES_PER_DAY 개까지 쓸 수 있다.

import {
  h, MOODS, moodOf, fmtFull, fmtNear, today, shiftDay, MAX_STORIES_PER_DAY,
} from '../util.js';
import { replyBlock, authorChip } from '../reply.js';

export function render(root, ctx) {
  const { store, state } = ctx;
  const day = state.day;
  const isFuture = day > today();

  root.appendChild(dateBar(ctx, day));

  if (!state.meId) {
    root.appendChild(whoAmI(ctx));
    return;
  }

  if (!isFuture) root.appendChild(composer(ctx, day));

  const memories = store.onThisDay(day);
  if (memories.length) root.appendChild(lookBack(ctx, memories));

  // 방금 쓴 글이 쓰는 칸 바로 아래 보이도록 새 글을 위에 둔다.
  const stories = store.storiesOn(day).slice().reverse();
  if (stories.length) {
    root.appendChild(h('h2', { class: 'section', text: '오늘의 이야기' }));
    for (const story of stories) root.appendChild(storyCard(ctx, story));
  }

  const waiting = store
    .livingMembers()
    .filter((m) => store.storiesOf(m.id, day).length === 0)
    .map((m) => `${m.emoji} ${m.name}`);
  if (waiting.length && !isFuture) {
    root.appendChild(h('p', { class: 'hint', text: `아직 안 쓴 사람: ${waiting.join('  ')}` }));
  }
}

function dateBar(ctx, day) {
  return h(
    'div',
    { class: 'date-bar' },
    h('button', {
      class: 'step',
      type: 'button',
      text: '‹',
      title: '전날',
      onclick: () => ctx.set({ day: shiftDay(day, -1) }),
    }),
    h(
      'div',
      { class: 'date-label' },
      h('div', { class: 'date-main', text: fmtFull(day) }),
      h('div', { class: 'date-sub', text: fmtNear(day) }),
    ),
    h('button', {
      class: 'step',
      type: 'button',
      text: '›',
      title: '다음날',
      disabled: day >= today(),
      onclick: () => ctx.set({ day: shiftDay(day, 1) }),
    }),
  );
}

function whoAmI(ctx) {
  const grid = h('div', { class: 'who-grid' });
  for (const member of ctx.store.livingMembers()) {
    grid.appendChild(
      h(
        'button',
        { class: 'who-btn', type: 'button', onclick: () => ctx.pickMe(member.id) },
        h('span', { class: 'who-emoji', text: member.emoji }),
        h('span', { class: 'who-name', text: member.name }),
      ),
    );
  }
  return h(
    'section',
    { class: 'card welcome' },
    h('h2', { text: '누구세요?' }),
    h('p', { class: 'muted', text: '이 기기에서 글을 쓸 사람을 골라 주세요. 나중에 언제든 바꿀 수 있어요.' }),
    grid,
  );
}

/* ---------- 새 글 쓰기 ---------- */

function composer(ctx, day) {
  const { store, state } = ctx;
  const me = store.memberById(state.meId);
  const written = store.storiesOf(state.meId, day).length;
  const left = store.roomLeft(state.meId, day);

  if (left <= 0) {
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: `오늘 ${written}개를 다 썼어요` }),
      h('p', {
        class: 'muted',
        text: `하루에 ${MAX_STORIES_PER_DAY}개까지 쓸 수 있어요. 쓴 글은 아래에서 고칠 수 있어요.`,
      }),
    );
  }

  const draft = state.draft;
  if (draft.key !== `${state.meId}|${day}`) {
    draft.key = `${state.meId}|${day}`;
    draft.mood = null;
    draft.body = '';
  }

  const area = h('textarea', {
    class: 'story-input',
    rows: '5',
    maxlength: '2000',
    placeholder: '오늘 무슨 일이 있었어요? 어떤 기분이었는지도 같이 적어 보세요.',
    value: draft.body,
    oninput: (e) => {
      draft.body = e.target.value;
    },
  });

  const save = async () => {
    const body = draft.body.trim();
    if (!body) return area.focus();
    await ctx.guard(async () => {
      await store.addStory({
        happened_on: day,
        member_id: state.meId,
        mood: draft.mood,
        body,
      });
      draft.mood = null;
      draft.body = '';
    });
  };

  return h(
    'section',
    { class: 'card writer' },
    h('h2', { text: written ? `${me.name}의 하루 (${written}/${MAX_STORIES_PER_DAY})` : `${me.name}의 하루` }),
    h('p', {
      class: 'muted',
      text: written
        ? `${left}개 더 쓸 수 있어요. 기분을 고르고 적어 보세요.`
        : '기분을 먼저 고르고, 있었던 일을 적어요.',
    }),
    moodRow(ctx, draft),
    area,
    h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'button', text: '올리기', onclick: save })),
  );
}

// 기분 고르는 줄. 새 글 쓰기와 고쳐 쓰기가 같이 쓴다.
function moodRow(ctx, draft) {
  const row = h('div', { class: 'mood-row' });
  for (const mood of MOODS) {
    const on = draft.mood === mood.key;
    row.appendChild(
      h(
        'button',
        {
          class: `mood${on ? ' on' : ''}`,
          type: 'button',
          onclick: () => {
            draft.mood = on ? null : mood.key;
            ctx.refresh();
          },
        },
        h('span', { class: 'mood-emoji', text: mood.emoji }),
        h('span', { class: 'mood-label', text: mood.label }),
      ),
    );
  }
  return row;
}

function lookBack(ctx, memories) {
  const box = h('section', { class: 'card lookback' }, h('h2', { text: '🕰️ 지난 오늘' }));
  for (const story of memories.slice(0, 3)) {
    const who = ctx.store.memberById(story.member_id);
    box.appendChild(
      h(
        'div',
        { class: 'lookback-item' },
        h('div', {
          class: 'lookback-when',
          text: `${story.happened_on.slice(0, 4)}년 · ${who?.emoji || ''} ${who?.name || ''}`,
        }),
        h('div', { class: 'lookback-body', text: story.body }),
      ),
    );
  }
  return box;
}

/* ---------- 올라간 글 ---------- */

export function storyCard(ctx, story) {
  if (ctx.state.editingStory === story.id) return storyEditor(ctx, story);

  const mine = story.member_id === ctx.state.meId;
  const mood = moodOf(story.mood);

  const card = h(
    'article',
    { class: 'card story' },
    h(
      'div',
      { class: 'story-head' },
      authorChip(ctx.store, story.member_id, story.happened_on),
      mood ? h('span', { class: 'story-mood', title: mood.label, text: mood.emoji }) : null,
    ),
    h('p', { class: 'story-body', text: story.body }),
  );

  if (mine) {
    card.appendChild(
      h(
        'div',
        { class: 'row-end' },
        h('button', {
          class: 'link-btn tiny',
          type: 'button',
          text: '지우기',
          onclick: async () => {
            if (!confirm('이 이야기를 지울까요?')) return;
            await ctx.guard(() => ctx.store.dropStory(story.id));
          },
        }),
        h('button', {
          class: 'link-btn tiny',
          type: 'button',
          text: '고치기',
          onclick: () => ctx.set({ editingStory: story.id }),
        }),
      ),
    );
  }

  card.appendChild(replyBlock(ctx, 'story', story));
  return card;
}

function storyEditor(ctx, story) {
  const { store, state } = ctx;
  const draft = state.editDraft;
  if (draft.key !== story.id) {
    draft.key = story.id;
    draft.mood = story.mood;
    draft.body = story.body;
  }

  const area = h('textarea', {
    class: 'story-input',
    rows: '5',
    maxlength: '2000',
    value: draft.body,
    oninput: (e) => {
      draft.body = e.target.value;
    },
  });

  const save = async () => {
    const body = draft.body.trim();
    if (!body) return area.focus();
    await ctx.guard(async () => {
      await store.editStory(story.id, { body, mood: draft.mood });
      state.editingStory = null;
      draft.key = null;
    });
  };

  return h(
    'article',
    { class: 'card story editing' },
    h('h2', { class: 'section', text: '고쳐 쓰기' }),
    moodRow(ctx, draft),
    area,
    h(
      'div',
      { class: 'row-end' },
      h('button', {
        class: 'link-btn',
        type: 'button',
        text: '취소',
        onclick: () => {
          draft.key = null;
          ctx.set({ editingStory: null });
        },
      }),
      h('button', { class: 'btn small', type: 'button', text: '저장', onclick: save }),
    ),
  );
}
