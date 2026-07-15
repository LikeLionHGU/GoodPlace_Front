// =========================================================
// 지도 초기화 + 상가 상태별 오버레이 렌더링
// =========================================================

let map;

/** 카카오맵 SDK를 동적으로 로드하고, 로드가 끝나면 callback 실행 */
function loadKakaoSDK(appKey, callback) {
  const script = document.createElement("script");
  script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
  script.onload = () => kakao.maps.load(callback);
  script.onerror = () => {
    alert("카카오맵 SDK 로드 실패. config.js의 KAKAO_APP_KEY와 도메인 등록을 확인하세요.");
  };
  document.head.appendChild(script);
}

function initMap() {
  const container = document.getElementById("map");
  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(MAP_CENTER.lat, MAP_CENTER.lng),
    level: MAP_LEVEL
  });
}

// 상태별 마커 아이콘 (디자이너 에셋: 빨강=개업, 흰색+빨강=빈상가, 흰색+렌치=공사중)
const STATUS_VIEW = {
  open: { cls: "st-open", icon: "assets/marker-active.svg" },
  construction: {
    cls: "st-construction",
    icon: "assets/marker-construction.svg",
    label: () => "공사 진행 중",
    sub: (v) => `${v.confirmedIndustry || "매장"}이 생길 예정입니다`
  },
  voting: { cls: "st-voting", icon: "assets/marker-vacant.svg", label: () => "빈 상가", sub: () => "투표 진행 중이에요" },
  empty: { cls: "st-empty", icon: "assets/marker-vacant.svg", label: () => "빈 상가", sub: () => "비어있는 상가입니다." }
};

/** 상가 하나에 대한 커스텀 오버레이 생성 (상태별로 다르게) */
function createVacancyOverlay(v) {
  const position = new kakao.maps.LatLng(v.lat, v.lng);
  const view = STATUS_VIEW[v.status] || STATUS_VIEW.empty;

  const content = document.createElement("div");
  content.className = `vacancy-overlay ${view.cls}`;

  if (v.status === "open") {
    // 새로 생긴 매장: 사진 카드 + NEW OPEN 배지 + 자세히 보기
    const total = v.votes.reduce((s, x) => s + x.count, 0);
    content.innerHTML = `
      <div class="building"><img src="${view.icon}" alt="" /></div>
      <div class="store-card">
        <div class="store-card-photo">
          <span class="new-open-badge">NEW OPEN</span>
        </div>
        <div class="store-card-body">
          <b>${v.openedName}</b>
          <span>${v.votes[0]?.industry || "매장"} · 투표 ${total}명 참여</span>
          <a class="store-card-more">자세히 보기 &rsaquo;</a>
        </div>
      </div>
    `;
    content.querySelector(".store-card-more").onclick = (e) => {
      e.stopPropagation();
      openStorePanel(v);
    };
  } else {
    // 빈 상가 / 공사 중: 말풍선 툴팁 (제목 + 설명 + 꼬리)
    content.innerHTML = `
      <div class="building"><img src="${view.icon}" alt="" /></div>
      <div class="tooltip-card">
        <b>${view.label(v)}</b>
        <span>${view.sub(v)}</span>
        <img class="tooltip-tail" src="assets/tooltip-arrow.svg" alt="" />
      </div>
    `;
  }

  // 빈 상가/투표 중 → 투표 패널, 공사 중/개업 → 매장 패널(쿠폰)
  content.onclick = () => {
    if (v.status === "open" || v.status === "construction") {
      openStorePanel(v);
    } else {
      openPanel(v);
    }
  };

  return new kakao.maps.CustomOverlay({
    position,
    content,
    yAnchor: 1,
    zIndex: 10 // 배경 흐림 레이어(#map-tint)보다 위에 그려지도록
  });
}

let overlays = [];

function renderVacancies(vacancies) {
  overlays.forEach((o) => o.setMap(null));
  overlays = vacancies.map((v) => {
    const overlay = createVacancyOverlay(v);
    overlay.setMap(map);
    return overlay;
  });
}

/** 투표 등으로 상가 상태가 바뀐 뒤 오버레이 다시 그리기 */
function refreshOverlays() {
  if (map && window.__vacancies) renderVacancies(window.__vacancies);
}

// =========================================================
// 진입점
//  - 키 있음: SDK 로드 → 지도 → 상가 오버레이
//  - 키 없음: 회색 배경 + 첫 상가 패널 자동 오픈 (UI 확인용)
// =========================================================
async function boot() {
  await loadMe();
  const vacancies = await fetchVacancies();
  window.__vacancies = vacancies; // 내 명당 "이동하기"에서 참조

  if (KAKAO_APP_KEY === "YOUR_APP_KEY") {
    document.getElementById("map").classList.add("map-placeholder");
    openPanel(vacancies[0]);
    return;
  }

  loadKakaoSDK(KAKAO_APP_KEY, () => {
    initMap();
    renderVacancies(vacancies);
  });
}

boot().catch((err) => {
  console.error(err);
  alert("데이터를 불러오는 중 오류가 발생했습니다. 콘솔을 확인하세요.");
});
