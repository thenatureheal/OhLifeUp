# 관리자(Admin) 운영 시스템 설정 가이드

OhLifeUp 관리자 시스템은 **Firebase Authentication(이메일/비밀번호) + 이메일 허용목록**으로
보호됩니다. 아래 순서대로 한 번만 설정하면 됩니다.

## 1. Firebase 콘솔에서 로그인 방식 켜기

1. [Firebase 콘솔](https://console.firebase.google.com) → 해당 프로젝트 선택
2. 좌측 **Authentication** → **Sign-in method** 탭
3. **이메일/비밀번호(Email/Password)** 를 **사용 설정(Enable)** → 저장

## 2. 관리자 계정 만들기

1. **Authentication** → **Users** 탭 → **사용자 추가(Add user)**
2. 이메일: `thenatureheal@gmail.com` (또는 원하는 관리자 이메일)
3. 비밀번호: 안전한 비밀번호 입력 → **사용자 추가**

> 이 이메일은 아래 3번의 허용목록과 **정확히 일치**해야 관리자 권한이 부여됩니다.

## 3. 허용목록(allowlist) 두 곳을 동일하게 맞추기

관리자 이메일은 **두 곳**에 적혀 있고, 항상 같아야 합니다.

**(a) 환경변수** — `.env.local` 및 Vercel 프로젝트 환경변수

```
NEXT_PUBLIC_ADMIN_EMAILS=thenatureheal@gmail.com
```

여러 명이면 콤마로 구분: `admin1@x.com,admin2@x.com`

**(b) Firestore 보안규칙** — `firestore.rules` 의 `isAdmin()` 함수

```
function isAdmin() {
  return request.auth != null
    && request.auth.token.email != null
    && request.auth.token.email.lower() in ['thenatureheal@gmail.com'];
}
```

두 곳의 이메일 목록을 반드시 동일하게 유지하세요. (a)만 바꾸면 UI는 통과하지만
데이터 접근이 막히고, (b)만 바꾸면 반대가 됩니다.

## 4. Firestore 보안규칙 배포

```
firebase deploy --only firestore:rules
```

또는 Firebase 콘솔 → **Firestore Database** → **규칙** 탭에 `firestore.rules` 내용을
붙여넣고 **게시(Publish)**.

## 5. 접속

- 관리자 로그인: `https://www.ohlifeup.com/admin/login`
- 로그인 후 자동으로 `/admin` 대시보드로 이동합니다.

---

## 관리자 화면 구성

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 대시보드 | `/admin` | 결제/문의 현황 요약, 최근 알림 |
| 결제 목록 | `/admin/payments` | 결제자 리스트. 이름·전화·이메일·생년월일·성별·주소 표시. **주소/생년월일/성별/메모는 관리자가 직접 입력**. 상태(결제완료/환불/취소) 변경 |
| 문의 관리 | `/admin/inquiries` | 고객 문의 확인 및 **답변 작성** |
| 알림 | `/admin/notifications` | 결제·환불·취소·문의 알림 및 기록(감사 로그) |

## 데이터 구조 (Firestore 컬렉션)

| 컬렉션 | 접근 권한 | 내용 |
|--------|-----------|------|
| `payments` | 읽기 공개(조회용), 상태변경/생성 제한 | 결제 기본정보 + status |
| `paymentDetails/{paymentId}` | **관리자 전용** | 주소·생년월일·성별·메모 (민감 PII) |
| `inquiries` | 생성 공개, 조회/답변 관리자 전용 | 고객 문의 + 답변 |
| `notifications` | 생성 공개(결제/문의)·관리자, 조회 관리자 전용 | 알림/기록 |

## 알림이 쌓이는 시점

- **결제**: 고객이 결제를 완료하면 자동 기록
- **문의**: 고객이 문의 폼(`/contact`)을 제출하면 자동 기록
- **환불 / 취소**: 관리자가 결제 목록에서 상태를 변경하면 기록

## 보안 참고 사항

- 주소·생년월일·성별 등 **민감 PII 는 관리자 전용(`paymentDetails`)** 으로 잠겨 있어
  로그인한 관리자만 읽을 수 있습니다.
- 다만 기존 **결제 조회 기능**(이름+전화로 본인 결제 확인) 때문에 `payments` 의
  이름·전화·이메일은 여전히 공개 읽기 상태입니다. 이는 마이그레이션 이전과 동일한
  수준입니다. 이 부분까지 완전히 잠그려면 서버(Route Handler + Firebase Admin SDK)로
  조회를 옮기는 추가 작업이 필요합니다. (원하시면 후속으로 진행 가능)
