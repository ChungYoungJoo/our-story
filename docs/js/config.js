// Supabase 연결 설정.
//
// 비어 있으면 앱은 "이 기기에만 저장" 모드로 돌아간다 (localStorage).
// 혼자 써 보는 동안은 이대로 두고, 가족이 서로 볼 수 있게 하려면 아래 두 값을 채운다.
//
//   1) supabase.com 에서 프로젝트를 만든다 (가족 앱·머니노트와 별개 프로젝트로).
//   2) supabase/schema.sql 의 family_emails 주소를 우리 가족 것으로 바꿔 SQL Editor 에서 실행한다.
//   3) Project Settings > API Keys 의 publishable key(sb_publishable_...)를 아래에 넣는다.
//   4) Authentication > URL Configuration 에 배포 주소와 http://localhost:8081 을 등록한다.
//
// 값을 채우면 매직링크 로그인이 켜지고, family_emails 에 등록된 메일만 들어올 수 있다.
// publishable key 는 공개돼도 되는 키다 — 로그인하지 않은 사람에게는 아무 권한도 없다.
// 자세한 건 README 의 '가족만 보게 하기' 와 CLAUDE.md 의 '보안' 항목.

// 머니노트와 같은 프로젝트다 (무료 플랜이 활성 프로젝트 2개까지라서). 표 이름이 겹치지 않고,
// 정책이 표마다 따로라서 머니노트 쪽 키로는 이 기록을 읽을 수 없다.
export const SUPABASE_URL = 'https://secqbdcobmqocznsbftm.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_KG-2wV1moYXPlfnBDJwrFg_o-AbrmqX';

// 처음 실행할 때 만들어 둘 가족. 앱의 '가족' 화면에서 언제든 고치고 더할 수 있다.
export const DEFAULT_MEMBERS = [
  { name: '아빠', emoji: '👨', role: 'parent' },
  { name: '엄마', emoji: '👩', role: 'parent' },
  { name: '소미', emoji: '🐰', role: 'child' },
  { name: '소빈', emoji: '🐥', role: 'child' },
];
