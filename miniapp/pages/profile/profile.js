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
    saving: false,
    bindingTransfer: false,
    error: "",
    auth: null,
    stats: null,
    group: null,
    members: [],
    transferCodeInput: "",
    transferMessage: "",
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
        auth: dashboard.auth,
        stats: dashboard.stats,
        group: dashboard.groupState.group || null,
        members: dashboard.groupState.members || [],
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

  handleRefresh() {
    this.loadProfile();
  },

  handleCopyInviteCode() {
    if (!this.data.group) {
      return;
    }
    wx.setClipboardData({
      data: this.data.group.invite_code,
    });
  },

  handleOpenGroup() {
    wx.navigateTo({
      url: "/pages/group/group",
    });
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

  async handleClaimTransferCode() {
    const transferCode = this.data.transferCodeInput.trim().toUpperCase();
    if (this.data.bindingTransfer || !transferCode) {
      return;
    }

    this.setData({ bindingTransfer: true, error: "", transferMessage: "" });

    try {
      const result = await api.loginWithWechatMini(api.getToken(), transferCode);
      this.setData({
        transferCodeInput: "",
        transferMessage: bindModeLabelMap[result.bind_mode] || "迁移码绑定成功",
      });
      await this.loadProfile();
      wx.showToast({
        title: "迁移成功",
        icon: "success",
      });
    } catch (error) {
      this.setData({ error: error.message || "迁移失败" });
      wx.showToast({
        title: "迁移失败",
        icon: "none",
      });
    } finally {
      this.setData({ bindingTransfer: false });
    }
  },
});
