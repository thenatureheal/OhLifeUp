# PayPal 결제 설정 가이드 (초보자용)

이 문서는 **PayPal 결제를 처음 붙이는 사람**을 기준으로, sandbox(테스트)에서 결제가 되는 것을 확인하고 → live(실거래)로 전환하는 전 과정을 **단계별**로 설명합니다.

> 핵심 원칙 한 줄: **"먼저 sandbox(가짜 돈)로 완벽히 테스트한 뒤, live(진짜 돈)로 바꾼다."**
> 바로 live로 하면 대부분 실패합니다. 이유는 [9번](#9-live-결제-실패-흔한-원인--해결)에 정리했습니다.

이 프로젝트의 결제 구조:
- **버튼(프론트)**: 브라우저에서 PayPal 버튼을 그림 → `NEXT_PUBLIC_PAYPAL_CLIENT_ID` 사용
- **주문 생성/승인(서버)**: `app/api/paypal/*` 에서 PayPal에 실제 주문·결제 요청 → `PAYPAL_CLIENT_SECRET` 사용
- 금액은 **서버가 통제**(브라우저에서 못 바꿈) → 안전

---

## 1. 개념 잡기 — sandbox vs live

| | Sandbox (테스트) | Live (실거래) |
|---|---|---|
| 돈 | 가짜 돈 (실제 청구 X) | 진짜 돈 (실제 청구 O) |
| 계정 | PayPal이 만들어주는 **가짜 구매자/판매자 계정** | 당신의 **진짜 비즈니스 계정** |
| 자격증명 | Sandbox용 Client ID / Secret | Live용 Client ID / Secret |
| 언제 | 개발·테스트 | 실제 오픈 |

⚠ **Sandbox 자격증명과 Live 자격증명은 완전히 다릅니다.** 섞어 쓰면 무조건 실패합니다.

---

## 2. PayPal 개발자 계정 준비

1. https://developer.paypal.com 접속 → 오른쪽 위 **Log in**
2. 로그인 계정 = 당신의 PayPal 계정 (없으면 먼저 www.paypal.com 에서 **비즈니스 계정** 가입)
3. 로그인 후 https://developer.paypal.com/dashboard 로 이동

---

## 3. Sandbox 앱 만들기 → Client ID · Secret 발급

1. 대시보드 왼쪽 메뉴 → **Apps & Credentials**
2. 상단 토글을 **Sandbox** 로 (Live 아님!)
3. **Create App** 클릭
4. App Name 입력 (예: `OhLifeUp-Sandbox`) → **Create App**
5. 생성된 앱 화면에 아래 두 값이 보입니다. **복사해 두세요.**
   - **Client ID** (긴 문자열)
   - **Secret** → `Show`/`Copy` 눌러 확인 (기본은 가려져 있음)

> 이 두 값이 5번 단계에서 `.env.local` 에 들어갑니다.

---

## 4. 테스트 계정 · 테스트 카드 발급 (여기가 헷갈리는 부분)

sandbox 결제를 하려면 **가짜 구매자**가 필요합니다. 두 가지 방법이 있습니다.

### 방법 A. Sandbox 구매자 계정으로 로그인 결제 (가장 확실)

1. 대시보드 왼쪽 → **Testing Tools → Sandbox Accounts**
   (또는 https://developer.paypal.com/dashboard/accounts)
2. 목록에 자동 생성된 계정 두 개가 보입니다:
   - `sb-...@business.example.com` → **판매자(=당신 상점)** 역할
   - `sb-...@personal.example.com` → **구매자** 역할
3. 구매자(personal) 계정의 **···(점 세 개) → View/Edit account** 클릭
   - **Email** 과 **System Generated Password**(비밀번호)를 확인/복사
   - 비밀번호가 안 보이면 여기서 새로 지정할 수 있습니다
4. 결제 테스트 때 PayPal 버튼을 누르면 뜨는 로그인 창에 **이 이메일/비밀번호**로 로그인 → 결제 진행
5. (필요하면) **Create account** 로 구매자 계정을 새로 만들 수 있습니다 (Personal 선택)

### 방법 B. 가상(테스트) 카드번호로 결제 (로그인 없이 "직불/신용카드")

> ⚠ **실물 카드가 아닙니다.** sandbox에서는 PayPal이 만들어주는 **가짜 카드번호**를 넣습니다. 실제 청구는 절대 없습니다.

가상 카드번호를 구하는 방법은 두 가지입니다.

**(1) 테스트 카드 생성기 — 원하는 카드 종류로 생성**
1. https://developer.paypal.com/test-card-manager/ 접속 (= PayPal Sandbox Test Card Generator)
   - 또는 대시보드 → **Testing Tools → Card testing**
2. 카드 종류(**Visa / Mastercard** 등) + 국가/지역 선택 → **Generate** 클릭
3. 생성된 **카드번호**를 복사

**(2) 내 sandbox 구매자 계정에 이미 딸린 카드 (가장 확실)**
1. 대시보드 → **Testing Tools → Sandbox Accounts**
2. `sb-...@personal...` (구매자) 계정 → **⋮(점 세 개) → View/Edit account**
3. **Funding 탭 → Credit Card** 섹션에 **카드번호 / 만료일 / CVV** 가 이미 있습니다 → 그대로 사용

**공통 입력 규칙**
- **만료일(Expiry)**: **미래 날짜** 아무거나 (예: 12/2030)
- **CVV**: 3자리 (American Express는 4자리)
- 이름/주소: 아무 값이나 입력 가능

**정적 테스트 번호(생성기가 안 될 때 예비용)**
- American Express: `371449635398431` (CVV 4자리)
- Diners Club: `36461510000039`

넣는 곳: 사이트에서 **"직불카드 또는 신용카드"** 버튼 클릭 → 뜨는 창에 위 **가상 카드번호 / 미래 만료일 / CVV** 입력 → 결제 → 성공 화면 확인.

---

## 5. 로컬 `.env.local` 설정

프로젝트 루트에서 예시 파일을 복사합니다.

```bash
cp .env.local.example .env.local
```

`.env.local` 을 열고 **PayPal 부분**을 3번에서 복사한 sandbox 값으로 채웁니다:

```env
# 프론트(공개)
NEXT_PUBLIC_PAYPAL_CLIENT_ID=여기에_Sandbox_Client_ID
NEXT_PUBLIC_PAYPAL_ENV=sandbox
NEXT_PUBLIC_PAYPAL_CURRENCY=USD
NEXT_PUBLIC_PAYPAL_AMOUNT=122.00

# 서버(비공개) — ⚠ NEXT_PUBLIC_ 붙이지 말 것
PAYPAL_CLIENT_SECRET=여기에_Sandbox_Secret
PAYPAL_ENV=sandbox
PAYPAL_AMOUNT=122.00
PAYPAL_CURRENCY=USD
```

핵심 3가지만 기억하세요:
1. `NEXT_PUBLIC_PAYPAL_CLIENT_ID` = **Client ID**
2. `PAYPAL_CLIENT_SECRET` = **Secret** (절대 공개 금지)
3. `PAYPAL_ENV=sandbox` (테스트 단계)

> `.env.local` 은 git에 안 올라갑니다(.gitignore). 안심하고 secret을 넣어도 됩니다.
> 값을 바꾼 뒤에는 **개발 서버를 껐다 다시 켜야** 반영됩니다.

---

## 6. 로컬에서 결제 테스트

1. 개발 서버 실행:
   ```bash
   npm install   # 처음 한 번
   npm run dev
   ```
2. 브라우저에서 http://localhost:3000 접속 → 아래로 스크롤 → **"신청 및 안전 결제"** 섹션
3. **이름 / 휴대폰 번호** 입력 (둘 다 넣어야 결제 버튼이 활성화됨)
4. **PayPal 버튼** 클릭 →
   - (방법 A) 뜨는 창에 **sandbox 구매자 이메일/비밀번호**로 로그인 → **Pay Now**
   - (방법 B) **Debit or Credit Card** 선택 → 테스트 카드번호 입력 → 결제
5. 성공하면 화면에 **"결제가 완료되었습니다 + 주문번호"** 가 표시됩니다 ✅
6. (Firebase까지 설정했다면) 아래 **"내 결제 내역 즉시 조회"** 에 이름·연락처를 넣으면 방금 결제가 조회됩니다

---

## 7. 결제 흐름 점검 (개발자용 · 문제 생기면)

브라우저 **개발자도구(F12) → Network 탭** 을 열고 결제하면 두 번의 요청이 보여야 합니다:

1. `POST /api/paypal/orders` → 응답 **201** + `{ "id": "..." }` (주문 생성됨)
2. `POST /api/paypal/orders/{id}/capture` → 응답 **200** + `"status": "COMPLETED"` (결제 확정됨)

둘 중 하나라도 실패(4xx/5xx)하면:
- **터미널(개발 서버 콘솔)** 에 `[paypal] ...` 로그가 찍힙니다 → 여기서 PayPal이 보낸 실제 에러 메시지를 확인
- 대부분 원인은 [9번](#9-live-결제-실패-흔한-원인--해결) 참고

---

## 8. Live(실거래) 전환

sandbox에서 6번이 완벽히 되면, 그때 live로 바꿉니다.

1. https://www.paypal.com 에서 **비즈니스 계정**이 완전히 활성화됐는지 확인
   - 이메일 인증, (필요 시) 은행/신원 확인 완료 → 안 되어 있으면 실거래 수금이 막힙니다
2. 개발자 대시보드 → **Apps & Credentials** → 토글을 **Live** 로 전환
3. **Create App** → live 앱 생성 → **Live Client ID** 와 **Live Secret** 복사
4. 배포 환경(Vercel)의 환경변수에 live 값 입력:
   - `NEXT_PUBLIC_PAYPAL_CLIENT_ID` = **Live** Client ID
   - `NEXT_PUBLIC_PAYPAL_ENV` = `live`
   - `PAYPAL_CLIENT_SECRET` = **Live** Secret
   - `PAYPAL_ENV` = `live`
   - `PAYPAL_AMOUNT` / `NEXT_PUBLIC_PAYPAL_AMOUNT` = 실제 판매가
   - (Vercel: 프로젝트 → **Settings → Environment Variables** 에서 입력 후 **재배포**)
5. 재배포 후, **본인 카드로 소액 실결제 → 바로 환불**로 한 번 검증하는 것을 권장

> ⚠ live 전환은 **env 값만** 바꾸면 됩니다. 코드는 그대로입니다.

---

## 9. "Live 결제 실패" 흔한 원인 & 해결

바로 live로 했다가 실패했다면 거의 이 중 하나입니다.

| 증상/원인 | 해결 |
|---|---|
| **sandbox 자격증명을 live에 사용** (또는 반대) | live 앱에서 새로 발급한 **Live** Client ID/Secret 사용. `PAYPAL_ENV=live` 로 서버 환경도 맞추기 |
| `PAYPAL_ENV` 와 자격증명 불일치 | 서버 `PAYPAL_ENV` 와 넣은 Client ID/Secret의 종류(sandbox/live)를 **똑같이** 맞추기 |
| **Live 앱을 안 만듦** | 8번 3단계 — Live 토글에서 별도로 Create App 해야 함 (sandbox 앱과 별개) |
| **비즈니스 계정 미인증** | paypal.com에서 이메일/은행/신원 확인 완료. 미인증이면 수금·일부 결제 제한 |
| **카드(게스트) 결제가 안 뜸** | live에서 "Debit/Credit Card"(비회원 카드결제)는 계정·국가별 **승인/자격**이 필요. 홍콩 등 일부 지역은 제한될 수 있음 → 우선 **PayPal 지갑 결제**부터 확인, 카드결제는 PayPal에 활성화 문의 |
| **통화/국가 미지원** | 계정이 해당 통화(USD 등) 수취 가능한지 확인. `CURRENCY` 값 확인 |
| **금액 형식 오류** | 금액은 반드시 소수점 2자리 문자열 (`"122.00"`), 통화와 맞게 |
| **Secret 누락/오타** | 배포 환경에 `PAYPAL_CLIENT_SECRET` 이 실제로 들어갔는지 (Vercel 재배포 필요) |
| **환경변수 반영 안 됨** | env 변경 후 **재배포**(로컬은 dev 서버 재시작) 안 하면 옛 값이 남음 |
| **표시 금액 ≠ 실제 금액** | 화면(`NEXT_PUBLIC_PAYPAL_AMOUNT`)과 서버(`PAYPAL_AMOUNT`)를 같은 값으로 |

문제 원인은 항상 **터미널/서버 로그의 `[paypal] ...` 메시지**에 PayPal이 알려줍니다. 그걸 먼저 확인하세요.

---

## 10. 배포 전 체크리스트 & FAQ

**체크리스트 (live 오픈 전)**
- [ ] sandbox에서 결제 성공(6번) + Network 200(7번) 확인
- [ ] 비즈니스 계정 인증 완료
- [ ] Live 앱 생성 + Live Client ID/Secret 확보
- [ ] Vercel 환경변수: `NEXT_PUBLIC_PAYPAL_CLIENT_ID`(live), `NEXT_PUBLIC_PAYPAL_ENV=live`, `PAYPAL_CLIENT_SECRET`(live), `PAYPAL_ENV=live`, 금액
- [ ] 재배포 후 본인 카드 소액 실결제→환불 검증
- [ ] `PAYPAL_CLIENT_SECRET` 이 코드/깃에 없고 환경변수에만 있는지 확인

**FAQ**
- Q. Client ID는 공개돼도 되나요? → 네(브라우저에 노출됨). **Secret만** 절대 공개 금지.
- Q. sandbox/live 앱을 매번 새로 만들어야 하나요? → 각 1개씩 만들어 두고 재사용합니다.
- Q. 금액을 바꾸려면? → `PAYPAL_AMOUNT` 와 `NEXT_PUBLIC_PAYPAL_AMOUNT` 를 같이 바꾸고 재배포.
- Q. 결제 성공했는데 조회가 안 돼요 → Firebase(`NEXT_PUBLIC_FIREBASE_*`)와 `firestore.rules` 배포가 필요합니다(README 참고).

---

### (참고) 향후 보안 강화 항목
- 지금은 결제 성공 후 **브라우저가 Firestore에 기록**합니다. 더 엄격히 하려면 **PayPal 웹훅**으로 서버에서 결제 확정을 받아 기록하고, `payments` 조회도 서버(Route Handler/Admin SDK)로 옮기는 것을 권장합니다.
