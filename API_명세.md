# 명당 API 명세 (프론트 ↔ 백엔드 계약) v0.3

프론트의 `js/vacancies.js` 함수와 1:1 대응. 백엔드 완성 후 `js/config.js`에서
`USE_MOCK_DATA = false`, `API_BASE_URL`을 실제 서버 주소로 바꾸면 연동 끝.
(현재 프론트는 `http://localhost:8000/api`로 가정 — 포트 다르면 알려주세요)

CORS: 프론트가 `http://localhost:5500`에서 뜨므로 백엔드에 CORS 허용 필요.

## 냥(재화) 정책 — 서버가 진실의 원천

| 항목 | 값 |
|---|---|
| 가입 기본 지급 | 50냥 |
| 결제 | 1,000원 = 100냥 |
| 투표 1회 | **-100냥** (상가당 1회 제한) |
| AI 리포트 생성 | **-50냥** |

잔액 검증·차감은 반드시 서버에서. 프론트는 표시만 함.
투표권 개념은 폐기됨 (v0.2까지의 tickets 필드 삭제).

---

## 0. 인증 (자체 로그인)

### POST /auth/signup — 회원가입
요청: `{ "id": "sehee", "pw": "1234", "nickname": "세희" }`
응답: `{ "id": "sehee", "nickname": "세희" }`
- 가입 시 기본 50냥 지급
- 아이디 중복 시 409 + `{ "message": "이미 사용 중인 아이디예요." }`

### POST /auth/login — 로그인
요청: `{ "id": "sehee", "pw": "1234" }`
응답: `{ "id": "sehee", "nickname": "세희", "token": "..." }`
- MVP는 토큰 없이 세션 쿠키여도 됨. 이후 모든 요청은 이 유저 기준으로 처리
- 프론트 목업은 localStorage로 대체 중 (`js/auth.js`)
- 소셜 로그인(네이버/구글)은 버튼만 있고 추후 연동

## 1. GET /vacancies — 상가 목록

지도에 표시할 모든 상가. **`lat`/`lng`는 실제 공실 위치** — 오버레이가 그 좌표 위에 뜸.
현장조사한 실제 공실 주소를 지오코딩해서 넣으면 됨 (주소→좌표 변환은 카카오 API 가능).

```json
[
  {
    "id": 1,
    "name": "육거리 1호 공실",
    "lat": 36.0412,
    "lng": 129.3655,
    "addr": "포항시 북구 중앙동 12-3",
    "area": "23㎡ / 1층",
    "status": "voting",
    "votes": [
      { "industry": "디저트 카페", "count": 50 }
    ]
  }
]
```

`status` 값 (4가지):

| 값 | 의미 | 지도 표시 | 추가 필드 |
|---|---|---|---|
| `empty` | 빈 상가, 투표 0건 | "아직 아무도 투표하지 않았어요" + 투표하러가기 | - |
| `voting` | 투표 진행 중 | "투표 진행 중" + 투표하러가기 | - |
| `construction` | 창업 확정, 공사 중 | "~이 생길 예정입니다" → 클릭 시 매장 패널 | `confirmedIndustry` |
| `open` | 창업 완료 | 새로 생긴 매장 → 클릭 시 매장 패널+쿠폰 | `openedName` (매장명) |

## 2. GET /me — 내 정보

```json
{
  "coins": 50,
  "voteHistory": [
    { "vacancyId": 4, "industry": "디저트 카페", "addr": "포항시 북구 중앙동 5-2" }
  ],
  "openedPlaces": [
    { "vacancyId": 4, "storeName": "달콤 디저트 카페", "addr": "포항시 북구 중앙동 5-2" }
  ],
  "claimedCoupons": [4]
}
```

- `voteHistory`: 상가당 최대 1건. 프론트가 "내 투표 보기"(업종+현재 순위)와
  중복 투표 방지, 쿠폰 수령 자격 판정에 사용
- `claimedCoupons`: 이미 쿠폰 받은 vacancyId 배열 (중복 발급 방지)
- MVP는 로그인 없이 단일 유저여도 됨

## 3. POST /payments — 냥 충전

요청: `{ "amountKrw": 1000 }`
응답: `{ "coins": 150 }` (충전 후 잔액)

MVP는 모의 결제(무조건 성공)로 충분. 실 결제 연동은 추후.

## 4. POST /vacancies/:id/votes — 투표 (100냥 차감)

요청: `{ "industry": "디저트 카페" }`

응답:
```json
{
  "votes": [ { "industry": "디저트 카페", "count": 51 } ],
  "coins": 50
}
```

서버 검증 필수: ① 잔액 ≥ 100냥 ② 이 상가에 첫 투표인지.
위반 시 4xx + `{ "message": "..." }`.
새 업종이면 배열에 추가, `empty` 상가면 `status`를 `voting`으로.

## 5. POST /vacancies/:id/coupon — 쿠폰 받기

`open` 상태 상가에서, 그 상가에 투표했던 유저만.
응답: `{ "storeName": "달콤 디저트 카페", "label": "디스카운트 쿠폰" }`
발급 후 `claimedCoupons`에 기록 (중복 방지).

## 6. POST /vacancies/:id/report — AI 리포트 생성 (50냥 차감)

LLM 호출이라 수 초 걸려도 됨 (프론트가 로딩 모달 표시 중).

응답:
```json
{
  "coins": 0,
  "recommendedIndustry": "디저트 카페",
  "fitScore": 82,
  "waitingCustomers": 50,
  "breakdown": [
    { "label": "수요 점수", "weight": 45, "score": 90, "desc": "주민 투표 50표 · 업종 1위" },
    { "label": "경쟁 공백", "weight": 30, "score": 75, "desc": "반경 500m 내 동일 업종 0곳" },
    { "label": "입지 적합", "weight": 15, "score": 80, "desc": "1층 · 유동인구 밀집 구간" },
    { "label": "면적 적합", "weight": 10, "score": 75, "desc": "23㎡ · 디저트 카페 적정 규모" }
  ],
  "competition": [
    { "name": "동일 업종", "count": 0, "highlight": true },
    { "name": "카페", "count": 12 },
    { "name": "편의점", "count": 5 }
  ],
  "competitionNote": "주변에 디저트 카페 업종이 없어 선점 효과가 기대돼요.",
  "initialCost": "약 4,500만 원",
  "costSource": "소상공인시장진흥공단 업종별 창업비용 통계",
  "licenses": "영업신고(식품위생법), 사업자등록",
  "unit": {
    "면적": "23㎡ (약 7평)",
    "층": "1층",
    "직전 업종": "의류 잡화",
    "보증금 / 월세": "1,000만 원 / 60만 원",
    "권리금": "없음 (추가 협의)"
  }
}
```

- `breakdown`: 적합도 산식 그대로 (수요 45% / 경쟁 30% / 입지 15% / 면적 10%) —
  가중치는 배치 엔진과 동일하게 유지
- `unit`: key-value 자유 구성 (프론트가 표로 그대로 렌더링)

---

## 에러 응답 공통

`{ "message": "잔액이 부족합니다" }` + 4xx/5xx 상태코드로 통일 제안.
