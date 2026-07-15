// =========================================================
// 자체 로그인/회원가입 - 지금은 localStorage 목업
// 백엔드 완성 후: POST /auth/signup, POST /auth/login 으로 교체
// (API_명세.md 참고)
// =========================================================

const USERS_KEY = "myeongdang_users";     // 가입된 유저 목록 (목업 전용)
const SESSION_KEY = "myeongdang_session"; // 로그인된 유저 아이디

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** POST /auth/signup  body:{id, pw, nickname} - 가입 (기본 50냥 지급) */
async function postSignup(id, pw, nickname) {
  if (USE_MOCK_DATA) {
    const users = loadUsers();
    if (users[id]) throw new Error("이미 사용 중인 아이디예요.");
    users[id] = { pw, nickname, coins: DEFAULT_COINS };
    saveUsers(users);
    return { id, nickname };
  }
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, pw, nickname })
  });
  if (!res.ok) throw new Error((await res.json()).message || "가입에 실패했어요.");
  return res.json();
}

/** POST /auth/login  body:{id, pw} - 로그인 */
async function postLogin(id, pw) {
  if (USE_MOCK_DATA) {
    const users = loadUsers();
    if (!users[id] || users[id].pw !== pw) {
      throw new Error("아이디 또는 비밀번호가 맞지 않아요.");
    }
    return { id, nickname: users[id].nickname };
  }
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, pw })
  });
  if (!res.ok) throw new Error((await res.json()).message || "로그인에 실패했어요.");
  return res.json();
}

/** 현재 로그인된 유저 (없으면 null) */
function currentUser() {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  if (USE_MOCK_DATA) {
    const u = loadUsers()[id];
    return u ? { id, nickname: u.nickname } : null;
  }
  return { id }; // 백엔드 연동 시: 세션/토큰 검증은 서버 몫
}

function setSession(id) {
  localStorage.setItem(SESSION_KEY, id);
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  location.href = "login.html";
}

/** 로그인 안 했으면 로그인 페이지로 (index.html에서 호출) */
function requireLogin() {
  if (!currentUser()) {
    location.href = "login.html";
    return false;
  }
  return true;
}
