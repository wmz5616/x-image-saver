chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "x-image-saver",
    title: "保存原图",
    contexts: ["image"],
  });

  chrome.contextMenus.create({
    id: "x-download-all-images",
    title: "下载该用户所有图片",
    contexts: ["page", "selection", "link"],
  });

  chrome.contextMenus.create({
    id: "x-download-all-videos",
    title: "下载该用户所有视频",
    contexts: ["page", "selection", "link"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "x-image-saver") {
    chrome.tabs.sendMessage(tab.id, { action: "getTweetInfo" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        startDownload(info.srcUrl, "unknown_user", "unknown_date");
      } else {
        startDownload(info.srcUrl, response.userId, response.dateStr);
      }
    });
  } else if (info.menuItemId === "x-download-all-images") {
    chrome.tabs.sendMessage(tab.id, { action: "toggleBatchUI", type: "image" });
  } else if (info.menuItemId === "x-download-all-videos") {
    chrome.tabs.sendMessage(tab.id, { action: "toggleBatchUI", type: "video" });
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "batchDownload") {
    const { urls, userId, type } = request;

    urls.forEach((url, index) => {
      setTimeout(() => {
        const isVideo = type === "video";
        const ext = isVideo ? "mp4" : "png";
        const safeUserId = userId || "unknown";
        const idxStr = (index + 1).toString().padStart(4, "0");
        const filename = `Batch_${safeUserId}/${safeUserId}_${idxStr}.${ext}`;

        let finalUrl = url;
        if (!isVideo && url.includes("format=")) {
          const baseUrl = url.split("format=")[0];
          finalUrl = baseUrl + "format=png&name=large";
        }

        chrome.downloads.download({
          url: finalUrl,
          filename: filename,
          saveAs: false,
        });
      }, index * 300);
    });
  }
});
