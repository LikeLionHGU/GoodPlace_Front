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
    // ↓ 창업 매장 광고용 필드 (백엔드 /map placements 계약과 동일한 이름).
    //   photo = 파일명만 저장, 프론트가 assets/shops/{photo} 로 참조(팀이 실사진 업로드).
    industry: "디저트 카페",
    photo: "dalkom-dessert-cafe.jpg",
    hours: "매일 10:00 - 21:00",
    address: "경상북도 포항시 북구 양덕로",
    intro: "지난달까지 공사 중이던 자리에 새로 문을 연 디저트 카페입니다. 명당을 통해 선결제해 주신 여러분 감사합니다. 첫 손님을 기다리고 있어요!",
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

// =========================================================
// 동네 투표·리포트(헤더 "투표하기"/"동네 현황") - 실제 백엔드 v3 연동
// 공실(건물) 단위 투표·쿠폰·개별 리포트는 백엔드에 대응 데이터가 없어 위 목업을 계속 쓴다.
// =========================================================

let _industriesCache = null;
/** GET /industries - 실제 업종 목록(6종). 대분류 없이 평평한 목록이라 캐시해서 재사용. */
async function getIndustries() {
  if (_industriesCache) return _industriesCache;
  // 임시: 목업 데이터 반환 (백엔드 연동 전)
  _industriesCache = [
    { id: 1, name: "햄버거" },
    { id: 2, name: "한식" },
    { id: 3, name: "분식" },
    { id: 4, name: "중식" },
    { id: 5, name: "디저트 카페" },
    { id: 6, name: "베이커리" }
  ];
  return _industriesCache;
}

let _regionCodeCache = null;
/** GET /regions - 백엔드에 시드된 동네(현재 유일하게 양덕동) 코드를 자동으로 가져온다. */
async function getPrimaryRegionCode() {
  if (_regionCodeCache) return _regionCodeCache;
  const res = await fetch(`${BACKEND_BASE_URL}/regions`);
  if (!res.ok) throw new Error("동네 목록 로드 실패: " + res.status);
  const regions = await res.json();
  if (regions.length === 0) throw new Error("등록된 동네가 없습니다.");
  _regionCodeCache = regions[0].region_code;
  return _regionCodeCache;
}

// region_code(예: "47111-YANGDEOK-TEMP")는 표시용 이름이 아니라서 사람이 읽을 이름으로 매핑.
// 목록에 없는 코드는 코드 그대로 보여준다(신규 동네가 추가돼도 깨지지 않게).
const REGION_DISPLAY_NAMES = { "47111-YANGDEOK-TEMP": "양덕동" };
function friendlyRegionName(regionCode) {
  return REGION_DISPLAY_NAMES[regionCode] || regionCode;
}

/** CATEGORY_TAXONOMY(투표하기 패널의 대분류/세부업종 UI)를 실제 백엔드 업종으로 채운다.
 *  백엔드엔 대분류 개념이 없어 카테고리 탭 1개("업종")에 6종을 전부 담는다.
 *  const 배열이라 재할당 대신 내용만 비우고 다시 채운다(panel.js가 이 배열 참조를 그대로 씀). */
function rebuildCategoryTaxonomyFromIndustries(industries) {
  CATEGORY_TAXONOMY.length = 0;
  CATEGORY_TAXONOMY.push({
    key: "업종",
    iconOff: "assets/cat-food-off.svg", // 백엔드에 대분류가 없어 기존 에셋을 임시로 재사용
    iconOn: "assets/cat-food-on.svg",
    subcategories: industries.map((i) => i.name)
  });
}

function industryIdByName(industries, name) {
  const found = industries.find((i) => i.name === name);
  if (!found) throw new Error(`알 수 없는 업종: ${name}`);
  return found.id;
}

/** 내가 이 동네에 투표한 세부 업종 - 백엔드에 "내 투표 목록" 조회 API가 없어 로컬에 기록해둔다. */
function neighborhoodMyVotesKey(regionCode) {
  const user = currentUser();
  return `myeongdang_my_neighborhood_votes_${user?.id || "anon"}_${regionCode}`;
}
function loadMyNeighborhoodVotes(regionCode) {
  try {
    return JSON.parse(localStorage.getItem(neighborhoodMyVotesKey(regionCode))) || [];
  } catch {
    return [];
  }
}
function saveMyNeighborhoodVotes(regionCode, industries) {
  localStorage.setItem(neighborhoodMyVotesKey(regionCode), JSON.stringify(industries));
}

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

/** GET /neighborhood 대응 - 실제로는 GET /industries + GET /regions/{code}/demand 조합.
 *  업종 택소노미(CATEGORY_TAXONOMY)도 여기서 실제 업종으로 채워둔다(투표하기 패널이 열리기 전에 필요). */
async function fetchNeighborhood() {
  if (NEIGHBORHOOD_USE_MOCK) return MOCK_NEIGHBORHOOD;
  const industries = await getIndustries();
  rebuildCategoryTaxonomyFromIndustries(industries);
  const regionCode = await getPrimaryRegionCode();
  const res = await fetch(`${BACKEND_BASE_URL}/regions/${encodeURIComponent(regionCode)}/demand`);
  if (!res.ok) throw new Error("동네 현황 로드 실패: " + res.status);
  const demand = await res.json();
  return {
    name: friendlyRegionName(regionCode),
    votes: demand.ranking.map((r) => ({ industry: r.industry_name, count: r.vote_count })),
    myVotes: loadMyNeighborhoodVotes(regionCode)
  };
}

/** POST /neighborhood/votes 대응 - 실제로는 POST /votes/batch(region_code+industry_ids).
 *  백엔드는 업종 1개당 1,000원(=100냥) 고정 차감이라 총액은 industries.length에 비례한다.
 *  냥 잔액 표시는 백엔드에 실제 유저 지갑(로그인 후순위)이 없어 목업 잔액에서만 차감한다. */
async function postNeighborhoodVoteBatch(industries) {
  if (NEIGHBORHOOD_USE_MOCK) {
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
    return { votes: MOCK_NEIGHBORHOOD.votes, coins: MOCK_ME.coins, myVotes: MOCK_NEIGHBORHOOD.myVotes };
  }

  const allIndustries = await getIndustries();
  const regionCode = await getPrimaryRegionCode();
  const industryIds = industries.map((name) => industryIdByName(allIndustries, name));
  const user = currentUser();

  const res = await fetch(`${BACKEND_BASE_URL}/votes/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      region_code: regionCode,
      industry_ids: industryIds,
      voter_id: user?.id || "anon",
      voter_name: user?.nickname || user?.id || "익명",
      lat: NEIGHBORHOOD_VOTE_LOCATION.lat,
      lng: NEIGHBORHOOD_VOTE_LOCATION.lng
    })
  });
  if (!res.ok) throw new Error("투표 실패: " + res.status);
  await res.json(); // 실제 응답은 raw vote 행이라 화면엔 안 쓰고, 아래서 집계를 다시 받아온다

  const prevMine = loadMyNeighborhoodVotes(regionCode);
  const mergedMine = Array.from(new Set([...prevMine, ...industries]));
  saveMyNeighborhoodVotes(regionCode, mergedMine);

  const demandRes = await fetch(`${BACKEND_BASE_URL}/regions/${encodeURIComponent(regionCode)}/demand`);
  const demand = await demandRes.json();
  const votes = demand.ranking.map((r) => ({ industry: r.industry_name, count: r.vote_count }));

  MOCK_ME.coins -= NEIGHBORHOOD_VOTE_COST_PER_INDUSTRY * industries.length;
  return { votes, coins: MOCK_ME.coins, myVotes: mergedMine };
}

/** POST /neighborhood/report - 동네 전체 투표 데이터 기반 AI 창업 기회 리포트, 50냥 차감
 *  응답: { coins, neighborhoodName, candidates: [ {A/B/C공실 각각의 상세 정보} ] }
 *  candidates 각 필드의 source 값은 데이터 출처 표기용: "verified"(명당 검증) / "public"(공공 API) / "agent"(중개사 입력) */
async function postNeighborhoodReport() {
  if (NEIGHBORHOOD_USE_MOCK) {
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
  const regionCode = await getPrimaryRegionCode();
  const demandRes = await fetch(`${BACKEND_BASE_URL}/regions/${encodeURIComponent(regionCode)}/demand`);
  if (!demandRes.ok) throw new Error("동네 현황 로드 실패: " + demandRes.status);
  const demand = await demandRes.json();
  const topIndustries = demand.ranking.slice(0, 3);
  if (topIndustries.length === 0) throw new Error("아직 이 동네에 투표가 없어요.");

  const user = currentUser();
  const voterId = user?.id || "anon";

  // 백엔드 v3 리포트는 "업종 하나 -> 추천 공실 top3" 구조라, 상위 득표 업종마다 따로 호출해서
  // 각 업종의 1순위 공실을 A/B/C 후보로 조립한다(목업의 "top3 업종, 각 1곳"과 방향은 같음).
  const reports = [];
  for (const ind of topIndustries) {
    const res = await fetch(`${BACKEND_BASE_URL}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ industry_id: ind.industry_id, region_code: regionCode, voter_id: voterId })
    });
    if (!res.ok) continue; // 그 업종에 맞는 공실이 없으면(404) 건너뛴다
    reports.push(await res.json());
  }
  if (reports.length === 0) throw new Error("추천할 공실이 없어요.");

  MOCK_ME.coins -= REPORT_COST; // 위 postNeighborhoodVoteBatch와 동일한 이유로 목업 잔액에서만 차감

  const candidates = reports.map((rep, i) => {
    const top = rep.vacancies[0];
    const areaM2 = top.area_fit.area_m2.value;
    return {
      label: String.fromCharCode(65 + i), // A, B, C
      name: top.vacancy.name,
      addr: top.vacancy.address.value,
      area: `${areaM2}㎡ (${Math.round(areaM2 / 3.3)}평)`,
      floor: top.floor_basis.floor.value,
      industry: rep.industry.name,
      fitScore: top.adequacy_pct,
      waitingCustomers: top.waiting_customers.count,
      demandDesc: `${top.action_range_demand.reading}. ${top.competition.reading}`,
      // 실제로는 "다른 업종"이 아니라 "같은 업종의 2·3순위 공실"이다(필드명은 UI 재사용 위해 유지).
      runnerUps: rep.vacancies.slice(1, 3).map((c) => ({ industry: c.vacancy.name, pct: c.adequacy_pct })),
      // v1의 "4요소 가중합"은 v3 곱셈 엔진과 안 맞아 폐기됐다(README 참고) - 가짜 가중치를 만들지 않고
      // 실제 산식에 쓰인 개별 값을 그대로 보여준다. weight는 null로 둬서 "가중 %" 배지를 숨긴다.
      breakdown: [
        { label: "동네 수요", weight: null, score: Math.min(100, Math.round(top.action_range_demand.weighted_demand * 20)), detail: top.action_range_demand.reading },
        { label: "경쟁 상황", weight: null, score: Math.round(Math.max(0, 100 - top.competition.competition_ratio * 50)), detail: top.competition.reading },
        { label: "면적 적합", weight: null, score: Math.round(top.area_fit.score01 * 100), detail: `${areaM2}㎡ · 적정 범위 ${top.area_fit.industry_range_m2[0]}~${top.area_fit.industry_range_m2[1]}㎡` },
        { label: "층 적합", weight: null, score: Math.round(top.floor_basis.floor_fit * 100), detail: top.floor_basis.reading }
      ],
      facility: [], // 실제 시설 정보는 아직 시드에 없음(중개사 등록은 후순위) - 빈 목록으로 정직하게 표시
      contract: [
        { label: "종합 적합도", value: `${top.adequacy_pct}%`, source: "verified" },
        { label: "산출 출처", value: "명당 v3 엔진(실데이터)", source: "verified" }
      ],
      competition: [
        { name: rep.industry.name, count: top.competition.count.value, avg: top.competition.neighborhood_avg.value }
      ],
      unit: [
        { label: "면적", value: `${areaM2}㎡`, source: "public" },
        { label: "층", value: top.floor_basis.floor.value, source: "public" },
        { label: "필요 인허가", value: rep.reference?.licenses?.value || "정보 없음", source: "public" },
        { label: "예상 초기비용", value: rep.reference?.startup_cost_manwon?.value ? `약 ${rep.reference.startup_cost_manwon.value}만 원` : "정보 없음", source: "public" }
      ]
    };
  });

  return { coins: MOCK_ME.coins, neighborhoodName: friendlyRegionName(regionCode), candidates };
}
