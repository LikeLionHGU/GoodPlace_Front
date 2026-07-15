// =========================================================
// 로그인 페이지 - 휴대폰 인증 (플로우 목업)
//  전화번호 입력 → 인증번호 받기 → 인증번호 입력 칸 노출 → 인증 → 로그인
//  실제 SMS 발송/검증은 없음(데모). 인증 성공 시 전화번호를 세션으로 저장.
// =========================================================

// 이미 로그인돼 있으면 바로 지도로
if (currentUser()) location.href = "index.html";

const phoneInput = document.getElementById("phone-input");
const codeSection = document.getElementById("code-section");
const codeInput = document.getElementById("code-input");
const btnSend = document.getElementById("btn-send-code");
const btnVerify = document.getElementById("btn-verify");

function showError(id, msg) {
  document.getElementById(id).innerText = msg || "";
}

/** 숫자만 남기기 */
function digits(v) {
  return (v || "").replace(/[^0-9]/g, "");
}

// ----- 인증번호 받기 (목업: 실제 발송 없음) -----
btnSend.onclick = () => {
  const phone = digits(phoneInput.value);
  if (phone.length < 10) {
    showError("phone-error", "휴대폰 번호를 정확히 입력해주세요.");
    return;
  }
  showError("phone-error", "");

  // 인증번호 입력 영역 노출
  codeSection.hidden = false;
  btnVerify.hidden = false;
  btnSend.innerText = "인증번호 재전송";
  showError("code-error", "");
  document.getElementById("code-hint").innerText =
    "인증번호를 발송했어요. (데모: 숫자 6자리 아무거나 입력)";
  codeInput.focus();
};

// ----- 인증 (목업: 6자리면 통과) -----
function doVerify() {
  const code = digits(codeInput.value);
  if (code.length !== 6) {
    showError("code-error", "인증번호 6자리를 입력해주세요.");
    return;
  }
  showError("code-error", "");
  const phone = digits(phoneInput.value);
  setSession(phone);       // 인증 완료 → 전화번호로 로그인
  location.href = "index.html";
}
btnVerify.onclick = doVerify;

// ----- 편의: 엔터 키 -----
phoneInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnSend.click();
});
codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doVerify();
});
