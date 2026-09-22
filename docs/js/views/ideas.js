// 추천 화면 — "이런 책이 좋대", "여기 재밌대", "이거 해보자" 를 모아 두고
// 실제로 해 본 것은 '해봤어' 로 옮겨 소감을 남긴다.

import { h, KINDS, kindOf, fmtDay, today } from '../util.js';
import { replyBlock, authorChip } from '../reply.js';

export function render(root, ctx) {
  const { store, state } = ctx;

  root.appendChild(statusTabs(ctx));
  root.appendChild(kindFilter(ctx));
  root.appendChild(addBox(ctx));

  const list = store.ideasWhere({ status: state.ideaStatus, kind: state.ideaKind });
  if (!list.length) {
    root.appendChild(
      h('p', {
        class: 'empty',
        text:
          state.ideaStatus === 'want'
            ? '아직 담아 둔 추천이 없어요. 위에서 하나 더해 보세요.'
            : '아직 해 본 것이 없어요.',
      }),
    );
    return;
  }
  for (const idea of list) root.appendChild(ideaCard(ctx, idea));
}

function statusTabs(ctx) {
  const { store, state } = ctx;
  const count = (status) => store.ideasWhere({ status }).length;
  const tab = (label, value) =>
    h('button', {
      class: `seg${state.ideaStatus === value ? ' on' : ''}`,
      type: 'button',
      text: `${label} ${count(value)}`,
      onclick: () => ctx.set({ ideaStatus: value }),
    });
  return h('div', { class: 'segs' }, tab('하고 싶어', 'want'), tab('해봤어', 'done'));
}

function kindFilter(ctx) {
  const { state } = ctx;
  const row = h('div', { class: 'chips' });
  const chip = (label, value) =>
    h('button', {
      class: `chip${state.ideaKind === value ? ' on' : ''}`,
      type: 'button',
      text: label,
      onclick: () => ctx.set({ ideaKind: value }),
    });
  row.appendChild(chip('전체', null));
  for (const kind of KINDS) row.appendChild(chip(`${kind.emoji} ${kind.label}`, kind.key));
  return row;
}

function addBox(ctx) {
  const { store, state } = ctx;
  const draft = state.ideaDraft;

  if (!draft.open) {
    return h('button', {
      class: 'btn wide',
      type: 'button',
      text: '＋ 추천 더하기',
      onclick: () => {
        if (!state.meId) return ctx.needMe();
        draft.open = true;
        ctx.refresh();
      },
    });
  }

  const kindRow = h('div', { class: 'mood-row' });
  for (const kind of KINDS) {
    kindRow.appendChild(
      h(
        'button',
        {
          class: `mood${draft.kind === kind.key ? ' on' : ''}`,
          type: 'button',
          onclick: () => {
            draft.kind = kind.key;
            ctx.refresh();
          },
        },
        h('span', { class: 'mood-emoji', text: kind.emoji }),
        h('span', { class: 'mood-label', text: kind.label }),
      ),
    );
  }

  const field = (key, placeholder, max) =>
    h('input', {
      class: 'text-input',
      type: 'text',
      maxlength: String(max),
      placeholder,
      value: draft[key] || '',
      oninput: (e) => {
        draft[key] = e.target.value;
      },
    });

  const title = field('title', '무엇을 추천해요? (책 제목, 장소 이름 …)', 120);
  const reason = field('reason', '왜 좋을 것 같아요? 한 줄이면 충분해요', 300);
  const link = field('link', '링크가 있으면 붙여 주세요 (없어도 돼요)', 500);

  const close = () => {
    draft.open = false;
    draft.title = '';
    draft.reason = '';
    draft.link = '';
    ctx.refresh();
  };

  return h(
    'section',
    { class: 'card' },
    h('h2', { text: '무엇을 추천할까요?' }),
    kindRow,
    title,
    reason,
    link,
    h(
      'div',
      { class: 'row-end' },
      h('button', { class: 'link-btn', type: 'button', text: '취소', onclick: close }),
      h('button', {
        class: 'btn',
        type: 'button',
        text: '담아 두기',
        onclick: async () => {
          const text = (draft.title || '').trim();
          if (!text) {
            title.focus();
            return;
          }
          await ctx.guard(async () => {
            await store.addIdea({
              member_id: state.meId,
              kind: draft.kind || 'todo',
              title: text,
              reason: (draft.reason || '').trim(),
              link: (draft.link || '').trim(),
            });
            draft.open = false;
            draft.title = '';
            draft.reason = '';
            draft.link = '';
            state.ideaStatus = 'want';
          });
        },
      }),
    ),
  );
}

function ideaCard(ctx, idea) {
  const { store, state } = ctx;
  const kind = kindOf(idea.kind);
  const done = idea.status === 'done';

  const head = h(
    'div',
    { class: 'idea-head' },
    h('span', { class: 'idea-kind', title: kind.label, text: kind.emoji }),
    h('h3', { class: 'idea-title', text: idea.title }),
  );

  const card = h('article', { class: `card idea${done ? ' done' : ''}` }, head);

  if (idea.reason) card.appendChild(h('p', { class: 'idea-reason', text: idea.reason }));
  if (idea.link) {
    card.appendChild(
      h('a', {
        class: 'idea-link',
        href: idea.link,
        target: '_blank',
        rel: 'noopener noreferrer',
        text: '링크 열기 ↗',
      }),
    );
  }

  card.appendChild(authorChip(store, idea.member_id, null));

  if (done) {
    card.appendChild(
      h('p', {
        class: 'idea-doneon',
        text: idea.done_on ? `✅ ${fmtDay(idea.done_on)}에 해봤어요` : '✅ 해봤어요',
      }),
    );
    card.appendChild(reviewBox(ctx, idea));
  }

  const actions = h('div', { class: 'row-end' });
  actions.appendChild(
    h('button', {
      class: done ? 'link-btn' : 'btn small',
      type: 'button',
      text: done ? '다시 하고 싶어' : '해봤어!',
      onclick: async () => {
        if (!state.meId) return ctx.needMe();
        const next = done ? 'want' : 'done';
        await ctx.guard(async () => {
          await store.editIdea(idea.id, { status: next, done_on: done ? null : today() });
          // 옮겨 간 쪽을 보여 준다. 그러지 않으면 누른 카드가 그냥 사라진 것처럼 보인다.
          state.ideaStatus = next;
          if (next === 'done') state.editingReview = idea.id;
        });
      },
    }),
  );
  if (idea.member_id === state.meId) {
    actions.insertBefore(
      h('button', {
        class: 'link-btn',
        type: 'button',
        text: '지우기',
        onclick: async () => {
          if (!confirm(`'${idea.title}' 을 지울까요?`)) return;
          await ctx.guard(() => store.dropIdea(idea.id));
        },
      }),
      actions.firstChild,
    );
  }
  card.appendChild(actions);

  card.appendChild(replyBlock(ctx, 'idea', idea));
  return card;
}

function reviewBox(ctx, idea) {
  const { store, state } = ctx;
  if (idea.review) {
    return h(
      'div',
      { class: 'review' },
      h('span', { class: 'review-label', text: '소감' }),
      h('p', { class: 'review-body', text: idea.review }),
      h('button', {
        class: 'link-btn tiny',
        type: 'button',
        text: '고치기',
        onclick: () => ctx.set({ editingReview: idea.id }),
      }),
    );
  }
  if (state.editingReview !== idea.id) {
    return h('button', {
      class: 'link-btn',
      type: 'button',
      text: '해보니 어땠어요?',
      onclick: () => {
        if (!state.meId) return ctx.needMe();
        ctx.set({ editingReview: idea.id });
      },
    });
  }

  const input = h('input', {
    class: 'text-input',
    type: 'text',
    maxlength: '500',
    placeholder: '해보니 어땠는지 적어 주세요',
    value: idea.review || '',
  });
  const save = async () => {
    await ctx.guard(async () => {
      await store.editIdea(idea.id, { review: input.value.trim() || null });
      state.editingReview = null;
    });
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') ctx.set({ editingReview: null });
  });
  return h(
    'div',
    { class: 'note-form' },
    input,
    h('button', { class: 'btn small', type: 'button', text: '남기기', onclick: save }),
  );
}
