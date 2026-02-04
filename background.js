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
    chrome.tabs.sendMessage(tab.id, { action: "openBatchUI" }).catch((err) => {
      console.log(err);
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "batchDownload") {
    const { items, folderName } = request;
    saveHistory(items);
    processBatchDownload(items, folderName);
  }

  if (request.action === "saveHistoryOnly") {
    saveHistory(request.items);
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
});

function saveHistory(items) {
  chrome.storage.local.get({ downloadHistory: {} }, (result) => {
    const history = result.downloadHistory;
    items.forEach((item) => {
      if (item.id) {
        history[item.id] = true;
      }
    });
    chrome.storage.local.set({ downloadHistory: history });
  });
}

function processBatchDownload(items, folderName) {
  items.forEach((item, index) => {
    setTimeout(() => {
      const fullFilename = `${folderName}/${item.filename}`;
      if (item.type === "video") {
        fetchAndDownloadVideo(item.id, fullFilename);
      } else {
        downloadImage(item.url, fullFilename);
      }
    }, index * 500);
  });
}

function downloadImage(url, filename) {
  let finalUrl = url;
  if (url.includes("?")) {
    finalUrl = url.split("?")[0];
  }
  finalUrl += "?format=png&name=4096x4096";

  chrome.downloads.download({
    url: finalUrl,
    filename: filename,
    saveAs: false,
    conflictAction: "overwrite",
  });
}

async function fetchAndDownloadVideo(tweetId, filename) {
  try {
    const response = await fetch(`https://api.fxtwitter.com/status/${tweetId}`);
    const data = await response.json();
    if (data?.tweet?.media?.videos?.[0]?.url) {
      const videoUrl = data.tweet.media.videos[0].url;
      chrome.downloads.download({
        url: videoUrl,
        filename: filename,
        saveAs: false,
        conflictAction: "overwrite",
      });
    }
  } catch (e) {
    console.error(e);
  }
}
