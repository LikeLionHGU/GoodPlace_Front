// =========================================================
// 데이터 계층 - 지금은 목업, 백엔드 완성 후 fetch로 교체
// 백엔드와 맞출 계약은 API_명세.md 참고 (이 파일의 함수 = 엔드포인트 1:1)
// =========================================================

// 상가 상태:
//  "empty"        빈 상가 (아직 아무도 투표 안 함)
//  "voting"       투표 진행 중
//  "construction" 창업 확정, 공사 진행 중
//  "open"         새로 생긴 매장 (창업 완료)
const MOCK_VACANCIES = [
  {
    id: 1,
    name: "육거리 1호 공실",
    lat: 36.0412, lng: 129.3655,
    addr: "포항시 북구 중앙동 12-3",
    area: "23㎡ / 1층",
    status: "voting",
    votes: [
      { industry: "디저트 카페", count: 50 },
      { industry: "애견 카페", count: 41 },
      { industry: "미용실", count: 32 },
      { industry: "베이커리", count: 18 },
      { industry: "꽃집", count: 9 }
    ]
  },
  {
    id: 2,
    name: "육거리 2호 공실",
    lat: 36.0422, lng: 129.3671,
    addr: "포항시 북구 중앙동 15-1",
    area: "18㎡ / 1층",
    status: "empty",
    votes: []
  },
  {
    id: 3,
    name: "육거리 3호 공실",
    lat: 36.0429, lng: 129.3652,
    addr: "포항시 북구 중앙동 8-7",
    area: "30㎡ / 1층",
    status: "construction",
    confirmedIndustry: "브런치 카페",   // 공사 중일 때: 생길 예정인 업종
    votes: [
      { industry: "브런치 카페", count: 44 },
      { industry: "독립서점", count: 19 }
    ]
  },
  {
    id: 4,
    name: "중앙동 명당 1호점",
    lat: 36.0404, lng: 129.3647,
    addr: "포항시 북구 중앙동 5-2",
    area: "25㎡ / 1층",
    status: "open",
    openedName: "달콤 디저트 카페",     // 창업 완료된 매장 이름
    votes: [
      { industry: "디저트 카페", count: 62 }
    ]
  }
];

// ===== 동네 전체 업종 투표 (헤더 "투표하기" / "동네 현황") =====
// 대분류 → 소분류 트리. iconOff = 선택 전(흰 배경), iconOn = 선택 후(빨간 배경) 디자이너 아이콘
const CATEGORY_TAXONOMY = [
  { key: "음식점", iconOff: "assets/cat-food-off.svg", iconOn: "assets/cat-food-on.svg", subcategories: ["햄버거", "한식", "분식", "중식"] },
  { key: "카페", iconOff: "assets/cat-cafe-off.svg", iconOn: "assets/cat-cafe-on.svg", subcategories: ["디저트 카페", "베이커리", "프랜차이즈 카페", "개인 카페"] },
  { key: "여가시설", iconOff: "assets/cat-leisure-off.svg", iconOn: "assets/cat-leisure-on.svg", subcategories: ["헬스장", "필라테스", "스크린골프", "PC방"] },
  { key: "소매", iconOff: "assets/cat-retail-off.svg", iconOn: "assets/cat-retail-on.svg", subcategories: ["편의점", "옷가게", "문구점", "잡화점"] },
  { key: "생활서비스", iconOff: "assets/cat-life-off.svg", iconOn: "assets/cat-life-on.svg", subcategories: ["세탁소", "부동산", "미용실", "인쇄소"] },
  { key: "의료", iconOff: "assets/cat-medical-off.svg", iconOn: "assets/cat-medical-on.svg", subcategories: ["약국", "한의원", "치과", "동물병원"] }
];

// 세부 업종 아이콘 - 지금은 음식점 4종만 에셋 있음, 나머지는 아이콘 없이 텍스트만 표시
const SUBCATEGORY_ICONS = {
  "햄버거": "assets/sub-hamburger.svg",
  "분식": "assets/sub-bunsik.svg",
  "한식": "assets/sub-hansik.svg",
  "중식": "assets/sub-jungsik.svg"
};

// 동네 전체 업종별 누적 투표수 (동네 현황 패널의 "투표 순위" 근거) - 백엔드 GET /neighborhood 응답으로 교체
const MOCK_NEIGHBORHOOD = {
  name: "중앙동 (육거리)",
  votes: [
    { industry: "햄버거", count: 32 },
    { industry: "한식", count: 18 },
    { industry: "분식", count: 11 },
    { industry: "중식", count: 7 },
    { industry: "디저트 카페", count: 50 },
    { industry: "애견 카페", count: 41 }
  ],
  // 내가 이 동네에 투표한 세부 업종 목록
  myVotes: []
};

// 내 정보 - 백엔드 GET /me 응답으로 교체될 값
// coins 기본값 50냥 → 투표(100냥)하려면 결제 필요 = 결제 플로우 시연 가능
const MOCK_ME = {
  coins: DEFAULT_COINS,
  // 내가 투표한 이력 (상가당 1건)
  voteHistory: [
    { vacancyId: 4, industry: "디저트 카페", addr: "포항시 북구 중앙동 5-2" },
    { vacancyId: 1, industry: "애견 카페", addr: "포항시 북구 중앙동 12-3" }
  ],
  // 내가 투표한 곳 중 창업 완료된 곳
  openedPlaces: [
    { vacancyId: 4, storeName: "달콤 디저트 카페", addr: "포항시 북구 중앙동 5-2" }
  ],
  // 이미 받은 쿠폰의 vacancyId 목록
  claimedCoupons: []
};

/** GET /vacancies - 상가 목록 (상태+투표 포함) */
async function fetchVacancies() {
  if (USE_MOCK_DATA) return MOCK_VACANCIES;
  const res = await fetch(`${API_BASE_URL}/vacancies`);
  if (!res.ok) throw new Error("상가 목록 로드 실패: " + res.status);
  return res.json();
}

/** GET /me - 냥 잔액/투표 이력/쿠폰 */
async function fetchMe() {
  if (USE_MOCK_DATA) return MOCK_ME;
  const res = await fetch(`${API_BASE_URL}/me`);
  if (!res.ok) throw new Error("내 정보 로드 실패: " + res.status);
  return res.json();
}

/** POST /payments - 1,000원 결제 → 100냥 충전 (응답: 갱신된 잔액) */
async function postPayment() {
  if (USE_MOCK_DATA) {
    MOCK_ME.coins += COINS_PER_PAYMENT;
    return { coins: MOCK_ME.coins };
  }
  const res = await fetch(`${API_BASE_URL}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountKrw: PAYMENT_KRW })
  });
  if (!res.ok) throw new Error("결제 실패: " + res.status);
  return res.json();
}

/** POST /vacancies/:id/votes  body:{industry} - 투표, 100냥 차감
 *  응답: { votes: 갱신된 배열, coins: 차감 후 잔액 } */
async function postVote(vacancyId, industry) {
  if (USE_MOCK_DATA) {
    const v = MOCK_VACANCIES.find((x) => x.id === vacancyId);
    let entry = v.votes.find((x) => x.industry === industry);
    if (!entry) {
      entry = { industry, count: 0 };
      v.votes.push(entry);
    }
    entry.count += 1;
    if (v.status === "empty") v.status = "voting";
    MOCK_ME.coins -= VOTE_COST;
    return { votes: v.votes, coins: MOCK_ME.coins };
  }
  const res = await fetch(`${API_BASE_URL}/vacancies/${vacancyId}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ industry })
  });
  if (!res.ok) throw new Error("투표 실패: " + res.status);
  return res.json();
}

/** POST /vacancies/:id/coupon - 개업 매장 쿠폰 받기 (내가 투표한 곳만) */
async function postClaimCoupon(vacancyId) {
  if (USE_MOCK_DATA) {
    const v = MOCK_VACANCIES.find((x) => x.id === vacancyId);
    MOCK_ME.claimedCoupons.push(vacancyId);
    return { storeName: v.openedName, label: "디스카운트 쿠폰" };
  }
  const res = await fetch(`${API_BASE_URL}/vacancies/${vacancyId}/coupon`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("쿠폰 발급 실패: " + res.status);
  return res.json();
}

/** POST /vacancies/:id/report - AI 창업 기회 리포트 생성, 50냥 차감
 *  (LLM 호출이라 수 초 걸림 - 프론트는 로딩 모달 표시 중) */
async function postGenerateReport(vacancyId) {
  if (USE_MOCK_DATA) {
    await new Promise((r) => setTimeout(r, 2000)); // LLM 흉내
    const v = MOCK_VACANCIES.find((x) => x.id === vacancyId);
    const votes = [...v.votes].sort((a, b) => b.count - a.count);
    const top = votes[0] || { industry: "미정", count: 0 };
    const total = votes.reduce((s, x) => s + x.count, 0);
    MOCK_ME.coins -= REPORT_COST;
    return {
      coins: MOCK_ME.coins,
      recommendedIndustry: top.industry,
      fitScore: 82,
      waitingCustomers: top.count,
      breakdown: [
        { label: "수요 점수", weight: 45, score: 90, desc: `주민 투표 ${top.count}표 · 업종 1위` },
        { label: "경쟁 공백", weight: 30, score: 75, desc: "반경 500m 내 동일 업종 0곳" },
        { label: "입지 적합", weight: 15, score: 80, desc: "1층 · 유동인구 밀집 구간" },
        { label: "면적 적합", weight: 10, score: 75, desc: `${v.area.split(" /")[0]} · ${top.industry} 적정 규모` }
      ],
      competition: [
        { name: "동일 업종", count: 0, highlight: true },
        { name: "카페", count: 12 },
        { name: "편의점", count: 5 }
      ],
      competitionNote: `주변에 ${top.industry} 업종이 없어 선점 효과가 기대돼요. 상세 경쟁 데이터는 소상공인 상권정보 API 연동 예정.`,
      initialCost: "약 4,500만 원",
      costSource: "소상공인시장진흥공단 업종별 창업비용 통계",
      licenses: "영업신고(식품위생법), 사업자등록",
      unit: {
        "면적": `${v.area.split(" /")[0]} (약 ${Math.round(parseInt(v.area) / 3.3)}평)`,
        "층": v.area.split("/ ")[1] || "1층",
        "직전 업종": "의류 잡화",
        "보증금 / 월세": "1,000만 원 / 60만 원",
        "권리금": "없음 (추가 협의)"
      }
    };
  }
  const res = await fetch(`${API_BASE_URL}/vacancies/${vacancyId}/report`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("리포트 생성 실패: " + res.status);
  return res.json();
}

/** GET /neighborhood - 동네 전체 업종 투표 현황 (동네 현황 패널) */
async function fetchNeighborhood() {
  if (USE_MOCK_DATA) return MOCK_NEIGHBORHOOD;
  const res = await fetch(`${API_BASE_URL}/neighborhood`);
  if (!res.ok) throw new Error("동네 현황 로드 실패: " + res.status);
  return res.json();
}

/** POST /neighborhood/votes  body:{industries:[...]} - 여러 세부 업종에 한번에 투표, 100냥 차감
 *  (헤더 "투표하기" 패널에서 여러 개 선택 후 하단 "투표하기" 버튼 1회 제출)
 *  응답: { votes: 갱신된 배열, coins: 차감 후 잔액 } */
async function postNeighborhoodVoteBatch(industries) {
  if (USE_MOCK_DATA) {
    industries.forEach((industry) => {
      let entry = MOCK_NEIGHBORHOOD.votes.find((x) => x.industry === industry);
      if (!entry) {
        entry = { industry, count: 0 };
        MOCK_NEIGHBORHOOD.votes.push(entry);
      }
      entry.count += 1;
      if (!MOCK_NEIGHBORHOOD.myVotes.includes(industry)) {
        MOCK_NEIGHBORHOOD.myVotes.push(industry);
      }
    });
    MOCK_ME.coins -= VOTE_COST;
    return { votes: MOCK_NEIGHBORHOOD.votes, coins: MOCK_ME.coins };
  }
  const res = await fetch(`${API_BASE_URL}/neighborhood/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ industries })
  });
  if (!res.ok) throw new Error("투표 실패: " + res.status);
  return res.json();
}

/** POST /neighborhood/report - 동네 전체 투표 데이터 기반 AI 창업 기회 리포트, 50냥 차감
 *  응답: { coins, neighborhoodName, candidates: [ {A/B/C공실 각각의 상세 정보} ] }
 *  candidates 각 필드의 source 값은 데이터 출처 표기용: "verified"(명당 검증) / "public"(공공 API) / "agent"(중개사 입력) */
async function postNeighborhoodReport() {
  if (USE_MOCK_DATA) {
    await new Promise((r) => setTimeout(r, 2000)); // LLM 흉내
    const sorted = [...MOCK_NEIGHBORHOOD.votes].sort((a, b) => b.count - a.count);
    MOCK_ME.coins -= REPORT_COST;

    const FIT_SCORES = [82, 74, 69];
    const ADDR_SAMPLES = [
      "경상북도 포항시 북구 양덕로 (예시 주소)",
      "경상북도 포항시 북구 중앙로 (예시 주소)",
      "경상북도 포항시 북구 죽도로 (예시 주소)"
    ];
    const region = MOCK_NEIGHBORHOOD.name.split(" ")[0];

    const candidates = sorted.slice(0, 3).map((top, i) => {
      const runnerUps = sorted
        .filter((v) => v.industry !== top.industry)
        .slice(0, 2)
        .map((v, j) => ({ industry: v.industry, pct: FIT_SCORES[i] - 18 - j * 6 }));
      return {
        label: String.fromCharCode(65 + i), // A, B, C
        name: `${region} ${String.fromCharCode(65 + i)}공실`,
        addr: ADDR_SAMPLES[i],
        area: "33㎡ (10평)",
        floor: "1층",
        industry: top.industry,
        fitScore: FIT_SCORES[i],
        waitingCustomers: top.count,
        demandDesc: `${region} 주민 ${top.count}명이 원했고, 반경 500m 안에 ${top.industry}이(가) 0개입니다.`,
        runnerUps,
        breakdown: [
          { label: "주민 수요", weight: 40, score: 90, detail: `${top.count}표 · ${i + 1}위` },
          { label: "경쟁 공백", weight: 30, score: 85, detail: "반경 내 0곳" },
          { label: "입지 적합", weight: 20, score: 65, detail: "1층 · 주거형" },
          { label: "면적 적합", weight: 10, score: 60, detail: "10평 · 적정" }
        ],
        facility: [
          { label: "하수구·정화조", value: "가능", source: "verified" },
          { label: "가스 인입", value: "가능", source: "verified" },
          { label: "화장실", value: "내부 별도", source: "agent" },
          { label: "전기 용량", value: "5kW", source: "agent" },
          { label: "주차", value: "공용 2대", source: "agent" },
          { label: "간판", value: "전면 가능", source: "agent" }
        ],
        contract: [
          { label: "보증금 / 월세", value: "1,000만 / 60만", source: "agent" },
          { label: "권리금", value: "없음", source: "agent" },
          { label: "관리비", value: "월 8만", source: "agent" },
          { label: "업종 제한", value: "주점·유흥 불가", source: "agent" },
          { label: "렌트프리", value: "첫 1개월", source: "agent" }
        ],
        competition: [
          { name: top.industry, count: 0, avg: 2.1 },
          { name: "카페", count: 13, avg: 8.4 },
          { name: "편의점", count: 5, avg: 4.7 }
        ],
        unit: [
          { label: "면적", value: "33㎡ (10평)", source: "public" },
          { label: "층", value: "1층", source: "public" },
          { label: "직전 업종", value: "의류점", source: "public" },
          { label: "예상 초기비용", value: "약 4,500만", source: "public" },
          { label: "필요 인허가", value: `${top.industry} 관련 신고`, source: "public" },
          { label: "용도", value: "2종 근생", source: "public" }
        ]
      };
    });

    return { coins: MOCK_ME.coins, neighborhoodName: MOCK_NEIGHBORHOOD.name, candidates };
  }
  const res = await fetch(`${API_BASE_URL}/neighborhood/report`, { method: "POST" });
  if (!res.ok) throw new Error("리포트 생성 실패: " + res.status);
  return res.json();
}
