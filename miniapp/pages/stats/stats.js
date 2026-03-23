const api = require("../../utils/api");

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

function shiftMonth(key, offset) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return monthKey(date);
}

function buildCalendarDays(month, checkedDays) {
  const [year, monthValue] = month.split("-").map(Number);
  const firstDay = new Date(year, monthValue - 1, 1);
  const totalDays = new Date(year, monthValue, 0).getDate();
  const leading = (firstDay.getDay() + 6) % 7;
  const checkedMap = new Map(checkedDays.map((item) => [item.checkin_date, item]));
  const cells = [];

  for (let index = 0; index < leading; index += 1) {
    cells.push({ key: `empty-start-${index}`, empty: true });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const dayKey = `${month}-${`${day}`.padStart(2, "0")}`;
    cells.push({
      key: dayKey,
      day,
      checked: checkedMap.has(dayKey),
      mood: checkedMap.has(dayKey) ? checkedMap.get(dayKey).mood : "",
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `empty-end-${cells.length}`, empty: true });
  }

  return cells;
}

Page({
  data: {
    loading: false,
    error: "",
    stats: null,
    calendarMonth: monthKey(),
    calendarCells: [],
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
      const [dashboard, calendar] = await Promise.all([
        api.fetchDashboard(),
        api.fetchCheckinCalendar(this.data.calendarMonth),
      ]);
      this.setData({
        stats: dashboard.stats,
        calendarCells: buildCalendarDays(this.data.calendarMonth, calendar.days || []),
      });
    } catch (error) {
      this.setData({ error: error.message || "读取统计失败" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async changeMonth(offset) {
    const nextMonth = shiftMonth(this.data.calendarMonth, offset);
    this.setData({
      calendarMonth: nextMonth,
      loading: true,
      error: "",
    });
    try {
      const calendar = await api.fetchCheckinCalendar(nextMonth);
      this.setData({
        calendarCells: buildCalendarDays(nextMonth, calendar.days || []),
      });
    } catch (error) {
      this.setData({ error: error.message || "读取月历失败" });
    } finally {
      this.setData({ loading: false });
    }
  },

  handlePrevMonth() {
    this.changeMonth(-1);
  },

  handleNextMonth() {
    this.changeMonth(1);
  },
});
