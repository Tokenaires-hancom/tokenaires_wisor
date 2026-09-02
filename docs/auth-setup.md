# Wisor 로그인 설정

Wisor 웹은 Supabase Auth의 쿠키 기반 PKCE 세션을 사용합니다. Google OAuth와
이메일·비밀번호 로그인을 함께 제공합니다.

## 1. 환경변수

`apps/web/.env.example`을 참고해 `apps/web/.env.local`에 다음 값을 넣습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

`SUPABASE_SECRET_KEY`는 마이페이지의 계정 삭제 API에서만 사용합니다. 브라우저에 노출되는
`NEXT_PUBLIC_*` 변수에 secret/service role 키를 넣지 않습니다.

## 2. 이메일 로그인

Supabase Dashboard의 **Authentication → Providers → Email**에서 Email provider를
켭니다. 운영에서는 **Confirm email**을 켜는 것을 권장합니다. 비밀번호 최소 길이는
앱과 동일하게 8자 이상으로 설정합니다.

## 3. Google 로그인

1. Google Auth Platform에서 Web application OAuth client를 만듭니다.
2. Authorized JavaScript origins에 로컬과 운영 사이트 origin을 등록합니다.
3. Authorized redirect URI에는 Supabase Dashboard가 Google provider 설정 화면에
   보여 주는 `https://<project-ref>.supabase.co/auth/v1/callback`을 등록합니다.
4. Google Client ID와 Client Secret을 Supabase의 Google provider에 입력하고 켭니다.

## 4. Supabase URL 설정

Supabase Dashboard의 **Authentication → URL Configuration**에서 다음을 설정합니다.

- Site URL: 운영 사이트 origin
- Redirect URLs: `http://localhost:3000/auth/callback`과 운영 사이트의
  `https://<domain>/auth/callback`

Preview 배포를 쓴다면 신뢰하는 배포 도메인만 redirect allow list에 추가합니다.

## 5. 사용자 데이터 스키마 적용

신규 프로젝트에는 `supabase/schema.sql`을 적용합니다. 기존 사용자 데이터 스키마가 있는
프로젝트에는 아래 증분 파일을 날짜순으로 Supabase SQL Editor에서 실행하거나 CLI로
적용합니다.

1. `supabase/migrations/20260820_account_learning_storage.sql`
2. `supabase/migrations/20260827_journal_entry_history.sql`

```bash
supabase db push
```

첫 마이그레이션은 기록형 답 테이블과 비회원 기록 병합 함수를 추가합니다. 두 번째는 같은
문항의 답을 덮어쓰지 않고 응답별 이력으로 보존하며, 앱 사용자의 권한을 조회·추가로
제한합니다. **두 번째 마이그레이션을 새 Web 버전보다 먼저 운영 DB에 적용합니다.** 새 Web은
새 복합키로 기록 이력을 먼저 멱등 삽입하고 나머지 계정 데이터를 병합하며, 두 단계가 모두
성공해야만 로그인 전 `localStorage` 원본을 지웁니다.

## 6. 확인

```bash
cd apps/web
npm test
npm run build
npm run dev
```

`/login`에서 이메일 가입·로그인, Google 로그인, 비밀번호 재설정 링크를 각각
확인합니다. `/me`의 계정 설정에서는 확인 문구가 일치하기 전 계정 삭제 버튼이
비활성화되는지 확인합니다. 실제 운영 계정 삭제 검증은 별도의 테스트 계정으로만
진행합니다. 비회원 기록을 만든 뒤 가입해 Supabase의 진도·퀴즈·관심종목·노트·기록형 답으로
이전되는지, 같은 계정으로 다른 브라우저에서 로그인했을 때 이어지는지 확인합니다. 계정을
삭제하면 외래키의 `on delete cascade`로 계정 학습 기록도 함께 삭제됩니다.
