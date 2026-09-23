// 공용 도구 — DOM 만들기, 날짜, 그리고 앱 전체가 쓰는 말(기분·추천 종류).
// 화면 코드는 innerHTML 을 쓰지 않고 이 파일의 h() 로만 DOM 을 만든다.
// 아이가 쓴 글에 <> 같은 글자가 들어가도 그대로 글자로 보이게 하려는 것.

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/* ---------- DOM ---------- */

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key === 'style') el.style.cssText = value;
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'selected') {
        el[key] = value;
      } else {
        el.setAttribute(key, value === true ? '' : String(value));
      }
    }
  }
  append(el, kids);
  return el;
}

export function append(parent, kids) {
  for (const kid of kids.flat(4)) {
    if (kid == null || kid === false || kid === '') continue;
    parent.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return parent;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/* ---------- 날짜 ----------
   날짜는 전부 'YYYY-MM-DD' 문자열로 다룬다.
   toISOString() 은 UTC 기준이라 한국 시간대에서 하루가 밀린다 — 쓰지 말 것. */

export function isoOf(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function today() {
  return isoOf(new Date());
}

export function dateOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDay(iso, delta) {
  const d = dateOf(iso);
  d.setDate(d.getDate() + delta);
  return isoOf(d);
}

export function fmtDay(iso) {
  const d = dateOf(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
}

export function fmtFull(iso) {
  const d = dateOf(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY[d.getDay()]}요일`;
}

export function fmtNear(iso) {
  const gap = Math.round((dateOf(today()) - dateOf(iso)) / 86400000);
  if (gap === 0) return '오늘';
  if (gap === 1) return '어제';
  if (gap === 2) return '그저께';
  if (gap > 0 && gap < 7) return `${gap}일 전`;
  return fmtDay(iso);
}

export function monthOf(iso) {
  return iso.slice(0, 7);
}

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return isoOf(d).slice(0, 7);
}

export function fmtMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y}년 ${m}월`;
}

/* ---------- 기타 ---------- */

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ---------- 앱이 쓰는 말 ---------- */

// 한 사람이 하루에 쓸 수 있는 이야기 수. DB 쪽 트리거(schema.sql)와 같은 값이어야 한다.
export const MAX_STORIES_PER_DAY = 5;

// 하루 기록의 기분. 초1도 고를 수 있게 이모지와 짧은 낱말을 함께 둔다.
export const MOODS = [
  { key: 'great', emoji: '🤩', label: '최고야' },
  { key: 'good', emoji: '😄', label: '좋았어' },
  { key: 'soso', emoji: '🙂', label: '그냥 그래' },
  { key: 'tired', emoji: '😴', label: '피곤해' },
  { key: 'sad', emoji: '😢', label: '슬펐어' },
  { key: 'angry', emoji: '😤', label: '속상해' },
];

export function moodOf(key) {
  return MOODS.find((m) => m.key === key) || null;
}

// 추천의 종류. "이런 책이 좋대 / 이런 데가 재밌대 / 이런 거 해보자" 를 담는다.
export const KINDS = [
  { key: 'book', emoji: '📚', label: '책' },
  { key: 'place', emoji: '🗺️', label: '가볼 곳' },
  { key: 'todo', emoji: '✨', label: '해보기' },
  { key: 'watch', emoji: '🎬', label: '볼거리' },
  { key: 'food', emoji: '🍜', label: '먹을거리' },
];

export function kindOf(key) {
  return KINDS.find((k) => k.key === key) || { key, emoji: '💡', label: '추천' };
}

// 반응 버튼. 글에 한마디 쓰기 부담스러울 때 톡 누르는 용도.
export const REACTIONS = ['❤️', '👍', '😂', '👏', '🙌', '🥰'];
