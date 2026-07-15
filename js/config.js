// =========================================================
// 설정값 - 팀원 중 이 파일만 건드리면 됨
// =========================================================

// 카카오 디벨로퍼스(developers.kakao.com) > 내 애플리케이션 > 앱 키
// 에서 발급받은 "JavaScript 키"를 아래에 붙여넣으세요.
// (REST API 키 아님! JavaScript 키여야 지도가 뜹니다)
const KAKAO_APP_KEY = "7b04a263461d5b09e5c2f41cb6371e16";

// 지도 중심 좌표 - 포항 중앙상가 육거리 (카카오 지오코딩 확인 좌표)
// 시연 지역을 바꾸려면 이 좌표와 vacancies.js의 상가 좌표를 함께 수정
const MAP_CENTER = { lat: 36.0416, lng: 129.3661 };

// 지도 확대 레벨 (숫자가 작을수록 확대됨, 동네 단위는 3~5 권장)
// 4: 개별 상가 건물 + 동(洞) 이름이 함께 보이는 레벨
const MAP_LEVEL = 4;

// 백엔드 API 준비되면 이 값을 true로 바꾸고 vacancies.js의
// fetchVacancies()를 실제 fetch(API_BASE_URL + "/vacancies")로 교체
const USE_MOCK_DATA = true;
const API_BASE_URL = "http://localhost:8000/api"; // 백엔드 담당자와 포트 맞추기

// ===== 냥(엽전) 정책 =====
const DEFAULT_COINS = 50;        // 가입 시 기본 지급
const COINS_PER_PAYMENT = 100;   // 1,000원 결제 시 충전되는 냥
const PAYMENT_KRW = 1000;        // 1회 결제 금액(원)
const VOTE_COST = 100;           // 투표 1회 차감
const REPORT_COST = 50;          // AI 리포트 생성 차감
