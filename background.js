chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "x-image-saver",
    title: "保存原图",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "x-image-saver") {

    chrome.tabs.sendMessage(tab.id, { action: "getTweetInfo" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        console.log("无法获取页面信息，使用默认命名");
        startDownload(info.srcUrl, "unknown_user", "unknown_date");
      } else {
        console.log("获取到的信息:", response);
        startDownload(info.srcUrl, response.userId, response.dateStr);
      }
    });
  }
});

function startDownload(originalUrl, userId, dateStr) {
  let finalUrl = originalUrl;

  if (originalUrl.includes("format=")) {
    const baseUrl = originalUrl.split("format=")[0];
    finalUrl = baseUrl + "format=png&name=4096x4096";
  }

  const safeUserId = userId.replace(/[^a-zA-Z0-9_]/g, "");
  const filename = `${safeUserId}_${dateStr}.png`;

  chrome.downloads.download({
    url: finalUrl,
    filename: filename,
    saveAs: false,
  });
}
