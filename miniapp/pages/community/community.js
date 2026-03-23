const api = require("../../utils/api");

const eventLabelMap = {
  checkin: "今日打卡",
  member_joined: "加入群组",
  group_created: "创建群组",
  group_updated: "更新群组",
  invite_code_refreshed: "刷新邀请码",
  member_reminded: "提醒打卡",
};

const eventIconMap = {
  checkin: "☑️",
  member_joined: "👥",
  group_created: "🌱",
  group_updated: "✏️",
  invite_code_refreshed: "🔐",
  member_reminded: "🔔",
};

function formatFeedTime(value) {
  if (!value) return "";
  const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}+08:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

function formatFeedBody(item) {
  if (item.event_type === "checkin") {
    return `${item.payload.mood || "一般"} · ${item.payload.reflection || "又坚持了一天，继续保持。"}`;
  }
  if (item.event_type === "member_joined") {
    return "加入了监督群组，一起开始互相监督。";
  }
  if (item.event_type === "group_created") {
    return `创建了监督群组「${item.payload.group_name || ""}」。`;
  }
  if (item.event_type === "group_updated") {
    return `把群组名称更新为「${item.payload.group_name || ""}」。`;
  }
  if (item.event_type === "invite_code_refreshed") {
    return `刷新了新的邀请码：${item.payload.invite_code || ""}。`;
  }
  if (item.event_type === "member_reminded") {
    return `提醒 ${item.payload.target_nickname || "群组成员"} 该打卡了。`;
  }
  return "有新的监督动态。";
}

Page({
  data: {
    loading: false,
    error: "",
    items: [],
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
      this.setData({ error: "请先在首页完成微信登录", items: [] });
      return;
    }

    this.setData({ loading: true, error: "" });
    try {
      const feed = await api.fetchGroupFeed();
      this.setData({
        items: (feed.items || []).map((item) => ({
          ...item,
          event_label: eventLabelMap[item.event_type] || "监督动态",
          event_icon: eventIconMap[item.event_type] || "✨",
          body_text: formatFeedBody(item),
          display_time: formatFeedTime(item.created_at),
        })),
      });
    } catch (error) {
      this.setData({
        error: error.message || "读取社区动态失败",
        items: [],
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
