// Supabase 매직링크 로그인.
//
// supabase-js 를 쓰지 않는다. 이 PC에 npm 이 없고, CDN 에서 받아오게 하면 회사
// 네트워크에 막힐 수 있다. 그래서 인증 REST API(GoTrue)를 fetch 로 직접 부른다.
//
// 흐름:
//   1) sendMagicLink(메일) → 메일로 링크가 간다
//   2) 링크를 누르면 우리 주소로 #access_token=... 을 달고 돌아온다 → captureFromUrl()
//   3) 토큰을 localStorage 에 두고, 만료되면 refresh_token 으로 조용히 갱신한다
//
// 메일 링크가 다른 브라우저에서 열려 로그인이 안 될 때를 위해 6자리 코드 입력도
// 지원한다(verifyCode). 그 코드는 Supabase 메일 서식에 {{ .Token }} 이 있어야 온다.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const KEY = 'our-story.session.v1';
const base = SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1';

let session = read();

/* ---------- 저장 ---------- */

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(next) {
  session = next;
  if (next) localStorage.setItem(KEY, JSON.stringify(next));
  else localStorage.removeItem(KEY);
}

function seconds() {
  return Math.floor(Date.now() / 1000);
}

function toSession(data, fallbackEmail) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || seconds() + Number(data.expires_in || 3600),
    email: data.user?.email || fallbackEmail || session?.email || null,
  };
}

/* ---------- 요청 ---------- */

async function call(url, body, token) {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  } catch {
    // DNS 실패, 오프라인, 주소 오타 — fetch 는 여기서 거절된다.
    throw new Error('서버에 닿지 못했어요. 인터넷 연결과 config.js 의 주소를 확인해 주세요.');
  }
  const text = await res.text();
  if (!res.ok) throw new Error(explain(res.status, text));
  return text ? JSON.parse(text) : null;
}

// Supabase 가 돌려주는 영어 오류를 그대로 보여 주면 알 수 없으니 몇 가지는 옮겨 준다.
function explain(status, text) {
  const lower = (text || '').toLowerCase();
  if (lower.includes('signups not allowed')) {
    return '이 메일로는 아직 가입할 수 없어요. Supabase 에서 이 메일을 초대해 주세요.';
  }
  if (lower.includes('invalid') && lower.includes('token')) {
    return '코드가 맞지 않거나 시간이 지났어요. 다시 받아 주세요.';
  }
  if (lower.includes('expired')) return '링크가 만료됐어요. 다시 받아 주세요.';
  if (status === 429) return '너무 자주 요청했어요. 잠시 뒤에 다시 해 주세요.';
  if (status === 422 || status === 400) {
    return `로그인 요청이 거절됐어요. (${(text || '').slice(0, 150)})`;
  }
  return `로그인 중 문제가 생겼어요. (HTTP ${status}) ${(text || '').slice(0, 150)}`;
}

/* ---------- 바깥에서 쓰는 것 ---------- */

export const configured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export function signedIn() {
  return Boolean(session && session.refresh_token);
}

export function currentEmail() {
  return session ? session.email : null;
}

// 이 주소로 돌아오게 한다. Supabase 의 Redirect URLs 에 등록돼 있어야 한다.
export function redirectTarget() {
  return location.origin + location.pathname;
}

export async function sendMagicLink(email) {
  const url = `${base}/otp?redirect_to=${encodeURIComponent(redirectTarget())}`;
  await call(url, { email: email.trim(), create_user: true });
}

export async function verifyCode(email, code) {
  const address = email.trim();
  const token = code.trim();
  // 메일이 가입 확인(signup)으로 왔는지 매직링크로 왔는지에 따라 GoTrue 가 받는 type 이 다르다.
  // 어느 쪽인지 화면에서는 알 수 없으니 순서대로 시도한다.
  let last = null;
  for (const type of ['email', 'magiclink', 'signup']) {
    try {
      const data = await call(`${base}/verify`, { type, email: address, token });
      write(toSession(data, address));
      return;
    } catch (err) {
      last = err;
    }
  }
  throw last || new Error('숫자를 확인하지 못했어요.');
}

// 매직링크를 누르고 돌아왔을 때 주소 끝에 붙은 토큰을 거둬들인다.
// 반환: 'ok' | 'none' | 오류 문구
export function captureFromUrl() {
  const raw = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!raw) return 'none';
  const params = new URLSearchParams(raw);
  const failure = params.get('error_description') || params.get('error');
  const token = params.get('access_token');
  if (!failure && !token) return 'none';

  history.replaceState(null, '', location.pathname + location.search);
  if (failure) {
    return failure.includes('expired')
      ? '링크가 만료됐어요. 다시 받아 주세요.'
      : decodeURIComponent(failure.replace(/\+/g, ' '));
  }
  write({
    access_token: token,
    refresh_token: params.get('refresh_token'),
    expires_at: seconds() + Number(params.get('expires_in') || 3600),
    email: null, // 바로 뒤 loadEmail() 이 채운다
  });
  return 'ok';
}

// 토큰만 있고 누구인지 모를 때 메일 주소를 받아 온다.
export async function loadEmail() {
  if (!session || session.email) return;
  const token = await accessToken();
  if (!token) return;
  const res = await fetch(`${base}/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const user = await res.json();
  write({ ...session, email: user.email || null });
}

// PostgREST 요청에 쓸 토큰. 만료가 가까우면 조용히 갱신한다.
export async function accessToken() {
  if (!session) return null;
  if (session.expires_at - 60 > seconds()) return session.access_token;
  try {
    const data = await call(`${base}/token?grant_type=refresh_token`, {
      refresh_token: session.refresh_token,
    });
    write(toSession(data));
    return session.access_token;
  } catch {
    // 갱신이 안 되면 다시 로그인해야 한다. 조용히 지우고 null 을 준다.
    write(null);
    return null;
  }
}

export async function signOut() {
  const token = session?.access_token;
  write(null);
  if (!token) return;
  try {
    await call(`${base}/logout`, {}, token);
  } catch {
    // 서버 쪽 정리가 실패해도 이 기기에서는 이미 로그아웃됐다.
  }
}
