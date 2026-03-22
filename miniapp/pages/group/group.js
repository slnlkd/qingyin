const api = require("../../utils/api");

Page({
  data: {
    loading: false,
    acting: false,
    error: "",
    viewerUserId: null,
    group: null,
    members: [],
    createName: "",
    joinCode: "",
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
    if (!api.getToken()) {
      this.setData({ error: "请先在首页完成微信登录" });
      return;
    }

    this.setData({ loading: true, error: "" });
    try {
      const dashboard = await api.fetchDashboard();
      const groupState = dashboard.groupState;
      this.setData({
        viewerUserId: dashboard.profile.user_id,
        group: groupState.group || null,
        members: groupState.members || [],
      });
    } catch (error) {
      this.setData({ error: error.message || "读取群组失败" });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleCreateInput(event) {
    this.setData({ createName: event.detail.value });
  },

  handleJoinInput(event) {
    this.setData({ joinCode: event.detail.value.toUpperCase() });
  },

  async handleCreateGroup() {
    if (this.data.acting) {
      return;
    }

    this.setData({ acting: true, error: "" });
    try {
      await api.createGroup({ name: this.data.createName.trim() || "清饮监督组" });
      wx.showToast({
        title: "创建成功",
        icon: "success",
      });
      this.setData({ createName: "" });
      await this.bootstrap();
    } catch (error) {
      this.setData({ error: error.message || "创建群组失败" });
    } finally {
      this.setData({ acting: false });
    }
  },

  async handleJoinGroup() {
    if (this.data.acting || !this.data.joinCode.trim()) {
      return;
    }

    this.setData({ acting: true, error: "" });
    try {
      await api.joinGroup({ invite_code: this.data.joinCode.trim() });
      wx.showToast({
        title: "加入成功",
        icon: "success",
      });
      this.setData({ joinCode: "" });
      await this.bootstrap();
    } catch (error) {
      this.setData({ error: error.message || "加入群组失败" });
    } finally {
      this.setData({ acting: false });
    }
  },

  async handleRemind(event) {
    const targetUserId = Number(event.currentTarget.dataset.userId);
    if (this.data.acting || !targetUserId) {
      return;
    }

    this.setData({ acting: true, error: "" });
    try {
      const result = await api.remindGroupMember(targetUserId);
      wx.showToast({
        title: `已提醒${result.target_nickname}`,
        icon: "success",
      });
      await this.bootstrap();
    } catch (error) {
      this.setData({ error: error.message || "提醒失败" });
      wx.showToast({
        title: "提醒失败",
        icon: "none",
      });
    } finally {
      this.setData({ acting: false });
    }
  },

  handleCopyInviteCode() {
    if (!this.data.group) {
      return;
    }
    wx.setClipboardData({
      data: this.data.group.invite_code,
    });
  },
});
