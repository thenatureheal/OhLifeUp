# OhLifeUp

> 중국 제품 구매대행 & LifeUpCoaching 구매대행 + BGI 대량유전자분석 패키지 결제 플랫폼

**Next.js (App Router) + TypeScript + Tailwind CSS + Firebase(Firestore) + Airwallex** 기반.
Vercel 배포를 전제로 한 서버리스 구성입니다 (별도 백엔드 서버 없음).

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend / SSR | Next.js 15 (App Router) + React 19 + TypeScript |
| 스타일 | Tailwind CSS (+ 디자인 토큰 CSS 변수) |
| 다국어 | react-i18next (한국어 / EN / 中文) |
| 게시판 DB | Firebase Firestore (프론트에서 SDK 직접 접근, 보안 규칙으로 보호) |
| 결제 | Airwallex (Hosted Payment Page, 신용카드) |
| 폰트 | Pretendard Variable |
| 호스팅 | Vercel |

---

## 로컬 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 을 열어 값을 채웁니다.

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase 콘솔 → 프로젝트 설정 → 내 앱 → SDK 구성값 |
| `NEXT_PUBLIC_AIRWALLEX_ENV` | `demo` \| `prod` (미설정 시 결제 버튼 숨김) |
| `AIRWALLEX_CLIENT_ID` / `AIRWALLEX_API_KEY` | 서버 결제(비공개). `AIRWALLEX_AMOUNT`/`CURRENCY` 는 상품 미선택 시 청구 fallback |

> Firebase 값이 비어 있어도 앱은 구동되며, 게시판만 "설정 필요" 안내를 표시합니다.

### 3. 개발 서버

```bash
npm run dev
# http://localhost:3000
```

### 4. 빌드 / 린트

```bash
npm run build
npm run lint
```

---

## Firestore 보안 규칙

게시판은 프론트에서 Firestore에 직접 읽고/씁니다. 반드시 `firestore.rules` 를 배포하세요.

- Firebase CLI: `firebase deploy --only firestore:rules`
- 또는 Firebase 콘솔 → Firestore Database → **규칙** 에 `firestore.rules` 내용을 붙여넣기

규칙 요약:
- `posts` (문의 게시판): **읽기 공개 / 생성은 필드·타입·길이 검증 통과 시만 / 수정·삭제 금지**. (비밀번호 필드는 폼에서 입력받지만 공개 컬렉션이라 **저장하지 않습니다**.)
- `payments` (결제 내역): 결제 성공 시 `{이름, 연락처, 이메일, 주문번호, 금액, 통화, 상품명}` 저장. **이름+연락처로 조회**하기 위해 읽기를 허용합니다.

> ⚠ **결제 내역 조회 보안 주의**: 방식 A(클라이언트 직접 접근)에서는 `payments` 가 읽기 가능해야 조회가 동작하므로, 이 데이터는 완전히 비공개가 아닙니다(이름+연락처를 아는 사람은 조회 가능). 운영 환경에서는 이 조회를 **서버(Next.js Route Handler / Firebase Admin SDK)** 로 옮기고 컬렉션 읽기를 잠그는 것을 권장합니다.

---

## 결제 (Airwallex · Hosted Payment Page)

- 결제 위치: **회사 소개(`/`) 페이지 하단 결제 섹션** — 상품 금액은 관리자(`/admin/products`)가 Firestore에서 관리(서버가 통제)
- 구조: **PaymentIntent 생성을 서버(Next.js Route Handler)에서 처리** → 금액을 서버가 통제(위변조 방지)
  - 프론트: `components/payment/PackagePay.tsx` (카드 결제 버튼) → `/api/airwallex/intents` 호출 후 Airwallex 결제창으로 리다이렉트
  - 서버: `app/api/airwallex/intents`(인텐트 생성), `/confirm`(상태 검증), `/webhook`(환불·취소 동기화) — `lib/airwallex-server.ts`
- 흐름: 이름·휴대폰·이메일(선택) 입력 → Airwallex 결제창에서 카드 결제 → 리턴 페이지(`/payment/airwallex/return`)에서 성공 확인 시 `payments` 에 기록 → **"내 결제 내역 즉시 조회"** 에서 이름+연락처로 조회
- **환경변수** (자세한 건 `.env.local.example`):
  - 프론트(공개): `NEXT_PUBLIC_AIRWALLEX_ENV`(demo/prod)
  - 서버(비공개, ⚠ `NEXT_PUBLIC_` 금지): `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_API_KEY`, `AIRWALLEX_WEBHOOK_SECRET`, `AIRWALLEX_ENV`, `AIRWALLEX_AMOUNT`, `AIRWALLEX_CURRENCY`
- **demo → prod 전환**: 코드 변경 없이 **env 값만** 운영 자격증명 + `AIRWALLEX_ENV=prod` + `NEXT_PUBLIC_AIRWALLEX_ENV=prod` 로 교체 후 재배포.

---

## Vercel 배포

1. 이 저장소를 GitHub에 push
2. Vercel에서 New Project → 이 저장소 import (프레임워크 자동 인식: Next.js)
3. **Environment Variables** 에 `.env.local` 의 값들을 동일하게 입력
4. Deploy → `git push` 마다 자동 배포

### 도메인 / 인프라 (수동 단계)

- `ohlifeup.com` 도메인을 Vercel 프로젝트에 연결 (Vercel Domains 안내에 따라 DNS 레코드 변경)
- 기존 알리바바클라우드 ECS는 새 사이트 정상 확인 후 정지/해지
- 기존 SQLite 데이터 이관: **불필요** (DB 비어 있음)
