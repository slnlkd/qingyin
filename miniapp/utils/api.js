const config = require("../config");

function getToken() {
  return wx.getStorageSync(config.tokenStorageKey) || "";
}

function setToken(token) {
  if (token) {
    wx.setStorageSync(config.tokenStorageKey, token);
  }
}

function clearToken() {
  wx.removeStorageSync(config.tokenStorageKey);
}

function request({ path, method = "GET", data, token }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBase}${path}`,
      method,
      data,
      timeout: 10000,
      header: token ? { "X-Session-Token": token } : {},
      success(result) {
        if (result.statusCode >= 200 && result.statusCode < 300) {
          resolve(result.data);
          return;
        }

        const detail =
          result.data && typeof result.data === "object" && result.data.detail
            ? result.data.detail
            : `请求失败：${result.statusCode}`;
        reject(new Error(detail));
      },
      fail(error) {
        reject(new Error(error.errMsg || "网络请求失败"));
      },
    });
  });
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (!result.code) {
          reject(new Error("微信未返回登录 code"));
          return;
        }
        resolve(result.code);
      },
      fail(error) {
        reject(new Error(error.errMsg || "微信登录失败"));
      },
    });
  });
}

async function loginWithWechatMini(existingToken = "", transferCode = "") {
  const code = await wxLogin();
  const response = await request({
    path: "/auth/wechat/mini/login",
    method: "POST",
    data: {
      code,
      transfer_code: transferCode || undefined,
    },
    token: existingToken || getToken(),
  });
  if (response.token) {
    setToken(response.token);
  }
  return response;
}

async function fetchDashboard() {
  const token = getToken();
  if (!token) {
    throw new Error("当前尚未登录微信小程序");
  }

  const [auth, profile, stats, groupState] = await Promise.all([
    request({ path: "/auth/me", token }),
    request({ path: "/profile", token }),
    request({ path: "/stats/summary", token }),
    request({ path: "/groups/current", token }),
  ]);

  return { token, auth, profile, stats, groupState };
}

async function fetchTodayCheckin() {
  const token = getToken();
  if (!token) {
    throw new Error("当前尚未登录微信小程序");
  }

  return request({
    path: "/checkins/today",
    token,
  });
}

async function fetchCheckinCalendar(month) {
  const token = getToken();
  if (!token) {
    throw new Error("当前尚未登录微信小程序");
  }

  return request({
    path: `/checkins/calendar?month=${month}`,
    token,
  });
}

async function createCheckin(data) {
  const token = getToken();
  if (!token) {
    throw new Error("当前尚未登录微信小程序");
  }

  return request({
    path: "/checkins",
    method: "POST",
    data,
    token,
  });
}

async function fetchCurrentGroup() {
  const token = getToken();
  if (!token) {
    throw new Error("当前尚未登录微信小程序");
  }

  return request({
    path: "/groups/current",
    token,
  });
}

async function fetchGroupFeed() {
  const token = getToken();
  if (!token) {
    throw new Error("当前尚未登录微信小程序");
  }

  return request({
    path: "/groups/feed",
    token,
  });
}

async function createGroup(data) {
  const token = getToken();
  if (!token) {
    throw new Error("当前尚未登录微信小程序");
  }

  return request({
    path: "/groups",
    method: "POST",
    data,
    token,
  });
}

async function joinGroup(data) {
  const token = getToken();
  if (!token) {
    throw new Error("当前尚未登录微信小程序");
  }

  return request({
    path: "/groups/join",
    method: "POST",
    data,
    token,
  });
}

async function remindGroupMember(targetUserId) {
  const token = getToken();
  if (!token) {
    throw new Error("当前尚未登录微信小程序");
  }

  return request({
    path: "/groups/remind",
    method: "POST",
    data: { target_user_id: targetUserId },
    token,
  });
}

async function updateCurrentGroup(data) {
  const token = getToken();
  if (!token) {
    throw new Error("当前尚未登录微信小程序");
  }

  return request({
    path: "/groups/current",
    method: "PUT",
    data,
    token,
  });
}

async function updateProfile(data) {
  const token = getToken();
  if (!token) {
    throw new Error("当前尚未登录微信小程序");
  }

  return request({
    path: "/profile",
    method: "PUT",
    data,
    token,
  });
}

module.exports = {
  getToken,
  setToken,
  clearToken,
  request,
  loginWithWechatMini,
  fetchDashboard,
  fetchTodayCheckin,
  fetchCheckinCalendar,
  createCheckin,
  fetchCurrentGroup,
  fetchGroupFeed,
  createGroup,
  joinGroup,
  remindGroupMember,
  updateCurrentGroup,
  updateProfile,
};
