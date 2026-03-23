const api = require("../../utils/api");

const bindModeLabelMap = {
  created_new: "首次登录，已为你创建新的清饮账号",
  bound_current: "已把当前清饮账号绑定到微信小程序",
  restored_existing: "已恢复你之前绑定的清饮数据",
  already_bound: "当前清饮账号已经绑定微信小程序",
  claimed_transfer: "已把 Web 端当前账号迁移到微信小程序",
};

Page({
  data: {
    loading: false,
    loggingIn: false,
    error: "",
    bindMessage: "",
    transferCodeInput: "",
    sessionToken: "",
    auth: null,
    profile: null,
    stats: null,
    group: null,
    members: [],
  },

  onShow() {
    this.bootstrap();
  },

  onPullDownRefresh() {
    this.bootstrap().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async bootstrap() {
    const token = api.getToken();
    if (!token) {
      this.setData({
        sessionToken: "",
        auth: null,
        profile: null,
        stats: null,
        group: null,
        members: [],
        error: "",
      });
      return;
    }

    this.setData({ loading: true, error: "", sessionToken: token });

    try {
      const dashboard = await api.fetchDashboard();
      this.applyDashboard(dashboard);
    } catch (error) {
      const message = error.message || "读取清饮数据失败";
      if (message.includes("无效会话") || message.includes("缺少会话令牌")) {
        api.clearToken();
        this.setData({
          sessionToken: "",
          auth: null,
          profile: null,
          stats: null,
          group: null,
          members: [],
        });
      }
      this.setData({ error: message });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyDashboard(dashboard) {
    const group = dashboard.groupState && dashboard.groupState.group ? dashboard.groupState.group : null;
    const members = dashboard.groupState && dashboard.groupState.members ? dashboard.groupState.members : [];
    this.setData({
      sessionToken: dashboard.token,
      auth: dashboard.auth,
      profile: dashboard.profile,
      stats: dashboard.stats,
      group,
      members,
      error: "",
    });
  },

  async handleWechatLogin() {
    if (this.data.loggingIn) {
      return;
    }

    this.setData({ loggingIn: true, error: "", bindMessage: "" });

    try {
      const transferCode = this.data.transferCodeInput.trim().toUpperCase();
      const result = await api.loginWithWechatMini("", transferCode);
      this.setData({
        bindMessage: bindModeLabelMap[result.bind_mode] || "微信小程序登录成功",
        transferCodeInput: "",
      });
      const dashboard = await api.fetchDashboard();
      this.applyDashboard(dashboard);
      wx.showToast({
        title: "登录成功",
        icon: "success",
      });
    } catch (error) {
      this.setData({ error: error.message || "微信登录失败" });
      wx.showToast({
        title: "登录失败",
        icon: "none",
      });
    } finally {
      this.setData({ loggingIn: false });
    }
  },

  handleTransferCodeInput(event) {
    this.setData({
      transferCodeInput: event.detail.value.toUpperCase(),
    });
  },

  handlePasteTransferCode() {
    wx.getClipboardData({
      success: (result) => {
        this.setData({
          transferCodeInput: (result.data || "").trim().toUpperCase(),
        });
      },
      fail: () => {
        wx.showToast({
          title: "读取剪贴板失败",
          icon: "none",
        });
      },
    });
  },

  handleRefreshTap() {
    this.bootstrap();
  },

  handleOpenProfile() {
    wx.navigateTo({
      url: "/pages/profile/profile",
    });
  },

  handleOpenCheckin() {
    wx.navigateTo({
      url: "/pages/checkin/checkin",
    });
  },

  handleOpenStats() {
    wx.navigateTo({
      url: "/pages/stats/stats",
    });
  },

  handleOpenGroup() {
    wx.navigateTo({
      url: "/pages/group/group",
    });
  },

  handleOpenCommunity() {
    wx.navigateTo({
      url: "/pages/community/community",
    });
  },

  handleCopyToken() {
    if (!this.data.sessionToken) {
      return;
    }
    wx.setClipboardData({
      data: this.data.sessionToken,
    });
  },
});
