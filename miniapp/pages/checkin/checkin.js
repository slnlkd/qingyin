const api = require("../../utils/api");

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
    submitting: false,
    error: "",
    celebrating: false,
    successBanner: "",
    todayStatus: null,
    stats: null,
    profile: null,
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
    if (!api.getToken()) {
      this.setData({ error: "请先在首页完成微信登录" });
      return;
    }

    this.setData({ loading: true, error: "" });
    try {
      const [todayStatus, dashboard] = await Promise.all([
        api.fetchTodayCheckin(),
        api.fetchDashboard(),
      ]);

      this.setData({
        todayStatus,
        stats: dashboard.stats,
        profile: dashboard.profile,
        selectedMood: todayStatus.checked_in && todayStatus.entry ? todayStatus.entry.mood : "平静",
        reflection: todayStatus.checked_in && todayStatus.entry ? todayStatus.entry.reflection || "" : "",
      });
    } catch (error) {
      this.setData({ error: error.message || "读取今日打卡失败" });
    } finally {
      this.setData({ loading: false });
    }
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
