const API_BASE =
  localStorage.getItem("qingyin_api_base") ||
  (location.hostname === "127.0.0.1" || location.hostname === "localhost"
    ? "http://127.0.0.1:8000/api"
    : `${location.origin}/qingyin-api`);
const TOKEN_KEY = "qingyin_session_token";
const moodMap = [
  { label: "开心", emoji: "☺️", level: 5 },
  { label: "平静", emoji: "😌", level: 4 },
  { label: "一般", emoji: "😐", level: 3 },
  { label: "渴望", emoji: "😣", level: 2 },
  { label: "不适", emoji: "😵", level: 1 },
];

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  profile: null,
  today: null,
  summary: null,
  calendar: [],
  selectedMood: "开心",
  group: null,
  members: [],
  feed: [],
};

const el = {
  todayLabel: document.querySelector("#todayLabel"),
  homeGreeting: document.querySelector("#homeGreeting"),
  ringTitle: document.querySelector("#ringTitle"),
  ringMark: document.querySelector("#ringMark"),
  ringSubtitle: document.querySelector("#ringSubtitle"),
  moodGrid: document.querySelector("#moodGrid"),
  moodHint: document.querySelector("#moodHint"),
  reflectionInput: document.querySelector("#reflectionInput"),
  checkinButton: document.querySelector("#checkinButton"),
  soberDaysValue: document.querySelector("#soberDaysValue"),
  savedAmountValue: document.querySelector("#savedAmountValue"),
  totalCheckinsValue: document.querySelector("#totalCheckinsValue"),
  dailyBudgetValue: document.querySelector("#dailyBudgetValue"),
  calendarMonthLabel: document.querySelector("#calendarMonthLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  moodTrend: document.querySelector("#moodTrend"),
  groupNameInput: document.querySelector("#groupNameInput"),
  inviteCodeInput: document.querySelector("#inviteCodeInput"),
  createGroupButton: document.querySelector("#createGroupButton"),
  joinGroupButton: document.querySelector("#joinGroupButton"),
  groupCard: document.querySelector("#groupCard"),
  memberList: document.querySelector("#memberList"),
  feedList: document.querySelector("#feedList"),
  profileForm: document.querySelector("#profileForm"),
  profileShortcut: document.querySelector("#profileShortcut"),
  toast: document.querySelector("#toast"),
};

function formatMoney(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
}

function formatDateLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function monthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.remove("is-visible"), 2200);
}

async function api(path, options = {}, hasRetried = false) {
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set("X-Session-Token", state.token);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const data = await response.json();
  if (response.status === 401 && state.token && !hasRetried) {
    state.token = "";
    localStorage.removeItem(TOKEN_KEY);
    await initSession();
    return api(path, options, true);
  }
  if (!response.ok) throw new Error(data.detail || "请求失败");
  return data;
}

function renderMoodOptions() {
  el.moodGrid.innerHTML = moodMap.map((item) => `
    <button class="mood-chip ${state.selectedMood === item.label ? "is-active" : ""}" data-mood="${item.label}">
      <span>${item.emoji}</span>
      <strong>${item.label}</strong>
    </button>
  `).join("");
}

function renderHome() {
  const soberDays = state.summary?.sober_days ?? 1;
  const checkedIn = state.today?.checked_in;
  el.todayLabel.textContent = formatDateLabel();
  el.homeGreeting.textContent = `你已坚持戒酒第 ${soberDays} 天`;
  el.soberDaysValue.textContent = soberDays;
  el.savedAmountValue.textContent = formatMoney(state.summary?.saved_amount ?? 0);
  el.totalCheckinsValue.textContent = state.summary?.total_checkins ?? 0;
  el.dailyBudgetValue.textContent = formatMoney(state.summary?.daily_budget ?? 0);
  el.ringTitle.textContent = checkedIn ? "今天已打卡" : "等待你点亮今天";
  el.ringMark.textContent = checkedIn ? "✓" : "○";
  el.ringSubtitle.textContent = checkedIn ? "很好，今天你又为自己守住了一天。" : "现在签到，给今天一个明确的承诺。";
  el.checkinButton.disabled = checkedIn;
  el.checkinButton.textContent = checkedIn ? "今天已经完成打卡" : "完成今日打卡";
}

function renderCalendar() {
  const [year, month] = monthKey().split("-").map(Number);
  const hitDays = new Set((state.calendar || []).map((item) => Number(item.checkin_date.slice(-2))));
  const firstDay = new Date(year, month - 1, 1).getDay();
  const dayCount = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push('<div class="calendar-day is-empty"></div>');
  for (let day = 1; day <= dayCount; day += 1) {
    cells.push(`<div class="calendar-day ${hitDays.has(day) ? "is-hit" : ""}">${day}</div>`);
  }
  el.calendarMonthLabel.textContent = `${year}年${month}月`;
  el.calendarGrid.innerHTML = cells.join("");
}

function renderTrend() {
  const recent = state.summary?.recent_moods || [];
  if (!recent.length) {
    el.moodTrend.innerHTML = '<div class="feed-empty">完成几次打卡后，这里会显示你的心情走势。</div>';
    return;
  }
  el.moodTrend.innerHTML = recent.map((item) => {
    const mood = moodMap.find((entry) => entry.label === item.mood) || moodMap[2];
    const height = 36 + mood.level * 20;
    return `
      <div class="trend-col">
        <div class="trend-bar" style="height:${height}px"></div>
        <div>${mood.emoji}</div>
        <div class="trend-label">${item.checkin_date.slice(5)}</div>
      </div>
    `;
  }).join("");
}

function renderGroup() {
  if (!state.group) {
    el.groupCard.innerHTML = "<p>你还没有加入监督群组。先创建一个，或者使用邀请码加入。</p>";
    el.memberList.innerHTML = "";
    return;
  }
  el.groupCard.innerHTML = `
    <div class="member-card-top">
      <div>
        <div class="member-name">${state.group.name}</div>
        <div class="group-meta">邀请码：${state.group.invite_code}</div>
      </div>
      <div class="member-meta">监督中</div>
    </div>
  `;
  el.memberList.innerHTML = state.members.map((member) => `
    <article class="member-card">
      <div class="member-card-top">
        <div>
          <div class="member-name">${member.avatar_emoji} ${member.nickname}</div>
          <div class="member-meta">${member.role === "owner" ? "群主" : "成员"} · 已坚持 ${member.sober_days} 天</div>
        </div>
        <div class="member-meta">${member.checked_in_today ? "今日已打卡" : "今日待打卡"}</div>
      </div>
      <p>最近状态：${member.latest_mood || "尚未打卡"} ${member.latest_reflection ? `· ${member.latest_reflection}` : ""}</p>
      <p>累计节省：${formatMoney(member.saved_amount)}</p>
    </article>
  `).join("");
}

function formatFeedItem(item) {
  if (item.event_type === "checkin") return `${item.payload.mood} · ${item.payload.reflection || "完成了今天的打卡"}`;
  if (item.event_type === "member_joined") return "加入了监督群组";
  if (item.event_type === "group_created") return `创建了群组「${item.payload.group_name}」`;
  return "有新的动态";
}

function renderFeed() {
  if (!state.feed.length) {
    el.feedList.innerHTML = '<div class="feed-empty">加入监督群组后，这里会显示成员动态。</div>';
    return;
  }
  el.feedList.innerHTML = state.feed.map((item) => `
    <article class="feed-item">
      <div class="feed-top">
        <div>
          <div class="feed-name">${item.avatar_emoji} ${item.nickname}</div>
          <div class="feed-meta">${item.created_at.replace("T", " ")}</div>
        </div>
        <div class="feed-meta">${item.event_type}</div>
      </div>
      <div class="feed-body">${formatFeedItem(item)}</div>
    </article>
  `).join("");
}

function fillProfileForm() {
  if (!state.profile) return;
  el.profileForm.elements.nickname.value = state.profile.nickname;
  el.profileForm.elements.avatar_emoji.value = state.profile.avatar_emoji;
  el.profileForm.elements.sober_start_date.value = state.profile.sober_start_date;
  el.profileForm.elements.daily_budget.value = state.profile.daily_budget;
}

function switchPage(target) {
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("is-active", page.dataset.page === target));
  document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.toggle("is-active", nav.dataset.target === target));
}

async function initSession() {
  if (state.token) return;
  const result = await api("/session/init", { method: "POST" });
  state.token = result.token;
  localStorage.setItem(TOKEN_KEY, result.token);
  state.profile = result.profile;
}

async function refreshAll() {
  if (!state.token) await initSession();
  const [profile, today, summary, calendar, currentGroup, feed] = await Promise.all([
    api("/profile"),
    api("/checkins/today"),
    api("/stats/summary"),
    api(`/checkins/calendar?month=${monthKey()}`),
    api("/groups/current"),
    api("/groups/feed"),
  ]);
  state.profile = profile;
  state.today = today;
  state.summary = summary;
  state.calendar = calendar.days;
  state.group = currentGroup.group;
  state.members = currentGroup.members || [];
  state.feed = feed.items || [];
  renderMoodOptions();
  renderHome();
  renderCalendar();
  renderTrend();
  renderGroup();
  renderFeed();
  fillProfileForm();
}

async function submitCheckin() {
  try {
    await api("/checkins", {
      method: "POST",
      body: JSON.stringify({
        mood: state.selectedMood,
        reflection: el.reflectionInput.value.trim(),
      }),
    });
    el.reflectionInput.value = "";
    showToast("今日打卡已完成");
    await refreshAll();
  } catch (error) {
    showToast(error.message);
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(el.profileForm).entries());
  payload.daily_budget = Number(payload.daily_budget);
  try {
    state.profile = await api("/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    showToast("资料已保存");
    await refreshAll();
  } catch (error) {
    showToast(error.message);
  }
}

async function createGroup() {
  const name = el.groupNameInput.value.trim();
  if (!name) return showToast("请输入群组名称");
  try {
    const result = await api("/groups", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    el.groupNameInput.value = "";
    showToast(`群组已创建，邀请码 ${result.invite_code}`);
    await refreshAll();
    switchPage("challenge");
  } catch (error) {
    showToast(error.message);
  }
}

async function joinGroup() {
  const inviteCode = el.inviteCodeInput.value.trim().toUpperCase();
  if (!inviteCode) return showToast("请输入邀请码");
  try {
    await api("/groups/join", {
      method: "POST",
      body: JSON.stringify({ invite_code: inviteCode }),
    });
    el.inviteCodeInput.value = "";
    showToast("已加入监督群组");
    await refreshAll();
    switchPage("challenge");
  } catch (error) {
    showToast(error.message);
  }
}

function registerEvents() {
  document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => switchPage(item.dataset.target)));
  el.profileShortcut.addEventListener("click", () => switchPage("profile"));
  el.moodGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".mood-chip");
    if (!button) return;
    state.selectedMood = button.dataset.mood;
    el.moodHint.textContent = `当前选择：${state.selectedMood}`;
    renderMoodOptions();
  });
  el.checkinButton.addEventListener("click", submitCheckin);
  el.profileForm.addEventListener("submit", saveProfile);
  el.createGroupButton.addEventListener("click", createGroup);
  el.joinGroupButton.addEventListener("click", joinGroup);
}

async function boot() {
  renderMoodOptions();
  registerEvents();
  try {
    await refreshAll();
  } catch (error) {
    showToast(`初始化失败：${error.message}`);
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

boot();
