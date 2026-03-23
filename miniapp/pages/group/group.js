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
    renameName: "",
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
        renameName: groupState.group ? groupState.group.name : "",
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

  handleRenameInput(event) {
    this.setData({ renameName: event.detail.value });
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

  async handleRenameGroup() {
    const name = this.data.renameName.trim();
    if (this.data.acting || !name) {
      return;
    }

    this.setData({ acting: true, error: "" });
    try {
      await api.updateCurrentGroup({ name });
      wx.showToast({
        title: "群组名称已更新",
        icon: "success",
      });
      await this.bootstrap();
    } catch (error) {
      this.setData({ error: error.message || "修改群组名称失败" });
      wx.showToast({
        title: "修改失败",
        icon: "none",
      });
    } finally {
      this.setData({ acting: false });
    }
  },

  async handleRefreshInviteCode() {
    if (this.data.acting) {
      return;
    }

    this.setData({ acting: true, error: "" });
    try {
      await api.updateCurrentGroup({ refresh_invite_code: true });
      wx.showToast({
        title: "邀请码已刷新",
        icon: "success",
      });
      await this.bootstrap();
    } catch (error) {
      this.setData({ error: error.message || "刷新邀请码失败" });
      wx.showToast({
        title: "刷新失败",
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

  formatMemberReflection(reflection) {
    if (!reflection) {
      return "今天还没有留下额外感悟。";
    }
    return reflection.length > 28 ? `${reflection.slice(0, 28)}...` : reflection;
  },
});
