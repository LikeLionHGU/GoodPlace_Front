// =========================================================
// 지도 초기화 + 상가 상태별 오버레이 렌더링
// =========================================================

let map;

/** 카카오맵 SDK를 동적으로 로드하고, 로드가 끝나면 callback 실행 */
function loadKakaoSDK(appKey, callback) {
  const script = document.createElement("script");
  // 프로토콜 상대경로("//...")로 두면 http로 뜬 페이지(예: http://127.0.0.1:5500)에선 이 스크립트도
  // http로 요청되는데, 최신 브라우저가 이를 ORB(Opaque Response Blocking)로 차단한다
  // (net::ERR_BLOCKED_BY_ORB - 키·도메인 등록과 무관한 원인). https를 강제해서 회피.
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
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
  // 목업 상가가 한 동네 범위에만 있어서, 줌아웃하면 마커가 도시 전체로 흩어져
  // 툴팁 카드끼리 겹쳐 보인다. 데모 동네 스케일 밖으로 못 벌어지게 최대 레벨 제한.
  map.setMaxLevel(6);
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

/** 상가 상태별 말풍선(호버 시 표시) HTML */
function vacancyBubbleHTML(v, view) {
  if (v.status === "open") {
    // 새로 생긴 매장: 사진 카드 + NEW OPEN 배지 + 자세히 보기
    const total = v.votes.reduce((s, x) => s + x.count, 0);
    return `
      <div class="store-card">
        <div class="store-card-photo">
          <span class="new-open-badge">NEW OPEN</span>
        </div>
        <div class="store-card-body">
          <b>${v.openedName}</b>
          <span>${v.votes[0]?.industry || "매장"} · 투표 ${total}명 참여</span>
          <a class="store-card-more">자세히 보기 &rsaquo;</a>
        </div>
      </div>`;
  }
  // 빈 상가 / 공사 중: 말풍선 툴팁 (제목 + 설명 + 꼬리)
  return `
    <div class="tooltip-card">
      <b>${view.label(v)}</b>
      <span>${view.sub(v)}</span>
      <img class="tooltip-tail" src="assets/tooltip-arrow.svg" alt="" />
    </div>`;
}

/** 상가 하나에 대한 커스텀 오버레이 생성 (핀 마커 항상 + 호버 시 말풍선) */
function createVacancyOverlay(v) {
  const position = new kakao.maps.LatLng(v.lat, v.lng);
  const view = STATUS_VIEW[v.status] || STATUS_VIEW.empty;

  // 지도에는 상태별 핀(마커)만 항상 고정 표시하고,
  // 말풍선(.overlay-bubble)은 평소 숨겼다가 마우스를 올리면(CSS :hover) 보여준다.
  // 말풍선은 absolute라 표시/숨김이 마커 위치(앵커)에 영향을 주지 않는다 → 핀이 안 흔들림.
  const content = document.createElement("div");
  content.className = `vacancy-overlay ${view.cls}`;
  content.innerHTML = `
    <div class="building"><img src="${view.icon}" alt="" /></div>
    <div class="overlay-bubble">${vacancyBubbleHTML(v, view)}</div>
  `;

  // 빈 상가/투표 중 → 투표 패널, 공사 중/개업 → 매장 패널(쿠폰)
  content.onclick = () => {
    if (v.status === "open" || v.status === "construction") {
      openStorePanel(v);
    } else {
      openPanel(v);
    }
  };

  const overlay = new kakao.maps.CustomOverlay({
    position,
    content,
    yAnchor: 1, // 핀 하단 끝이 실제 좌표에 붙도록 (CSS translateY 이중 오프셋 제거와 한 쌍)
    zIndex: 10  // 배경 흐림 레이어(#map-tint)보다 위에 그려지도록
  });

  // 호버한 핀의 말풍선이 이웃 핀 마커에 가리지 않도록 맨 앞으로 올렸다가 원복
  content.addEventListener("mouseenter", () => overlay.setZIndex(100));
  content.addEventListener("mouseleave", () => overlay.setZIndex(10));

  return overlay;
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
// 동네 현황: 지도 위 동네 경계 + 업종별 핀 (데모 시각화)
//  - 백엔드에 업종 대분류·좌표 집계가 없어(투자하기 흐름의 업종은 평평한 실제 목록),
//    이 폴리곤/핀/인원수는 전부 데모용 목업이다. 아래 랭킹 리스트(실제 백엔드 데이터)와는 별개.
//  - "동네 현황" 패널이 열려있는 동안만 표시하고, 패널을 닫으면 지도에서 지운다.
// =========================================================
// 폴리곤 반경을 실제 행정동 스케일(대략 1.5km 폭)로 잡음 - MAP_CENTER 기준 육각형
const NEIGHBORHOOD_ZONE = {
  polygon: [
    { lat: 36.0491, lng: 129.3661 },
    { lat: 36.0456, lng: 129.3736 },
    { lat: 36.0376, lng: 129.3736 },
    { lat: 36.0341, lng: 129.3661 },
    { lat: 36.0376, lng: 129.3586 },
    { lat: 36.0456, lng: 129.3586 }
  ],
  pins: [
    { icon: "assets/cat-food-on.svg", label: "음식점", votes: 80, lat: 36.0450, lng: 129.3650 },
    { icon: "assets/cat-cafe-on.svg", label: "카페", votes: 50, lat: 36.0430, lng: 129.3610 },
    { icon: "assets/cat-leisure-on.svg", label: "여가시설", votes: 30, lat: 36.0460, lng: 129.3700 },
    { icon: "assets/cat-retail-on.svg", label: "소매", votes: 45, lat: 36.0390, lng: 129.3700 },
    { icon: "assets/cat-life-on.svg", label: "생활서비스", votes: 60, lat: 36.0400, lng: 129.3620 },
    { icon: "assets/cat-medical-on.svg", label: "의료", votes: 25, lat: 36.0370, lng: 129.3661 }
  ]
};

let neighborhoodPolygon = null;
let neighborhoodPinOverlays = [];

function showNeighborhoodZone() {
  if (!map) return;
  hideNeighborhoodZone();

  // 목업 공실 핀은 동 단위 폴리곤과 스케일이 안 맞아 어수선해 보이므로, 동네 현황을 보는 동안은 숨긴다.
  overlays.forEach((o) => o.setMap(null));

  const path = NEIGHBORHOOD_ZONE.polygon.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
  neighborhoodPolygon = new kakao.maps.Polygon({
    path,
    strokeWeight: 2,
    strokeColor: "#C62827",
    strokeOpacity: 0.9,
    fillColor: "#C62827",
    fillOpacity: 0.12
  });
  neighborhoodPolygon.setMap(map);

  // 동 단위로 커진 폴리곤 전체가 보이게 지도 범위를 재조정 (닫을 때 원래 뷰로 복귀)
  // 왼쪽 패널(250px)에 가려지는 영역을 감안해 왼쪽 패딩을 줘서, 폴리곤이 패널 밑에 깔리지 않게 한다.
  const bounds = new kakao.maps.LatLngBounds();
  path.forEach((p) => bounds.extend(p));
  map.setBounds(bounds, 40, 40, 40, 280);

  neighborhoodPinOverlays = NEIGHBORHOOD_ZONE.pins.map((pin) => {
    const content = document.createElement("div");
    content.className = "zone-pin";
    content.innerHTML = `
      <img class="zone-pin-icon" src="${pin.icon}" alt="${pin.label}" />
      <div class="zone-pin-bubble">
        <b>${pin.label}</b>
        <span>${pin.votes}명이 투표했어요.</span>
      </div>
    `;
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(pin.lat, pin.lng),
      content,
      yAnchor: 0.5,
      zIndex: 20
    });
    overlay.setMap(map);

    // 호버한 핀의 말풍선이 이웃 핀에 가리지 않도록 맨 앞으로 올렸다가 원복
    content.addEventListener("mouseenter", () => overlay.setZIndex(200));
    content.addEventListener("mouseleave", () => overlay.setZIndex(20));

    return overlay;
  });
}

function hideNeighborhoodZone() {
  if (!neighborhoodPolygon) return; // 이미 닫혀있으면 아무 것도 안 함 (지도 뷰/핀 복귀 중복 방지)

  neighborhoodPolygon.setMap(null);
  neighborhoodPolygon = null;
  neighborhoodPinOverlays.forEach((o) => o.setMap(null));
  neighborhoodPinOverlays = [];

  // 동네 현황 보기 전 원래 뷰(공실 핀 + 기본 중심/레벨)로 복귀
  overlays.forEach((o) => o.setMap(map));
  map.setCenter(new kakao.maps.LatLng(MAP_CENTER.lat, MAP_CENTER.lng));
  map.setLevel(MAP_LEVEL);
}

// =========================================================
// AI 레포트: A/B/C 추천 공실 위치를 지도에 표시 (탭 전환 시 활성 마커만 강조)
// =========================================================
let candidateMarkerOverlays = [];

function showCandidateMarkers(candidates, activeIndex) {
  if (!map) return;
  hideCandidateMarkers();

  // 리포트 지도에는 A/B/C 후보 위치만 또렷하게 보여주고, 나머지 목업 공실 핀은 혼동을 피하려 숨긴다.
  overlays.forEach((o) => o.setMap(null));

  candidateMarkerOverlays = candidates.map((c, i) => {
    const content = document.createElement("div");
    content.className = "cand-marker" + (i === activeIndex ? " active" : "");
    content.innerText = c.label;

    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(c.lat, c.lng),
      content,
      yAnchor: 0.5,
      zIndex: 50
    });
    overlay.setMap(map);
    return overlay;
  });

  // 리포트 패널(460px)에 가려지는 영역을 감안해 왼쪽 패딩을 크게 줘서, A/B/C 핀이 패널 밑에 깔리지 않게 한다.
  const bounds = new kakao.maps.LatLngBounds();
  candidates.forEach((c) => bounds.extend(new kakao.maps.LatLng(c.lat, c.lng)));
  map.setBounds(bounds, 40, 40, 40, 500);
}

/** 리포트 탭을 바꿔서 활성 후보가 바뀌었을 때, 지도 마커의 강조만 갱신 */
function highlightCandidateMarker(activeIndex) {
  candidateMarkerOverlays.forEach((overlay, i) => {
    const el = overlay.getContent();
    if (el) el.classList.toggle("active", i === activeIndex);
  });
}

function hideCandidateMarkers() {
  if (candidateMarkerOverlays.length === 0) return; // 이미 닫혀있으면 아무 것도 안 함 (핀 복귀 중복 방지)

  candidateMarkerOverlays.forEach((o) => o.setMap(null));
  candidateMarkerOverlays = [];

  // 리포트 보기 전 원래 뷰(공실 핀 + 기본 중심/레벨)로 복귀
  overlays.forEach((o) => o.setMap(map));
  map.setCenter(new kakao.maps.LatLng(MAP_CENTER.lat, MAP_CENTER.lng));
  map.setLevel(MAP_LEVEL);
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
