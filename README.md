# OhLifeUp

> 중국 제품 구매대행 & LifeUpCoaching 구매대행 전문 플랫폼

---

## 실행 방법

### 1. 처음 실행 (Ubuntu / macOS)

```bash
git clone <repo-url>
cd Hompage
chmod +x run_dev.sh
./run_dev.sh
```

첫 실행 시 자동으로 처리됩니다:
- Python `venv` 생성 및 백엔드 패키지 설치
- `npm install` (프론트엔드 패키지 설치)

### 2. 이후 실행

```bash
./run_dev.sh
```

### 접속 주소

| | 주소 |
|---|---|
| 웹사이트 | http://localhost:5173 |
| API 문서 | http://localhost:8000/docs |

같은 Wi-Fi의 다른 기기에서는 실행 시 콘솔에 출력되는 Network 주소로 접속.

---

## 기술 스택

| | |
|---|---|
| Frontend | React 19 + Vite 7 |
| 다국어 | react-i18next (한국어 / EN / 中文) |
| Backend | FastAPI + Uvicorn |
| DB | SQLite (SQLAlchemy) |
| 폰트 | Pretendard Variable |
