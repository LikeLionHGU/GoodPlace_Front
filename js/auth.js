// =========================================================
// 로그인 세션 - 휴대폰 인증(플로우 목업)
// 실제 SMS 발송/검증 없음. 인증 완료 시 전화번호를 세션으로 저장한다.
// 백엔드 완성 후: 인증번호 발송/확인 API로 교체 (예: POST /auth/sms, POST /auth/verify)
// =========================================================

const SESSION_KEY = "myeongdang_session"; // 로그인된 유저 식별값(= 전화번호)

/** 현재 로그인된 유저 (없으면 null). 휴대폰 번호를 id/닉네임으로 쓴다. */
function currentUser() {
  const phone = localStorage.getItem(SESSION_KEY);
  if (!phone) return null;
  return { id: phone, nickname: phone };
}

function setSession(phone) {
  localStorage.setItem(SESSION_KEY, phone);
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
