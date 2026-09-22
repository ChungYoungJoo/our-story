# Our Story

가족이 **하루를 나누고 서로에게 추천을 남기는** 작은 웹앱.

- ☀️ **오늘** — 기분을 고르고 그날 있었던 일을 적는다. 가족이 쓴 글이 바로 아래 보이고,
  이모지나 한마디로 반응할 수 있다. 작년 같은 날 기록이 있으면 '지난 오늘'로 올라온다
- 📖 **이야기** — 지난 기록을 달 단위로 훑어본다. 사람별로 걸러 볼 수 있다
- 💡 **추천** — "이런 책이 좋대", "여기 재밌대", "이거 해보자" 를 담아 두고,
  해본 뒤에는 '해봤어' 로 옮겨 소감을 남긴다
- 🏡 **가족** — 식구를 손보고, 누가 얼마나 썼는지 보고, 백업을 내보낸다

빌드 도구가 없다. 순수 HTML/CSS/ES모듈이라 `docs/` 를 그대로 올리면 끝.

## 처음 해보기 (혼자, 이 기기에서만)

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1
```

http://localhost:8081 이 열린다. 처음에는 **아빠 / 엄마 / 소미 / 소빈** 이 만들어져 있으니
자기 얼굴을 누르고 바로 써 보면 된다. 이 상태에서는 기록이 **그 기기에만** 저장된다.

이름과 이모지는 '가족' 화면에서 바꾸고, 식구를 더할 수도 있다.

## 가족만 보게 하기 (Supabase 연결 + 매직링크 로그인)

기록을 가족끼리 나눠 보려면 Supabase 를 붙인다. 붙이면 **메일로 온 링크를 눌러 들어오는
로그인**이 함께 켜지고, 미리 등록한 메일 주소만 들어올 수 있다. 비밀번호는 없다.

1. **머니노트와 같은 Supabase 프로젝트**(`secqbdcobmqocznsbftm`)를 쓴다. 무료 플랜이 활성
   프로젝트 2개까지라서 새로 만들지 않고 얹었다. 표 이름이 겹치지 않아(머니노트는
   `categories`·`expenses` 뿐) 서로 간섭하지 않고, 정책도 표마다 따로라서
   머니노트의 anon 키로는 여기 기록을 읽을 수 없다
2. `supabase/schema.sql` 전체를 SQL Editor 에 붙여 **Run**.
   들어올 수 있는 메일을 바꾸려면 맨 위 `family_emails` 의 insert 를 고친다
3. Project Settings > API Keys 에서 **publishable key**(`sb_publishable_...`)를 복사
4. `docs/js/config.js` 의 두 값을 채운다

```js
export const SUPABASE_URL = 'https://<프로젝트>.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_...';
```

5. Authentication > **URL Configuration** 에 돌아올 주소를 등록한다. 이게 빠지면 메일 링크를
   눌렀을 때 엉뚱한 곳으로 간다
   - Site URL: `https://chungyoungjoo.github.io/our-story/`
   - Redirect URLs: 같은 주소, 그리고 로컬 확인용 `http://localhost:8081`

'가족' 화면 맨 아래가 `가족과 공유 중` 으로 바뀌고 로그인한 메일이 보이면 연결된 것이다.

### 아이들은 어떻게 들어오나

아이들은 메일 주소가 없다. 그래서 **로그인은 "이 기기가 우리 가족 것인가" 만 확인한다.**
부모 메일로 기기마다 한 번 로그인해 두면, 그 기기에서는 소미·소빈이 자기 얼굴을 눌러 글을 쓴다.
로그인은 오래 유지되므로 아이가 다시 로그인할 일은 없다.

부모는 '가족' 화면에서 자기 이름을 **고치기** 해 로그인 메일을 적어 둘 수 있다.
그러면 그 메일로 들어올 때 자동으로 그 사람이 된다.

### 가족을 더하거나 뺄 때

Supabase 의 `family_emails` 표에 줄을 넣거나 지운다 (Table Editor 에서 바로 된다).

```sql
insert into family_emails (email, note) values ('엄마메일@example.com', '엄마');
delete from family_emails where email = '이제안쓰는@example.com';
```

### 더 단단히 막고 싶으면

지금은 남이 자기 메일로 로그인을 시도하는 것 자체는 막지 않는다 — 들어와도
`family_emails` 에 없으면 **아무것도 보이지 않고** "가족으로 등록되지 않은 주소예요" 만 뜬다.
그 시도조차 막으려면 Authentication > Sign In / Providers 에서 **신규 가입을 끄고**,
Authentication > Users 에서 가족을 직접 초대하면 된다.

## 배포 (GitHub Pages)

회사 네트워크가 `git push` 와 웹 업로드를 막기 때문에 GitHub Contents API 로 올린다.

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File .\upload-to-github.ps1
```

토큰을 물어보면 GitHub 개인 토큰을 붙여넣는다. 저장소가 없으면 **만들고 → 올리고 → Pages 까지 켜 준다.**

- 토큰: GitHub > Settings > Developer settings > Personal access tokens
  (fine-grained 면 이 저장소에 **Contents: Read and write**)
- 배포 주소: https://chungyoungjoo.github.io/our-story/
- 첫 배포는 1~2분쯤 걸린다. 404가 뜨면 잠시 뒤 새로고침
- 업로드만 하려면 `-NoRepoSetup`, 무엇이 올라갈지만 보려면 `-WhatIf`

> 토큰을 PowerShell 프롬프트에 **직접 치지 말 것.** 스크립트가 물어볼 때 붙여넣어야 한다.
> 프롬프트에 친 줄은 PSReadLine 기록 파일에 평문으로 남는다.

## 백업

'가족' 화면의 **내보내기(백업)** 가 기록 전체를 JSON 파일로 저장한다.
기기 저장 모드에서는 **가져오기**로 되돌릴 수 있다(기존 내용을 덮어쓴다).

## 폴더

```
docs/                  GitHub Pages 루트 (직접 편집하는 원본)
  index.html
  css/style.css
  js/
    app.js             문(로그인)·상태·탭·화면 교체
    config.js          Supabase 주소/키, 처음 만들 식구
    auth.js            매직링크 로그인 (Supabase 인증 REST 직접 호출)
    store.js           데이터 출입구 (화면은 여기만 부른다)
    remote.js          Supabase 백엔드 (로그인 토큰으로 요청)
    local.js           이 기기 저장 백엔드 (같은 메서드 이름)
    reply.js           이모지 반응 + 한마디 (하루 기록·추천 공용)
    util.js            h(), 날짜, 기분·추천 종류 목록
    views/             login · today · timeline · ideas · family
supabase/schema.sql    테이블·정책
serve.ps1              로컬 확인용 정적 서버 (포트 8081)
upload-to-github.ps1   배포
CLAUDE.md              작업 지침 — 고치기 전에 읽어 주세요
```

## 다음에 할 이야기

- 📷 **사진 첨부** (1단계에서는 일부러 뺐다)
- 기록 안 한 날 알려 주기, 월간 달력
- 1년치 기록을 책처럼 묶어 인쇄하기
