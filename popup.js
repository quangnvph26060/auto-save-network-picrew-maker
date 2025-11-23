const btn = document.getElementById('toggle-btn');
const statusText = document.getElementById('status-text');
const counterText = document.getElementById('counter-text');
const resetBtn = document.getElementById('reset-btn');
const folderInput = document.getElementById('folder-input');
const saveFolderBtn = document.getElementById('save-folder-btn');
const currentFolderText = document.getElementById('current-folder');

// Picrew elements
const picrewInfo = document.getElementById('picrew-info');
const picrewMaker = document.getElementById('picrew-maker');
const picrewColor = document.getElementById('picrew-color');
const picrewColorPreview = document.getElementById('picrew-color-preview');

// Lấy trạng thái hiện tại từ bộ nhớ
chrome.storage.local.get(['isEnabled', 'fileCounter', 'folderName', 'picrewMakerID', 'picrewColorHex', 'isPicrewMode'], (result) => {
    updateUI(result.isEnabled);
    updateCounter(result.fileCounter || 1);

    const savedFolder = result.folderName || 'AutoCaptured';
    if (folderInput) folderInput.value = savedFolder;
    if (currentFolderText) currentFolderText.textContent = savedFolder;

    // Update Picrew info if available
    if (result.isPicrewMode && result.picrewMakerID && result.picrewColorHex) {
        updatePicrewInfo(result.picrewMakerID, result.picrewColorHex);
    } else {
        // Nếu không ở Picrew Mode, hiển thị lại input folder
        restoreFolderInput();
    }
});

// Lắng nghe thay đổi counter và Picrew info từ background
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.fileCounter) {
        updateCounter(changes.fileCounter.newValue);
    }
    if (changes.folderName) {
        if (currentFolderText) currentFolderText.textContent = changes.folderName.newValue;
    }

    // Check for Picrew updates
    if (changes.isPicrewMode || changes.picrewMakerID || changes.picrewColorHex) {
        // Lấy lại toàn bộ giá trị mới nhất để đảm bảo đồng bộ
        chrome.storage.local.get(['isPicrewMode', 'picrewMakerID', 'picrewColorHex'], (data) => {
            if (data.isPicrewMode && data.picrewMakerID && data.picrewColorHex) {
                updatePicrewInfo(data.picrewMakerID, data.picrewColorHex);
            } else {
                // Nếu không ở Picrew Mode nữa, khôi phục input folder
                restoreFolderInput();
            }
        });
    }
});

// Nút LƯU thư mục
if (saveFolderBtn) {
    saveFolderBtn.addEventListener('click', () => {
        let folderName = folderInput.value.trim();
        // Nếu để trống, dùng mặc định
        if (!folderName) {
            folderName = 'AutoCaptured';
            folderInput.value = folderName;
        }

        // Lưu vào storage
        chrome.storage.local.set({ folderName: folderName }, () => {
            currentFolderText.textContent = folderName;

            // Hiệu ứng nút Lưu
            saveFolderBtn.textContent = '✅ Đã lưu!';
            setTimeout(() => {
                saveFolderBtn.textContent = '💾 Lưu';
            }, 1500);
        });
    });
}

// Nút BẬT/TẮT - TỰ ĐỘNG RESET VỀ 1 KHI TẮT
if (btn) {
    btn.addEventListener('click', () => {
        chrome.storage.local.get(['isEnabled'], (result) => {
            const newState = !result.isEnabled;

            // Nếu đang TẮT extension (newState = false), reset counter về 1
            if (!newState) {
                chrome.storage.local.set({
                    isEnabled: newState,
                    fileCounter: 1  // Reset về 1 khi tắt
                });
                updateCounter(1);
            } else {
                // Nếu BẬT, chỉ lưu trạng thái
                chrome.storage.local.set({ isEnabled: newState });
            }

            updateUI(newState);
        });
    });
}

// Nút RESET counter
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        // Reset counter về 1
        chrome.storage.local.set({ fileCounter: 1 });
        updateCounter(1);
    });
}

function updateUI(isOn) {
    if (!btn || !statusText) return;

    if (isOn) {
        btn.textContent = "TẮT ĐI";
        btn.className = "on";
        statusText.textContent = "Extension đang: CHẠY";
    } else {
        btn.textContent = "BẬT LÊN";
        btn.className = "off";
        statusText.textContent = "Extension đang: NGỦ";
    }
}

function updateCounter(count) {
    if (counterText) counterText.textContent = count;
}

function updatePicrewInfo(makerID, colorHex) {
    if (!picrewMaker || !picrewColor || !picrewColorPreview || !picrewInfo) return;

    picrewMaker.textContent = makerID;
    picrewColor.textContent = colorHex;
    picrewColorPreview.style.background = `#${colorHex}`;

    // Show data, hide placeholder
    const dataElem = document.getElementById('picrew-data');
    const placeholderElem = document.getElementById('picrew-placeholder');

    if (dataElem) dataElem.style.display = 'block';
    if (placeholderElem) placeholderElem.style.display = 'none';
    picrewInfo.style.display = 'block';

    // Update current folder display
    if (currentFolderText) currentFolderText.textContent = `Maker_${makerID}/${colorHex}`;

    // Ẩn phần "Tên thư mục" khi ở Picrew Mode (vì dùng folder tự động)
    const folderSection = document.querySelectorAll('.section')[1]; // Section thứ 2 chứa folder input
    if (folderSection) {
        const folderLabel = folderSection.querySelector('label[for="folder-input"]');
        const folderRow = folderSection.querySelector('.folder-row');
        
        if (folderLabel) folderLabel.style.display = 'none';
        if (folderRow) folderRow.style.display = 'none';
        
        // Thay đổi text "Đang lưu vào" thành "Tự động lưu vào" khi ở Picrew Mode
        const folderStatus = folderSection.querySelector('.folder-status');
        if (folderStatus) {
            // Giữ nguyên structure, chỉ thay đổi text
            folderStatus.innerHTML = '🎨 <strong>Picrew Mode:</strong> Tự động lưu vào: <strong id="current-folder">Maker_' + makerID + '/' + colorHex + '</strong>';
        }
    }
}

// Hàm khôi phục phần "Tên thư mục" khi không ở Picrew Mode
function restoreFolderInput() {
    const folderSection = document.querySelectorAll('.section')[1]; // Section thứ 2 chứa folder input
    if (folderSection) {
        const folderLabel = folderSection.querySelector('label[for="folder-input"]');
        const folderRow = folderSection.querySelector('.folder-row');
        
        if (folderLabel) folderLabel.style.display = 'block';
        if (folderRow) folderRow.style.display = 'flex';
        
        // Khôi phục text "Đang lưu vào" bình thường
        const folderStatus = folderSection.querySelector('.folder-status');
        if (folderStatus) {
            chrome.storage.local.get(['folderName'], (result) => {
                const folderName = result.folderName || 'AutoCaptured';
                folderStatus.innerHTML = 'Đang lưu vào: <strong id="current-folder">' + folderName + '</strong>';
            });
        }
    }
}

// Auto Crawl Button
const autoCrawlBtn = document.getElementById('auto-crawl-btn');
const crawlStatus = document.getElementById('crawl-status');
const autoNextItemCheckbox = document.getElementById('auto-next-item');

if (autoCrawlBtn) {
    autoCrawlBtn.addEventListener('click', () => {
        const autoNext = autoNextItemCheckbox ? autoNextItemCheckbox.checked : false;
        
        if (crawlStatus) {
            if (autoNext) {
                crawlStatus.textContent = "Đang tải TẤT CẢ Item... (Đừng đóng tab Picrew)";
            } else {
                crawlStatus.textContent = "Đang chạy... (Đừng đóng tab Picrew)";
            }
            crawlStatus.style.color = "#e65100";
        }

        // Gửi lệnh tới content script của tab hiện tại
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    type: 'START_CRAWL',
                    autoNextItem: autoNext
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        if (crawlStatus) {
                            crawlStatus.textContent = "Lỗi: Hãy reload trang Picrew";
                            crawlStatus.style.color = "red";
                        }
                    } else {
                        console.log("Crawl started", autoNext ? "(with auto-next)" : "");
                    }
                });
            }
        });
    });
}