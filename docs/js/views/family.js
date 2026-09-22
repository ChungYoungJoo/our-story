// 가족 화면 — 나를 바꾸고, 식구를 손보고, 기록이 어디에 저장되는지 확인한다.

import { h, fmtDay } from '../util.js';
import { configured, currentEmail } from '../auth.js';

const EMOJIS = ['👨', '👩', '🐰', '🐥', '🐻', '🐱', '🐶', '🦊', '🐼', '🦁', '🐸', '🐧', '🌷', '⭐'];

export function render(root, ctx) {
  const { store, state } = ctx;

  /* --- 나 --- */
  const me = state.meId ? store.memberById(state.meId) : null;
  root.appendChild(
    h(
      'section',
      { class: 'card' },
      h('h2', { text: '나' }),
      h('p', {
        class: 'muted',
        text: me
          ? `이 기기에서는 ${me.name}(으)로 글을 씁니다.`
          : '아직 고르지 않았어요. 글을 쓰려면 먼저 고릅니다.',
      }),
      whoGrid(ctx),
    ),
  );

  /* --- 식구 --- */
  const list = h('div', { class: 'member-list' });
  for (const member of store.members) {
    list.appendChild(memberRow(ctx, member));
  }
  root.appendChild(
    h(
      'section',
      { class: 'card' },
      h('h2', { text: '우리 식구' }),
      list,
      addMemberBox(ctx),
    ),
  );

  /* --- 저장 --- */
  root.appendChild(storageBox(ctx));
}

function whoGrid(ctx) {
  const { store, state } = ctx;
  const grid = h('div', { class: 'who-grid' });
  for (const member of store.livingMembers()) {
    grid.appendChild(
      h(
        'button',
        {
          class: `who-btn${state.meId === member.id ? ' on' : ''}`,
          type: 'button',
          onclick: () => ctx.pickMe(member.id),
        },
        h('span', { class: 'who-emoji', text: member.emoji }),
        h('span', { class: 'who-name', text: member.name }),
      ),
    );
  }
  return grid;
}

function memberRow(ctx, member) {
  const { store, state } = ctx;
  const stats = store.statsOf(member.id);

  if (state.editingMember === member.id) {
    const name = h('input', {
      class: 'text-input',
      type: 'text',
      maxlength: '20',
      value: member.name,
    });
    // 로그인을 쓰는 경우에만 뜻이 있는 칸이다.
    const email = configured
      ? h('input', {
          class: 'text-input',
          type: 'email',
          inputmode: 'email',
          maxlength: '120',
          placeholder: '이 사람의 로그인 메일 (없으면 비워 두세요)',
          value: member.email || '',
        })
      : null;
    const picked = { emoji: member.emoji };
    const palette = h('div', { class: 'emoji-row' });
    for (const emoji of EMOJIS) {
      const btn = h('button', {
        class: `emoji-btn${picked.emoji === emoji ? ' on' : ''}`,
        type: 'button',
        text: emoji,
        onclick: () => {
          picked.emoji = emoji;
          for (const other of palette.children) other.classList.remove('on');
          btn.classList.add('on');
        },
      });
      palette.appendChild(btn);
    }
    return h(
      'div',
      { class: 'member editing' },
      name,
      email,
      palette,
      h(
        'div',
        { class: 'row-end' },
        h('button', {
          class: 'link-btn',
          type: 'button',
          text: '취소',
          onclick: () => ctx.set({ editingMember: null }),
        }),
        h('button', {
          class: 'btn small',
          type: 'button',
          text: '저장',
          onclick: async () => {
            const text = name.value.trim();
            if (!text) return name.focus();
            const changes = { name: text, emoji: picked.emoji };
            if (email) changes.email = email.value.trim() || null;
            await ctx.guard(async () => {
              await store.editMember(member.id, changes);
              state.editingMember = null;
            });
          },
        }),
      ),
    );
  }

  return h(
    'div',
    { class: `member${member.archived ? ' archived' : ''}` },
    h('span', { class: 'member-emoji', text: member.emoji }),
    h(
      'div',
      { class: 'member-main' },
      h('div', { class: 'member-name', text: member.name + (member.archived ? ' (감춤)' : '') }),
      h('div', {
        class: 'member-stats',
        text: stats.stories
          ? `이야기 ${stats.stories}개 · 추천 ${stats.ideas}개 · ${stats.streak}일 연속 · 마지막 ${fmtDay(stats.last)}`
          : '아직 쓴 이야기가 없어요',
      }),
    ),
    h('button', {
      class: 'link-btn tiny',
      type: 'button',
      text: '고치기',
      onclick: () => ctx.set({ editingMember: member.id }),
    }),
    member.archived
      ? h('button', {
          class: 'link-btn tiny',
          type: 'button',
          text: '되살리기',
          onclick: () => ctx.guard(() => store.editMember(member.id, { archived: false })),
        })
      : h('button', {
          class: 'link-btn tiny',
          type: 'button',
          text: '감추기',
          onclick: async () => {
            if (!confirm(`${member.name}을(를) 목록에서 감출까요? 쓴 이야기는 그대로 남습니다.`)) return;
            await ctx.guard(async () => {
              await store.dropMember(member.id);
              if (ctx.state.meId === member.id) ctx.pickMe(null);
            });
          },
        }),
  );
}

function addMemberBox(ctx) {
  const { store, state } = ctx;
  if (!state.addingMember) {
    return h('button', {
      class: 'link-btn',
      type: 'button',
      text: '＋ 식구 더하기',
      onclick: () => ctx.set({ addingMember: true }),
    });
  }
  const name = h('input', {
    class: 'text-input',
    type: 'text',
    maxlength: '20',
    placeholder: '이름',
  });
  return h(
    'div',
    { class: 'member editing' },
    name,
    h(
      'div',
      { class: 'row-end' },
      h('button', {
        class: 'link-btn',
        type: 'button',
        text: '취소',
        onclick: () => ctx.set({ addingMember: false }),
      }),
      h('button', {
        class: 'btn small',
        type: 'button',
        text: '더하기',
        onclick: async () => {
          const text = name.value.trim();
          if (!text) return name.focus();
          await ctx.guard(async () => {
            await store.addMember({ name: text, emoji: '⭐', role: 'child' });
            state.addingMember = false;
          });
        },
      }),
    ),
  );
}

function storageBox(ctx) {
  const { store } = ctx;
  const box = h(
    'section',
    { class: 'card' },
    h('h2', { text: '저장' }),
    h('p', { class: 'muted', text: store.label }),
  );

  if (store.mode === 'local') {
    box.appendChild(
      h('p', {
        class: 'hint',
        text: '지금은 이 기기에만 저장돼요. 가족이 서로 보게 하려면 js/config.js 에 Supabase 주소와 키를 넣으세요.',
      }),
    );
  } else if (configured) {
    box.appendChild(
      h('p', { class: 'muted', text: `로그인: ${currentEmail() || '(주소를 확인하는 중)'}` }),
    );
    box.appendChild(
      h('p', {
        class: 'hint',
        text: '가족으로 등록된 메일만 들어올 수 있어요. 기기마다 한 번 로그인해 두면 계속 쓸 수 있어요.',
      }),
    );
  }
  if (store.error) {
    box.appendChild(h('p', { class: 'error', text: `연결 문제: ${store.error}` }));
  }

  const row = h('div', { class: 'row-end' });
  row.appendChild(
    h('button', {
      class: 'link-btn',
      type: 'button',
      text: '새로 받아오기',
      onclick: () => ctx.guard(() => store.reload()),
    }),
  );
  row.appendChild(
    h('button', {
      class: 'link-btn',
      type: 'button',
      text: '내보내기(백업)',
      onclick: () => exportJson(store),
    }),
  );
  if (configured) {
    row.appendChild(
      h('button', {
        class: 'link-btn',
        type: 'button',
        text: '로그아웃',
        onclick: () => ctx.signOut(),
      }),
    );
  }
  if (store.mode === 'local') {
    const picker = h('input', {
      type: 'file',
      accept: '.json,application/json',
      style: 'display:none',
      onchange: (e) => importJson(ctx, e.target.files[0]),
    });
    row.appendChild(picker);
    row.appendChild(
      h('button', {
        class: 'link-btn',
        type: 'button',
        text: '가져오기',
        onclick: () => picker.click(),
      }),
    );
  }
  box.appendChild(row);
  return box;
}

function exportJson(store) {
  const blob = new Blob([JSON.stringify(store.snapshot(), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: `our-story-${new Date().toISOString().slice(0, 10)}.json` });
  link.click();
  URL.revokeObjectURL(url);
}

async function importJson(ctx, file) {
  if (!file) return;
  if (!confirm('지금 이 기기에 있는 기록을 가져온 파일로 덮어씁니다. 계속할까요?')) return;
  try {
    const data = JSON.parse(await file.text());
    await ctx.store.importAll(data);
    ctx.refresh();
  } catch (err) {
    alert(`가져오지 못했습니다: ${err.message}`);
  }
}
