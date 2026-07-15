// =========================================================
// 로그인/회원가입 페이지 동작
// =========================================================

// 이미 로그인돼 있으면 바로 지도로
if (currentUser()) location.href = "index.html";

const loginFormEl = document.getElementById("login-form");
const signupFormEl = document.getElementById("signup-form");

function showError(id, msg) {
  document.getElementById(id).innerText = msg || "";
}

// ----- 로그인 ↔ 회원가입 전환 -----
document.getElementById("goto-signup").onclick = (e) => {
  e.preventDefault();
  loginFormEl.hidden = true;
  signupFormEl.hidden = false;
  showError("signup-error", "");
};
document.getElementById("goto-login").onclick = (e) => {
  e.preventDefault();
  signupFormEl.hidden = true;
  loginFormEl.hidden = false;
  showError("login-error", "");
};

// ----- 로그인 -----
async function doLogin() {
  const id = document.getElementById("login-id").value.trim();
  const pw = document.getElementById("login-pw").value;
  if (!id || !pw) {
    showError("login-error", "아이디와 비밀번호를 입력해주세요.");
    return;
  }
  try {
    const user = await postLogin(id, pw);
    setSession(user.id);
    location.href = "index.html";
  } catch (err) {
    showError("login-error", err.message);
  }
}
document.getElementById("btn-login").onclick = doLogin;
document.getElementById("login-pw").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

// ----- 회원가입 -----
document.getElementById("btn-signup").onclick = async () => {
  const nickname = document.getElementById("signup-nickname").value.trim();
  const id = document.getElementById("signup-id").value.trim();
  const pw = document.getElementById("signup-pw").value;
  const pw2 = document.getElementById("signup-pw2").value;

  if (!nickname || !id || !pw) {
    showError("signup-error", "모든 칸을 입력해주세요.");
    return;
  }
  if (pw.length < 4) {
    showError("signup-error", "비밀번호는 4자 이상으로 해주세요.");
    return;
  }
  if (pw !== pw2) {
    showError("signup-error", "비밀번호가 서로 달라요.");
    return;
  }
  try {
    const user = await postSignup(id, pw, nickname);
    setSession(user.id);
    location.href = "index.html";
  } catch (err) {
    showError("signup-error", err.message);
  }
};

// ----- 계정찾기 / 비밀번호 찾기 (추후 연동) -----
["find-account", "find-password"].forEach((id) => {
  document.getElementById(id).onclick = (e) => {
    e.preventDefault();
    alert("추후 지원 예정인 기능이에요.");
  };
});

// ----- 소셜 로그인 (추후 연동) -----
document.querySelectorAll(".login-social .social").forEach((btn) => {
  btn.onclick = () => alert("소셜 로그인은 추후 연동 예정이에요. 지금은 아이디로 가입해주세요!");
});
