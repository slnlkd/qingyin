function resolveApiBase() {
  try {
    const accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
    const envVersion = accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram.envVersion : "develop";
    if (envVersion === "develop") {
      return "https://8.155.168.138/qingyin-api";
    }
  } catch (error) {
    // Fallback 到开发地址，避免开发工具里因为环境信息读取失败而阻塞联调。
    return "https://8.155.168.138/qingyin-api";
  }

  return "https://lvkedang.cn/qingyin-api";
}

module.exports = {
  apiBase: resolveApiBase(),
  tokenStorageKey: "qingyin_session_token",
};
