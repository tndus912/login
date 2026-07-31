function bindAuthForm(formId, endpoint, options = {}) {
  const form = document.getElementById(formId);
  const messageEl = document.getElementById("message");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    messageEl.className = "message";
    messageEl.textContent = "";
    submitBtn.disabled = true;

    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.ok) {
        messageEl.textContent = data.message + (data.username ? ` (${data.username})` : "");
        messageEl.classList.add("visible", "success");
        form.reset();
        if (options.onSuccess) options.onSuccess(data);
      } else {
        messageEl.textContent = data.message || "요청에 실패했습니다.";
        messageEl.classList.add("visible", "error");
      }
    } catch {
      messageEl.textContent = "서버에 연결할 수 없습니다.";
      messageEl.classList.add("visible", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });
}
