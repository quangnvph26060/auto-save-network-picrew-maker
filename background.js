// Biến lưu trạng thái bật/tắt
let isEnabled = false;
let fileCounter = 1; // Counter cho việc đặt tên file
let folderName = 'AutoCaptured'; // Tên thư mục mặc định

// Biến cho Picrew auto-detect
let currentMakerID = null;
let currentColorHex = null;
let currentItemName = null; // Tên item (ví dụ: "Mũi", "Mắt"...)
let currentLayerName = null; // Tên layer con (nếu có)
let isPicrewMode = false; // True khi đang ở trang Picrew
let isCrawling = false; // True khi đang trong quá trình auto crawl
let hasColorPalette = true; // True nếu Item có bảng màu, False nếu không có
let currentLayerItemCount = 0; // Số lượng items trong layer hiện tại

// Track counter cho mỗi folder màu
let folderCounters = {}; // { "Maker_123/Item/COLOR": 3 }

// 1. LẮNG NGHE MESSAGE TỪ CONTENT SCRIPT (Picrew color detection)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'COLOR_SELECTED') {
    console.log("📩 Received COLOR_SELECTED:", message); // Debug log

    currentMakerID = message.makerID;
    currentColorHex = message.color.hex;
    currentItemName = message.itemName || null;
    currentLayerName = message.layerName || null;
    hasColorPalette = message.hasColorPalette !== false; // Mặc định true nếu không có thông tin
    isPicrewMode = true;

    console.log(`✅ Activated Picrew Mode: Maker ${currentMakerID}, Item: ${currentItemName || 'N/A'}, Layer: ${currentLayerName || 'N/A'}, Color ${currentColorHex}, Has Color Palette: ${hasColorPalette}`);

    // Gửi update cho popup và lưu trạng thái Picrew Mode
    chrome.storage.local.set({
      picrewMakerID: currentMakerID,
      picrewColorHex: currentColorHex,
      picrewItemName: currentItemName,
      picrewLayerName: currentLayerName,
      hasColorPalette: hasColorPalette,
      isPicrewMode: true // Lưu trạng thái này để Popup biết
    });
  }

  // Message để reset counter khi bắt đầu layer mới
  if (message.type === 'RESET_COUNTER') {
    console.log("🔄 Reset counter về 1 (bắt đầu layer mới)");
    fileCounter = 1;
    chrome.storage.local.set({ fileCounter: 1 });
  }

  // Message để bắt đầu/dừng crawl
  if (message.type === 'START_CRAWLING') {
    isCrawling = true;
    console.log("🚀 Bắt đầu crawling mode");
  }

  if (message.type === 'STOP_CRAWLING') {
    isCrawling = false;
    console.log("⏹️ Dừng crawling mode");
  }

  // Message để nhận thông tin layer từ content script
  if (message.type === 'LAYER_CHANGED') {
    currentLayerName = message.layerName;
    currentLayerItemCount = message.itemCount;

    console.log(`📊 Layer: ${currentLayerName}, Items: ${currentLayerItemCount}, Colors: ${message.colorCount}`);

    // Lưu vào storage để popup có thể đọc
    chrome.storage.local.set({
      currentLayerName: currentLayerName,
      currentLayerItemCount: currentLayerItemCount,
      currentLayerColorCount: message.colorCount || 0
    });
  }
});

// 2. Lắng nghe thay đổi từ nút Bật/Tắt ở Popup
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.isEnabled) {
    isEnabled = changes.isEnabled.newValue;
    updateIcon();
  }
  if (changes.fileCounter) {
    fileCounter = changes.fileCounter.newValue;
  }
  if (changes.folderName) {
    folderName = changes.folderName.newValue;
  }
});

// Lấy trạng thái ban đầu khi khởi động
chrome.storage.local.get(['isEnabled', 'fileCounter', 'folderName', 'isPicrewMode', 'picrewMakerID', 'picrewColorHex', 'picrewItemName', 'picrewLayerName'], (result) => {
  isEnabled = result.isEnabled || false;
  fileCounter = result.fileCounter || 1;
  folderName = result.folderName || 'AutoCaptured';

  // Restore Picrew Mode state
  if (result.isPicrewMode) {
    isPicrewMode = true;
    currentMakerID = result.picrewMakerID;
    currentColorHex = result.picrewColorHex;
    currentItemName = result.picrewItemName || null;
    currentLayerName = result.picrewLayerName || null;
    console.log(`♻️ Restored Picrew Mode: Maker ${currentMakerID}, Item: ${currentItemName || 'N/A'}, Layer: ${currentLayerName || 'N/A'}, Color ${currentColorHex}`);
  }

  updateIcon();
});

function updateIcon() {
  chrome.action.setBadgeText({ text: isEnabled ? "ON" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: isEnabled ? "#4caf50" : "#f44336" });
}

// 3. Hàm tạo folder path động
function getFolderPath() {
  if (isPicrewMode && currentMakerID) {
    // Chế độ Picrew: Maker_{ID}/{ItemName}/[{ColorHex}/]
    let path = `Maker_${currentMakerID}`;

    // Thêm tên Item nếu có
    if (currentItemName) {
      // Làm sạch tên item (loại bỏ ký tự đặc biệt không hợp lệ cho tên folder)
      const cleanItemName = currentItemName.replace(/[<>:"/\\|?*]/g, '_').trim();
      path += `/${cleanItemName}`;
    }

    // Chỉ thêm folder màu nếu Item CÓ bảng màu
    if (hasColorPalette && currentColorHex) {
      path += `/${currentColorHex}`;
    }
    // Nếu KHÔNG có bảng màu → lưu trực tiếp vào folder Item

    return path;
  } else {
    // Chế độ thường: Dùng folderName từ popup
    return folderName;
  }
}

// Hàm lấy counter cho folder hiện tại
function getCounterForFolder(folderPath) {
  if (!folderCounters[folderPath]) {
    folderCounters[folderPath] = 1;
  }
  return folderCounters[folderPath];
}

// Hàm tăng counter cho folder
function incrementCounterForFolder(folderPath) {
  if (!folderCounters[folderPath]) {
    folderCounters[folderPath] = 1;
  }
  folderCounters[folderPath]++;

  // Cập nhật UI counter (hiển thị counter của folder hiện tại)
  fileCounter = folderCounters[folderPath];
  chrome.storage.local.set({ fileCounter: fileCounter });
}

// 4. LẮNG NGHE REQUEST MẠNG
chrome.webRequest.onCompleted.addListener(
  function (details) {
    // Nếu chưa bật công tắc hoặc không đang crawl thì bỏ qua
    if (!isEnabled || !isCrawling) return;

    // Chỉ bắt các request là hình ảnh
    if (details.type === 'image' || details.type === 'xmlhttprequest') {

      const url = details.url;

      // Lọc thêm: Chỉ tải file có đuôi ảnh (png, jpg, webp)
      if (url.match(/\.(png)/i)) {

        // Bỏ qua các icon nhỏ hoặc file svg giao diện
        if (url.includes('icon') || url.includes('logo')) return;

        console.log("Phát hiện ảnh mới:", url);

        // Lấy folder path (tự động hoặc thủ công)
        const targetFolder = getFolderPath();

        // Lấy counter riêng cho folder này
        const currentCounter = getCounterForFolder(targetFolder);

        // Lấy extension từ URL
        const extension = getFileExtension(url);
        const newFilename = `${currentCounter}.${extension}`;
        const fullPath = targetFolder + "/" + newFilename;

        // Log để debug
        console.log(`📁 Folder path: ${targetFolder}`);
        console.log(`🔢 Counter cho folder này: ${currentCounter}`);
        console.log(`💾 Full path: ${fullPath}`);

        // Thực hiện tải về (Chrome sẽ tự động tạo folder nếu chưa tồn tại)
        chrome.downloads.download({
          url: url,
          filename: fullPath,
          conflictAction: "uniquify",
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            // console.error("❌ Download error:", chrome.runtime.lastError.message);
          } else if (downloadId) {
            console.log(`✅ Download started: ${fullPath} (ID: ${downloadId})`);
            // Tăng counter cho folder này
            incrementCounterForFolder(targetFolder);
          }
        });
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// Hàm lấy extension từ URL
function getFileExtension(url) {
  let filename = url.substring(url.lastIndexOf('/') + 1);

  if (filename.indexOf('?') > -1) {
    filename = filename.substring(0, filename.indexOf('?'));
  }

  const match = filename.match(/\.(png)/i);
  if (match) {
    return match[1].toLowerCase();
  }

  return 'jpg';
}