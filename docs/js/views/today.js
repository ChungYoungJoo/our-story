// 오늘 화면 — 그날 있었던 일을 쓰고, 가족이 쓴 걸 본다.

import { h, MOODS, moodOf, fmtFull, fmtNear, today, shiftDay } from '../util.js';
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

  if (!isFuture) root.appendChild(writer(ctx, day));

  const memories = store.onThisDay(day);
  if (memories.length) root.appendChild(lookBack(ctx, memories));

  const stories = store.storiesOn(day).filter((s) => s.member_id !== state.meId);
  if (stories.length) {
    root.appendChild(h('h2', { class: 'section', text: '가족이 쓴 이야기' }));
    for (const story of stories) root.appendChild(storyCard(ctx, story));
  }

  const waiting = store
    .livingMembers()
    .filter((m) => !store.storyOf(m.id, day))
    .map((m) => `${m.emoji} ${m.name}`);
  if (waiting.length && !isFuture) {
    root.appendChild(
      h('p', { class: 'hint', text: `아직 안 쓴 사람: ${waiting.join('  ')}` }),
    );
  }
}

function dateBar(ctx, day) {
  const back = h('button', {
    class: 'step',
    type: 'button',
    text: '‹',
    title: '전날',
    onclick: () => ctx.set({ day: shiftDay(day, -1) }),
  });
  const forward = h('button', {
    class: 'step',
    type: 'button',
    text: '›',
    title: '다음날',
    disabled: day >= today(),
    onclick: () => ctx.set({ day: shiftDay(day, 1) }),
  });
  return h(
    'div',
    { class: 'date-bar' },
    back,
    h(
      'div',
      { class: 'date-label' },
      h('div', { class: 'date-main', text: fmtFull(day) }),
      h('div', { class: 'date-sub', text: fmtNear(day) }),
    ),
    forward,
  );
}

function whoAmI(ctx) {
  const { store } = ctx;
  const grid = h('div', { class: 'who-grid' });
  for (const member of store.livingMembers()) {
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

function writer(ctx, day) {
  const { store, state } = ctx;
  const me = store.memberById(state.meId);
  const existing = store.storyOf(state.meId, day);
  const draft = state.draft;

  // 이미 쓴 글이 있으면 그 내용으로 시작한다(고쳐 쓰기).
  if (draft.key !== `${state.meId}|${day}`) {
    draft.key = `${state.meId}|${day}`;
    draft.mood = existing ? existing.mood : null;
    draft.body = existing ? existing.body : '';
  }

  const moodRow = h('div', { class: 'mood-row' });
  for (const mood of MOODS) {
    const on = draft.mood === mood.key;
    moodRow.appendChild(
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

  const save = h('button', {
    class: 'btn',
    type: 'button',
    text: existing ? '고쳐 쓰기' : '저장하기',
    onclick: async () => {
      const body = draft.body.trim();
      if (!body) {
        area.focus();
        return;
      }
      await ctx.guard(async () => {
        if (existing) {
          await store.editStory(existing.id, { body, mood: draft.mood });
        } else {
          await store.addStory({
            happened_on: day,
            member_id: state.meId,
            mood: draft.mood,
            body,
          });
        }
        draft.key = null;
      });
    },
  });

  const actions = h('div', { class: 'row-end' }, save);
  if (existing) {
    actions.insertBefore(
      h('button', {
        class: 'link-btn',
        type: 'button',
        text: '지우기',
        onclick: async () => {
          if (!confirm('이 기록을 지울까요?')) return;
          await ctx.guard(async () => {
            await store.dropStory(existing.id);
            draft.key = null;
          });
        },
      }),
      save,
    );
  }

  const card = h(
    'section',
    { class: 'card writer' },
    h('h2', { text: `${me.name}의 하루` }),
    h('p', { class: 'muted', text: '기분을 먼저 고르고, 있었던 일을 적어요.' }),
    moodRow,
    area,
    actions,
  );

  if (existing) card.appendChild(replyBlock(ctx, 'story', existing));
  return card;
}

function lookBack(ctx, memories) {
  const box = h(
    'section',
    { class: 'card lookback' },
    h('h2', { text: '🕰️ 지난 오늘' }),
  );
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

export function storyCard(ctx, story) {
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
  card.appendChild(replyBlock(ctx, 'story', story));
  return card;
}
