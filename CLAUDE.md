# CLAUDE.md — Our Story 작업 지침

## 이 앱이 하는 일

아이 둘(소미 초4, 소빈 초1)과 부모가 **① 그날 있었던 일과 기분을 짧게 나누고, ② 서로에게 추천을
남기는**(이런 책이 좋대 / 여기 재밌대 / 이거 해보자) 가족 기록장. 2026-09-22 시작.

요구는 단순하다. 기능을 늘리기 전에 이 세 가지가 흔들리지 않는지부터 볼 것:

1. 아이가 혼자서도 오늘 기록을 쓸 수 있다 (로그인 없이, 얼굴 눌러 나를 고르고 바로 쓴다)
2. 가족이 쓴 글이 같은 화면에서 보이고, 이모지·한마디로 반응할 수 있다
3. 추천을 담아 두고, 해본 뒤 소감을 남길 수 있다

**초1도 쓴다.** 글자를 줄이고 이모지를 크게, 버튼은 44px 이상으로 유지할 것.

## 현재 상태 (2026-09-22)

- 1단계 완성: 오늘 / 이야기 / 추천 / 가족 네 화면이 로컬 서버에서 실제 동작까지 확인됨
  (글 저장·고치기·삭제, 이모지 반응, 한마디, 추천 담기→해봤어→소감, 달 이동, 식구 수정)
- **매직링크 로그인 완성**(2026-09-22 추가). 로그인·가족 확인·만료 링크·자동 '나' 선택까지
  정적 파일로 만든 가짜 Supabase 응답을 통과시켜 검증했다
- **배포 완료**: https://chungyoungjoo.github.io/our-story/ (2026-09-22, 파일 20개, Pages 켜짐).
  배포본의 `config.js`·`auth.js` 를 직접 받아 확인했다
- **전 경로 확인 완료** (2026-09-22): 휴대폰에서 매직링크로 로그인 → 식구 4명 생성 → 하루 기록 저장,
  그리고 PC 에서 **숫자(8자리) 로그인** 후 그 글이 그대로 보이는 것까지 대조했다. 기기 간 공유 증명됨
- 남은 일: 아이 폰 2대 + 아빠 폰 붙이기(숫자 방식이면 쉽다), 그리고 며칠 써 본 뒤의 피드백
- **Supabase 는 머니노트와 같은 프로젝트(`secqbdcobmqocznsbftm`)의 public 스키마를 쓴다.**
  무료 플랜이 활성 프로젝트 2개까지여서 새로 만들지 않고 얹었다. 표 이름이 겹치지 않는 것을
  확인했다(그쪽은 `categories`·`expenses` 뿐). **표를 더 만들 때는 이름 충돌을 먼저 확인할 것**
- `docs/js/config.js` 에 주소·키를 채우면 공유 + 로그인이 함께 켜진다 (README 의 '가족만 보게 하기')
- 아직 배포 안 함. GitHub 저장소 `our-story` 도 아직 없다 — `upload-to-github.ps1` 이 만들면서 올린다
- **사진 첨부는 일부러 뺐다.** 2단계로 이야기하기로 한 항목이다

## 환경 제약 (중요)

'우리집 하루'·'머니노트'와 같은 PC라 제약이 같다.

- 이 PC에는 **Node.js도 Python도 없다.** npm/빌드/테스트 러너를 쓰는 제안은 하지 말 것
- 로컬 확인은 `.\serve.ps1` (PowerShell HttpListener 정적 서버) → http://localhost:8081
  `index.html` 을 file:// 로 열면 ES 모듈이 CORS로 막히니 쓰지 말 것
- **실행 정책이 Restricted(기본값)** 라 `.\xxx.ps1` 이 바로 안 돌아간다. 그룹정책 제한은 아니다.
  `powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1` 로 실행하거나,
  한 번 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 을 해 두면 된다
- Claude Code 브라우저 패널로 확인하려면 `launch.json` 을 **세션 작업 폴더의 `.claude/` 안**에 둬야 한다
  (작업 폴더가 `C:\Users\youngjoo.chung\.claude` 일 때는 `C:\Users\youngjoo.chung\.claude\.claude\launch.json`.
  이 저장소의 `.claude/launch.json` 은 참고용 사본이다). 포트는 머니노트(8080)와 겹치지 않게 **8081**
- 배포는 `git push` 가 아니라 `.\upload-to-github.ps1` (GitHub Contents API).
  회사 프록시가 업로드성 요청을 막고 본문 ~45KB 한계가 있다 → **소스 파일 하나를 20KB 이하로 유지**
- `.ps1` 은 반드시 **UTF-8 BOM** 으로 저장하고 `[Parser]::ParseFile` 로 검증할 것
  (BOM 없으면 CP949로 읽혀 한글이 깨진다)
- 터미널 PowerShell에 git이 없을 수 있다: `$env:Path += ";C:\Program Files\Git\cmd"`

## 구조

- `docs/` 가 GitHub Pages 루트. 빌드 산출물이 아니라 **직접 편집하는 원본**이다
- 데이터 접근은 전부 `store.js` 를 거친다. 화면(`views/*`)이 `remote.js`/`local.js` 를 직접 부르지 않는다
- `remote.js`(Supabase PostgREST)와 `local.js`(localStorage)는 **같은 메서드 이름·같은 행 모양**을
  지켜야 한다. 한쪽만 고치면 `config.js` 를 비운 상태에서 조용히 깨진다
- 화면은 `render(root, ctx)` 하나만 내보낸다.
  `ctx = { store, state, refresh, set, pickMe, needMe, guard, afterLogin, signOut }`
- `app.js:refresh()` 는 매번 `<main id="view">` 를 **새로 만들어 교체**한다. 그래서 화면이 컨테이너에 건
  이벤트 핸들러가 쌓이지 않는다. 화면 안에서 다시 그릴 때 `render()` 를 직접 재귀 호출하지 말고
  `ctx.refresh()` / `ctx.set({...})` 을 쓸 것
- 저장·삭제처럼 실패할 수 있는 일은 `ctx.guard(async () => ...)` 로 감싼다. 실패하면 알려 주고 화면은 살린다
- **DOM 은 `util.js` 의 `h()` 로만 만든다. `innerHTML` 을 쓰지 말 것** — 아이가 쓴 글에 `<` 같은
  글자가 섞여도 그대로 글자로 보이게 하려는 것이다
- `store.js` 는 시작할 때 데이터를 통째로 받아 메모리에 들고, 쓰기는 백엔드에 보낸 뒤 메모리에도 반영한다
  (다시 전체를 받아오지 않는다). 가족 규모(한 해 수백 건)에서는 이게 가장 단순하다

## 로그인 (문)

- `auth.js` 가 Supabase 인증 REST(GoTrue)를 **fetch 로 직접** 부른다. **supabase-js 를 쓰지 말 것** —
  npm 이 없고, CDN 에서 받아오게 하면 회사 네트워크에 막힐 수 있다
- 흐름: `sendMagicLink()` → 메일 링크 → 우리 주소로 `#access_token=...` 으로 돌아옴 →
  `captureFromUrl()` 이 거둬 localStorage(`our-story.session.v1`)에 넣고 주소창을 정리 →
  만료되면 `accessToken()` 이 refresh_token 으로 조용히 갱신
- 메일 링크가 다른 브라우저에서 열리는 경우를 위해 6자리 코드 입력(`verifyCode`)도 있다.
  그 숫자는 Supabase 메일 서식에 `{{ .Token }}` 이 있어야 온다 (기본 서식에는 링크만 있다)
- `app.js` 의 **gate** 가 `'loading' | 'login' | 'stranger' | 'ready'` 로 화면을 가른다.
  `ready` 가 아니면 탭바와 '나' 칩을 감춘다
- **`config.js` 가 비어 있으면 로그인을 아예 지나간다** (이 기기 저장 모드). 로그인 코드를
  고칠 때 이 두 갈래를 같이 확인할 것
- 로그인은 **"이 기기가 우리 가족 것인가" 만 확인한다.** 아이들은 메일이 없으니 지금 쓰는
  사람은 얼굴을 눌러 고른다(`state.meId`). 이 둘을 섞지 말 것
- Supabase 대시보드에 **Redirect URLs**(배포 주소 + `http://localhost:8081`)가 등록돼 있어야
  메일 링크가 제대로 돌아온다. "링크를 눌렀는데 엉뚱한 데로 간다" 는 말이 나오면 여기부터 볼 것

## 메일 (2026-09-22 에 실제로 겪은 함정)

- **네이버 메일로는 로그인이 안 된다.** 링크를 누르지 않았는데도 토큰이 `otp_expired` 가 됐다 —
  네이버가 메일 속 링크를 미리 열어 일회용 토큰을 소진시킨다. 그래서 `family_emails` 는
  **지메일**(`milove99@gmail.com`)을 쓴다. 네이버 주소를 다시 넣지 말 것
- **그래서 커스텀 SMTP 를 붙였다** (2026-09-22). 엄마 지메일 + 앱 비밀번호로 `smtp.gmail.com:465`.
  앱 비밀번호는 **구글 2단계 인증을 켜야** 메뉴가 나타난다(안 켜져 있으면 "찾고 있는 설정을
  계정에서 사용할 수 없습니다" 가 뜬다). 이걸 붙이고 나서야 서식 편집이 열렸다
  — **기본 발송 서버를 쓰는 동안은 서식이 읽기 전용**이다
- 서식(Magic Link)에 `{{ .Token }}` 을 넣어 **숫자 로그인**을 쓴다. 숫자는 **8자리**다(6자리가 아니다).
  기기를 새로 붙일 때는 이게 정답이다 — 링크는 옮기다 소진되지만 숫자는 불러 주면 된다
- **발송 한도는 Authentication > Rate Limits 에서 30/시간으로 올려 뒀다.** 기본 SMTP 때는
  시간당 2통이어서 세 번째부터 `429 over_email_send_rate_limit` 이 났다
- **브라우저 패널(preview_*)은 외부 주소로 이동하지 못한다.** `location.href` 로 Supabase 의
  verify 링크를 열려 해도 요청이 아예 나가지 않는다. 그래서 매직링크를 대신 눌러 검증할 수 없다 —
  실제 링크 확인은 사용자가 자기 브라우저/휴대폰에서 해야 한다.
  단 `fetch` 는 나간다(`POST /auth/v1/verify` 로 토큰 상태를 확인하는 건 됐다)

## 데이터 모델

```
family_emails(email, note, created_at)        -- 들어올 수 있는 메일. 여기 없으면 아무것도 안 보인다
members(id, name, emoji, role 'parent'|'child', email, sort_order, archived, created_at)
stories(id, happened_on date, member_id, mood, body, created_at)   -- (member_id, happened_on) 유일
ideas(id, member_id, kind, title, reason, link, status 'want'|'done', done_on, review, created_at)
replies(id, target_type 'story'|'idea', target_id, member_id, emoji, body, created_at)
```

- 날짜는 `'YYYY-MM-DD'` 문자열. `toISOString()` 은 UTC라 하루 밀리므로 쓰지 말고 `util.isoOf()` 를 쓸 것
- **한 사람이 같은 날에 쓰는 기록은 하나.** 두 번째는 새 글이 아니라 '고쳐 쓰기'로 다룬다 (DB에도 유일 인덱스)
- `replies.target_id` 는 story/idea 를 함께 가리켜 외래키를 걸 수 없다. 그래서 글을 지울 때
  `store.js` 가 딸린 reply 를 **먼저** 지운다. 새 화면을 만들 때 이 순서를 잊지 말 것
- 글을 쓴 적 있는 식구는 삭제 대신 `archived = true`. 지난 기록이 이름을 잃지 않게 하기 위함
- '나'(`state.meId`)는 localStorage `our-story.me` 에 기기별로 저장한다. 로그인이 아니다 —
  기기를 든 사람이 자기 얼굴을 누르는 방식
- `members.email` 은 있어도 되고 없어도 된다. 있으면 그 메일로 로그인할 때 자동으로 그 사람이 된다
  (`store.memberByEmail`). 아이들 줄은 비어 있는 게 정상이다

## 보안

- **로그인하지 않은 사람(anon)에게는 아무 정책도 주지 않는다.** 배포 주소를 알아도,
  publishable key 를 알아도 아무것도 보이지 않는다
- 통과 조건은 `is_family()` — 로그인한 메일이 `family_emails` 에 있는지 본다.
  `security definer` 함수라서 `family_emails` 자체의 정책과 무관하게 판단한다
- 데이터 표(members/stories/ideas/replies)의 정책은 `family_only` 하나뿐이다.
  **새 표를 만들면 RLS 를 켜고 같은 정책을 붙일 것.** 잊으면 그 표만 조용히 열린다
- `family_emails` 는 자기 줄만 읽을 수 있다(남의 메일 주소가 보이지 않게)
- 남이 매직링크로 가입하는 것 자체는 막지 않는다. 가입해도 정책이 전부 거절하고
  '가족으로 등록되지 않은 주소예요' 화면만 본다. 더 막으려면 Supabase 에서 신규 가입을 끄고 초대한다
- **아이 이야기가 들어가는 앱이다.** 보안을 느슨하게 하는 변경(정책 열기, anon 허용,
  키를 다른 곳에 넣기)은 사용자에게 먼저 묻고 할 것

## 검증 방법

로컬 실행 확인은 `serve.ps1` + 브라우저 패널로 실제로 눌러 보는 것이 가장 확실하다
(2026-09-22 이렇게 검증했다). Node 가 없어 테스트 러너를 못 쓰므로 이게 유일한 실행 검증이다.

**Supabase 없이 로그인·공유 경로를 검증하는 방법** (2026-09-22 이렇게 했다):
`config.js` 의 `SUPABASE_URL` 을 `http://localhost:8081` 로 두고, `docs/` 아래에 응답 내용을
담은 정적 파일을 만든다. `serve.ps1` 은 메서드를 가리지 않고 파일을 돌려주므로 POST 도 통과한다.

```
docs/auth/v1/otp          {}
docs/auth/v1/verify       {"access_token":"...","refresh_token":"...","expires_in":3600,"user":{"email":"..."}}
docs/auth/v1/user         {"email":"..."}
docs/rest/v1/rpc/is_family  true   (false 로 바꾸면 '가족 아님' 화면을 볼 수 있다)
docs/rest/v1/members        [ ...식구 배열... ]
docs/rest/v1/stories|ideas|replies   []
```

매직링크로 돌아오는 것은 `http://localhost:8081/#access_token=...&refresh_token=...&expires_in=3600`
으로 직접 들어가 보면 된다(해시만 바꾸면 새로 안 뜨니 **reload 까지** 해야 한다).
만료 링크는 `#error=access_denied&error_description=...` 로 확인한다.
**확인이 끝나면 `docs/auth`, `docs/rest` 를 지우고 `config.js` 를 비울 것.**

배포본이 "반영이 안 된다" 는 말이 나오면 추측하지 말고 파일을 직접 받아 본다 —
`https://chungyoungjoo.github.io/our-story/js/<파일>.js` 를 받아 보면
코드 문제 / 업로드 누락 / 브라우저 캐시가 한 번에 갈린다.

## 아직 없는 것

- **사진 첨부** (2단계로 합의한 항목. Supabase Storage + `stories.photo_path`.
  Storage 버킷도 RLS 를 `is_family()` 기준으로 잠가야 한다 — 사진이 공개 URL 로 새지 않게)
- 월간 달력 보기, 검색, 태그
- 휴대폰 푸시/알림 ("오늘 아직 안 썼어요")
- 기록 모아 인쇄·PDF 만들기 (연말에 책처럼 묶기)
