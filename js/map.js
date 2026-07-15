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
    // 새로 생긴 매장: 1차(사진 카드 + NEW OPEN + 자세히 보기) + 2차(영업시간·위치·소개·쿠폰)
    const industry = v.industry || v.votes?.[0]?.industry || "매장";
    // photo = 파일명만. 실제 경로는 assets/shops/. 없거나 로딩 실패 시 폴백 배경이 그대로 노출된다.
    const img = v.photo
      ? `<img class="store-card-img" src="assets/shops/${v.photo}" alt="" onerror="this.style.display='none'" />`
      : "";
    return `
      <div class="store-bubble-wrap">
        <div class="store-card">
          <div class="store-card-photo">
            <span class="store-card-fallback">&#127976;</span>
            ${img}
            <span class="new-open-badge">NEW OPEN</span>
          </div>
          <div class="store-card-body">
            <b>${v.openedName}</b>
            <span>${industry}<span class="store-dist" data-lat="${v.lat}" data-lng="${v.lng}"></span></span>
            <a class="store-card-more">자세히 보기 &rsaquo;</a>
          </div>
        </div>
        <div class="store-detail" hidden>
          <button class="store-detail-back" title="접기">&lsaquo;</button>
          <div class="sd-row"><small>영업 시간</small><p>${v.hours || "정보 없음"}</p></div>
          <div class="sd-row"><small>위치</small><p>${v.address || v.addr || "정보 없음"}</p></div>
          <div class="sd-row"><small>소개</small><p>${v.intro || "소개 정보가 아직 없어요."}</p></div>
          <button class="btn-coupon-detail">&#127915; 쿠폰 받기</button>
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

  // 핀 클릭 → 사이드바 진입점은 제거(v3: 투표는 공실 단위가 아니라 동네 단위).
  // 마커에는 호버 말풍선만. 창업 매장만 말풍선 안 "자세히 보기"로 2차 말풍선을 연다.

  const overlay = new kakao.maps.CustomOverlay({
    position,
    content,
    yAnchor: 1, // 핀 하단 끝이 실제 좌표에 붙도록 (CSS translateY 이중 오프셋 제거와 한 쌍)
    zIndex: 10  // 배경 흐림 레이어(#map-tint)보다 위에 그려지도록
  });

  // 호버한 핀의 말풍선이 이웃 핀 마커에 가리지 않도록 맨 앞으로 올렸다가 원복
  content.addEventListener("mouseenter", () => overlay.setZIndex(100));
  content.addEventListener("mouseleave", () => overlay.setZIndex(10));

  if (v.status === "open") {
    wireStoreBubble(content, v);
  }

  return overlay;
}

/** 창업 매장 말풍선: 자세히 보기(2차 열기) · 접기 · 쿠폰 받기 핸들러 */
function wireStoreBubble(content, v) {
  const wrap = content.querySelector(".store-bubble-wrap");
  const detail = content.querySelector(".store-detail");
  const moreBtn = content.querySelector(".store-card-more");
  const backBtn = content.querySelector(".store-detail-back");
  const couponBtn = content.querySelector(".btn-coupon-detail");

  if (moreBtn && detail && wrap) {
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      detail.hidden = false;
      // 뷰포트 오른쪽으로 넘치면 왼쪽에 붙인다
      wrap.classList.remove("flip-left");
      const rect = detail.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) wrap.classList.add("flip-left");
    });
  }
  if (backBtn && detail) {
    backBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      detail.hidden = true;
    });
  }
  if (couponBtn) {
    couponBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof claimCouponFor === "function") claimCouponFor(v);
    });
  }
}

// =========================================================
// 내 위치 → 매장 거리 ("현재 위치에서 N M")
//  기본 API = 브라우저 Geolocation. 거부/미지원 시 거리 생략(업종만 표시).
// =========================================================
let myLoc = null;

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)}M` : `${(m / 1000).toFixed(1)}KM`;
}

/** 현재 떠 있는 모든 매장 말풍선의 거리 텍스트를 갱신 */
function updateStoreDistances() {
  if (!myLoc) return;
  document.querySelectorAll(".store-dist").forEach((el) => {
    const lat = parseFloat(el.dataset.lat);
    const lng = parseFloat(el.dataset.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    el.textContent = `현재 위치에서 ${formatDistance(distanceMeters(myLoc, { lat, lng }))}`;
  });
}

function requestMyLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      myLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      updateStoreDistances();
    },
    () => {},                       // 거부/실패 → 거리 생략(에러 표시 안 함)
    { timeout: 8000, maximumAge: 300000 }
  );
}

let overlays = [];

function renderVacancies(vacancies) {
  overlays.forEach((o) => o.setMap(null));
  overlays = vacancies.map((v) => {
    const overlay = createVacancyOverlay(v);
    overlay.setMap(map);
    return overlay;
  });
  updateStoreDistances(); // 위치를 이미 알고 있으면 즉시 채움
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
    // 키 없음: 지도 대신 회색 placeholder만(패널은 상단 버튼으로만 진입 — 핀 클릭 사이드바 제거됨)
    document.getElementById("map").classList.add("map-placeholder");
    return;
  }

  requestMyLocation(); // "현재 위치에서 N M" 계산용 (거부해도 나머지는 정상)
  loadKakaoSDK(KAKAO_APP_KEY, () => {
    initMap();
    renderVacancies(vacancies);
  });
}

boot().catch((err) => {
  console.error(err);
  alert("데이터를 불러오는 중 오류가 발생했습니다. 콘솔을 확인하세요.");
});
