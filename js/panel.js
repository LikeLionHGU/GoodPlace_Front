// =========================================================
// 패널 + 모달 UI 로직
//  - 투표 패널 (빈 상가/투표 중) · 매장 패널 (공사 중/개업)
//  - 내 명당, 냥 결제, 쿠폰, AI 리포트
// =========================================================

let currentVacancy = null;   // 투표/매장 패널에 떠 있는 상가
let me = { coins: 0, voteHistory: [], openedPlaces: [], claimedCoupons: [] };
let pendingIndustry = null;  // 투표 확인 모달에서 대기 중인 업종
let afterCharge = null;      // 결제 완료 후 이어서 실행할 동작
let neighborhood = null;     // 동네 현황 데이터 (fetchNeighborhood)
let reportContext = "vacancy"; // "vacancy" | "neighborhood" - AI 리포트 생성 확인 모달이 어느 흐름에서 열렸는지
let activeCategory = CATEGORY_TAXONOMY[0].key;  // 투표하기 패널에서 지금 보고 있는 대분류
let selectedIndustries = new Set();             // 투표하기 패널에서 선택된 세부 업종들

const panelEl = document.getElementById("vote-panel");
const myPanelEl = document.getElementById("my-panel");
const storePanelEl = document.getElementById("store-panel");
const voteSelectPanelEl = document.getElementById("vote-select-panel");
const neighborhoodPanelEl = document.getElementById("neighborhood-panel");
const rankListEl = document.getElementById("rank-list");
const myVoteBoxEl = document.getElementById("my-vote-box");
const totalCountEl = document.getElementById("total-count");
const coinCountEl = document.getElementById("coin-count");

// ---------- 공용 ----------
function openModal(id) { document.getElementById(id).hidden = false; }
function closeModal(id) { document.getElementById(id).hidden = true; }

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.onclick = () => { document.getElementById(btn.dataset.close).hidden = true; };
});

function closeAllPanels() {
  panelEl.hidden = true;
  myPanelEl.hidden = true;
  storePanelEl.hidden = true;
  voteSelectPanelEl.hidden = true;
  neighborhoodPanelEl.hidden = true;
}

async function loadMe() {
  me = await fetchMe();
  renderTopbar();
}

function renderTopbar() {
  coinCountEl.innerHTML = `<img src="assets/icon-coin-ring.svg" alt="냥" /> ${me.coins}냥`;
}

// 프로필 아이콘 → 로그아웃
document.querySelector(".profile-icon").onclick = () => {
  const user = currentUser();
  if (confirm(`${user?.nickname || user?.id}님, 로그아웃할까요?`)) logout();
};

/** 이 상가에 내가 투표한 이력 (상가당 1건) */
function myVoteFor(vacancyId) {
  return me.voteHistory.find((h) => h.vacancyId === vacancyId) || null;
}

// ---------- 냥 결제 ----------
/** 냥이 부족하면 결제 모달을 띄우고 true 반환. onCharged = 결제 후 이어갈 동작 */
function needCharge(cost, onCharged) {
  if (me.coins >= cost) return false;
  document.getElementById("charge-current").innerText = `${me.coins}냥`;
  document.getElementById("charge-need").innerText = `${cost}냥`;
  afterCharge = onCharged || null;
  openModal("modal-charge");
  return true;
}

document.getElementById("btn-charge-ok").onclick = async () => {
  try {
    const r = await postPayment();
    me.coins = r.coins;
    renderTopbar();
    closeModal("modal-charge");
    if (afterCharge) {
      const next = afterCharge;
      afterCharge = null;
      next();
    }
  } catch (err) {
    console.error(err);
    alert("결제 처리 중 오류가 발생했습니다.");
  }
};

// ---------- 투표 패널 (empty / voting) ----------
function openPanel(vacancy) {
  currentVacancy = vacancy;
  closeAllPanels();
  renderPanel();
  panelEl.hidden = false;
}

function renderPanel() {
  if (!currentVacancy) return;
  const votes = [...currentVacancy.votes].sort((a, b) => b.count - a.count);

  const total = votes.reduce((sum, v) => sum + v.count, 0);
  totalCountEl.innerText = total;

  rankListEl.innerHTML = "";
  if (votes.length === 0) {
    rankListEl.innerHTML = `<li class="empty">아직 아무도 투표하지 않았어요</li>`;
  }
  const voted = myVoteFor(currentVacancy.id);
  votes.forEach((v, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${i + 1}. ${v.industry}</span>
      <span class="votes">${v.count}명</span>
      <button class="btn-vote" title="투표 (100냥)">&#9997;</button>
    `;
    const btn = li.querySelector(".btn-vote");
    if (voted) {
      btn.disabled = true;
      btn.title = "이미 이 상가에 투표했어요";
    } else {
      btn.onclick = () => askVote(v.industry);
    }
    rankListEl.appendChild(li);
  });

  // 내 투표 보기: 이 건물에 내가 투표한 업종 1개 + 현재 순위
  if (voted) {
    const rank = votes.findIndex((v) => v.industry === voted.industry) + 1;
    myVoteBoxEl.innerHTML = `
      <b>${voted.industry}</b>
      <span class="my-rank">현재 ${rank > 0 ? rank + "위" : "집계 중"}</span>
    `;
  } else {
    myVoteBoxEl.innerHTML = `<span class="empty">아직 이 상가에 투표하지 않았어요</span>`;
  }

  renderTopbar();
}

// ---------- 투표 플로우 ----------
function askVote(industry) {
  if (myVoteFor(currentVacancy.id)) {
    alert("이미 이 상가에 투표했어요. (상가당 1회)");
    return;
  }
  if (needCharge(VOTE_COST, () => askVote(industry))) return;
  pendingIndustry = industry;
  document.getElementById("vote-confirm-title").innerText = `"${industry}"에 투표하시겠습니까?`;
  openModal("modal-vote-confirm");
}

document.getElementById("btn-vote-confirm-ok").onclick = async () => {
  closeModal("modal-vote-confirm");
  if (!pendingIndustry) return;
  await doVote(pendingIndustry);
  pendingIndustry = null;
};

async function doVote(industry) {
  if (!currentVacancy) return;
  try {
    const r = await postVote(currentVacancy.id, industry);
    currentVacancy.votes = r.votes;
    me.coins = r.coins;
    me.voteHistory.push({
      vacancyId: currentVacancy.id,
      industry,
      addr: currentVacancy.addr
    });
    renderPanel();
    if (typeof refreshOverlays === "function") refreshOverlays();
  } catch (err) {
    console.error(err);
    alert("투표 처리 중 오류가 발생했습니다.");
  }
}

/** 새로운 업종 투표 */
document.getElementById("btn-new-vote").onclick = () => {
  if (!currentVacancy) return;
  if (myVoteFor(currentVacancy.id)) {
    alert("이미 이 상가에 투표했어요. (상가당 1회)");
    return;
  }
  if (needCharge(VOTE_COST, () => document.getElementById("btn-new-vote").onclick())) return;
  document.getElementById("new-industry-input").value = "";
  openModal("modal-new-industry");
  document.getElementById("new-industry-input").focus();
};

document.getElementById("btn-new-industry-ok").onclick = async () => {
  const industry = document.getElementById("new-industry-input").value.trim();
  if (!industry) return;
  closeModal("modal-new-industry");
  await doVote(industry);
};

// ---------- 헤더 "투표하기": 업종 카테고리/세부업종 다중 선택 ----------
function openVoteSelectPanel() {
  closeAllPanels();
  selectedIndustries.clear();
  activeCategory = CATEGORY_TAXONOMY[0].key;
  renderCategoryRow();
  renderSubcategoryGrid();
  updateSelectedCount();
  voteSelectPanelEl.hidden = false;
}

function renderCategoryRow() {
  const row = document.getElementById("category-row");
  row.innerHTML = "";
  CATEGORY_TAXONOMY.forEach((cat) => {
    const isActive = cat.key === activeCategory;
    const btn = document.createElement("button");
    btn.className = "category-chip" + (isActive ? " active" : "");
    btn.innerHTML = `
      <span class="chip-icon">
        <img class="icon-off" src="${cat.iconOff}" alt="" />
        <img class="icon-on" src="${cat.iconOn}" alt="" />
      </span>
      <span>${cat.key}</span>
    `;
    btn.onclick = () => {
      activeCategory = cat.key;
      renderCategoryRow();
      renderSubcategoryGrid();
    };
    row.appendChild(btn);
  });
}

function renderSubcategoryGrid() {
  const cat = CATEGORY_TAXONOMY.find((c) => c.key === activeCategory);
  document.getElementById("subcategory-cat-name").innerText = cat.key;
  const grid = document.getElementById("subcategory-grid");
  grid.innerHTML = "";
  cat.subcategories.forEach((sub) => {
    const entry = neighborhood?.votes.find((v) => v.industry === sub);
    const count = entry ? entry.count : 0;
    const iconSrc = SUBCATEGORY_ICONS[sub];
    const card = document.createElement("button");
    card.className = "subcategory-card" + (selectedIndustries.has(sub) ? " selected" : "");
    card.innerHTML = `
      ${iconSrc ? `<span class="sub-icon" style="-webkit-mask-image:url(${iconSrc}); mask-image:url(${iconSrc})"></span>` : ""}
      <b>${sub}</b>
      <span class="sub-count">현재 ${count}표</span>
    `;
    card.onclick = () => {
      if (selectedIndustries.has(sub)) selectedIndustries.delete(sub);
      else selectedIndustries.add(sub);
      renderSubcategoryGrid();
      updateSelectedCount();
    };
    grid.appendChild(card);
  });
}

function updateSelectedCount() {
  const n = selectedIndustries.size;
  document.getElementById("selected-count").innerText = `${n}개 선택됨`;
  document.getElementById("btn-submit-vote-select").disabled = n === 0;
}

document.getElementById("btn-submit-vote-select").onclick = () => {
  if (selectedIndustries.size === 0) return;
  // 실제 백엔드는 업종 1개당 100냥 고정 차감(1,000원) — 선택 개수에 비례해서 확인해야 한다.
  const cost = NEIGHBORHOOD_VOTE_COST_PER_INDUSTRY * selectedIndustries.size;
  if (needCharge(cost, () => document.getElementById("btn-submit-vote-select").onclick())) return;
  document.getElementById("vs-confirm-current").innerText = `${me.coins}냥`;
  document.getElementById("vs-confirm-need").innerText = `${cost}냥`;
  openModal("modal-vote-select-confirm");
};

document.getElementById("btn-vote-select-confirm-ok").onclick = async () => {
  closeModal("modal-vote-select-confirm");
  try {
    const r = await postNeighborhoodVoteBatch([...selectedIndustries]);
    neighborhood.votes = r.votes;
    neighborhood.myVotes = r.myVotes;
    me.coins = r.coins;
    renderTopbar();
    selectedIndustries.clear();
    renderSubcategoryGrid();
    updateSelectedCount();
    alert("투표가 반영됐어요! 동네 현황에서 확인해보세요.");
  } catch (err) {
    console.error(err);
    alert("투표 처리 중 오류가 발생했습니다.");
  }
};

document.getElementById("btn-open-vote-select").onclick = async () => {
  if (!neighborhood) neighborhood = await fetchNeighborhood();
  openVoteSelectPanel();
};

// ---------- 헤더 "동네 현황" ----------
document.getElementById("btn-open-neighborhood").onclick = async () => {
  if (!neighborhood) neighborhood = await fetchNeighborhood();
  closeAllPanels();
  renderNeighborhoodPanel();
  neighborhoodPanelEl.hidden = false;
};

function renderNeighborhoodPanel() {
  document.getElementById("neighborhood-name").innerText = neighborhood.name;
  const votes = [...neighborhood.votes].sort((a, b) => b.count - a.count);
  const total = votes.reduce((s, v) => s + v.count, 0);
  document.getElementById("neighborhood-total").innerText = total;

  const rankEl = document.getElementById("neighborhood-rank-list");
  rankEl.innerHTML = "";
  votes.slice(0, 5).forEach((v, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${i + 1}. ${v.industry}</span><span class="votes">${v.count}</span>`;
    rankEl.appendChild(li);
  });

  const myEl = document.getElementById("neighborhood-my-list");
  myEl.innerHTML = "";
  if (!neighborhood.myVotes || neighborhood.myVotes.length === 0) {
    myEl.innerHTML = `<li class="empty">아직 이 동네에 투표하지 않았어요</li>`;
  } else {
    neighborhood.myVotes.forEach((industry) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${industry}</span>`;
      myEl.appendChild(li);
    });
  }
}

document.getElementById("btn-neighborhood-report").onclick = () => {
  if (needCharge(REPORT_COST, () => document.getElementById("btn-neighborhood-report").onclick())) return;
  openModal("modal-report-confirm");
  reportContext = "neighborhood";
};

// ---------- 매장 패널 (construction / open) ----------
function openStorePanel(vacancy) {
  currentVacancy = vacancy;
  closeAllPanels();

  const isOpen = vacancy.status === "open";
  const total = vacancy.votes.reduce((s, x) => s + x.count, 0);
  const voted = myVoteFor(vacancy.id);
  const claimed = me.claimedCoupons.includes(vacancy.id);

  document.getElementById("store-icon").innerHTML = isOpen ? "&#127913;" : "&#127959;";
  document.getElementById("store-name").innerText = isOpen
    ? vacancy.openedName
    : `${vacancy.confirmedIndustry} 공사 중`;
  document.getElementById("store-status").innerText = isOpen
    ? "주민 투표로 새로 생긴 매장이에요"
    : `${vacancy.confirmedIndustry}이(가) 생길 예정입니다`;
  document.getElementById("store-addr").innerText = vacancy.addr;
  document.getElementById("store-votes").innerText = `${total}명`;

  const btnCoupon = document.getElementById("btn-claim-coupon");
  const noCoupon = document.getElementById("store-no-coupon");
  // 개업했고 + 내가 투표했던 곳이면 무조건 쿠폰
  // (아직 안 받음 → "쿠폰 받기" / 이미 받음 → "내 쿠폰 보기"로 다시 열람)
  if (isOpen && voted) {
    btnCoupon.hidden = false;
    btnCoupon.disabled = false;
    btnCoupon.innerHTML = claimed ? "&#127915; 내 쿠폰 보기" : "&#127915; 쿠폰 받기";
    noCoupon.hidden = true;
  } else {
    btnCoupon.hidden = true;
    noCoupon.hidden = false;
    noCoupon.innerText = isOpen
      ? "이 상가에 투표한 주민에게 쿠폰이 발급돼요"
      : "완공되면, 투표한 주민에게 쿠폰이 발급돼요";
  }

  storePanelEl.hidden = false;
}

document.getElementById("btn-claim-coupon").onclick = async () => {
  try {
    if (me.claimedCoupons.includes(currentVacancy.id)) {
      // 이미 받은 쿠폰 다시 보기
      showCoupon(currentVacancy);
      return;
    }
    const coupon = await postClaimCoupon(currentVacancy.id);
    drawCoupon(coupon);
    openModal("modal-coupon");
    openStorePanel(currentVacancy); // 버튼을 "내 쿠폰 보기"로 갱신
  } catch (err) {
    console.error(err);
    alert("쿠폰 발급 중 오류가 발생했습니다.");
  }
};

/** 받아둔 쿠폰 다시 열람 (매장 패널·내 명당에서 사용) */
function showCoupon(vacancy) {
  drawCoupon({ storeName: vacancy.openedName, label: "디스카운트 쿠폰" });
  openModal("modal-coupon");
}

// ---------- AI 레포트: 확인 → (냥 확인) → 로딩 → 리포트 ----------
document.getElementById("btn-report").onclick = () => {
  if (!currentVacancy) return;
  if (needCharge(REPORT_COST, () => document.getElementById("btn-report").onclick())) return;
  reportContext = "vacancy";
  openModal("modal-report-confirm");
};

document.getElementById("btn-report-confirm-ok").onclick = async () => {
  closeModal("modal-report-confirm");
  openModal("modal-loading");
  try {
    const isNeighborhood = reportContext === "neighborhood";
    const report = isNeighborhood
      ? await postNeighborhoodReport()
      : await postGenerateReport(currentVacancy.id);
    me.coins = report.coins;
    renderTopbar();
    if (isNeighborhood) {
      renderNeighborhoodCandidates(report);
    } else {
      renderReport(report, currentVacancy.name, `경상북도 ${currentVacancy.addr}`);
    }
    closeModal("modal-loading");
    openModal("report-modal");
  } catch (err) {
    closeModal("modal-loading");
    console.error(err);
    alert("리포트 생성 중 오류가 발생했습니다.");
  }
};

function renderReport(r, title, addr) {
  document.getElementById("report-title").innerText = title;
  document.getElementById("report-addr").innerText = addr;

  const breakdownRows = r.breakdown.map((b) => `
    <div class="rp-row">
      <span class="rp-row-label">${b.label} <small>가중 ${b.weight}%</small></span>
      <div class="rp-bar"><div class="rp-bar-fill" style="width:${b.score}%"></div></div>
      <span class="rp-row-desc">${b.desc}</span>
    </div>
  `).join("");

  const compCards = r.competition.map((c) => `
    <div class="rp-comp ${c.highlight ? "good" : ""}">
      <b>${c.count}</b>
      <span>${c.name}</span>
    </div>
  `).join("");

  const unitRows = Object.entries(r.unit).map(([k, v]) => `
    <tr><th>${k}</th><td>${v}</td></tr>
  `).join("");

  document.getElementById("report-body").innerHTML = `
    <div class="rp-top">
      <div class="rp-reco">
        <small>추천 업종</small>
        <b>${r.recommendedIndustry}</b>
        <span class="rp-fit">종합 적합도 <b>${r.fitScore}%</b></span>
      </div>
      <div class="rp-waiting">
        <small>선결제 대기 고객</small>
        <b>${r.waitingCustomers}명</b>
        <span>개업일 첫 방문이 확정된 고객 수</span>
      </div>
    </div>

    <section>
      <h3>AI가 이렇게 판단했어요</h3>
      ${breakdownRows}
    </section>

    <section>
      <h3>주변 경쟁 · 반경 500m</h3>
      <div class="rp-comp-wrap">${compCards}</div>
      <p class="rp-note">${r.competitionNote}</p>
    </section>

    <section>
      <h3>창업 실무 정보</h3>
      <p>예상 창업 비용 <b>${r.initialCost}</b> <span class="source">(${r.costSource})</span><br/>
      필요 인허가: ${r.licenses}</p>
    </section>

    <section>
      <h3>이 공실 정보</h3>
      <table class="rp-table">${unitRows}</table>
    </section>

    <p class="source">본 추천은 주민 투표 데이터, 소진공 상권분석, 업종별 창업비용 통계에 기반합니다.</p>
  `;
}

// ---------- 동네 현황 "창업하기": A/B/C 공실 탭 + 드롭다운(아코디언) 리포트 ----------
let neighborhoodCandidates = [];
let activeCandidateIndex = 0;

function renderNeighborhoodCandidates(payload) {
  neighborhoodCandidates = payload.candidates;
  activeCandidateIndex = 0;
  document.getElementById("report-title").innerText =
    `${payload.neighborhoodName} · 주민 수요로 추천된 공실 ${payload.candidates.length}곳`;
  document.getElementById("report-addr").innerText = "";
  renderCandidateReportBody();
}

/** 데이터 출처 표시 점 (명당 검증=초록 / 공공 API=회색 / 중개사 입력=주황) */
function sourceDot(source) {
  return `<span class="src-dot src-${source}"></span>`;
}

function condRows(items) {
  return items.map((f) => `
    <div class="cond-row">${sourceDot(f.source)}<span class="cond-label">${f.label}</span><b>${f.value}</b></div>
  `).join("");
}

function renderCandidateReportBody() {
  const c = neighborhoodCandidates[activeCandidateIndex];

  const tabsHtml = neighborhoodCandidates.map((cand, i) => `
    <button class="cand-tab ${i === activeCandidateIndex ? "active" : ""}" data-idx="${i}">
      <b>${cand.label}공실</b>
      <span>${cand.industry} · ${cand.fitScore}%</span>
    </button>
  `).join("");

  const runnerUpsHtml = c.runnerUps.map((r) => `<div>${r.industry} <b>${r.pct}%</b></div>`).join("");

  const breakdownHtml = c.breakdown.map((b) => `
    <div class="rp-row">
      <span class="rp-row-label">${b.label}${b.weight != null ? ` <small>가중 ${b.weight}%</small>` : ""}</span>
      <div class="rp-bar"><div class="rp-bar-fill" style="width:${b.score}%"></div></div>
      <span class="rp-row-desc">${b.detail}</span>
    </div>
  `).join("");

  const compHtml = c.competition.map((comp) => `
    <div class="rp-comp ${comp.count === 0 ? "good" : ""}">
      <b>${comp.count}</b><span>${comp.name}</span><small>평균 ${comp.avg}</small>
    </div>
  `).join("");

  document.getElementById("report-body").innerHTML = `
    <div class="cand-tabs">${tabsHtml}</div>

    <div class="cand-head">
      <b>${c.name}</b>
      <span>${c.addr} · ${c.area} · ${c.floor}</span>
    </div>

    <div class="demand-box">
      <div class="demand-box-top">
        <span class="demand-badge">추천 1순위</span>
        <span class="demand-fit">수요 적합도 ${c.fitScore}%</span>
      </div>
      <div class="demand-industry">${c.industry}</div>
      <p class="demand-desc">${c.demandDesc}</p>
    </div>

    <div class="stat-pair">
      <div class="stat-box">
        <span>선결제 대기 고객</span>
        <b>${c.waitingCustomers}명</b>
        <small>개업일 첫 손님</small>
      </div>
      <div class="stat-box">
        <span>2·3순위 후보</span>
        ${runnerUpsHtml}
      </div>
    </div>

    <div class="accordion open">
      <button class="accordion-head"><span>이 추천의 근거</span><i class="chev">&#8964;</i></button>
      <div class="accordion-body">
        <p class="rp-formula">종합 적합도 ${c.fitScore}% — 아래 4개 요소를 반영해 산출</p>
        ${breakdownHtml}
        <p class="rp-disclaimer">명당은 성공을 보장하지 않습니다. 검증된 수요와 개업일 첫 손님까지가 명당의 책임이며, 이후 운영·품질은 창업자의 몫입니다.</p>
      </div>
    </div>

    <div class="accordion">
      <button class="accordion-head"><span>시설·계약 조건 <small>중개사 입력</small></span><i class="chev">&#8964;</i></button>
      <div class="accordion-body">
        <p class="accordion-note">담당 중개사가 확인·입력한 정보입니다. 창업 전 실측을 권장합니다.</p>
        <p class="cond-group-title">시설 조건</p>
        ${condRows(c.facility)}
        <p class="cond-group-title">계약 조건</p>
        ${condRows(c.contract)}
      </div>
    </div>

    <div class="accordion">
      <button class="accordion-head"><span>주변 경쟁 <small>공공 API</small></span><i class="chev">&#8964;</i></button>
      <div class="accordion-body">
        <div class="rp-comp-wrap">${compHtml}</div>
        <p class="source">소상공인 상가정보 API 실시간 집계</p>
      </div>
    </div>

    <div class="accordion">
      <button class="accordion-head"><span>공실 기본정보·참고 비용</span><i class="chev">&#8964;</i></button>
      <div class="accordion-body">
        ${condRows(c.unit)}
        <p class="source">초기비용은 업종 평균(공단 통계) 참고값. 실제는 점포·인테리어에 따라 다름.</p>
      </div>
    </div>

    <div class="source-legend">
      <span><i class="src-dot src-verified"></i>명당 검증</span>
      <span><i class="src-dot src-public"></i>공공 API</span>
      <span><i class="src-dot src-agent"></i>중개사 입력</span>
    </div>

    <div class="report-cta">
      <button class="btn-agent-connect">&#128222; 이 자리 중개사에게 연결</button>
      <button class="btn-download-report" title="다운로드">&#11015;</button>
    </div>
  `;

  document.querySelectorAll(".cand-tab").forEach((btn) => {
    btn.onclick = () => {
      activeCandidateIndex = parseInt(btn.dataset.idx, 10);
      renderCandidateReportBody();
    };
  });

  document.querySelectorAll(".accordion").forEach((acc) => {
    acc.querySelector(".accordion-head").onclick = () => acc.classList.toggle("open");
  });

  document.querySelector(".btn-agent-connect").onclick = () =>
    alert("중개사 연결은 추후 지원 예정이에요.");
  document.querySelector(".btn-download-report").onclick = () =>
    alert("리포트 다운로드는 추후 지원 예정이에요.");
}

// ---------- 내 명당 패널 ----------
document.getElementById("btn-my").onclick = () => {
  closeAllPanels();
  renderMyPanel();
  myPanelEl.hidden = false;
};

function renderMyPanel() {
  const openedEl = document.getElementById("opened-list");
  const historyEl = document.getElementById("history-list");

  openedEl.innerHTML = "";
  if (me.openedPlaces.length === 0) {
    openedEl.innerHTML = `<li class="empty">아직 창업 완료된 곳이 없어요</li>`;
  }
  me.openedPlaces.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${p.storeName}<br/><small>${p.addr}</small></span>
                    <button class="btn-goto">이동하기</button>`;
    li.querySelector(".btn-goto").onclick = () => gotoVacancy(p.vacancyId);
    openedEl.appendChild(li);
  });

  // 창업 완료된 상가는 투표 이력에서 제외 (위 목록과 중복 방지)
  const openedIds = me.openedPlaces.map((p) => p.vacancyId);
  const history = me.voteHistory.filter((h) => !openedIds.includes(h.vacancyId));

  historyEl.innerHTML = "";
  if (history.length === 0) {
    historyEl.innerHTML = `<li class="empty">아직 투표 이력이 없어요</li>`;
  }
  history.forEach((h) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${h.industry}<br/><small>${h.addr}</small></span>
                    <button class="btn-goto">이동하기</button>`;
    li.querySelector(".btn-goto").onclick = () => gotoVacancy(h.vacancyId);
    historyEl.appendChild(li);
  });

  // 내 쿠폰: 받아둔 쿠폰 언제든 다시 보기
  const couponEl = document.getElementById("coupon-list");
  couponEl.innerHTML = "";
  if (me.claimedCoupons.length === 0) {
    couponEl.innerHTML = `<li class="empty">아직 받은 쿠폰이 없어요</li>`;
  }
  me.claimedCoupons.forEach((vacancyId) => {
    const v = window.__vacancies?.find((x) => x.id === vacancyId);
    if (!v) return;
    const li = document.createElement("li");
    li.innerHTML = `<span>&#127915; 디스카운트 쿠폰<br/><small>${v.openedName}</small></span>
                    <button class="btn-goto">보기</button>`;
    li.querySelector(".btn-goto").onclick = () => showCoupon(v);
    couponEl.appendChild(li);
  });
}

/** 이동하기: 지도 이동 + 상태에 맞는 패널 오픈 */
function gotoVacancy(vacancyId) {
  const v = window.__vacancies?.find((x) => x.id === vacancyId);
  if (!v) return;
  if (typeof map !== "undefined" && map) {
    map.panTo(new kakao.maps.LatLng(v.lat, v.lng));
  }
  if (v.status === "open" || v.status === "construction") {
    openStorePanel(v);
  } else {
    openPanel(v);
  }
}

// ---------- 쿠폰: 캔버스에 그려서 이미지 다운로드 ----------
function drawCoupon(coupon) {
  const canvas = document.getElementById("coupon-canvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(0, 70, 12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(280, 70, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(coupon.label, 140, 55);
  ctx.font = "13px sans-serif";
  ctx.fillText(coupon.storeName, 140, 85);
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#bbb";
  ctx.fillText("명당 - 주민이 만든 가게", 140, 115);
}

document.getElementById("btn-coupon-download").onclick = () => {
  const canvas = document.getElementById("coupon-canvas");
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "명당_쿠폰.png";
  a.click();
};
