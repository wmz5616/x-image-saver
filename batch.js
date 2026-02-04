let isScanning = false;
let collectedItems = new Map();
let uiContainer = null;
let scanInterval = null;
let noScrollCount = 0;
let lastScrollHeight = 0;
let localHistory = {};
let skipDownloaded = true;
let isDragging = false;
let dragStartX, dragStartY, initialLeft, initialTop;

function getCurrentUserId() {
  const pathParts = window.location.pathname.split("/");
  return pathParts[1] || "unknown_user";
}

function getFolderName() {
  const handle = getCurrentUserId();
  let name = handle;
  try {
    const titleMatch = document.title.match(/^(.*?) \(@/);
    if (titleMatch && titleMatch[1]) {
      name = titleMatch[1];
    }
  } catch (e) {}

  const folderName = `${name} ${handle}`.replace(/[\\/:*?"<>|]/g, "_");
  return folderName;
}

function saveSession() {
  const userId = getCurrentUserId();
  if (!userId || collectedItems.size === 0) return;
  const data = Array.from(collectedItems.entries());
  try {
    localStorage.setItem(`x_backup_${userId}`, JSON.stringify(data));
  } catch (e) {}
}

function loadSession() {
  const userId = getCurrentUserId();
  const raw = localStorage.getItem(`x_backup_${userId}`);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      collectedItems = new Map(data);
      updateUICount();
    } catch (e) {}
  }
}

function clearSession() {
  const userId = getCurrentUserId();
  localStorage.removeItem(`x_backup_${userId}`);
  collectedItems.clear();
  updateUICount();
  alert("已清空");
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "openBatchUI") {
    chrome.storage.local.get({ downloadHistory: {} }, (result) => {
      localHistory = result.downloadHistory;
      if (uiContainer) removeUI();
      createUI();
      loadSession();
    });
  }
});

function createUI() {
  uiContainer = document.createElement("div");
  uiContainer.style.cssText = `
    position: fixed; top: 100px; right: 30px; width: 300px;
    background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(10px);
    color: #e7e9ea; padding: 20px; border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 99999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border: 1px solid rgba(255,255,255,0.2); user-select: none;
  `;

  uiContainer.innerHTML = `
    <div id="x-drag-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; cursor: move;">
        <h3 style="margin:0; font-size:16px; font-weight:bold; pointer-events:none;">媒体采集</h3>
        <div style="display:flex; gap:10px;">
             <span id="x-btn-clear" style="font-size:12px; color:#f4212e; cursor:pointer; text-decoration:underline;">清空</span>
             <div id="x-btn-close-icon" style="cursor:pointer; font-weight:bold;">✕</div>
        </div>
    </div>
    
    <div style="display:flex; gap:10px; margin-bottom:15px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
        <div style="flex:1; text-align:center;">
            <div id="x-count-img" style="font-size:18px; font-weight:bold; color:#00ba7c;">0</div>
            <div style="font-size:10px; color:#aaa;">图片</div>
        </div>
        <div style="flex:1; text-align:center; border-left:1px solid rgba(255,255,255,0.1);">
            <div id="x-count-vid" style="font-size:18px; font-weight:bold; color:#f91880;">0</div>
            <div style="font-size:10px; color:#aaa;">视频</div>
        </div>
    </div>
    
    <div style="font-size:12px; color:#71767b; margin-bottom:15px;">
       <label style="display:flex; align-items:center; cursor:pointer; gap:6px; margin-bottom:4px;">
         <input type="checkbox" id="x-chk-skip" checked style="accent-color:#1d9bf0;">
         跳过已下载
       </label>
    </div>

    <div style="display:grid; gap:8px;">
      <button id="x-btn-start" style="width:100%; padding:10px; background:#1d9bf0; border:none; border-radius:8px; color:#fff; font-weight:bold; cursor:pointer; transition:0.2s;">开始扫描</button>
      
      <div style="display:flex; gap:8px;">
          <button id="x-btn-zip" style="flex:1; padding:10px; background:#ffbd03; border:none; border-radius:8px; color:#000; font-weight:bold; cursor:pointer; display:none;">📦 下载压缩包</button>
          <button id="x-btn-down" style="flex:1; padding:10px; background:#00ba7c; border:none; border-radius:8px; color:#fff; font-weight:bold; cursor:pointer; display:none;">普通下载</button>
      </div>
    </div>
    <div id="x-status-text" style="text-align:center; font-size:12px; color:#aaa; margin-top:10px; height:14px;"></div>
  `;

  document.body.appendChild(uiContainer);
  setupDragEvent();

  document.getElementById("x-chk-skip").onchange = (e) =>
    (skipDownloaded = e.target.checked);
  document.getElementById("x-btn-start").onclick = toggleScan;
  document.getElementById("x-btn-close-icon").onclick = removeUI;
  document.getElementById("x-btn-clear").onclick = clearSession;
  document.getElementById("x-btn-down").onclick = startBatchDownload;
  document.getElementById("x-btn-zip").onclick = startZipDownload;
}

function sanitizeId(rawId) {
  if (!rawId) return "unknown";
  if (rawId.includes("http") || rawId.includes("/")) {
    return rawId.split("/").pop().split(".")[0];
  }
  return rawId;
}

function fetchBlobViaBackground(url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: "fetchBlob", url: url },
      (response) => {
        if (response && response.success) {
          fetch(response.dataUrl)
            .then((res) => res.blob())
            .then((blob) => resolve(blob))
            .catch((err) => reject(err));
        } else {
          reject(response ? response.error : "Unknown error");
        }
      },
    );
  });
}

async function startZipDownload() {
  if (collectedItems.size === 0) return alert("列表为空");

  const userId = getCurrentUserId();
  const folderName = getFolderName();

  const zip = new JSZip();
  const folder = zip.folder(folderName);

  const statusEl = document.getElementById("x-status-text");
  const zipBtn = document.getElementById("x-btn-zip");

  zipBtn.disabled = true;
  zipBtn.innerText = "打包中...";

  let processed = 0;
  const total = collectedItems.size;
  let index = 1;

  const items = Array.from(collectedItems.values());

  for (const item of items) {
    statusEl.innerText = `处理: ${processed}/${total}`;

    const cleanId = sanitizeId(item.id);
    const idxStr = index.toString().padStart(3, "0");
    const isVideo = item.type === "video";

    const ext = isVideo ? ".mp4" : ".png";
    const filename = `${userId}_${item.timeStr}_${cleanId}_${idxStr}${ext}`;

    try {
      let blob = null;

      if (isVideo) {
        const apiRes = await fetch(
          `https://api.fxtwitter.com/status/${item.id}`,
        );
        const apiJson = await apiRes.json();
        if (apiJson?.tweet?.media?.videos?.[0]?.url) {
          blob = await fetchBlobViaBackground(
            apiJson.tweet.media.videos[0].url,
          );
        }
      } else {
        const cleanUrl = item.url.split("?")[0];
        const fetchUrl = `${cleanUrl}?format=png&name=4096x4096`;
        blob = await fetchBlobViaBackground(fetchUrl);
      }

      if (blob && blob.size > 0) {
        folder.file(filename, blob);
      }
    } catch (err) {
      console.error(err);
    }

    processed++;
    index++;
  }

  statusEl.innerText = "正在压缩...";

  const content = await zip.generateAsync({ type: "blob" });
  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(content);
  downloadLink.download = `${folderName}.zip`;
  downloadLink.click();

  statusEl.innerText = "完成！";
  zipBtn.innerText = "📦 下载压缩包";
  zipBtn.disabled = false;

  const itemsArray = [];
  collectedItems.forEach((item) => itemsArray.push({ id: item.id }));
  chrome.runtime.sendMessage({ action: "saveHistoryOnly", items: itemsArray });

  localStorage.removeItem(`x_backup_${userId}`);
}

function updateUICount() {
  let imgCount = 0;
  let vidCount = 0;
  collectedItems.forEach((item) => {
    if (item.type === "video") vidCount++;
    else imgCount++;
  });

  if (document.getElementById("x-count-img")) {
    document.getElementById("x-count-img").innerText = imgCount;
    document.getElementById("x-count-vid").innerText = vidCount;
  }

  const showBtns = collectedItems.size > 0 ? "block" : "none";
  if (document.getElementById("x-btn-down")) {
    document.getElementById("x-btn-down").style.display = showBtns;
    document.getElementById("x-btn-zip").style.display = showBtns;
  }
}

function removeUI() {
  stopScan();
  if (uiContainer) {
    uiContainer.remove();
    uiContainer = null;
  }
}

function toggleScan() {
  const btn = document.getElementById("x-btn-start");
  if (isScanning) {
    stopScan();
    btn.innerText = "继续";
    btn.style.background = "#1d9bf0";
    document.getElementById("x-btn-down").style.display = "block";
    document.getElementById("x-btn-zip").style.display = "block";
  } else {
    isScanning = true;
    noScrollCount = 0;
    btn.innerText = "停止";
    btn.style.background = "#f4212e";
    document.getElementById("x-btn-down").style.display = "none";
    document.getElementById("x-btn-zip").style.display = "none";
    scanLoop();
  }
}

function stopScan() {
  isScanning = false;
  clearTimeout(scanInterval);
  saveSession();
}

function setupDragEvent() {
  const header = document.getElementById("x-drag-header");
  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = uiContainer.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    uiContainer.style.right = "auto";
    uiContainer.style.bottom = "auto";
    uiContainer.style.left = initialLeft + "px";
    uiContainer.style.top = initialTop + "px";
  });
  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    uiContainer.style.left = initialLeft + (e.clientX - dragStartX) + "px";
    uiContainer.style.top = initialTop + (e.clientY - dragStartY) + "px";
  });
  window.addEventListener("mouseup", () => (isDragging = false));
}

function isVideoGridItem(linkElement) {
  const hasPlayIcon = linkElement.querySelector(
    '[data-testid="iconMediaPlay"]',
  );
  if (hasPlayIcon) return true;
  const text = linkElement.innerText;
  return /\d+:\d+/.test(text) || text.includes("GIF");
}

function getTimeFromElement(element) {
  const article = element.closest("article");
  if (article) {
    const timeEl = article.querySelector("time");
    if (timeEl) {
      const isoDate = timeEl.getAttribute("datetime");
      const date = new Date(isoDate);
      const h = date.getHours().toString().padStart(2, "0");
      const m = date.getMinutes().toString().padStart(2, "0");
      return `${h}${m}`;
    }
  }
  return "0000";
}

function scanLoop() {
  if (!isScanning) return;
  const shouldSkip = skipDownloaded;
  const gridLinks = document.querySelectorAll('a[href*="/status/"]');
  let hasNew = false;

  gridLinks.forEach((link) => {
    if (link.closest('[data-testid="User-Name"]')) return;
    if (link.getAttribute("role") === "link" && link.querySelector("time"))
      return;

    const match = link.href.match(/\/status\/(\d+)/);
    if (!match) return;
    const tweetId = match[1];

    if (shouldSkip && localHistory[tweetId]) return;

    if (isVideoGridItem(link)) {
      if (!collectedItems.has(tweetId)) {
        collectedItems.set(tweetId, {
          type: "video",
          id: tweetId,
          url: `video_id:${tweetId}`,
          timeStr: "0000",
        });
        hasNew = true;
      }
    } else {
      const img = link.querySelector("img");
      if (img && img.src.includes("media")) {
        const rawUrl = img.src.split("?")[0];
        if (shouldSkip && localHistory[rawUrl]) return;
        if (!collectedItems.has(rawUrl)) {
          collectedItems.set(rawUrl, {
            type: "image",
            id: rawUrl,
            url: rawUrl,
            timeStr: "0000",
          });
          hasNew = true;
        }
      }
    }
  });

  const videoComponents = document.querySelectorAll(
    '[data-testid="videoPlayer"], [data-testid="videoComponent"]',
  );
  videoComponents.forEach((comp) => {
    const article = comp.closest("article");
    if (!article) return;
    const links = article.querySelectorAll('a[href*="/status/"]');
    for (const l of links) {
      const m = l.href.match(/\/status\/(\d+)/);
      if (m) {
        const tid = m[1];
        if (shouldSkip && localHistory[tid]) break;
        if (!collectedItems.has(tid)) {
          collectedItems.set(tid, {
            type: "video",
            id: tid,
            url: `video_id:${tid}`,
            timeStr: getTimeFromElement(comp),
          });
          hasNew = true;
        }
        break;
      }
    }
  });

  if (hasNew) {
    updateUICount();
    saveSession();
  }

  const currentHeight = document.body.scrollHeight;
  const scrollThreshold = 8;

  if (currentHeight - lastScrollHeight > 50) {
    noScrollCount = 0;
    lastScrollHeight = currentHeight;
    window.scrollTo(0, document.body.scrollHeight);
    const btn = document.getElementById("x-btn-start");
    if (btn) btn.innerText = "停止";
  } else {
    noScrollCount++;
    const btn = document.getElementById("x-btn-start");
    if (btn) btn.innerText = `触底检查 ${noScrollCount}/${scrollThreshold}`;
    window.scrollBy(0, -200);
    setTimeout(() => {
      window.scrollTo(0, document.body.scrollHeight);
    }, 300);
  }

  if (noScrollCount > scrollThreshold) {
    stopScan();
    const btn = document.getElementById("x-btn-start");
    if (btn) {
      btn.innerText = "已完成";
      btn.style.background = "#536471";
    }
    document.getElementById("x-btn-down").style.display = "block";
    document.getElementById("x-btn-zip").style.display = "block";
    return;
  }

  scanInterval = setTimeout(scanLoop, 1200);
}

function startBatchDownload() {
  if (collectedItems.size === 0) {
    alert("列表为空");
    return;
  }

  const userId = getCurrentUserId();
  const folderName = getFolderName();
  const itemsArray = [];
  let index = 1;

  collectedItems.forEach((item) => {
    const cleanId = sanitizeId(item.id);
    const idxStr = index.toString().padStart(3, "0");
    const ext = item.type === "video" ? ".mp4" : ".png";
    const filename = `${userId}_${item.timeStr}_${cleanId}_${idxStr}${ext}`;

    itemsArray.push({
      url: item.url,
      type: item.type,
      id: item.id,
      filename: filename,
    });
    index++;
  });

  chrome.runtime.sendMessage({
    action: "batchDownload",
    items: itemsArray,
    userId: userId,
    folderName: folderName,
  });

  localStorage.removeItem(`x_backup_${userId}`);

  const downBtn = document.getElementById("x-btn-down");
  downBtn.innerText = "后台下载中...";
  downBtn.disabled = true;
  downBtn.style.opacity = 0.6;
}
