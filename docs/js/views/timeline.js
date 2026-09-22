// 이야기 화면 — 지난 기록을 달 단위로 훑어본다.

import { h, fmtDay, fmtMonth, shiftMonth, monthOf, today } from '../util.js';
import { storyCard } from './today.js';

export function render(root, ctx) {
  const { store, state } = ctx;
  const ym = state.month;

  root.appendChild(
    h(
      'div',
      { class: 'date-bar' },
      h('button', {
        class: 'step',
        type: 'button',
        text: '‹',
        title: '지난 달',
        onclick: () => ctx.set({ month: shiftMonth(ym, -1) }),
      }),
      h(
        'div',
        { class: 'date-label' },
        h('div', { class: 'date-main', text: fmtMonth(ym) }),
        h('div', { class: 'date-sub', text: countLabel(store, ym, state.who) }),
      ),
      h('button', {
        class: 'step',
        type: 'button',
        text: '›',
        title: '다음 달',
        disabled: ym >= monthOf(today()),
        onclick: () => ctx.set({ month: shiftMonth(ym, 1) }),
      }),
    ),
  );

  root.appendChild(whoFilter(ctx));

  const days = store.daysIn(ym, state.who);
  if (!days.length) {
    root.appendChild(
      h('p', { class: 'empty', text: '이 달에는 아직 기록이 없어요.' }),
    );
    return;
  }

  for (const { iso, stories } of days) {
    root.appendChild(
      h(
        'div',
        { class: 'day-head' },
        h('h2', { class: 'day-title', text: fmtDay(iso) }),
        h('button', {
          class: 'link-btn',
          type: 'button',
          text: '이 날 쓰기',
          onclick: () => ctx.set({ tab: 'today', day: iso }),
        }),
      ),
    );
    for (const story of stories) root.appendChild(storyCard(ctx, story));
  }
}

function countLabel(store, ym, who) {
  const days = store.daysIn(ym, who);
  const count = days.reduce((sum, d) => sum + d.stories.length, 0);
  return count ? `${days.length}일 · ${count}개의 이야기` : '기록 없음';
}

function whoFilter(ctx) {
  const { store, state } = ctx;
  const row = h('div', { class: 'chips' });
  const chip = (label, value) =>
    h('button', {
      class: `chip${state.who === value ? ' on' : ''}`,
      type: 'button',
      text: label,
      onclick: () => ctx.set({ who: value }),
    });

  row.appendChild(chip('모두', null));
  for (const member of store.livingMembers()) {
    row.appendChild(chip(`${member.emoji} ${member.name}`, member.id));
  }
  return row;
}
