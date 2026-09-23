// 앱 시작점 — 문(로그인)을 지나면 상태를 들고 탭에 맞는 화면을 그린다.
//
// refresh() 는 매번 <main> 을 새로 만들어 갈아 끼운다. 그래서 화면이 컨테이너에
// 걸어 둔 이벤트 핸들러가 쌓이지 않는다. 화면 안에서 다시 그릴 때는 render() 를
// 직접 부르지 말고 ctx.refresh() / ctx.set() 을 쓸 것.

import { h, clear, today, monthOf } from './util.js';
import { createStore } from './store.js';
import * as auth from './auth.js';
import { amFamily } from './remote.js';
import * as loginView from './views/login.js';
import * as todayView from './views/today.js';
import * as timelineView from './views/timeline.js';
import * as ideasView from './views/ideas.js';
import * as familyView from './views/family.js';

const ME_KEY = 'our-story.me';

const TABS = [
  { id: 'today', label: '오늘', emoji: '☀️', view: todayView },
  { id: 'timeline', label: '이야기', emoji: '📖', view: timelineView },
  { id: 'ideas', label: '추천', emoji: '💡', view: ideasView },
  { id: 'family', label: '가족', emoji: '🏡', view: familyView },
];

// gate: 'loading' | 'login' | 'stranger' | 'ready'
const state = {
  gate: 'loading',
  tab: 'today',
  meId: localStorage.getItem(ME_KEY) || null,
  day: today(),
  month: monthOf(today()),
  who: null, // 이야기 화면의 사람 필터
  ideaStatus: 'want',
  ideaKind: null,
  ideaDraft: { open: false, kind: 'book', title: '', reason: '', link: '' },
  draft: { key: null, mood: null, body: '' }, // 오늘 화면에서 새로 쓰던 글
  editingStory: null, // 지금 고쳐 쓰는 중인 이야기 id
  editDraft: { key: null, mood: null, body: '' },
  editingMember: null,
  addingMember: false,
  editingReview: null,
  login: { email: '', sent: false, codeMode: false, busy: false, error: null },
};

let store = null;

const ctx = {
  get store() {
    return store;
  },
  state,
  refresh,
  set(changes) {
    Object.assign(state, changes);
    refresh();
  },
  pickMe(id) {
    state.meId = id;
    if (id) localStorage.setItem(ME_KEY, id);
    else localStorage.removeItem(ME_KEY);
    state.draft.key = null; // 다른 사람으로 바뀌었으니 쓰던 글을 비운다
    state.editingStory = null;
    state.editDraft.key = null;
    refresh();
  },
  needMe() {
    state.tab = 'family';
    refresh();
    alert('먼저 내가 누구인지 골라 주세요.');
  },
  // 저장·삭제처럼 실패할 수 있는 일을 감싼다. 실패하면 알려 주고 화면은 살려 둔다.
  async guard(work) {
    try {
      await work();
    } catch (err) {
      alert(`저장하지 못했습니다.\n\n${err.message || err}`);
    }
    refresh();
  },
  afterLogin: enterAfterLogin,
  async signOut() {
    if (!confirm('이 기기에서 로그아웃할까요? 다시 들어오려면 메일 링크가 필요해요.')) return;
    await auth.signOut();
    location.reload();
  },
};

function refresh() {
  drawTop();
  drawTabs();

  const fresh = h('main', { class: 'view', id: 'view' });
  document.getElementById('view').replaceWith(fresh);

  if (state.gate === 'loading') {
    fresh.appendChild(h('p', { class: 'empty', text: '불러오는 중…' }));
    return;
  }
  if (state.gate === 'login') {
    loginView.render(fresh, ctx);
    return;
  }
  if (state.gate === 'stranger') {
    fresh.appendChild(strangerCard());
    return;
  }
  if (store.error && !store.members.length) {
    fresh.appendChild(
      h(
        'section',
        { class: 'card' },
        h('h2', { text: '연결하지 못했어요' }),
        h('p', { class: 'error', text: store.error }),
        h('button', {
          class: 'btn',
          type: 'button',
          text: '다시 시도',
          onclick: () => ctx.guard(() => store.reload()),
        }),
      ),
    );
    return;
  }

  const tab = TABS.find((t) => t.id === state.tab) || TABS[0];
  tab.view.render(fresh, ctx);
  window.scrollTo({ top: 0 });
}

// 로그인은 됐지만 가족으로 등록되지 않은 메일.
function strangerCard() {
  return h(
    'section',
    { class: 'card welcome' },
    h('h2', { text: '가족으로 등록되지 않은 주소예요' }),
    h('p', {
      class: 'muted',
      text: `${auth.currentEmail() || '이 주소'} 로는 기록을 볼 수 없어요. Supabase 의 family_emails 표에 이 주소를 넣어야 들어올 수 있어요.`,
    }),
    h(
      'div',
      { class: 'row-end' },
      h('button', {
        class: 'btn',
        type: 'button',
        text: '다른 주소로 로그인',
        onclick: () => ctx.signOut(),
      }),
    ),
  );
}

function drawTop() {
  const top = clear(document.getElementById('top'));
  const me = store && state.meId ? store.memberById(state.meId) : null;
  const showChip = state.gate === 'ready';
  top.appendChild(
    h(
      'div',
      { class: 'top-row' },
      h('h1', { class: 'brand', text: 'Our Story' }),
      showChip
        ? h(
            'button',
            {
              class: 'me-chip',
              type: 'button',
              title: '나를 바꾸기',
              onclick: () => ctx.set({ tab: 'family' }),
            },
            me ? `${me.emoji} ${me.name}` : '나는 누구?',
          )
        : null,
    ),
  );
  if (store && store.error) {
    top.appendChild(h('div', { class: 'banner', text: '저장소에 연결하지 못했어요' }));
  }
}

function drawTabs() {
  const nav = clear(document.getElementById('tabs'));
  nav.style.display = state.gate === 'ready' ? '' : 'none';
  if (state.gate !== 'ready') return;
  for (const tab of TABS) {
    nav.appendChild(
      h(
        'button',
        {
          class: `tab${state.tab === tab.id ? ' on' : ''}`,
          type: 'button',
          onclick: () => ctx.set({ tab: tab.id }),
        },
        h('span', { class: 'tab-emoji', text: tab.emoji }),
        h('span', { class: 'tab-label', text: tab.label }),
      ),
    );
  }
}

// 로그인 직후 / 이미 로그인된 상태로 앱을 열었을 때 공통으로 지나는 길.
async function enterAfterLogin() {
  state.gate = 'loading';
  refresh();

  await auth.loadEmail();

  // 가족으로 등록된 메일인지 서버에 물어본다.
  try {
    if (!(await amFamily())) {
      state.gate = 'stranger';
      return refresh();
    }
  } catch (err) {
    // 물어보다 실패한 경우엔 막지 않고 진행한다. 정말 권한이 없으면 목록이 비어 보인다.
    console.warn('가족 확인 실패:', err.message || err);
  }

  await openStore();
}

async function openStore() {
  try {
    store = await createStore();
  } catch (err) {
    store = { error: err.message || String(err), members: [], reload: async () => {} };
  }
  // 저장된 '나' 가 더 이상 없는 사람일 수 있다(기기 바꿈, 식구 지움).
  if (state.meId && store.memberById && !store.memberById(state.meId)) {
    state.meId = null;
    localStorage.removeItem(ME_KEY);
  }
  // 로그인한 메일이 어느 식구의 것이면 그 사람으로 시작한다. 아이는 얼굴을 눌러 바꾼다.
  if (!state.meId && store.memberByEmail) {
    const mine = store.memberByEmail(auth.currentEmail());
    if (mine) ctx.pickMe(mine.id);
  }
  state.gate = 'ready';
  refresh();
}

async function boot() {
  refresh(); // 불러오는 중 화면

  // 공유 설정(config.js)이 비어 있으면 로그인 없이 이 기기에만 저장한다.
  if (!auth.configured) return openStore();

  const captured = auth.captureFromUrl();
  if (captured !== 'none' && captured !== 'ok') state.login.error = captured;

  if (!auth.signedIn()) {
    state.gate = 'login';
    return refresh();
  }
  return enterAfterLogin();
}

boot();
