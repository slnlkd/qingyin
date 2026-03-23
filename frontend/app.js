const API_BASE =
  localStorage.getItem("qingyin_api_base") ||
  (location.hostname === "127.0.0.1" || location.hostname === "localhost"
    ? "http://127.0.0.1:8000/api"
    : `${location.origin}/qingyin-api`);
const IS_LOCAL_DEV = location.hostname === "127.0.0.1" || location.hostname === "localhost";

const TOKEN_KEY = "qingyin_session_token";
const moodMap = [
  { label: "开心", level: 5, icon: "happy" },
  { label: "平静", level: 4, icon: "neutral" },
  { label: "一般", level: 3, icon: "plain" },
  { label: "渴望", level: 2, icon: "craving" },
  { label: "不适", level: 1, icon: "unwell" },
];

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  profile: null,
  auth: null,
  transferCode: null,
  today: null,
  summary: null,
  calendar: [],
  calendarMonth: monthKey(),
  selectedMood: "开心",
  group: null,
  members: [],
  feed: [],
  checkinUiState: "idle",
};

class SessionExpiredError extends Error {
  constructor() {
    super("当前会话已失效");
    this.name = "SessionExpiredError";
  }
}

const el = {
  todayLabel: document.querySelector("#todayLabel"),
  homeGreeting: document.querySelector("#homeGreeting"),
  soberDaysHero: document.querySelector("#soberDaysHero"),
  soberDaysCard: document.querySelector("#soberDaysCard"),
  checkinRing: document.querySelector("#checkinRing"),
  ringInner: document.querySelector("#ringInner"),
  ringTitle: document.querySelector("#ringTitle"),
  ringMark: document.querySelector("#ringMark"),
  ringSubtitle: document.querySelector("#ringSubtitle"),
  homeSupervisionPanel: document.querySelector("#homeSupervisionPanel"),
  moodGrid: document.querySelector("#moodGrid"),
  reflectionInput: document.querySelector("#reflectionInput"),
  devResetCheckinButton: document.querySelector("#devResetCheckinButton"),
  soberDaysValue: document.querySelector("#soberDaysValue"),
  savedAmountValue: document.querySelector("#savedAmountValue"),
  savedAmountCard: document.querySelector("#savedAmountCard"),
  totalCheckinsValue: document.querySelector("#totalCheckinsValue"),
  dailyBudgetValue: document.querySelector("#dailyBudgetValue"),
  calendarMonthLabel: document.querySelector("#calendarMonthLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  calendarPrev: document.querySelector("#calendarPrev"),
  calendarNext: document.querySelector("#calendarNext"),
  moodTrend: document.querySelector("#moodTrend"),
  groupNameInput: document.querySelector("#groupNameInput"),
  inviteCodeInput: document.querySelector("#inviteCodeInput"),
  createGroupButton: document.querySelector("#createGroupButton"),
  joinGroupButton: document.querySelector("#joinGroupButton"),
  groupCard: document.querySelector("#groupCard"),
  groupManagement: document.querySelector("#groupManagement"),
  groupRenameInput: document.querySelector("#groupRenameInput"),
  renameGroupButton: document.querySelector("#renameGroupButton"),
  refreshInviteButton: document.querySelector("#refreshInviteButton"),
  memberList: document.querySelector("#memberList"),
  feedList: document.querySelector("#feedList"),
  profileForm: document.querySelector("#profileForm"),
  profileSoberDaysValue: document.querySelector("#profileSoberDaysValue"),
  profileCheckinsValue: document.querySelector("#profileCheckinsValue"),
  profileSavedAmountValue: document.querySelector("#profileSavedAmountValue"),
  authCard: document.querySelector("#authCard"),
  profileGroupCard: document.querySelector("#profileGroupCard"),
  refreshProfileButton: document.querySelector("#refreshProfileButton"),
  profileShortcut: document.querySelector("#profileShortcut"),
  toast: document.querySelector("#toast"),
};

function formatMoney(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
}

function formatDateLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(key, offset) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return monthKey(date);
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.remove("is-visible"), 2200);
}

function formatFeedTime(value) {
  if (!value) return "";
  let normalized = value;
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value.replace("T", " ");
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(parsed);
}

function formatTransferExpiry(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}

function ringMarkIcon(mode) {
  if (mode === "success") {
    return `
      <svg class="ring-mark-icon ring-mark-icon-success" viewBox="0 0 48 48">
        <circle class="ring-mark-circle" cx="24" cy="24" r="16"></circle>
        <path class="ring-mark-check" d="M16.5 24.5 22 30l11-12"></path>
      </svg>
    `;
  }
  if (mode === "loading") {
    return `
      <svg class="ring-mark-icon ring-mark-icon-loading" viewBox="0 0 48 48">
        <circle class="ring-mark-pulse" cx="24" cy="24" r="6"></circle>
      </svg>
    `;
  }
  return `
    <svg class="ring-mark-icon ring-mark-icon-idle" viewBox="0 0 48 48">
      <circle class="ring-mark-outline" cx="24" cy="24" r="14"></circle>
      <circle class="ring-mark-core" cx="24" cy="24" r="3"></circle>
    </svg>
  `;
}

function moodIcon(name) {
  const icons = {
    happy: `
      <svg class="ui-icon mood-chip-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M8.5 10h.01M15.5 10h.01"></path>
        <path d="M8 14.2c1 .9 2.3 1.3 4 1.3 1.7 0 3-.4 4-1.3"></path>
      </svg>`,
    neutral: `
      <svg class="ui-icon mood-chip-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M8.5 10h.01M15.5 10h.01"></path>
        <path d="M8.5 15h7"></path>
      </svg>`,
    plain: `
      <svg class="ui-icon mood-chip-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M8.5 10h.01M15.5 10h.01"></path>
        <path d="M9 15c1-.3 2-.5 3-.5s2 .2 3 .5"></path>
      </svg>`,
    craving: `
      <svg class="ui-icon mood-chip-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M8.5 10h.01M15.5 10h.01"></path>
        <path d="M8.5 16c1.1-1 2.3-1.5 3.5-1.5s2.4.5 3.5 1.5"></path>
      </svg>`,
    unwell: `
      <svg class="ui-icon mood-chip-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M8.2 10.2 9 11M15.8 10.2 15 11"></path>
        <path d="M8.5 16c1.1-1.2 2.2-1.8 3.5-1.8 1.3 0 2.4.6 3.5 1.8"></path>
      </svg>`,
  };
  return icons[name] || icons.plain;
}

function statusIcon(name) {
  const icons = {
    checked: `
      <svg class="ui-icon status-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M8.5 12.2 10.9 14.6 15.8 9.8"></path>
      </svg>`,
    pending: `
      <svg class="ui-icon status-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 8v4.6"></path>
        <path d="M12 16.6h.01"></path>
      </svg>`,
    reminded: `
      <svg class="ui-icon status-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.5a4.6 4.6 0 0 1 4.6 4.6v2.1c0 .8.2 1.5.7 2.2l1 1.4H5.7l1-1.4c.5-.7.7-1.4.7-2.2V9.1A4.6 4.6 0 0 1 12 4.5"></path>
        <path d="M10.2 18a2 2 0 0 0 3.6 0"></path>
      </svg>`,
  };
  return icons[name] || icons.pending;
}

function eventTypeIcon(type) {
  const icons = {
    checkin: statusIcon("checked"),
    member_joined: `
      <svg class="ui-icon status-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="9" r="3.2"></circle>
        <path d="M4.8 18c.9-2.6 2.4-4 4.2-4s3.3 1.4 4.2 4"></path>
        <path d="M16 8.5h4"></path>
        <path d="M18 6.5v4"></path>
      </svg>`,
    group_created: `
      <svg class="ui-icon status-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 7.5h14"></path>
        <path d="M5 12h14"></path>
        <path d="M5 16.5h9"></path>
      </svg>`,
    group_updated: `
      <svg class="ui-icon status-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 17.5h3l7.8-7.8a1.6 1.6 0 0 0-2.3-2.3L6.7 15.2v2.3Z"></path>
        <path d="m13.7 8.2 2.3 2.3"></path>
      </svg>`,
    invite_code_refreshed: `
      <svg class="ui-icon status-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.8 8.2A6.5 6.5 0 1 0 18.5 14"></path>
        <path d="M18.5 5.8v4h-4"></path>
      </svg>`,
    member_reminded: statusIcon("reminded"),
  };
  return icons[type] || statusIcon("pending");
}

function memberStatusChip(member) {
  if (member.checked_in_today) {
    return `<div class="status-chip is-checked">${statusIcon("checked")}<span>今日已打卡</span></div>`;
  }
  if (state.group?.reminder_target_user_id === member.user_id) {
    return `<div class="status-chip is-reminded">${statusIcon("reminded")}<span>今日已提醒</span></div>`;
  }
  return `<div class="status-chip is-pending">${statusIcon("pending")}<span>今日待打卡</span></div>`;
}

function memberLatestState(member) {
  if (!member.latest_mood) {
    return `<div class="member-state-row is-empty">${statusIcon("pending")}<span>今天还没有留下状态</span></div>`;
  }
  const mood = moodMap.find((entry) => entry.label === member.latest_mood) || moodMap[2];
  return `
    <div class="member-state-row">
      ${moodIcon(mood.icon)}
      <span>${member.latest_mood}</span>
      <em>${member.latest_reflection ? escapeHtml(member.latest_reflection) : "今天的状态已更新"}</em>
    </div>
  `;
}

async function api(path, options = {}, hasRetried = false) {
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set("X-Session-Token", state.token);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: "no-store" });
  if (response.status === 204) return null;
  const data = await response.json();

  if (response.status === 401 && state.token && !hasRetried) {
    state.token = "";
    localStorage.removeItem(TOKEN_KEY);
    throw new SessionExpiredError();
  }

  if (!response.ok) throw new Error(data.detail || "请求失败");
  return data;
}

async function rebuildSessionAfterExpiry() {
  const shouldCreate = window.confirm("当前会话已失效。是否创建新的本地会话？注意：新会话不会自动恢复原来的监督关系。");
  if (!shouldCreate) {
    throw new SessionExpiredError();
  }
  await initSession();
  await refreshAll();
  showToast("已创建新的本地会话");
}

async function handleActionError(error) {
  if (error instanceof SessionExpiredError) {
    try {
      await rebuildSessionAfterExpiry();
    } catch (sessionError) {
      showToast(sessionError.message);
    }
    return;
  }
  showToast(error.message);
}

function renderMoodOptions() {
  el.moodGrid.innerHTML = moodMap
    .map(
      (item) => `
        <button class="mood-chip ${state.selectedMood === item.label ? "is-active" : ""}" data-mood="${item.label}">
          ${moodIcon(item.icon)}
          <strong>${item.label}</strong>
        </button>
      `,
    )
    .join("");
}

function triggerHomeCelebration() {
  const targets = [
    el.soberDaysHero,
    el.todayLabel,
    el.soberDaysCard,
    el.savedAmountCard,
  ].filter(Boolean);
  targets.forEach((node) => node.classList.remove("is-celebrating"));
  void document.body.offsetWidth;
  targets.forEach((node) => node.classList.add("is-celebrating"));
  clearTimeout(triggerHomeCelebration.timer);
  triggerHomeCelebration.timer = setTimeout(() => {
    targets.forEach((node) => node.classList.remove("is-celebrating"));
  }, 920);
}

function renderHome() {
  const streakDays = state.summary?.streak_days ?? 0;
  const checkedIn = state.today?.checked_in;
  const uiState = checkedIn ? "completed" : state.checkinUiState;
  el.todayLabel.textContent = formatDateLabel();
  el.homeGreeting.textContent = `你已连续打卡 ${streakDays} 天`;
  el.soberDaysHero.textContent = streakDays;
  el.soberDaysValue.textContent = streakDays;
  el.savedAmountValue.textContent = formatMoney(state.summary?.saved_amount ?? 0);
  el.totalCheckinsValue.textContent = state.summary?.total_checkins ?? 0;
  el.dailyBudgetValue.textContent = formatMoney(state.summary?.daily_budget ?? 0);
  el.checkinRing.classList.remove("is-actionable", "is-loading", "is-success", "is-completed");

  if (uiState === "loading") {
    el.checkinRing.classList.add("is-loading");
    el.ringTitle.textContent = "正在打卡";
    el.ringMark.innerHTML = ringMarkIcon("loading");
    el.ringSubtitle.textContent = "正在为今天留下一个清醒的确认。";
  } else if (uiState === "success") {
    el.checkinRing.classList.add("is-success");
    el.ringTitle.textContent = "今日已打卡";
    el.ringMark.innerHTML = ringMarkIcon("success");
    el.ringSubtitle.textContent = "很好，今天你又为自己守住了一天。";
  } else if (uiState === "completed") {
    el.checkinRing.classList.add("is-completed");
    el.ringTitle.textContent = "今日已打卡";
    el.ringMark.innerHTML = ringMarkIcon("success");
    el.ringSubtitle.textContent = "很好，今天你又为自己守住了一天。";
  } else {
    el.checkinRing.classList.add("is-actionable");
    el.ringTitle.textContent = "点击打卡";
    el.ringMark.innerHTML = ringMarkIcon("idle");
    el.ringSubtitle.textContent = "现在签到，给今天一个明确的承诺。";
  }

  el.checkinRing.disabled = uiState === "loading" || checkedIn;
  if (IS_LOCAL_DEV) {
    el.devResetCheckinButton.classList.toggle("hidden", uiState === "loading");
  }
}

function pendingCount(members) {
  return members.filter((member) => !member.checked_in_today).length;
}

function doneCount(members) {
  return members.filter((member) => member.checked_in_today).length;
}

function renderHomeSupervision() {
  if (!state.group) {
    el.homeSupervisionPanel.innerHTML = `
      <article class="supervision-empty">
        <div class="supervision-empty-title">监督功能已就位</div>
        <div class="supervision-empty-note">创建群组或输入邀请码加入后，这里会显示今天谁还没打卡。</div>
        <div class="supervision-empty-actions">
          <button class="secondary-btn" type="button" data-home-action="create-group">创建群组</button>
          <button class="secondary-btn" type="button" data-home-action="join-group">加入群组</button>
        </div>
      </article>
    `;
    return;
  }

  const members = [...(state.members || [])].sort((a, b) => {
    if (a.checked_in_today === b.checked_in_today) return b.streak_days - a.streak_days;
    return a.checked_in_today ? 1 : -1;
  });
  const pending = pendingCount(members);
  const done = doneCount(members);
  const focusMembers = members.slice(0, 2);
  const incomingReminder =
    state.group.incoming_reminder && !state.today?.checked_in
      ? `
        <div class="incoming-reminder">
          <div class="incoming-reminder-title">有人提醒你该打卡了</div>
          <div class="incoming-reminder-note">${state.group.incoming_reminder.actor_nickname} 正在等你更新今天的进度</div>
        </div>
      `
      : "";

  el.homeSupervisionPanel.innerHTML = `
    <div class="supervision-strip-body">
      ${incomingReminder}
      <div class="supervision-main">
        <div>
          <div class="supervision-label">今日监督</div>
          <div class="supervision-title">${pending > 0 ? `还有 ${pending} 人未打卡` : "今天群组全部已打卡"}</div>
        </div>
        <button class="supervision-go" type="button" data-home-action="open-challenge">去监督</button>
      </div>
      <div class="supervision-members">
        ${focusMembers
          .map(
            (member) => `
              <article class="supervision-member-chip ${member.checked_in_today ? "" : "is-pending"}" data-home-action="open-challenge">
                <div class="member-chip-main">
                  ${member.checked_in_today ? "" : '<span class="member-alert-dot"></span>'}
                  <div>
                    <div class="member-chip-name">${member.avatar_emoji} ${member.nickname}</div>
                    <div class="member-chip-meta">连续打卡 ${member.streak_days} 天</div>
                  </div>
                </div>
                <div class="member-chip-status ${member.checked_in_today ? "" : "pending"}">
                  ${member.checked_in_today ? "已打卡" : "待打卡"}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
      <button class="supervision-copy" type="button" data-copy-invite="${state.group.invite_code}">
        邀请码 ${state.group.invite_code} · ${done}/${members.length} 已完成
      </button>
    </div>
  `;
}

function renderCalendar() {
  const [year, month] = state.calendarMonth.split("-").map(Number);
  const hitDays = new Set((state.calendar || []).map((item) => Number(item.checkin_date.slice(-2))));
  const firstDay = new Date(year, month - 1, 1).getDay();
  const dayCount = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i += 1) {
    cells.push('<div class="calendar-day is-empty"></div>');
  }
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

  el.moodTrend.innerHTML = recent
    .map((item) => {
      const mood = moodMap.find((entry) => entry.label === item.mood) || moodMap[2];
      const height = 34 + mood.level * 16;
      return `
        <div class="trend-col">
          <div class="trend-bar" style="height:${height}px"></div>
          <div>${moodIcon(mood.icon)}</div>
          <div class="trend-value">${item.mood}</div>
          <div class="trend-label">${item.checkin_date.slice(5)}</div>
        </div>
      `;
    })
    .join("");
}

function renderGroup() {
  if (!state.group) {
    el.groupCard.innerHTML = "<p>你还没有加入监督群组。先创建一个，或者使用邀请码加入。</p>";
    el.groupManagement.classList.add("hidden");
    el.memberList.innerHTML = "";
    return;
  }

  el.groupCard.innerHTML = `
    <div class="group-card-main">
      <div class="member-card-top">
        <div>
          <div class="member-name">${state.group.name}</div>
          <div class="group-meta">邀请码：${state.group.invite_code}</div>
        </div>
        <div class="member-meta">${state.group.viewer_role === "owner" ? "群主" : "成员"}</div>
      </div>
      <div class="group-card-meta">
        <span class="meta-pill">成员 ${state.members.length} 人</span>
        <span class="meta-pill ${pendingCount(state.members) > 0 ? "is-pending" : ""}">${pendingCount(state.members)} 人待打卡</span>
      </div>
    </div>
  `;
  const isOwner = state.group.viewer_role === "owner";
  el.groupManagement.classList.toggle("hidden", !isOwner);
  if (isOwner) {
    el.groupRenameInput.value = state.group.name;
  }

  el.memberList.innerHTML = state.members
    .map(
      (member) => `
        <article class="member-card">
          <div class="member-card-top">
            <div>
              <div class="member-name">${member.avatar_emoji} ${member.nickname}</div>
              <div class="member-meta">${member.role === "owner" ? "群主" : "成员"} · 连续打卡 ${member.streak_days} 天</div>
            </div>
            ${memberStatusChip(member)}
          </div>
          ${memberLatestState(member)}
          <p>累计节省：${formatMoney(member.saved_amount)}</p>
          ${
            member.user_id !== state.profile?.user_id && !member.checked_in_today
              ? `<div class="member-card-actions">
                  <button class="secondary-btn remind-btn ${state.group?.reminder_used_today ? "is-disabled" : ""}" type="button" data-remind-user-id="${member.user_id}" ${state.group?.reminder_used_today ? "disabled" : ""}>
                    ${state.group?.reminder_target_user_id === member.user_id ? "已提醒" : "催一下"}
                  </button>
                </div>`
              : ""
          }
        </article>
      `,
    )
    .join("");
}

function formatFeedItem(item) {
  if (item.event_type === "checkin") return `${item.payload.mood} · ${item.payload.reflection || "又坚持了一天，继续保持。"}`
  if (item.event_type === "member_joined") return "加入了监督群组，一起开始互相监督。";
  if (item.event_type === "group_created") return `创建了监督群组「${item.payload.group_name}」，新的坚持已经开始。`;
  if (item.event_type === "group_updated") return `把群组名称更新为「${item.payload.group_name}」。`;
  if (item.event_type === "invite_code_refreshed") return `刷新了新的邀请码：${item.payload.invite_code}。`;
  if (item.event_type === "member_reminded") return `提醒 ${item.payload.target_nickname} 该打卡了。`;
  return "有新的监督动态。";
}

function renderFeedBody(item) {
  if (item.event_type === "checkin") {
    const mood = moodMap.find((entry) => entry.label === item.payload.mood) || moodMap[2];
    return `
      <div class="feed-status-row">
        ${moodIcon(mood.icon)}
        <span>${escapeHtml(item.payload.mood || "一般")}</span>
        <em>${escapeHtml(item.payload.reflection || "又坚持了一天，继续保持。")}</em>
      </div>
    `;
  }
  if (item.event_type === "member_reminded") {
    return `
      <div class="feed-status-row is-reminded">
        ${statusIcon("reminded")}
        <span>提醒打卡</span>
        <em>${escapeHtml(item.payload.target_nickname || "")} 该更新今天的进度了</em>
      </div>
    `;
  }
  return `<div class="feed-body-text">${escapeHtml(formatFeedItem(item))}</div>`;
}

function formatFeedType(item) {
  const labels = {
    checkin: "今日打卡",
    member_joined: "加入群组",
    group_created: "创建群组",
    group_updated: "更新群组",
    invite_code_refreshed: "刷新邀请码",
    member_reminded: "提醒打卡",
  };
  return labels[item.event_type] || "监督动态";
}

function renderFeed() {
  if (!state.feed.length) {
    el.feedList.innerHTML = '<div class="feed-empty">加入监督群组后，这里会显示成员动态。</div>';
    return;
  }

  el.feedList.innerHTML = state.feed
    .map(
      (item) => `
        <article class="feed-item">
          <div class="feed-top">
            <div>
              <div class="feed-name">${item.avatar_emoji} ${item.nickname}</div>
              <div class="feed-meta">${formatFeedTime(item.created_at)}</div>
            </div>
            <div class="feed-badge">${eventTypeIcon(item.event_type)}<span>${formatFeedType(item)}</span></div>
          </div>
          <div class="feed-body">${renderFeedBody(item)}</div>
        </article>
      `,
    )
    .join("");
}

function renderProfileSummary() {
  el.profileSoberDaysValue.textContent = `${state.summary?.sober_days ?? 0} 天`;
  el.profileCheckinsValue.textContent = `${state.summary?.streak_days ?? 0} 天`;
  el.profileSavedAmountValue.textContent = formatMoney(state.summary?.saved_amount ?? 0);

  if (!state.group) {
    el.profileGroupCard.innerHTML = "<p>暂未加入监督群组，去挑战页创建或输入邀请码加入。</p>";
    return;
  }

  el.profileGroupCard.innerHTML = `
    <div class="profile-group-main">
      <div class="member-card-top">
        <div>
          <div class="member-name">${state.group.name}</div>
          <div class="group-meta">邀请码：${state.group.invite_code}</div>
        </div>
        <div class="member-meta">${state.group.viewer_role === "owner" ? "群主" : "成员"}</div>
      </div>
      <div class="profile-group-meta">
        <span class="meta-pill">成员 ${state.members.length} 人</span>
        <span class="meta-pill ${pendingCount(state.members) > 0 ? "is-pending" : ""}">${pendingCount(state.members)} 人待打卡</span>
      </div>
      <button class="secondary-btn" type="button" data-profile-action="open-challenge">前往群组</button>
    </div>
  `;
}

function renderAuthStatus() {
  if (!state.auth) {
    el.authCard.innerHTML = "<p>正在读取账号状态。</p>";
    return;
  }

  if (state.auth.bound) {
    el.authCard.innerHTML = `
      <div class="auth-card-main">
        <div>
          <div class="member-name">已绑定微信小程序账号</div>
          <div class="group-meta">账号标识：${state.auth.openid_masked || "已绑定"}</div>
        </div>
        <div class="meta-pill">已绑定</div>
      </div>
      <p>后续你可以直接在微信小程序中登录，并恢复当前资料、打卡记录和监督群组关系。</p>
    `;
    return;
  }

  const transferBlock = state.auth.login_ready
    ? `
      <div class="auth-transfer-block">
        <div class="auth-transfer-top">
          <div>
            <div class="member-name">迁移到微信小程序</div>
            <div class="group-meta">${
              state.transferCode
                ? `迁移码 ${state.transferCode.code}，${formatTransferExpiry(state.transferCode.expires_at)} 前有效`
                : "生成 10 分钟有效的迁移码，在小程序中输入即可接过当前账号数据"
            }</div>
          </div>
          <button class="secondary-btn" type="button" data-auth-action="create-transfer-code">${
            state.transferCode ? "重新生成" : "生成迁移码"
          }</button>
        </div>
        ${
          state.transferCode
            ? `<div class="auth-transfer-code-row">
                <strong class="auth-transfer-code">${state.transferCode.code}</strong>
                <button class="secondary-btn" type="button" data-auth-action="copy-transfer-code" data-transfer-code="${state.transferCode.code}">复制</button>
              </div>`
            : ""
        }
      </div>
    `
    : "";

  el.authCard.innerHTML = `
    <div class="auth-card-main">
      <div>
        <div class="member-name">未绑定微信小程序账号</div>
        <div class="group-meta">${state.auth.login_ready ? "微信登录服务已就绪" : "服务端尚未配置微信登录"}</div>
      </div>
      <div class="meta-pill ${state.auth.login_ready ? "" : "is-pending"}">${state.auth.login_ready ? "可绑定" : "未就绪"}</div>
    </div>
    <p>当前仍是本地会话。后续在微信小程序首次登录时，可将当前设备上的资料与监督关系绑定为正式账号。</p>
    ${transferBlock}
  `;
}

function fillProfileForm() {
  if (!state.profile) return;
  el.profileForm.elements.nickname.value = state.profile.nickname;
  el.profileForm.elements.avatar_emoji.value = state.profile.avatar_emoji;
  el.profileForm.elements.sober_start_date.value = state.profile.sober_start_date;
  el.profileForm.elements.daily_budget.value = state.profile.daily_budget;
}

function switchPage(target) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === target);
  });
  document.querySelectorAll(".nav-item").forEach((nav) => {
    nav.classList.toggle("is-active", nav.dataset.target === target);
  });
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
  const [profile, auth, today, summary, calendar, currentGroup, feed] = await Promise.all([
    api("/profile"),
    api("/auth/me"),
    api("/checkins/today"),
    api("/stats/summary"),
    api(`/checkins/calendar?month=${state.calendarMonth}`),
    api("/groups/current"),
    api("/groups/feed"),
  ]);
  state.profile = profile;
  state.auth = auth;
  if (auth?.bound) {
    state.transferCode = null;
  }
  state.today = today;
  state.summary = summary;
  state.calendar = calendar.days;
  state.group = currentGroup.group;
  state.members = currentGroup.members || [];
  state.feed = feed.items || [];
  renderMoodOptions();
  renderHome();
  renderHomeSupervision();
  renderCalendar();
  renderTrend();
  renderGroup();
  renderFeed();
  renderProfileSummary();
  renderAuthStatus();
  fillProfileForm();
}

async function submitCheckin() {
  if (state.today?.checked_in || state.checkinUiState === "loading") return;
  state.checkinUiState = "loading";
  renderHome();
  try {
    await api("/checkins", {
      method: "POST",
      body: JSON.stringify({
        mood: state.selectedMood,
        reflection: el.reflectionInput.value.trim(),
      }),
    });
    el.reflectionInput.value = "";
    state.checkinUiState = "success";
    renderHome();
    triggerHomeCelebration();
    await new Promise((resolve) => setTimeout(resolve, 820));
    showToast("今日打卡已完成");
    await refreshAll();
  } catch (error) {
    state.checkinUiState = "idle";
    renderHome();
    await handleActionError(error);
  }
}

async function resetTodayCheckinForDev() {
  try {
    await api("/dev/reset-today-checkin", { method: "POST" });
    state.checkinUiState = "idle";
    el.reflectionInput.value = "";
    await refreshAll();
    showToast("已重置今日打卡");
  } catch (error) {
    await handleActionError(error);
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
    await handleActionError(error);
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
    await handleActionError(error);
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
    await handleActionError(error);
  }
}

async function updateGroup(options) {
  try {
    await api("/groups/current", {
      method: "PUT",
      body: JSON.stringify(options),
    });
    showToast(options.refresh_invite_code ? "邀请码已刷新" : "群组信息已更新");
    await refreshAll();
  } catch (error) {
    await handleActionError(error);
  }
}

async function remindMember(targetUserId) {
  try {
    const result = await api("/groups/remind", {
      method: "POST",
      body: JSON.stringify({ target_user_id: Number(targetUserId) }),
    });
    showToast(`已提醒 ${result.target_nickname} 去打卡`);
    await refreshAll();
    switchPage("challenge");
  } catch (error) {
    await handleActionError(error);
  }
}

async function createTransferCode() {
  try {
    const result = await api("/auth/transfer-code", {
      method: "POST",
    });
    state.transferCode = result;
    renderAuthStatus();
    showToast(`迁移码 ${result.code} 已生成`);
  } catch (error) {
    await handleActionError(error);
  }
}

function registerEvents() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => switchPage(item.dataset.target));
  });
  el.profileShortcut.addEventListener("click", () => switchPage("profile"));
  el.moodGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".mood-chip");
    if (!button) return;
    state.selectedMood = button.dataset.mood;
    renderMoodOptions();
  });
  el.checkinRing.addEventListener("click", submitCheckin);
  if (IS_LOCAL_DEV) {
    el.devResetCheckinButton.classList.remove("hidden");
    el.devResetCheckinButton.addEventListener("click", resetTodayCheckinForDev);
  }
  el.profileForm.addEventListener("submit", saveProfile);
  el.createGroupButton.addEventListener("click", createGroup);
  el.joinGroupButton.addEventListener("click", joinGroup);
  el.renameGroupButton.addEventListener("click", () => {
    const name = el.groupRenameInput.value.trim();
    if (!name) return showToast("请输入新的群组名称");
    updateGroup({ name });
  });
  el.refreshInviteButton.addEventListener("click", () => {
    updateGroup({ refresh_invite_code: true });
  });
  el.refreshProfileButton.addEventListener("click", async () => {
    try {
      await refreshAll();
      showToast("已刷新最新数据");
    } catch (error) {
      await handleActionError(error);
    }
  });
  el.memberList.addEventListener("click", async (event) => {
    const remindButton = event.target.closest("[data-remind-user-id]");
    if (!remindButton) return;
    await remindMember(remindButton.dataset.remindUserId);
  });
  el.homeSupervisionPanel.addEventListener("click", async (event) => {
    const actionTarget = event.target.closest("[data-home-action]");
    const copyTarget = event.target.closest("[data-copy-invite]");

    if (copyTarget) {
      try {
        await navigator.clipboard.writeText(copyTarget.dataset.copyInvite);
        showToast("邀请码已复制");
      } catch {
        showToast(`邀请码：${copyTarget.dataset.copyInvite}`);
      }
      return;
    }

    if (!actionTarget) return;
    const action = actionTarget.dataset.homeAction;
    if (action === "open-challenge") {
      switchPage("challenge");
      return;
    }
    if (action === "create-group") {
      switchPage("challenge");
      el.groupNameInput.focus();
      return;
    }
    if (action === "join-group") {
      switchPage("challenge");
      el.inviteCodeInput.focus();
    }
  });
  el.profileGroupCard.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-profile-action]");
    if (!actionTarget) return;
    if (actionTarget.dataset.profileAction === "open-challenge") {
      switchPage("challenge");
    }
  });
  el.authCard.addEventListener("click", async (event) => {
    const actionTarget = event.target.closest("[data-auth-action]");
    if (!actionTarget) return;
    const action = actionTarget.dataset.authAction;
    if (action === "create-transfer-code") {
      await createTransferCode();
      return;
    }
    if (action === "copy-transfer-code") {
      const code = actionTarget.dataset.transferCode;
      try {
        await navigator.clipboard.writeText(code);
        showToast("迁移码已复制");
      } catch {
        showToast(`迁移码：${code}`);
      }
    }
  });
}

async function boot() {
  renderMoodOptions();
  registerEvents();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => {
        if ("caches" in window) {
          return caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
        }
        return null;
      })
      .catch(() => {});
  }
  try {
    state.checkinUiState = "idle";
    await refreshAll();
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      showToast("原会话已失效，请确认是否重建本地会话");
      try {
        await rebuildSessionAfterExpiry();
      } catch (sessionError) {
        showToast(sessionError.message);
      }
      return;
    }
    showToast(`初始化失败：${error.message}`);
  }
}

async function changeCalendarMonth(offset) {
  state.calendarMonth = shiftMonth(state.calendarMonth, offset);
  try {
    const calendar = await api(`/checkins/calendar?month=${state.calendarMonth}`);
    state.calendar = calendar.days;
    renderCalendar();
  } catch (error) {
    await handleActionError(error);
  }
}

function registerCalendarEvents() {
  el.calendarPrev.addEventListener("click", () => {
    changeCalendarMonth(-1);
  });
  el.calendarNext.addEventListener("click", () => {
    changeCalendarMonth(1);
  });
}

registerCalendarEvents();
boot();
