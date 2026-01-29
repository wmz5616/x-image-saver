let isScanning = false;
let collectedUrls = new Set();
let uiContainer = null;
let scanInterval = null;
let currentType = "image";
let noScrollCount = 0;
let lastScrollHeight = 0;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleBatchUI") {
    currentType = request.type || "image";
    if (uiContainer) {
      removeUI();
    } else {
      createUI();
    }
  }
});

function createUI() {
  uiContainer = document.createElement("div");
  uiContainer.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    width: 260px;
    background: rgba(20, 23, 26, 0.95);
    backdrop-filter: blur(10px);
    color: #fff;
    padding: 20px;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    border: 1px solid rgba(255,255,255,0.1);
    transition: all 0.3s ease;
  `;

  const title = currentType === "image" ? "图片" : "视频";
  const icon = currentType === "image" ? "🖼️" : "🎬";

  uiContainer.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; font-size: 18px; font-weight: 700;">${icon} ${title}批量采集</h3>
        <span id="x-status" style="font-size: 12px; color: #8899a6; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">就绪</span>
    </div>
    
    <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #8899a6; font-size: 13px;">已捕获</span>
        <span id="x-count" style="color: #1d9bf0; font-weight: bold; font-size: 20px;">0</span>
    </div>

    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
      <button id="x-btn-start" style="flex: 1; padding: 10px; cursor: pointer; background: #1d9bf0; border: none; border-radius: 20px; color: white; font-weight: 600; transition: 0.2s;">开始采集</button>
      <button id="x-btn-download" style="flex: 1; padding: 10px; cursor: pointer; background: #00ba7c; border: none; border-radius: 20px; color: white; font-weight: 600; display: none;">下载全部</button>
    </div>
    
    <button id="x-btn-close" style="width: 100%; padding: 8px; cursor: pointer; background: transparent; border: 1px solid #333; color: #777; border-radius: 20px; font-size: 12px; transition: 0.2s;">关闭面板</button>
  `;

  document.body.appendChild(uiContainer);

  const startBtn = document.getElementById("x-btn-start");
  const closeBtn = document.getElementById("x-btn-close");
  const downloadBtn = document.getElementById("x-btn-download");

  startBtn.onmouseover = () => (startBtn.style.opacity = 0.9);
  startBtn.onmouseout = () => (startBtn.style.opacity = 1);
  closeBtn.onmouseover = () => {
    closeBtn.style.borderColor = "#555";
    closeBtn.style.color = "#999";
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.borderColor = "#333";
    closeBtn.style.color = "#777";
  };

  startBtn.onclick = toggleScan;
  closeBtn.onclick = removeUI;
  downloadBtn.onclick = startBatchDownload;
}

function removeUI() {
  stopScan();
  if (uiContainer) {
    uiContainer.remove();
    uiContainer = null;
  }
  collectedUrls.clear();
  noScrollCount = 0;
}

function updateStatus(text, isError = false) {
  const el = document.getElementById("x-status");
  if (el) {
    el.innerText = text;
    el.style.color = isError ? "#f4212e" : "#8899a6";
  }
}

function toggleScan() {
  const btn = document.getElementById("x-btn-start");
  const downBtn = document.getElementById("x-btn-download");

  if (isScanning) {
    stopScan();
    btn.innerText = "继续采集";
    btn.style.background = "#1d9bf0";
    downBtn.style.display = "block";
    updateStatus("已暂停");
  } else {
    isScanning = true;
    noScrollCount = 0;
    btn.innerText = "停止采集";
    btn.style.background = "#f4212e";
    downBtn.style.display = "none";
    updateStatus("扫描中...");
    scanLoop();
  }
}

function stopScan() {
  isScanning = false;
  clearTimeout(scanInterval);
}

function scanLoop() {
  if (!isScanning) return;

  if (currentType === "image") {
    const images = document.querySelectorAll('img[src*="media"]');
    images.forEach((img) => {
      if (img.src.includes("profile_images") || img.width < 50) return;

      const isVideoCover =
        img.closest('[data-testid="videoPlayer"]') ||
        img.closest('[data-testid="videoComponent"]');
      if (isVideoCover) return;

      let finalUrl = img.src;
      if (finalUrl.includes("format=")) {
        finalUrl = finalUrl.replace(/name=[^&]+/, "name=orig");
      }
      collectedUrls.add(finalUrl);
    });
  } else {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      if (video.src && !video.src.includes("blob:"))
        collectedUrls.add(video.src);
      const sources = video.querySelectorAll("source");
      sources.forEach((source) => {
        if (source.src && !source.src.includes("blob:"))
          collectedUrls.add(source.src);
      });
    });
  }

  document.getElementById("x-count").innerText = collectedUrls.size;

  const currentHeight = document.body.scrollHeight;

  if (currentHeight <= lastScrollHeight) {
    noScrollCount++;
    updateStatus(`加载中... (${noScrollCount})`);

    window.scrollBy(0, -600);
    setTimeout(() => {
      window.scrollTo(0, document.body.scrollHeight);
    }, 200);
  } else {
    noScrollCount = 0;
    lastScrollHeight = currentHeight;
    updateStatus("正在翻页...");
    window.scrollTo(0, document.body.scrollHeight);
  }

  if (noScrollCount > 15) {
    stopScan();
    document.getElementById("x-btn-start").innerText = "已完成";
    document.getElementById("x-btn-download").style.display = "block";
    updateStatus("已达底部");
    return;
  }

  const delay = 1500 + Math.random() * 1000;
  scanInterval = setTimeout(scanLoop, delay);
}

function startBatchDownload() {
  if (collectedUrls.size === 0) {
    alert("未找到任何内容！");
    return;
  }

  const pathParts = window.location.pathname.split("/");
  const userId = pathParts[1] || "unknown_user";

  chrome.runtime.sendMessage({
    action: "batchDownload",
    urls: Array.from(collectedUrls),
    userId: userId,
    type: currentType,
  });

  const downBtn = document.getElementById("x-btn-download");
  downBtn.innerText = "下载处理中...";
  downBtn.disabled = true;
  downBtn.style.opacity = 0.7;
}
