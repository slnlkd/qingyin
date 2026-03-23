const api = require("../../utils/api");

const bindModeLabelMap = {
  created_new: "首次登录，已为你创建新的清饮账号",
  bound_current: "已把当前清饮账号绑定到微信小程序",
  restored_existing: "已恢复你之前绑定的清饮数据",
  already_bound: "当前清饮账号已经绑定微信小程序",
  claimed_transfer: "已把 Web 端当前账号迁移到微信小程序",
};

const moods = [
  { label: "开心", icon: "😊" },
  { label: "平静", icon: "😌" },
  { label: "一般", icon: "🙂" },
  { label: "渴望", icon: "😣" },
  { label: "不适", icon: "😟" },
];

Page({
  data: {
    loading: false,
    loggingIn: false,
    submitting: false,
    error: "",
    bindMessage: "",
    sessionToken: "",
    auth: null,
    profile: null,
    stats: null,
    group: null,
    members: [],
    todayStatus: null,
    celebrating: false,
    successBanner: "",
    moods,
    selectedMood: "平静",
    reflection: "",
  },

  onShow() {
    this.bootstrap();
  },

  onHide() {
    this.clearCelebrationTimer();
  },

  onUnload() {
    this.clearCelebrationTimer();
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
        todayStatus: null,
        reflection: "",
        error: "",
      });
      return;
    }

    this.setData({ loading: true, error: "", sessionToken: token });

    try {
      const [dashboard, todayStatus] = await Promise.all([
        api.fetchDashboard(),
        api.fetchTodayCheckin(),
      ]);
      this.applyDashboard(dashboard);
      this.setData({
        todayStatus,
        selectedMood: todayStatus.checked_in && todayStatus.entry ? todayStatus.entry.mood : "平静",
        reflection: todayStatus.checked_in && todayStatus.entry ? todayStatus.entry.reflection || "" : "",
      });
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
          todayStatus: null,
          reflection: "",
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

  clearCelebrationTimer() {
    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
      this.celebrationTimer = null;
    }
  },

  triggerCelebration() {
    this.clearCelebrationTimer();
    this.setData({
      celebrating: true,
      successBanner: "今天也守住了自己，继续保持清醒。",
    });
    this.celebrationTimer = setTimeout(() => {
      this.setData({
        celebrating: false,
        successBanner: "",
      });
      this.celebrationTimer = null;
    }, 2200);
  },

  async handleWechatLogin() {
    if (this.data.loggingIn) {
      return;
    }

    this.setData({ loggingIn: true, error: "", bindMessage: "" });

    try {
      const result = await api.loginWithWechatMini();
      this.setData({
        bindMessage: bindModeLabelMap[result.bind_mode] || "微信小程序登录成功",
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

  handleRefreshTap() {
    this.bootstrap();
  },

  handleOpenProfile() {
    wx.navigateTo({
      url: "/pages/profile/profile",
    });
  },

  handleOpenStats() {
    wx.navigateTo({
      url: "/pages/stats/stats",
    });
  },

  handleOpenGroup() {
    wx.navigateTo({
      url: "/pages/challenge/challenge",
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

  handleMoodSelect(event) {
    const mood = event.currentTarget.dataset.mood;
    this.setData({ selectedMood: mood });
  },

  handleReflectionInput(event) {
    this.setData({ reflection: event.detail.value });
  },

  async handleSubmit() {
    if (this.data.submitting || !this.data.selectedMood) {
      return;
    }

    this.setData({ submitting: true, error: "" });
    try {
      await api.createCheckin({
        mood: this.data.selectedMood,
        reflection: this.data.reflection.trim(),
      });
      await this.bootstrap();
      this.triggerCelebration();
      wx.showToast({
        title: "打卡成功",
        icon: "success",
      });
    } catch (error) {
      this.setData({ error: error.message || "打卡失败" });
      wx.showToast({
        title: "打卡失败",
        icon: "none",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
