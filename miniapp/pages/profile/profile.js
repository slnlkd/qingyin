const api = require("../../utils/api");

Page({
  data: {
    loading: false,
    saving: false,
    error: "",
    form: {
      nickname: "",
      avatar_emoji: "🌿",
      sober_start_date: "",
      daily_budget: "48",
    },
  },

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    this.setData({ loading: true, error: "" });
    try {
      const dashboard = await api.fetchDashboard();
      this.setData({
        form: {
          nickname: dashboard.profile.nickname,
          avatar_emoji: dashboard.profile.avatar_emoji,
          sober_start_date: dashboard.profile.sober_start_date,
          daily_budget: String(dashboard.profile.daily_budget),
        },
      });
    } catch (error) {
      this.setData({ error: error.message || "读取资料失败" });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    this.setData({
      [`form.${field}`]: value,
    });
  },

  handleDateChange(event) {
    this.setData({
      "form.sober_start_date": event.detail.value,
    });
  },

  async handleSubmit() {
    if (this.data.saving) {
      return;
    }

    this.setData({ saving: true, error: "" });

    try {
      await api.updateProfile({
        nickname: this.data.form.nickname.trim(),
        avatar_emoji: this.data.form.avatar_emoji.trim() || "🌿",
        sober_start_date: this.data.form.sober_start_date,
        daily_budget: Number(this.data.form.daily_budget || 0),
      });
      wx.showToast({
        title: "保存成功",
        icon: "success",
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 300);
    } catch (error) {
      this.setData({ error: error.message || "保存失败" });
      wx.showToast({
        title: "保存失败",
        icon: "none",
      });
    } finally {
      this.setData({ saving: false });
    }
  },
});
