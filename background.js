chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create(
    {
      id: "X-media-download",
      title: "采集该用户所有媒体",
      contexts: ["page", "selection", "link"],
    },
    () => {
      if (chrome.runtime.lastError) return;
    },
  );
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "X-media-download") {
    /* ASSERTION: tab.id 必须存在才能向目标页面定向通信 */
    if (!tab || !tab.id) return;
    chrome.tabs.sendMessage(tab.id, { action: "openBatchUI" }).catch((err) => {
      console.log(err);
    });
  }
});

chrome.action.onClicked.addListener((tab) => {
  /* ASSERTION: 用户点击浏览器栏插件图标时，必须存在活跃的 tab.id 且仅向该标签发送呼出指令 */
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "openBatchUI" }).catch((err) => {
      console.log(err);
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "batchDownload") {
    const { items, folderName, downloadMode, userId } = request;
    saveHistory(items, userId);
    const tabId = sender && sender.tab ? sender.tab.id : null;
    processBatchDownload(items, folderName, downloadMode, tabId);
  }

  if (request.action === "saveHistoryOnly") {
    saveHistory(request.items, request.userId);
  }

  if (request.action === "checkExistingFiles") {
    /* ASSERTION: 通过系统下载引擎检索已完成且存在的文件，实现准确的本地去重 */
    chrome.downloads.search({ state: "complete" }, (results) => {
      const existingFiles = {};
      const targetFolder = request.folderName || request.userId || "";
      if (results) {
        results.forEach((d) => {
          if (d.filename && d.exists !== false) {
            const normalized = d.filename.replace(/\\/g, "/");
            const filename = normalized.split("/").pop();
            if (!targetFolder || normalized.includes(`/${targetFolder}/`) || normalized.includes(targetFolder)) {
              existingFiles[filename] = true;
            }
          }
        });
      }
      sendResponse({ success: true, existingFiles: existingFiles });
    });
    return true;
  }

  if (request.action === "fetchBlob") {
    fetch(request.url)
      .then((response) => {
        if (!response.ok) throw new Error(response.statusText);
        return response.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ success: true, dataUrl: reader.result });
        };
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.toString() });
      });
    return true;
  }

  if (request.action === "showNotification") {
    /* ASSERTION: 系统桌面通知必须包含有效标题与消息内容，用于后台挂机完成提示 */
    if (chrome.notifications) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "X.png",
        title: request.title || "X-Media Downloads Pro",
        message: request.message || "任务已完成",
        priority: 2,
      });
    }
    sendResponse({ success: true });
    return true;
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
});

function saveHistory(items, userId) {
  /* ASSERTION: 持久化保存记录必须包含文件名与唯一ID，作为离线/跨会话去重依据 */
  chrome.storage.local.get({ downloadHistory: {} }, (result) => {
    const history = result.downloadHistory;
    items.forEach((item) => {
      if (item.filename) {
        history[item.filename] = true;
      }
      if (item.id) {
        history[item.id] = true;
      }
    });
    chrome.storage.local.set({ downloadHistory: history });
  });
}

let currentBatchTracker = null;

chrome.downloads.onChanged.addListener((delta) => {
  /* ASSERTION: 系统底层下载状态变化监听断言，精准捕获每个媒体文件的真实磁盘写入完成 */
  if (!currentBatchTracker || !currentBatchTracker.activeDownloadIds.has(delta.id)) return;

  if (delta.state && delta.state.current) {
    if (delta.state.current === "complete") {
      currentBatchTracker.activeDownloadIds.delete(delta.id);
      currentBatchTracker.finishedCount++;
      notifyBatchProgress();
    } else if (delta.state.current === "interrupted") {
      currentBatchTracker.activeDownloadIds.delete(delta.id);
      currentBatchTracker.finishedCount++;
      currentBatchTracker.failedCount++;
      notifyBatchProgress();
    }
  }
});

function notifyBatchProgress() {
  /* ASSERTION: 真实进度回传断言，向发起标签页发送当前在磁盘落盘完成的文件计数 */
  if (!currentBatchTracker || !currentBatchTracker.senderTabId) return;
  const current = currentBatchTracker.finishedCount;
  const total = currentBatchTracker.totalCount;

  chrome.tabs.sendMessage(currentBatchTracker.senderTabId, {
    action: "downloadProgress",
    current: current,
    total: total,
    isRealFinished: current >= total,
  }).catch(() => {});

  if (current >= total) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "X.png",
      title: "全部下载完成",
      message: `共 ${total} 项媒体已全部真实保存至本地！`,
      priority: 2,
    });
    currentBatchTracker = null;
  }
}

function processBatchDownload(items, folderName, downloadMode = "folder", senderTabId = null) {
  /* ASSERTION: 启动真实下载批次追踪器，记录待完成总量与每个下载任务的系统ID */
  currentBatchTracker = {
    senderTabId: senderTabId,
    totalCount: items.length,
    finishedCount: 0,
    failedCount: 0,
    activeDownloadIds: new Set(),
  };

  items.forEach((item, index) => {
    setTimeout(() => {
      /* ASSERTION: 根据用户设置的下载方式决定是否包裹用户专属文件夹目录 */
      const fullFilename = downloadMode === "direct" ? item.filename : `${folderName}/${item.filename}`;

      const onIdReceived = (downloadId) => {
        if (currentBatchTracker) {
          currentBatchTracker.activeDownloadIds.add(downloadId);
          chrome.downloads.search({ id: downloadId }, (results) => {
            if (results && results[0] && results[0].state === "complete") {
              if (currentBatchTracker && currentBatchTracker.activeDownloadIds.has(downloadId)) {
                currentBatchTracker.activeDownloadIds.delete(downloadId);
                currentBatchTracker.finishedCount++;
                notifyBatchProgress();
              }
            }
          });
        }
      };

      const onError = () => {
        if (currentBatchTracker) {
          currentBatchTracker.finishedCount++;
          currentBatchTracker.failedCount++;
          notifyBatchProgress();
        }
      };

      if (item.type === "video") {
        fetchAndDownloadVideo(item.id, fullFilename, onIdReceived, onError);
      } else {
        downloadImage(item.url, fullFilename, onIdReceived, onError);
      }
    }, index * 250);
  });
}

function downloadImage(url, filename, onIdReceived, onError) {
  let finalUrl = url;
  if (url.includes("?")) {
    finalUrl = url.split("?")[0];
  }
  finalUrl += "?format=png&name=4096x4096";

  chrome.downloads.download(
    {
      url: finalUrl,
      filename: filename,
      saveAs: false,
      conflictAction: "overwrite",
    },
    (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        if (onError) onError(chrome.runtime.lastError);
      } else {
        if (onIdReceived) onIdReceived(downloadId);
      }
    }
  );
}

async function fetchAndDownloadVideo(tweetId, filename, onIdReceived, onError) {
  try {
    const response = await fetch(`https://api.fxtwitter.com/status/${tweetId}`);
    const data = await response.json();
    if (data?.tweet?.media?.videos?.[0]?.url) {
      const videoUrl = data.tweet.media.videos[0].url;
      chrome.downloads.download(
        {
          url: videoUrl,
          filename: filename,
          saveAs: false,
          conflictAction: "overwrite",
        },
        (downloadId) => {
          if (chrome.runtime.lastError || !downloadId) {
            if (onError) onError(chrome.runtime.lastError);
          } else {
            if (onIdReceived) onIdReceived(downloadId);
          }
        }
      );
    } else {
      if (onError) onError(new Error("Video URL not found"));
    }
  } catch (e) {
    if (onError) onError(e);
  }
}
