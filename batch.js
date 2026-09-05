let isScanning = false;
let collectedItems = new Map();
let uiContainer = null;
let capsuleContainer = null;
let scanInterval = null;
let noScrollCount = 0;
let lastScrollHeight = 0;
let localHistory = {};
let skipDownloaded = true;
let activeFilter = localStorage.getItem("x_active_filter") || "all";
let isPreviewOpen = false;
let scanPhase = "idle";
let retryAttempts = 0;
const MAX_RETRY_LIMIT = 8;
let downloadMethod = localStorage.getItem("x_download_method") || "folder";
let scanLimit = parseInt(localStorage.getItem("x_scan_limit") || "0", 10);
let isDownloading = false;
let isDownloadCompleted = false;

let isDragging = false;
let dragStartX, dragStartY, initialLeft, initialTop;
let currentTargetEl = null;

const ICONS = {
  xLogo: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  minimize: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  image: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  video: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  zip: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  download: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  play: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  info: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  externalLink: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
};

function injectStyles() {
  if (document.getElementById("x-media-pro-styles")) return;
  const styleEl = document.createElement("style");
  styleEl.id = "x-media-pro-styles";
  styleEl.textContent = `
    .x-pro-root * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .x-pro-root *::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    .x-pro-root input::-webkit-outer-spin-button,
    .x-pro-root input::-webkit-inner-spin-button {
      -webkit-appearance: none !important;
      margin: 0 !important;
      display: none !important;
    }
    .x-pro-root input[type="number"] {
      -moz-appearance: textfield !important;
      appearance: textfield !important;
    }
    .x-pro-panel {
      position: fixed;
      top: 90px;
      right: 28px;
      width: 320px;
      background: rgba(15, 20, 25, 0.88);
      backdrop-filter: blur(24px) saturate(190%);
      -webkit-backdrop-filter: blur(24px) saturate(190%);
      color: #f7f9f9;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05);
      z-index: 999999;
      user-select: none;
      transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .x-pro-capsule {
      position: fixed;
      top: 90px;
      right: 28px;
      height: 40px;
      padding: 0 14px;
      border-radius: 20px;
      background: rgba(15, 20, 25, 0.92);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(29, 155, 240, 0.4);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(29, 155, 240, 0.25);
      color: #f7f9f9;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      z-index: 999999;
      font-size: 13px;
      font-weight: 600;
      user-select: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .x-pro-capsule:hover {
      transform: scale(1.04);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.7), 0 0 20px rgba(29, 155, 240, 0.4);
    }
    .x-pro-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: grab;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .x-pro-header:active {
      cursor: grabbing;
    }
    .x-pro-title {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 14px;
      font-weight: 700;
      color: #f7f9f9;
      letter-spacing: 0.2px;
    }
    .x-pro-logo-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .x-pro-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .x-pro-icon-btn {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: #71767b;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .x-pro-icon-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #f7f9f9;
    }
    .x-pro-icon-btn.danger:hover {
      background: rgba(244, 33, 46, 0.15);
      color: #f4212e;
    }
    .x-pro-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .x-pro-stat-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 9px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background 0.15s ease;
    }
    .x-pro-stat-card:hover {
      background: rgba(255, 255, 255, 0.07);
    }
    .x-pro-stat-left {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #71767b;
    }
    .x-pro-stat-val {
      font-size: 16px;
      font-weight: 700;
      color: #f7f9f9;
      font-variant-numeric: tabular-nums;
    }
    .x-pro-stat-img .x-pro-stat-left {
      color: #1d9bf0;
    }
    .x-pro-stat-vid .x-pro-stat-left {
      color: #f91880;
    }
    .x-pro-filter-tabs {
      display: flex;
      background: rgba(255, 255, 255, 0.05);
      padding: 3px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .x-pro-tab-btn {
      flex: 1;
      padding: 5px 0;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      color: #71767b;
      border: none;
      background: transparent;
      border-radius: 7px;
      cursor: pointer;
      transition: all 0.18s ease;
    }
    .x-pro-tab-btn.active {
      background: rgba(255, 255, 255, 0.12);
      color: #f7f9f9;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .x-pro-drawer-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 10px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      color: #8b98a5;
      transition: all 0.15s ease;
    }
    .x-pro-drawer-toggle:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #f7f9f9;
    }
    .x-pro-drawer-toggle svg {
      transition: transform 0.2s ease;
    }
    .x-pro-drawer-toggle.open svg {
      transform: rotate(180deg);
    }
    .x-pro-preview-box {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .x-pro-preview-box::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      background: transparent;
    }
    .x-pro-preview-box.open {
      max-height: 190px;
      overflow-y: auto;
      margin-top: 4px;
    }
    .x-pro-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      padding: 4px 1px;
    }
    .x-pro-thumb {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      border-radius: 8px;
      overflow: hidden;
      background: #16181c;
      border: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
    }
    .x-pro-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.2s ease;
    }
    .x-pro-thumb:hover img {
      transform: scale(1.08);
    }
    .x-pro-thumb-del {
      position: absolute;
      top: 3px;
      right: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .x-pro-thumb:hover .x-pro-thumb-del {
      display: flex;
    }
    .x-pro-thumb-del:hover {
      background: #f4212e;
    }
    .x-pro-thumb-vid-tag {
      position: absolute;
      bottom: 3px;
      left: 3px;
      padding: 2px 4px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 9px;
      font-weight: 600;
    }
    .x-pro-options {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: #71767b;
      padding: 0 2px;
    }
    .x-pro-checkbox-label {
      display: flex;
      align-items: center;
      gap: 7px;
      cursor: pointer;
      user-select: none;
    }
    .x-pro-checkbox-label input {
      accent-color: #1d9bf0;
      width: 14px;
      height: 14px;
      cursor: pointer;
    }
    .x-pro-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .x-pro-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      width: 100%;
      padding: 9px 14px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      outline: none;
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .x-pro-btn:active {
      transform: scale(0.98);
    }
    .x-pro-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none !important;
    }
    .x-pro-btn-scan {
      background: #1d9bf0;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(29, 155, 240, 0.35);
    }
    .x-pro-btn-scan:hover:not(:disabled) {
      background: #1a8cd8;
      box-shadow: 0 6px 18px rgba(29, 155, 240, 0.45);
    }
    .x-pro-btn-scan.stopping {
      background: #f4212e;
      box-shadow: 0 4px 14px rgba(244, 33, 46, 0.35);
    }
    .x-pro-btn-scan.stopping:hover:not(:disabled) {
      background: #dc1e29;
    }
    .x-pro-action-row {
      display: flex;
      gap: 8px;
    }
    .x-pro-btn-zip {
      flex: 1;
      background: #f7f9f9;
      color: #0f1419;
      box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);
    }
    .x-pro-btn-zip:hover:not(:disabled) {
      background: #e6e8ea;
    }
    .x-pro-btn-batch {
      flex: 1;
      background: rgba(255, 255, 255, 0.08);
      color: #f7f9f9;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .x-pro-btn-batch:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.14);
    }
    .x-pro-progress-wrapper {
      display: none;
      flex-direction: column;
      gap: 6px;
      padding: 8px 10px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .x-pro-progress-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #8b98a5;
    }
    .x-pro-progress-bar-bg {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      overflow: hidden;
    }
    .x-pro-progress-bar-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #1d9bf0, #00ba7c);
      border-radius: 3px;
      transition: width 0.2s ease;
    }
    .x-pro-toast-container {
      position: fixed;
      bottom: 24px;
      right: 28px;
      z-index: 1000000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    .x-pro-toast {
      background: rgba(15, 20, 25, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 10px 16px;
      border-radius: 12px;
      color: #f7f9f9;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      opacity: 0;
      transform: translateY(10px) scale(0.96);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .x-pro-toast.show {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .x-pro-toast.success {
      border-color: rgba(0, 186, 124, 0.4);
    }
    .x-pro-toast.warn {
      border-color: rgba(255, 189, 3, 0.4);
    }
    .x-pro-toast.error {
      border-color: rgba(244, 33, 46, 0.4);
    }
    .x-pro-quick-preview {
      position: fixed;
      width: 260px;
      background: rgba(15, 20, 25, 0.94);
      backdrop-filter: blur(20px) saturate(190%);
      -webkit-backdrop-filter: blur(20px) saturate(190%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65);
      z-index: 1000002;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      user-select: none;
      animation: xPreviewPop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes xPreviewPop {
      from {
        opacity: 0;
        transform: scale(0.92);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    .x-pro-quick-preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: #8b98a5;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .x-pro-quick-preview-img-box {
      width: 100%;
      max-height: 280px;
      border-radius: 8px;
      overflow: hidden;
      background: #16181c;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .x-pro-quick-preview-img {
      width: 100%;
      max-height: 280px;
      object-fit: contain;
      display: block;
    }
  `;
  document.head.appendChild(styleEl);
}

function showToast(message, type = "info") {
  let container = document.getElementById("x-pro-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "x-pro-toast-container";
    container.className = "x-pro-root x-pro-toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `x-pro-toast ${type}`;
  let iconSvg = ICONS.info;
  if (type === "success") iconSvg = ICONS.check;
  toast.innerHTML = `<span>${iconSvg}</span><span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 260);
  }, 2200);
}

function getCurrentUserId() {
  const pathParts = window.location.pathname.split("/");
  return pathParts[1] || "unknown_user";
}

function getFolderName() {
  /* ASSERTION: 文件夹命名严格对齐用户ID规范，不拼接多余昵称与非法路径字符 */
  return getCurrentUserId().replace(/[\\/:*?"<>|]/g, "_");
}

function getImageStandardFilename(url) {
  /* ASSERTION: 图片文件名必须按照系统默认名字（URL中的media标识+.png）提取 */
  if (!url) return "image.png";
  const clean = url.split("?")[0];
  const base = clean.split("/").pop();
  const nameWithoutExt = base.split(".")[0];
  return `${nameWithoutExt}.png`;
}

function getVideoStandardFilename(item) {
  /* ASSERTION: 视频文件名按推特原始文件名或唯一ID生成 */
  if (!item) return "video.mp4";
  if (item.videoUrl && item.videoUrl.startsWith("http")) {
    const clean = item.videoUrl.split("?")[0];
    const base = clean.split("/").pop();
    return base.endsWith(".mp4") ? base : `${base.split(".")[0]}.mp4`;
  }
  const cleanId = sanitizeId(item.id);
  return `${cleanId}.mp4`;
}

function getMediaFilename(item) {
  return item.type === "video" ? getVideoStandardFilename(item) : getImageStandardFilename(item.url);
}

function loadExistingFiles() {
  /* ASSERTION: 读取历史下载记录及目标文件夹已有同名文件，用于扫描前置去重 */
  const folderName = getFolderName();
  chrome.runtime.sendMessage(
    { action: "checkExistingFiles", folderName: folderName, userId: folderName },
    (res) => {
      if (res && res.success && res.existingFiles) {
        Object.assign(localHistory, res.existingFiles);
      }
    }
  );
}

function saveSession() {
  const userId = getCurrentUserId();
  if (!userId || collectedItems.size === 0) return;
  const data = Array.from(collectedItems.entries());
  try {
    localStorage.setItem(`x_backup_${userId}`, JSON.stringify(data));
  } catch (e) { }
}

function loadSession() {
  const userId = getCurrentUserId();
  const raw = localStorage.getItem(`x_backup_${userId}`);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      collectedItems = new Map(data);
      updateUICount();
    } catch (e) { }
  }
}

function clearSession() {
  /* ASSERTION: 清空会话断言，必须停止任何进行中的扫描任务并彻底将界面控件复位到初始空载状态 */
  stopScan();
  isScanning = false;
  scanPhase = "idle";
  noScrollCount = 0;
  lastScrollHeight = 0;
  retryAttempts = 0;
  isDownloading = false;
  isDownloadCompleted = false;

  const userId = getCurrentUserId();
  localStorage.removeItem(`x_backup_${userId}`);
  collectedItems.clear();
  closeQuickPreview();

  const startBtn = document.getElementById("x-btn-start");
  if (startBtn) {
    startBtn.innerText = "开始扫描";
    startBtn.disabled = false;
    startBtn.classList.remove("stopping");
  }

  const probeBar = document.getElementById("x-probe-status-bar");
  if (probeBar) {
    probeBar.style.display = "none";
    probeBar.innerHTML = "";
  }

  setProgress(false);
  updateUICount();
  updateDownloadMethodUI();
  showToast("已清空采集列表并恢复初始状态", "info");
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "openBatchUI") {
    chrome.storage.local.get({ downloadHistory: {} }, (result) => {
      localHistory = result.downloadHistory;
      if (uiContainer) removeUI();
      if (capsuleContainer) removeCapsule();
      createUI();
      loadSession();
    });
  }

  if (request.action === "downloadProgress") {
    /* ASSERTION: 下载进度消息断言，动态驱动面板下方进度条百分比与完成复位 */
    const pct = Math.round((request.current / request.total) * 100);
    setProgress(true, `正在下载: ${request.current}/${request.total} (${pct}%)`, pct);
    if (request.current >= request.total) {
      /* ASSERTION: 全部下载完成断言，锁定下载完成态并彻底禁用按钮以防二次重复下载 */
      isDownloading = false;
      isDownloadCompleted = true;
      setProgress(true, `全部下载完成 (${request.total}/${request.total})`, 100);

      const execBtn = document.getElementById("x-btn-execute");
      const btnTextEl = document.getElementById("x-btn-execute-text");
      if (btnTextEl) btnTextEl.innerText = "已全部下载完成";
      if (execBtn) {
        execBtn.disabled = true;
        execBtn.style.opacity = "0.65";
        execBtn.style.cursor = "not-allowed";
      }

      const downloadedItems = getFilteredItems();
      downloadedItems.forEach((it) => {
        const fn = getMediaFilename(it);
        localHistory[fn] = true;
        if (it.url) localHistory[it.url] = true;
        if (it.id) localHistory[it.id] = true;
      });

      showToast(`已全部下载完成（共 ${request.total} 项）`, "success");

      setTimeout(() => {
        setProgress(false);
      }, 4000);
    }
  }
});

function createUI() {
  injectStyles();

  /* ASSERTION: UI 容器必须唯一，重复创建需先销毁旧实例以防止内存泄漏与事件重复绑定 */
  if (uiContainer) {
    uiContainer.remove();
  }

  uiContainer = document.createElement("div");
  uiContainer.className = "x-pro-root x-pro-panel";
  uiContainer.id = "x-media-pro-panel";

  uiContainer.innerHTML = `
    <div class="x-pro-header" id="x-drag-header">
      <div class="x-pro-title">
        <span class="x-pro-logo-badge">${ICONS.xLogo}</span>
        <span>媒体采集</span>
      </div>
      <div class="x-pro-actions">
        <button class="x-pro-icon-btn danger" id="x-btn-clear" title="清空列表">${ICONS.trash}</button>
        <button class="x-pro-icon-btn" id="x-btn-minimize" title="最小化">${ICONS.minimize}</button>
        <button class="x-pro-icon-btn" id="x-btn-close" title="关闭">${ICONS.close}</button>
      </div>
    </div>

    <div class="x-pro-stats">
      <div class="x-pro-stat-card x-pro-stat-img">
        <div class="x-pro-stat-left">
          ${ICONS.image}
          <span>图片</span>
        </div>
        <div class="x-pro-stat-val" id="x-count-img">0</div>
      </div>
      <div class="x-pro-stat-card x-pro-stat-vid">
        <div class="x-pro-stat-left">
          ${ICONS.video}
          <span>视频</span>
        </div>
        <div class="x-pro-stat-val" id="x-count-vid">0</div>
      </div>
    </div>

    <div class="x-pro-filter-tabs" id="x-media-filter-tabs">
      <button class="x-pro-tab-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">全部</button>
      <button class="x-pro-tab-btn ${activeFilter === 'image' ? 'active' : ''}" data-filter="image">仅图片</button>
      <button class="x-pro-tab-btn ${activeFilter === 'video' ? 'active' : ''}" data-filter="video">仅视频</button>
    </div>

    <div>
      <div class="x-pro-drawer-toggle" id="x-drawer-toggle">
        <span id="x-drawer-title">已采集列表预览 (0)</span>
        ${ICONS.chevronDown}
      </div>
      <div class="x-pro-preview-box" id="x-preview-box">
        <div class="x-pro-grid" id="x-preview-grid"></div>
      </div>
    </div>

    <div class="x-pro-options">
      <label class="x-pro-checkbox-label">
        <input type="checkbox" id="x-chk-skip" checked>
        <span>跳过已下载</span>
      </label>
      <span id="x-total-label" style="color:#71767b; font-size:11px;">总计: 0</span>
    </div>

    <div style="display:flex; flex-direction:column; gap:6px;">
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#8b98a5;">
        <span>采集上限 (达额自动停止)</span>
        <span id="x-limit-hint" style="font-size:11px; color:#536471;">${scanLimit > 0 ? `已设为 ${scanLimit} 项` : '不限制'}</span>
      </div>
      <div class="x-pro-filter-tabs" id="x-limit-tabs">
        <button class="x-pro-tab-btn ${scanLimit === 0 ? 'active' : ''}" data-limit="0">不限</button>
        <button class="x-pro-tab-btn ${scanLimit === 50 ? 'active' : ''}" data-limit="50">50</button>
        <button class="x-pro-tab-btn ${scanLimit === 100 ? 'active' : ''}" data-limit="100">100</button>
        <button class="x-pro-tab-btn ${scanLimit === 200 ? 'active' : ''}" data-limit="200">200</button>
        <button class="x-pro-tab-btn ${[0, 50, 100, 200].includes(scanLimit) ? '' : 'active'}" data-limit="custom">自定</button>
      </div>
      <div id="x-custom-limit-box" style="display:${[0, 50, 100, 200].includes(scanLimit) ? 'none' : 'flex'}; align-items:center; gap:6px; margin-top:2px;">
        <input type="text" inputmode="numeric" pattern="[0-9]*" id="x-input-custom-limit" value="${[0, 50, 100, 200].includes(scanLimit) ? '' : scanLimit}" placeholder="目标张数" style="flex:1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:5px 10px; color:#fff; font-size:12px; outline:none; -webkit-appearance:none; -moz-appearance:textfield; appearance:textfield;" />
        <button id="x-btn-custom-limit-ok" class="x-pro-tab-btn" style="width:50px; padding:5px 0; background:rgba(29, 155, 240, 0.2); color:#1d9bf0;">确定</button>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:6px;">
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#8b98a5;">
        <span>下载方式</span>
        <span id="x-method-hint" style="font-size:11px; color:#536471;"></span>
      </div>
      <div class="x-pro-filter-tabs" id="x-method-tabs">
        <button class="x-pro-tab-btn ${downloadMethod === 'zip' ? 'active' : ''}" data-method="zip">压缩包</button>
        <button class="x-pro-tab-btn ${downloadMethod === 'folder' ? 'active' : ''}" data-method="folder">文件夹</button>
        <button class="x-pro-tab-btn ${downloadMethod === 'direct' ? 'active' : ''}" data-method="direct">无</button>
      </div>
    </div>

    <div id="x-probe-status-bar" style="display:none; font-size:11px; border-radius:8px; padding:6px 10px; text-align:center; transition:all 0.2s ease;"></div>

    <div class="x-pro-buttons">
      <button class="x-pro-btn x-pro-btn-scan" id="x-btn-start">开始扫描</button>
      <button class="x-pro-btn" id="x-btn-execute" style="display:none; background:#f7f9f9; color:#0f1419; box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);">
        <span id="x-btn-execute-icon">${ICONS.folder}</span>
        <span id="x-btn-execute-text">下载到文件夹</span>
      </button>
    </div>

    <div class="x-pro-progress-wrapper" id="x-progress-wrapper" style="display:none; margin-top:2px;">
      <div class="x-pro-progress-header">
        <span id="x-progress-status">准备就绪...</span>
        <span id="x-progress-pct">0%</span>
      </div>
      <div class="x-pro-progress-bar-bg">
        <div class="x-pro-progress-bar-fill" id="x-progress-fill"></div>
      </div>
    </div>
  `;

  document.body.appendChild(uiContainer);

  /* ASSERTION: 读取历史记忆坐标复位面板，越界时自动限制在当前屏幕可视区域内 */
  const savedPosStr = localStorage.getItem("x_panel_pos");
  if (savedPosStr) {
    try {
      const pos = JSON.parse(savedPosStr);
      if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
        const safeLeft = Math.max(10, Math.min(window.innerWidth - 340, pos.left));
        const safeTop = Math.max(10, Math.min(window.innerHeight - 150, pos.top));
        uiContainer.style.left = `${safeLeft}px`;
        uiContainer.style.top = `${safeTop}px`;
        uiContainer.style.right = "auto";
      }
    } catch (e) { }
  }

  setupDragEvent(uiContainer, document.getElementById("x-drag-header"));

  loadExistingFiles();
  bindEvents();
  updateDownloadMethodUI();
}

function updateDownloadMethodUI() {
  const hintEl = document.getElementById("x-method-hint");
  const btnTextEl = document.getElementById("x-btn-execute-text");
  const btnIconEl = document.getElementById("x-btn-execute-icon");
  const userId = getFolderName();
  const filterText = activeFilter === "image" ? "图片" : (activeFilter === "video" ? "视频" : "全部媒体");

  if (downloadMethod === "zip") {
    if (hintEl) hintEl.innerText = `${userId}.zip`;
    if (btnTextEl) btnTextEl.innerText = `打包${filterText} (${userId}.zip)`;
    if (btnIconEl) btnIconEl.innerHTML = ICONS.zip;
  } else if (downloadMethod === "folder") {
    if (hintEl) hintEl.innerText = `保存到 ${userId}/`;
    if (btnTextEl) btnTextEl.innerText = `下载${filterText} (${userId}/)`;
    if (btnIconEl) btnIconEl.innerHTML = ICONS.folder;
  } else {
    if (hintEl) hintEl.innerText = "直接保存文件";
    if (btnTextEl) btnTextEl.innerText = `批量下载${filterText}`;
    if (btnIconEl) btnIconEl.innerHTML = ICONS.download;
  }
}

function executeDownload() {
  /* ASSERTION: 下载防重断言，严格拦截正在下载或当前批次已全部下载完成时的重复触发 */
  if (isDownloading) {
    showToast("当前任务正在下载中，请稍候...", "warn");
    return;
  }
  if (isDownloadCompleted) {
    showToast("当前采集的媒体已全部下载完成，无需重复下载", "info");
    return;
  }

  if (downloadMethod === "zip") {
    startZipDownload();
  } else if (downloadMethod === "folder") {
    startBatchDownload("folder");
  } else {
    startBatchDownload("direct");
  }
}

function bindEvents() {
  document.getElementById("x-chk-skip").onchange = (e) => {
    skipDownloaded = e.target.checked;
  };

  document.getElementById("x-btn-start").onclick = toggleScan;
  document.getElementById("x-btn-close").onclick = removeUI;
  document.getElementById("x-btn-minimize").onclick = minimizeToCapsule;
  document.getElementById("x-btn-clear").onclick = clearSession;
  document.getElementById("x-btn-execute").onclick = executeDownload;

  const limitHintEl = document.getElementById("x-limit-hint");
  const customLimitBox = document.getElementById("x-custom-limit-box");
  const customLimitInput = document.getElementById("x-input-custom-limit");
  const customLimitOk = document.getElementById("x-btn-custom-limit-ok");

  const applyLimit = (val) => {
    scanLimit = Math.max(0, parseInt(val, 10) || 0);
    localStorage.setItem("x_scan_limit", scanLimit.toString());
    if (limitHintEl) {
      limitHintEl.innerText = scanLimit > 0 ? `已设为 ${scanLimit} 项` : "不限制";
    }
  };

  document.querySelectorAll("#x-limit-tabs .x-pro-tab-btn").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll("#x-limit-tabs .x-pro-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const limitVal = btn.dataset.limit;
      if (limitVal === "custom") {
        if (customLimitBox) customLimitBox.style.display = "flex";
        if (customLimitInput) {
          customLimitInput.focus();
          if (customLimitInput.value) {
            applyLimit(customLimitInput.value);
          }
        }
      } else {
        if (customLimitBox) customLimitBox.style.display = "none";
        applyLimit(limitVal);
      }
    };
  });

  if (customLimitOk && customLimitInput) {
    customLimitInput.oninput = () => {
      customLimitInput.value = customLimitInput.value.replace(/\D/g, "");
    };
    customLimitOk.onclick = () => {
      applyLimit(customLimitInput.value);
      showToast(`采集上限已设为 ${scanLimit} 项`, "info");
    };
    customLimitInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        applyLimit(customLimitInput.value);
        showToast(`采集上限已设为 ${scanLimit} 项`, "info");
      }
    };
  }

  document.querySelectorAll("#x-method-tabs .x-pro-tab-btn").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll("#x-method-tabs .x-pro-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      downloadMethod = btn.dataset.method;
      localStorage.setItem("x_download_method", downloadMethod);
      updateDownloadMethodUI();
    };
  });

  document.querySelectorAll("#x-media-filter-tabs .x-pro-tab-btn").forEach((btn) => {
    btn.onclick = async () => {
      document.querySelectorAll("#x-media-filter-tabs .x-pro-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      localStorage.setItem("x_active_filter", activeFilter);
      updateUICount();
      updateDownloadMethodUI();

      if (activeFilter === "image") {
        scanPhase = "photos";
        await switchToMediaSubTab("image");
      } else if (activeFilter === "video") {
        scanPhase = "videos";
        await switchToMediaSubTab("video");
      } else if (activeFilter === "all") {
        scanPhase = "photos";
        await switchToMediaSubTab("image");
      }
    };
  });

  const drawerToggle = document.getElementById("x-drawer-toggle");
  const previewBox = document.getElementById("x-preview-box");
  drawerToggle.onclick = () => {
    isPreviewOpen = !isPreviewOpen;
    drawerToggle.classList.toggle("open", isPreviewOpen);
    previewBox.classList.toggle("open", isPreviewOpen);
    if (isPreviewOpen) {
      renderThumbnails();
    }
  };
}

function minimizeToCapsule() {
  if (!uiContainer) return;
  closeQuickPreview();
  const rect = uiContainer.getBoundingClientRect();
  const currentLeft = rect.left;
  const currentTop = rect.top;

  uiContainer.style.display = "none";

  if (!capsuleContainer) {
    capsuleContainer = document.createElement("div");
    capsuleContainer.className = "x-pro-root x-pro-capsule";
    capsuleContainer.id = "x-media-pro-capsule";
    document.body.appendChild(capsuleContainer);
    setupDragEvent(capsuleContainer, capsuleContainer);
    capsuleContainer.onclick = () => {
      if (isDragging) return;
      restoreFromCapsule();
    };
  }

  capsuleContainer.style.display = "flex";
  capsuleContainer.style.left = `${Math.min(window.innerWidth - 140, Math.max(10, currentLeft))}px`;
  capsuleContainer.style.top = `${Math.min(window.innerHeight - 50, Math.max(10, currentTop))}px`;
  updateCapsuleCount();
}

function restoreFromCapsule() {
  if (capsuleContainer) {
    const rect = capsuleContainer.getBoundingClientRect();
    capsuleContainer.style.display = "none";
    if (uiContainer) {
      uiContainer.style.display = "flex";
      /* ASSERTION: 从胶囊还原时优先应用用户保存的面板坐标，保持视口位置一致性 */
      const savedPosStr = localStorage.getItem("x_panel_pos");
      if (savedPosStr) {
        try {
          const pos = JSON.parse(savedPosStr);
          if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
            const safeLeft = Math.max(10, Math.min(window.innerWidth - 340, pos.left));
            const safeTop = Math.max(10, Math.min(window.innerHeight - 150, pos.top));
            uiContainer.style.left = `${safeLeft}px`;
            uiContainer.style.top = `${safeTop}px`;
            uiContainer.style.right = "auto";
            return;
          }
        } catch (e) { }
      }
      uiContainer.style.left = `${Math.min(window.innerWidth - 340, Math.max(10, rect.left))}px`;
      uiContainer.style.top = `${Math.min(window.innerHeight - 450, Math.max(10, rect.top))}px`;
    }
  }
}

function removeCapsule() {
  if (capsuleContainer) {
    capsuleContainer.remove();
    capsuleContainer = null;
  }
}

function updateCapsuleCount() {
  if (!capsuleContainer) return;
  const total = collectedItems.size;
  capsuleContainer.innerHTML = `
    <span class="x-pro-logo-badge">${ICONS.xLogo}</span>
    <span>已采: ${total}</span>
  `;
}

function getTwitterRetryButton() {
  /* ASSERTION: 重试按钮断言，准确匹配推特流控或网络异常界面中的重试控制元素 */
  const buttons = document.querySelectorAll('button, [role="button"]');
  for (const btn of buttons) {
    const text = btn.innerText?.trim();
    if (text === "重试" || text === "Retry" || text === "Try again" || text?.includes("重试")) {
      return btn;
    }
  }
  return null;
}

async function switchToMediaSubTab(type) {
  /* ASSERTION: 子标签切换必须验证目标类型为有效媒体分类，确保照片与视频自适应流转 */
  if (type !== "image" && type !== "video") return false;

  const targetText = type === "video" ? "视频" : "照片";
  const altText = type === "video" ? "Videos" : "Photos";

  const findMenuItem = () => {
    const candidates = Array.from(document.querySelectorAll('div, span, [role="menuitem"]'));
    return candidates.find((el) => {
      const t = el.innerText?.trim();
      return (t === targetText || t === altText) && el.children.length === 0;
    });
  };

  let targetOption = findMenuItem();

  if (!targetOption) {
    const tabs = Array.from(document.querySelectorAll('a[role="tab"], [role="tab"], a[href*="/media"]'));
    const mediaTab = tabs.find((el) => {
      const t = el.innerText?.trim();
      return t?.includes("媒体") || t?.includes("Media");
    });

    if (mediaTab) {
      mediaTab.click();
      await new Promise((r) => setTimeout(r, 450));
      targetOption = findMenuItem();
    }
  }

  if (targetOption) {
    targetOption.click();
    showToast(`已自适应切换至【${targetText}】`, "info");
    await new Promise((r) => setTimeout(r, 900));
    return true;
  }
  return false;
}

function sanitizeId(rawId) {
  /* ASSERTION: 媒体ID必须处理非空与特殊字符，以确保生成的文件名在操作系统文件系统中合法 */
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

function setProgress(show, text = "", percent = 0) {
  const wrapper = document.getElementById("x-progress-wrapper");
  const statusEl = document.getElementById("x-progress-status");
  const pctEl = document.getElementById("x-progress-pct");
  const fillEl = document.getElementById("x-progress-fill");

  if (!wrapper) return;
  if (!show) {
    wrapper.style.display = "none";
    return;
  }

  wrapper.style.display = "flex";
  statusEl.innerText = text;
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  pctEl.innerText = `${clamped}%`;
  fillEl.style.width = `${clamped}%`;
}

function getFilteredItems() {
  /* ASSERTION: 采集的数据结构必须为合法的数组，避免 map 异常或 null 导致的链式报错 */
  const items = Array.from(collectedItems.values());
  if (activeFilter === "image") {
    return items.filter((it) => it.type === "image");
  }
  if (activeFilter === "video") {
    return items.filter((it) => it.type === "video");
  }
  return items;
}

function sendDesktopNotification(title, message) {
  /* ASSERTION: 系统桌面通知派发断言，保证在浏览器支持并在后台生命周期内正常唤起原生通知 */
  try {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: "showNotification",
        title: title,
        message: message,
      }).catch(() => { });
    }
  } catch (e) { }
}

async function startZipDownload() {
  const items = getFilteredItems();
  if (items.length === 0) {
    showToast("当前筛选列表为空", "warn");
    return;
  }

  isDownloading = true;
  isDownloadCompleted = false;

  const userId = getFolderName();
  const folderName = userId;
  const zip = new JSZip();
  const folder = zip.folder(folderName);
  const execBtn = document.getElementById("x-btn-execute");
  const btnTextEl = document.getElementById("x-btn-execute-text");

  if (execBtn) execBtn.disabled = true;
  if (btnTextEl) btnTextEl.innerText = "正在打包中...";

  let processed = 0;
  const total = items.length;

  setProgress(true, `准备打包媒体 (0/${total})`, 0);

  /* ASSERTION: 并发下载池必须具备网络容错与并发度限制，避免单线程过慢或过度并发导致接口限流 */
  const CONCURRENCY_LIMIT = 6;
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const item = items[currentIndex++];
      const filename = getMediaFilename(item);
      const isVideo = item.type === "video";

      try {
        let blob = null;
        if (isVideo) {
          const apiRes = await fetch(`https://api.fxtwitter.com/status/${item.id}`);
          const apiJson = await apiRes.json();
          if (apiJson?.tweet?.media?.videos?.[0]?.url) {
            blob = await fetchBlobViaBackground(apiJson.tweet.media.videos[0].url);
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
        console.error(`打包资源获取失败: ${filename}`, err);
      }

      processed++;
      const pct = Math.round((processed / total) * 85);
      setProgress(true, `并发获取中: ${processed}/${total} (${pct}%)`, pct);
    }
  }

  const workers = [];
  const activeLimit = Math.min(CONCURRENCY_LIMIT, items.length);
  for (let i = 0; i < activeLimit; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  setProgress(true, "正在生成 ZIP 压缩文件...", 90);

  const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
    setProgress(true, `压缩中: ${Math.round(metadata.percent)}%`, 90 + metadata.percent * 0.1);
  });

  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(content);
  downloadLink.download = `${folderName}.zip`;
  downloadLink.click();

  isDownloading = false;
  isDownloadCompleted = true;
  setProgress(true, "打包完成！", 100);
  setTimeout(() => setProgress(false), 3000);

  if (execBtn) {
    execBtn.disabled = true;
    execBtn.style.opacity = "0.65";
    execBtn.style.cursor = "not-allowed";
  }
  if (btnTextEl) btnTextEl.innerText = "已全部打包完成";

  items.forEach((it) => {
    const fn = getMediaFilename(it);
    localHistory[fn] = true;
    if (it.url) localHistory[it.url] = true;
    if (it.id) localHistory[it.id] = true;
  });

  showToast("ZIP 打包完成，已开始下载", "success");
  sendDesktopNotification(
    "ZIP 打包完成",
    `${folderName}.zip (${items.length}项) 已成功生成并开始保存！`
  );

  const itemsArray = items.map((item) => ({ id: item.id, filename: getMediaFilename(item) }));
  chrome.runtime.sendMessage({ action: "saveHistoryOnly", items: itemsArray, userId: userId });

  localStorage.removeItem(`x_backup_${userId}`);
}

let quickPreviewEl = null;

function showQuickPreview(item) {
  /* ASSERTION: 快速简单预览仅处理图片类型，严格忽略视频与空对象 */
  if (!item || item.type !== "image") return;

  if (quickPreviewEl) {
    const isSame = quickPreviewEl.dataset.previewId === item.id;
    closeQuickPreview();
    if (isSame) return;
  }

  quickPreviewEl = document.createElement("div");
  quickPreviewEl.className = "x-pro-root x-pro-quick-preview";
  quickPreviewEl.id = "x-media-quick-preview";
  quickPreviewEl.dataset.previewId = item.id;

  const imgSrc = item.thumbUrl || item.url;

  quickPreviewEl.innerHTML = `
    <div class="x-pro-quick-preview-header">
      <span>图片预览</span>
      <button class="x-pro-icon-btn" id="x-btn-preview-close" style="width:22px; height:22px;" title="关闭">
        ${ICONS.close}
      </button>
    </div>
    <div class="x-pro-quick-preview-img-box">
      <img src="${imgSrc}" class="x-pro-quick-preview-img" alt="preview" />
    </div>
  `;

  document.body.appendChild(quickPreviewEl);

  if (uiContainer) {
    const rect = uiContainer.getBoundingClientRect();
    const popupW = 260;
    let targetLeft = rect.left - popupW - 12;
    if (targetLeft < 10) {
      targetLeft = rect.right + 12;
    }
    if (targetLeft + popupW > window.innerWidth - 10) {
      targetLeft = Math.max(10, rect.left);
    }
    let targetTop = Math.max(10, Math.min(window.innerHeight - 330, rect.top));
    quickPreviewEl.style.left = `${targetLeft}px`;
    quickPreviewEl.style.top = `${targetTop}px`;
  } else {
    quickPreviewEl.style.left = "50%";
    quickPreviewEl.style.top = "50%";
    quickPreviewEl.style.transform = "translate(-50%, -50%)";
  }

  document.getElementById("x-btn-preview-close").onclick = (e) => {
    e.stopPropagation();
    closeQuickPreview();
  };
}

function closeQuickPreview() {
  if (quickPreviewEl) {
    quickPreviewEl.remove();
    quickPreviewEl = null;
  }
}

function renderThumbnails() {
  const grid = document.getElementById("x-preview-grid");
  if (!grid) return;

  const items = getFilteredItems();
  grid.innerHTML = "";

  if (items.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:18px 0; font-size:12px; color:#536471;">暂无符合条件的媒体</div>`;
    return;
  }

  items.forEach((item) => {
    const thumb = document.createElement("div");
    thumb.className = "x-pro-thumb";

    const imgSrc = item.thumbUrl || (item.type === "image" ? `${item.url.split("?")[0]}?format=jpg&name=240x240` : "");
    const isVideo = item.type === "video";

    thumb.innerHTML = `
      ${imgSrc ? `<img src="${imgSrc}" loading="lazy" alt="preview">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#536471;">${ICONS.video}</div>`}
      ${isVideo ? `<div class="x-pro-thumb-vid-tag">${ICONS.play} 视频</div>` : ""}
      <div class="x-pro-thumb-del" title="移除此项">✕</div>
    `;

    thumb.onclick = (e) => {
      if (e.target.closest(".x-pro-thumb-del")) return;
      if (item.type !== "image") return;
      showQuickPreview(item);
    };

    thumb.querySelector(".x-pro-thumb-del").onclick = (e) => {
      e.stopPropagation();
      collectedItems.delete(item.id);
      if (quickPreviewEl && quickPreviewEl.dataset.previewId === item.id) {
        closeQuickPreview();
      }
      saveSession();
      updateUICount();
      renderThumbnails();
      showToast("已移除该媒体", "info");
    };

    grid.appendChild(thumb);
  });
}

function updateUICount() {
  let imgCount = 0;
  let vidCount = 0;
  collectedItems.forEach((item) => {
    if (item.type === "video") vidCount++;
    else imgCount++;
  });

  const countImgEl = document.getElementById("x-count-img");
  const countVidEl = document.getElementById("x-count-vid");
  if (countImgEl) countImgEl.innerText = imgCount;
  if (countVidEl) countVidEl.innerText = vidCount;

  const total = collectedItems.size;
  const filteredTotal = getFilteredItems().length;

  const totalLabel = document.getElementById("x-total-label");
  if (totalLabel) {
    totalLabel.innerText = activeFilter === "all" ? `总计: ${total}` : `筛选: ${filteredTotal} / 共 ${total}`;
  }

  const drawerTitle = document.getElementById("x-drawer-title");
  if (drawerTitle) {
    drawerTitle.innerText = `已采集列表预览 (${filteredTotal})`;
  }

  const execBtn = document.getElementById("x-btn-execute");
  if (execBtn) {
    execBtn.style.display = total > 0 ? "inline-flex" : "none";
    const btnTextEl = document.getElementById("x-btn-execute-text");
    if (isDownloading) {
      execBtn.disabled = true;
      execBtn.style.opacity = "0.65";
      execBtn.style.cursor = "not-allowed";
    } else if (isDownloadCompleted) {
      execBtn.disabled = true;
      execBtn.style.opacity = "0.65";
      execBtn.style.cursor = "not-allowed";
      if (btnTextEl) btnTextEl.innerText = "已全部下载完成";
    } else {
      execBtn.disabled = false;
      execBtn.style.opacity = "1";
      execBtn.style.cursor = "pointer";
    }
  }

  if (isPreviewOpen) {
    renderThumbnails();
  }

  updateCapsuleCount();
}

function removeUI() {
  stopScan();
  if (uiContainer) {
    uiContainer.remove();
    uiContainer = null;
  }
  removeCapsule();
  closeQuickPreview();
}

async function toggleScan() {
  const btn = document.getElementById("x-btn-start");
  if (isScanning) {
    stopScan();
    btn.innerHTML = `${ICONS.play} 继续扫描`;
    btn.classList.remove("stopping");
    updateUICount();
  } else {
    isScanning = true;
    noScrollCount = 0;
    retryAttempts = 0;
    btn.innerText = "停止扫描";
    btn.classList.add("stopping");

    if (activeFilter === "all") {
      scanPhase = "photos";
      await switchToMediaSubTab("image");
    } else if (activeFilter === "image") {
      scanPhase = "photos";
      await switchToMediaSubTab("image");
    } else if (activeFilter === "video") {
      scanPhase = "videos";
      await switchToMediaSubTab("video");
    }

    scanLoop();
  }
}

function stopScan() {
  isScanning = false;
  scanPhase = "idle";
  retryAttempts = 0;
  clearTimeout(scanInterval);
  saveSession();
}

function setupDragEvent(targetEl, handleEl) {
  handleEl.addEventListener("mousedown", (e) => {
    if (e.target.closest("button") || e.target.closest("input")) return;
    isDragging = true;
    currentTargetEl = targetEl;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = targetEl.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    targetEl.style.right = "auto";
    targetEl.style.bottom = "auto";
    targetEl.style.left = `${initialLeft}px`;
    targetEl.style.top = `${initialTop}px`;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging || !currentTargetEl) return;
    const rect = currentTargetEl.getBoundingClientRect();
    let newLeft = initialLeft + (e.clientX - dragStartX);
    let newTop = initialTop + (e.clientY - dragStartY);

    /* ASSERTION: 限制拖拽元素留在视口以内，防止拖飞丢失 */
    newLeft = Math.max(10, Math.min(window.innerWidth - rect.width - 10, newLeft));
    newTop = Math.max(10, Math.min(window.innerHeight - rect.height - 10, newTop));

    currentTargetEl.style.left = `${newLeft}px`;
    currentTargetEl.style.top = `${newTop}px`;
  });

  window.addEventListener("mouseup", () => {
    if (isDragging && currentTargetEl) {
      /* ASSERTION: 拖拽结束时持久化存储元素视口位置，实现跨刷新位置记忆 */
      const rect = currentTargetEl.getBoundingClientRect();
      const pos = { left: rect.left, top: rect.top };
      if (currentTargetEl === uiContainer) {
        localStorage.setItem("x_panel_pos", JSON.stringify(pos));
      } else if (currentTargetEl === capsuleContainer) {
        localStorage.setItem("x_capsule_pos", JSON.stringify(pos));
      }
    }
    setTimeout(() => {
      isDragging = false;
      currentTargetEl = null;
    }, 50);
  });
}

function isVideoGridItem(linkElement) {
  const hasPlayIcon = linkElement.querySelector('[data-testid="iconMediaPlay"]');
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

async function scanLoop() {
  if (!isScanning) return;

  /* ASSERTION: 检测页面是否被推特流控或网络异常阻断，若出现重试按钮则自动进入退避重试流程 */
  const retryBtn = getTwitterRetryButton();
  if (retryBtn) {
    retryAttempts++;
    if (retryAttempts <= MAX_RETRY_LIMIT) {
      const waitSec = Math.min(10, Math.round(2.5 + retryAttempts * 1.5));
      const btn = document.getElementById("x-btn-start");
      if (btn) btn.innerText = `流控恢复中 (${retryAttempts}/${MAX_RETRY_LIMIT}) ${waitSec}s`;
      showToast(`检测到加载受阻，正在智能等待 ${waitSec} 秒后自动重试...`, "warn");

      window.scrollBy(0, -250);

      setTimeout(() => {
        if (!isScanning) return;
        const currentBtn = getTwitterRetryButton();
        if (currentBtn) {
          currentBtn.click();
        }
        setTimeout(scanLoop, 1500);
      }, waitSec * 1000);
      return;
    } else {
      showToast("接口持续受限，已暂停扫描，建议稍后再试", "error");
      stopScan();
      return;
    }
  } else {
    retryAttempts = 0;
  }

  const shouldSkip = skipDownloaded;
  const gridLinks = document.querySelectorAll('a[href*="/status/"]');
  let hasNew = false;

  gridLinks.forEach((link) => {
    if (link.closest('[data-testid="User-Name"]')) return;
    if (link.getAttribute("role") === "link" && link.querySelector("time")) return;

    const match = link.href.match(/\/status\/(\d+)/);
    if (!match) return;
    const tweetId = match[1];

    if (isVideoGridItem(link)) {
      if (activeFilter !== "image" && !collectedItems.has(tweetId)) {
        const thumbImg = link.querySelector("img");
        const filename = getVideoStandardFilename({ id: tweetId });
        /* ASSERTION: 查重断言，优先比对目标文件夹下是否已存在同名媒体文件或ID，存在则直接跳过 */
        if (shouldSkip && (localHistory[filename] || localHistory[tweetId])) return;

        collectedItems.set(tweetId, {
          type: "video",
          id: tweetId,
          url: `video_id:${tweetId}`,
          filename: filename,
          thumbUrl: thumbImg ? thumbImg.src : "",
          timeStr: "0000",
        });
        hasNew = true;
      }
    } else {
      const img = link.querySelector("img");
      if (img && img.src.includes("media")) {
        const rawUrl = img.src.split("?")[0];
        const filename = getImageStandardFilename(rawUrl);

        /* ASSERTION: 查重断言，严格比对文件名或图片原始链接，确保一推多图不被 tweetId 误杀 */
        if (shouldSkip && (localHistory[filename] || localHistory[rawUrl])) return;

        if (activeFilter !== "video" && !collectedItems.has(rawUrl)) {
          collectedItems.set(rawUrl, {
            type: "image",
            id: rawUrl,
            url: rawUrl,
            filename: filename,
            thumbUrl: img.src,
            timeStr: "0000",
          });
          hasNew = true;
        }
      }
    }
  });

  const videoComponents = document.querySelectorAll('[data-testid="videoPlayer"], [data-testid="videoComponent"]');
  videoComponents.forEach((comp) => {
    if (activeFilter === "image") return;
    const article = comp.closest("article");
    if (!article) return;
    const links = article.querySelectorAll('a[href*="/status/"]');
    for (const l of links) {
      const m = l.href.match(/\/status\/(\d+)/);
      if (m) {
        const tid = m[1];
        const filename = getVideoStandardFilename({ id: tid });
        if (shouldSkip && (localHistory[filename] || localHistory[tid])) break;
        if (!collectedItems.has(tid)) {
          const poster = comp.querySelector("video")?.poster || comp.querySelector("img")?.src || "";
          collectedItems.set(tid, {
            type: "video",
            id: tid,
            url: `video_id:${tid}`,
            filename: filename,
            thumbUrl: poster,
            timeStr: getTimeFromElement(comp),
          });
          hasNew = true;
        }
        break;
      }
    }
  });

  if (hasNew) {
    isDownloadCompleted = false;
    updateUICount();
    saveSession();
  }

  /* ASSERTION: 采集数量上限断言，严格根据当前筛选类型统计项数，达到阈值时平滑停止 */
  const currentCount = activeFilter === "all" ? collectedItems.size : getFilteredItems().length;
  if (scanLimit > 0 && currentCount >= scanLimit) {
    stopScan();
    scanPhase = "idle";
    const categoryName = activeFilter === "image" ? "图片" : (activeFilter === "video" ? "视频" : "全部媒体");
    const probeBar = document.getElementById("x-probe-status-bar");
    if (probeBar) {
      probeBar.style.display = "block";
      probeBar.style.color = "#00ba7c";
      probeBar.style.borderColor = "rgba(0, 186, 124, 0.25)";
      probeBar.style.background = "rgba(0, 186, 124, 0.08)";
      probeBar.innerHTML = `已达到目标【${categoryName}】采集上限 (${currentCount}/${scanLimit})，自动停止！`;
    }
    const btn = document.getElementById("x-btn-start");
    if (btn) {
      btn.innerText = "已达成目标数量";
      btn.classList.remove("stopping");
      btn.disabled = false;
    }
    showToast(`已达成目标采集数量 (${currentCount} 项${categoryName})，自动停止`, "success");
    sendDesktopNotification(
      "X 媒体采集目标达成",
      `已为您成功采集到设定的 ${currentCount} 项${categoryName}，可直接下载！`
    );
    updateUICount();
    return;
  }

  const currentHeight = document.body.scrollHeight;
  const scrollThreshold = 8;
  const probeBar = document.getElementById("x-probe-status-bar");
  const btn = document.getElementById("x-btn-start");

  if (currentHeight - lastScrollHeight > 50) {
    noScrollCount = 0;
    lastScrollHeight = currentHeight;
    if (probeBar) probeBar.style.display = "none";
    window.scrollTo(0, document.body.scrollHeight);
    if (btn) btn.innerText = "停止扫描";
  } else {
    noScrollCount++;
    if (probeBar) {
      probeBar.style.display = "block";
      probeBar.style.color = "#ffd400";
      probeBar.style.borderColor = "rgba(255, 212, 0, 0.25)";
      probeBar.style.background = "rgba(255, 212, 0, 0.08)";
      probeBar.innerHTML = `正在探测是否到底 (${noScrollCount}/${scrollThreshold})... 尝试触发加载`;
    }
    if (btn) btn.innerText = `深度探测中 (${noScrollCount}/${scrollThreshold})`;
    window.scrollBy(0, -220);
    setTimeout(() => {
      window.scrollTo(0, document.body.scrollHeight);
    }, 320);
  }

  if (noScrollCount > scrollThreshold) {
    /* ASSERTION: 仅在【全部】模式且当前为照片阶段触底时，自适应流转至视频分类继续采集；【仅图片/仅视频】触底直接完成，不进行自适应切换 */
    if (activeFilter === "all" && scanPhase === "photos") {
      if (probeBar) {
        probeBar.style.display = "block";
        probeBar.style.color = "#1d9bf0";
        probeBar.style.borderColor = "rgba(29, 155, 240, 0.25)";
        probeBar.style.background = "rgba(29, 155, 240, 0.08)";
        probeBar.innerHTML = "【照片】已全部触底，正在自适应切换至【视频】抓取...";
      }
      showToast("【照片】已全量触底，自动切换至【视频】抓取...", "info");
      if (btn) btn.innerText = "切换至视频采集...";
      scanPhase = "videos";
      noScrollCount = 0;
      lastScrollHeight = 0;

      const switched = await switchToMediaSubTab("video");
      if (switched) {
        window.scrollTo(0, 0);
        setTimeout(scanLoop, 1200);
        return;
      }
    }

    stopScan();
    scanPhase = "idle";
    const categoryName = activeFilter === "image" ? "图片" : (activeFilter === "video" ? "视频" : "所有媒体");
    const count = getFilteredItems().length;
    if (probeBar) {
      probeBar.style.display = "block";
      probeBar.style.color = "#00ba7c";
      probeBar.style.borderColor = "rgba(0, 186, 124, 0.25)";
      probeBar.style.background = "rgba(0, 186, 124, 0.08)";
      probeBar.innerHTML = `已确认到达页面最底部，【${categoryName}】采集完成！`;
      setTimeout(() => {
        if (probeBar) probeBar.style.display = "none";
      }, 4500);
    }
    if (btn) {
      btn.innerText = "已扫描完成";
      btn.classList.remove("stopping");
      btn.disabled = true;
    }
    showToast(`已扫描到底部，${categoryName}采集完毕`, "success");
    sendDesktopNotification(
      "X 媒体采集完成",
      `已扫描到最底部，共采集到 ${count} 项${categoryName}，可随时下载。`
    );
    updateUICount();
    return;
  }

  scanInterval = setTimeout(scanLoop, 1350);
}

function startBatchDownload(downloadMode = "folder") {
  const items = getFilteredItems();
  if (items.length === 0) {
    showToast("当前筛选列表为空", "warn");
    return;
  }

  isDownloading = true;
  isDownloadCompleted = false;

  const userId = getFolderName();
  const folderName = userId;
  const itemsArray = [];

  items.forEach((item) => {
    /* ASSERTION: 文件名严格按照系统默认名字命名（例如 HRIY8mKasAArHj3.png） */
    const filename = getMediaFilename(item);
    itemsArray.push({
      url: item.url,
      type: item.type,
      id: item.id,
      filename: filename,
    });
  });

  chrome.runtime.sendMessage({
    action: "batchDownload",
    items: itemsArray,
    userId: userId,
    folderName: folderName,
    downloadMode: downloadMode,
  });

  localStorage.removeItem(`x_backup_${userId}`);
  const modeText = downloadMode === "direct" ? "直接保存" : `文件夹 ${folderName}/`;
  showToast(`已开始批量下载 ${items.length} 项（${modeText}）`, "info");
  sendDesktopNotification(
    "批量下载已开始",
    `共 ${items.length} 项媒体已加入下载队列（${modeText}）`
  );

  const execBtn = document.getElementById("x-btn-execute");
  const btnTextEl = document.getElementById("x-btn-execute-text");
  if (btnTextEl) btnTextEl.innerText = "正在下载中...";
  if (execBtn) {
    execBtn.disabled = true;
    execBtn.style.opacity = "0.65";
    execBtn.style.cursor = "not-allowed";
  }

  /* ASSERTION: 点击下载立即在下方展开进度条并初始化真实进度显示 */
  setProgress(true, `正在保存: 0/${items.length} (0%)`, 0);
}
