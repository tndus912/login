function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR");
}

function renderInfoList(container, user) {
  container.innerHTML = `
    <div><dt>사용자 이름</dt><dd>${escapeHtml(user.username)}</dd></div>
    <div><dt>등록 일시</dt><dd>${formatDate(user.registeredAt)}</dd></div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function apiFetch(url, options = {}) {
  return fetch(url, { credentials: "same-origin", ...options });
}

async function loadDashboard() {
  const messageEl = document.getElementById("message");
  const res = await apiFetch("/api/me");
  const data = await res.json();

  if (!data.ok) {
    window.location.href = "/login.html";
    return;
  }

  document.getElementById("welcome").textContent = `${data.user.username}님, 환영합니다.`;
  renderInfoList(document.getElementById("my-info"), data.user);

  if (data.isRoot) {
    const usersRes = await apiFetch("/api/users");
    const usersData = await usersRes.json();
    if (usersData.ok) {
      const section = document.getElementById("all-users-section");
      const tbody = document.getElementById("all-users-body");
      section.classList.remove("hidden");
      tbody.innerHTML = usersData.users
        .map(
          (u) =>
            `<tr><td>${escapeHtml(u.username)}</td><td>${formatDate(u.registeredAt)}</td></tr>`
        )
        .join("");
    } else {
      messageEl.textContent = usersData.message || "전체 목록을 불러오지 못했습니다.";
      messageEl.classList.add("visible", "error");
    }
  }
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  await apiFetch("/logout", { method: "POST" });
  window.location.href = "/login.html";
});

loadDashboard();
