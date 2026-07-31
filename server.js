const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_COOKIE = "sessionId";
const ROOT_USERNAME = "root";

/** @type {Map<string, { passwordHash: string, registeredAt: string }>} */
const users = new Map();

/** @type {Map<string, { username: string }>} */
const sessions = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, decodeURIComponent(rest.join("="))];
    })
  );
}

function getSessionUsername(req) {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  if (!sessionId) return null;
  return sessions.get(sessionId)?.username ?? null;
}

function requireAuth(req, res, next) {
  const username = getSessionUsername(req);
  if (!username) {
    return res.status(401).json({ ok: false, message: "로그인이 필요합니다." });
  }
  req.username = username;
  next();
}

function userPublicInfo(username) {
  const user = users.get(username);
  if (!user) return null;
  return { username, registeredAt: user.registeredAt };
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function setSessionCookie(res, sessionId) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax`
  );
}

async function ensureRootUser() {
  if (users.has(ROOT_USERNAME)) return;
  const password = process.env.ROOT_PASSWORD || "root";
  const passwordHash = await bcrypt.hash(password, 10);
  users.set(ROOT_USERNAME, {
    passwordHash,
    registeredAt: new Date().toISOString(),
  });
}

app.get("/", (_req, res) => {
  res.redirect("/login.html");
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || typeof username !== "string" || !username.trim()) {
    return res.status(400).json({ ok: false, message: "사용자 이름을 입력하세요." });
  }
  if (!password || typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ ok: false, message: "비밀번호는 4자 이상이어야 합니다." });
  }

  const id = username.trim();
  if (id === ROOT_USERNAME) {
    return res.status(403).json({ ok: false, message: "사용할 수 없는 사용자 이름입니다." });
  }
  if (users.has(id)) {
    return res.status(409).json({ ok: false, message: "이미 등록된 사용자입니다." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  users.set(id, {
    passwordHash,
    registeredAt: new Date().toISOString(),
  });

  return res.status(201).json({ ok: true, message: "등록되었습니다.", username: id });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: "사용자 이름과 비밀번호를 입력하세요." });
  }

  const id = String(username).trim();
  const user = users.get(id);
  if (!user) {
    return res.status(401).json({ ok: false, message: "사용자 이름 또는 비밀번호가 올바르지 않습니다." });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ ok: false, message: "사용자 이름 또는 비밀번호가 올바르지 않습니다." });
  }

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { username: id });
  setSessionCookie(res, sessionId);

  return res.json({ ok: true, message: "로그인 성공", username: id });
});

app.post("/logout", (req, res) => {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  if (sessionId) sessions.delete(sessionId);
  clearSessionCookie(res);
  return res.json({ ok: true, message: "로그아웃되었습니다." });
});

app.get("/api/me", requireAuth, (req, res) => {
  const info = userPublicInfo(req.username);
  if (!info) {
    return res.status(401).json({ ok: false, message: "로그인이 필요합니다." });
  }
  return res.json({
    ok: true,
    user: info,
    isRoot: req.username === ROOT_USERNAME,
  });
});

app.get("/api/users", requireAuth, (req, res) => {
  if (req.username !== ROOT_USERNAME) {
    return res.status(403).json({ ok: false, message: "권한이 없습니다." });
  }
  const list = [...users.keys()]
    .sort((a, b) => a.localeCompare(b, "ko"))
    .map((name) => userPublicInfo(name));
  return res.json({ ok: true, users: list });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, userCount: users.size });
});

ensureRootUser().then(() => {
  app.listen(PORT, () => {
    console.log(`Login server listening on http://localhost:${PORT}`);
  });
});
