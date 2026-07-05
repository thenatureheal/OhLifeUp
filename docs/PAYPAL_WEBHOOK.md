# PayPal 웹훅 자동 동기화 (C) — 활성화 가이드

이 기능을 켜면 **PayPal에서 환불/취소가 발생할 때 우리 결제 목록 상태가 자동으로
바뀝니다.** (관리자가 직접 "환불"로 바꾸지 않아도 됨)

동작: PayPal → `POST https://www.ohlifeup.com/api/paypal/webhook` → 서명 검증 →
해당 결제(capture id/order id로 매칭)의 상태를 `refunded`/`cancelled`로 자동 변경
+ 알림 기록.

> 코드·전용 계정·보안규칙은 이미 준비돼 있습니다. 아래 **2가지 설정만** 하면 켜집니다.

## 1. PayPal 개발자 대시보드에서 웹훅 등록

1. https://developer.paypal.com → **Apps & Credentials** → (실서비스면 **Live** 탭) →
   결제에 쓰는 앱 선택
2. 아래로 스크롤 → **Webhooks** → **Add Webhook**
3. **Webhook URL**: `https://www.ohlifeup.com/api/paypal/webhook`
4. **Event types**: 아래 3개(최소) 체크
   - `Payment capture refunded`
   - `Payment capture reversed`
   - `Payment capture denied`
   - (원하면 `Payment capture completed`도 — 무시되지만 무해)
5. 저장 → 생성된 **Webhook ID** 복사 (예: `5GP028458E823623V`)

## 2. Vercel 환경변수 3개 추가 + 재배포

Vercel → oh-life-up → **Environment Variables** → 아래 3개 추가
(Production/Preview 체크):

```
PAYPAL_WEBHOOK_ID=<1번에서 복사한 Webhook ID>
WEBHOOK_FIREBASE_EMAIL=<webhook-credentials.secret.txt 의 값>
WEBHOOK_FIREBASE_PASSWORD=<webhook-credentials.secret.txt 의 값>
```

> `WEBHOOK_FIREBASE_*` 값은 프로젝트 루트의 **`webhook-credentials.secret.txt`**
> 파일에 들어 있습니다. (이 파일은 gitignore로 커밋되지 않음)

추가 후 **Deployments → 최신 → ⋯ → Redeploy**.

## 3. 테스트 (권장)

- PayPal 대시보드 **Webhooks → Webhook simulator** 로 `PAYMENT.CAPTURE.REFUNDED`
  이벤트를 보내 200 응답이 오는지 확인.
- 실제로: 샌드박스에서 결제 → PayPal에서 환불 → 잠시 후 관리자 **결제 목록**의
  해당 건이 자동으로 "환불"로 바뀌는지 확인.

## 동작 조건 / 한계

- 환불/취소 매칭은 결제 시 저장된 **capture id**(신규 결제부터 저장됨)로 이뤄집니다.
  이 기능 배포 **이전**에 결제된 건은 capture id가 없어 자동매칭이 안 될 수 있습니다.
- 서명 검증에 실패하면(가짜 요청 등) 무시됩니다.
- 미설정 상태(환경변수 없음)면 웹훅은 아무 것도 하지 않고 200을 반환합니다.

## 보안 메모

- `paypal-webhook@ohlifeup.com` 은 웹훅 서버 전용 Firebase 계정으로, 보안규칙
  `isAdmin()` 허용목록에 포함돼 있습니다. 사람이 로그인해서 쓰는 계정이 아닙니다.
- 이 계정 비밀번호가 노출되면 관리자 권한 쓰기가 가능하므로, `webhook-credentials.secret.txt`
  와 Vercel 환경변수는 외부에 공유하지 마세요.
