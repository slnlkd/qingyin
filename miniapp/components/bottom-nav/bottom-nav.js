const NAV_ITEMS = {
  home: "/pages/index/index",
  stats: "/pages/stats/stats",
  challenge: "/pages/challenge/challenge",
  community: "/pages/community/community",
  profile: "/pages/profile/profile",
};

Component({
  properties: {
    current: {
      type: String,
      value: "home",
    },
  },

  data: {
    items: [
      { key: "home", icon: "⌂", text: "首页" },
      { key: "stats", icon: "◔", text: "统计" },
      { key: "challenge", icon: "◈", text: "挑战" },
      { key: "community", icon: "◎", text: "社区" },
      { key: "profile", icon: "◡", text: "我的" },
    ],
  },

  methods: {
    handleTap(event) {
      const key = event.currentTarget.dataset.key;
      if (!key || key === this.data.current) {
        return;
      }

      const url = NAV_ITEMS[key];
      if (!url) {
        return;
      }

      wx.reLaunch({ url });
    },
  },
});
