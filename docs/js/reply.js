// 글에 붙는 반응(이모지)과 한마디. 하루 기록과 추천이 똑같이 쓴다.

import { h, clear, REACTIONS, fmtNear } from './util.js';

export function replyBlock(ctx, targetType, target) {
  const { store, state } = ctx;
  const replies = store.repliesFor(target.id);
  const reactions = replies.filter((r) => r.emoji);
  const notes = replies.filter((r) => r.body);

  const box = h('div', { class: 'replies' });

  /* --- 이모지 반응 --- */
  const bar = h('div', { class: 'reaction-bar' });
  for (const emoji of REACTIONS) {
    const mine = reactions.find((r) => r.emoji === emoji && r.member_id === state.meId);
    const count = reactions.filter((r) => r.emoji === emoji).length;
    bar.appendChild(
      h(
        'button',
        {
          class: `reaction${mine ? ' on' : ''}`,
          type: 'button',
          title: reactions
            .filter((r) => r.emoji === emoji)
            .map((r) => store.memberById(r.member_id)?.name || '?')
            .join(', '),
          onclick: () => toggle(emoji, mine),
        },
        emoji,
        count > 0 ? h('span', { class: 'reaction-count', text: String(count) }) : null,
      ),
    );
  }
  box.appendChild(bar);

  async function toggle(emoji, mine) {
    if (!requireMe()) return;
    if (mine) await store.dropReply(mine.id);
    else
      await store.addReply({
        target_type: targetType,
        target_id: target.id,
        member_id: state.meId,
        emoji,
      });
    ctx.refresh();
  }

  /* --- 한마디 --- */
  if (notes.length) {
    const list = h('ul', { class: 'notes' });
    for (const note of notes) {
      const who = store.memberById(note.member_id);
      list.appendChild(
        h(
          'li',
          { class: 'note' },
          h('span', { class: 'note-who', text: `${who?.emoji || '🙂'} ${who?.name || '누군가'}` }),
          h('span', { class: 'note-body', text: note.body }),
          note.member_id === state.meId
            ? h('button', {
                class: 'link-btn tiny',
                type: 'button',
                text: '지우기',
                onclick: async () => {
                  await store.dropReply(note.id);
                  ctx.refresh();
                },
              })
            : null,
        ),
      );
    }
    box.appendChild(list);
  }

  const slot = h('div', { class: 'note-slot' });
  slot.appendChild(
    h('button', {
      class: 'link-btn',
      type: 'button',
      text: '한마디 쓰기',
      onclick: () => openForm(slot),
    }),
  );
  box.appendChild(slot);

  function openForm(host) {
    if (!requireMe()) return;
    clear(host);
    const input = h('input', {
      class: 'note-input',
      type: 'text',
      maxlength: '200',
      placeholder: '따뜻한 한마디를 남겨 주세요',
    });
    const save = async () => {
      const body = input.value.trim();
      if (!body) return;
      await store.addReply({
        target_type: targetType,
        target_id: target.id,
        member_id: state.meId,
        body,
      });
      ctx.refresh();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') ctx.refresh();
    });
    host.appendChild(
      h(
        'div',
        { class: 'note-form' },
        input,
        h('button', { class: 'btn small', type: 'button', text: '남기기', onclick: save }),
      ),
    );
    input.focus();
  }

  function requireMe() {
    if (state.meId) return true;
    ctx.needMe();
    return false;
  }

  return box;
}

export function authorChip(store, memberId, when) {
  const who = store.memberById(memberId);
  return h(
    'div',
    { class: 'author' },
    h('span', { class: 'author-emoji', text: who?.emoji || '🙂' }),
    h('span', { class: 'author-name', text: who?.name || '누군가' }),
    when ? h('span', { class: 'author-when', text: fmtNear(when) }) : null,
  );
}
