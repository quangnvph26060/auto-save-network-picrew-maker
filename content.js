// Content Script - Chạy trên trang Picrew
// Logic: Detect active layer và đếm items trong layer đó

let makerID = null;
let currentLayerName = null;
let currentLayerItemCount = 0;
let isCrawling = false;

// ==========================================
// CORE FUNCTIONS: Layer Detection
// ==========================================

// Lấy Maker ID từ URL
function getMakerID() {
    const match = window.location.pathname.match(/\/image_maker\/(\d+)/);
    return match ? match[1] : null;
}

// Lấy layer đang active trong splide01-list
function getCurrentActiveLayer() {
    return document.querySelector('ul#splide01-list > li.splide__slide.is-active.is-visible');
}

// Lấy tên layer từ element
function getLayerName(layerElement) {
    if (!layerElement) return 'Unknown Layer';

    // Lấy data-key hoặc ID từ layer
    const dataKey = layerElement.getAttribute('data-key');
    if (dataKey) return dataKey;

    // Fallback: lấy từ text content hoặc aria-label
    const label = layerElement.getAttribute('aria-label');
    if (label) return label;

    const id = layerElement.getAttribute('id');
    if (id) return id;

    return 'Unknown Layer';
}

// Đếm số items trong layer active
function getItemCountInActiveLayer() {
    const activeLayer = getCurrentActiveLayer();
    if (!activeLayer) return 0;

    // Tìm .simplebar-content > ul > li trong layer active
    const items = activeLayer.querySelectorAll('.simplebar-content > ul > li');
    return items.length;
}

// Lấy danh sách items trong layer active
function getItemsInActiveLayer() {
    const activeLayer = getCurrentActiveLayer();
    if (!activeLayer) return [];

    const items = activeLayer.querySelectorAll('.simplebar-content > ul > li');
    return Array.from(items);
}

// Theo dõi thay đổi class is-active is-visible khi user scroll/lướt layer
// THÊM RETRY LOGIC để đợi DOM load xong
function observeLayerChanges(retryCount = 0) {
    // Log frame info để debug
    if (retryCount === 0) {
        console.log(`🏁 Script running at: ${window.location.href}`);
    }

    // Strategy 1: Try ID directly (Fastest)
    let splideList = document.getElementById('splide01-list');

    // Strategy 2: Try Query Selector ID
    if (!splideList) {
        splideList = document.querySelector('ul#splide01-list');
    }

    // Strategy 3: Try Class
    if (!splideList) {
        splideList = document.querySelector('ul.splide__list'); // Correct class name from screenshot
    }

    // Strategy 4: Find parent of slides
    if (!splideList) {
        const slide = document.querySelector('li.splide__slide');
        if (slide) {
            splideList = slide.parentElement;
            console.log('💡 Found splide list via child slide!');
        }
    }

    if (!splideList) {
        // Tăng thời gian retry lên 60 lần (30 giây) vì game load chậm
        if (retryCount < 60) {
            if (retryCount % 5 === 0) { // Log mỗi 5 lần thử để đỡ spam
                console.log(`⏳ [${retryCount}/60] Đang tìm ul#splide01-list...`);
            }
            setTimeout(() => observeLayerChanges(retryCount + 1), 500);
            return;
        }

        console.warn('❌ Đã thử 60 lần (30s) mà vẫn không thấy ul#splide01-list');
        console.warn(`🌍 URL hiện tại: ${window.location.href}`);
        console.warn('📸 Vui lòng kiểm tra xem extension có đang chạy đúng frame không.');
        return;
    }

    console.log('✅ Đã tìm thấy splide list:', splideList);
    console.log('👀 Bắt đầu observe layer changes...');

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList.contains('is-active') && target.classList.contains('is-visible')) {
                    // Layer mới được active
                    console.log('✨ Detected layer class change!');
                    onLayerChanged();
                }
            }
        });
    });

    // Observe tất cả li.splide__slide
    const slides = splideList.querySelectorAll('li.splide__slide');
    console.log(`🔍 Đang observe ${slides.length} slides...`);

    slides.forEach(slide => {
        observer.observe(slide, {
            attributes: true,
            attributeFilter: ['class']
        });
    });
}

// ==========================================
// COLOR DETECTION (OLD LOGIC - KEEP FOR NOW)
// ==========================================

function rgbToHex(rgb) {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);

    return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
}

function detectSelectedColor() {
    const selectedLi = document.querySelector('li.selected[data-key]');
    if (!selectedLi) return null;

    if (!selectedLi.style.background) return null;

    const bgStyle = selectedLi.style.background;
    const hexColor = rgbToHex(bgStyle);

    return {
        hex: hexColor,
        rgb: bgStyle,
        dataKey: selectedLi.getAttribute('data-key')
    };
}

function sendColorInfo(itemName = null) {
    const color = detectSelectedColor();
    const maker = getMakerID();

    if (color && maker) {
        try {
            chrome.runtime.sendMessage({
                type: 'COLOR_SELECTED',
                makerID: maker,
                color: color,
                itemName: itemName || currentLayerName,
                layerName: currentLayerName,
                hasColorPalette: true
            });
        } catch (e) {
            console.warn("⚠️ Failed to send color info:", e.message);
        }
    }
}

// ==========================================
// AUTO CRAWL LOGIC
// ==========================================

async function startAutoCrawl() {
    if (isCrawling) {
        console.log('⚠️ Đang crawl rồi, vui lòng đợi...');
        return;
    }

    isCrawling = true;

    console.log('🚀 Bắt đầu auto crawl...');
    console.log(`📍 Layer hiện tại: ${currentLayerName}`);
    console.log(`🔢 Số items: ${currentLayerItemCount}`);

    // Bật crawling mode
    try {
        chrome.runtime.sendMessage({ type: 'START_CRAWLING' });
    } catch (e) {
        console.warn("⚠️ Không thể bật crawling mode:", e.message);
    }

    const items = getItemsInActiveLayer();

    if (items.length === 0) {
        console.log('⚠️ Không có items trong layer này');
        isCrawling = false;
        return;
    }

    // Đếm số items hợp lệ (không phải remove_item và không phải pi-id)
    const validItems = items.filter(item => {
        const isRemove = item.classList.contains('remove_item');
        const isPiId = item.classList.contains('pi-id');
        return !isRemove && !isPiId;
    });

    console.log(`✅ Số items hợp lệ: ${validItems.length}/${items.length}`);

    // Kiểm tra: nếu chỉ có 1 item hợp lệ và không có class pi-id
    const shouldSkipColorFolders = validItems.length === 1 && !validItems[0].classList.contains('pi-id');

    if (shouldSkipColorFolders) {
        console.log('🎯 Chỉ có 1 item không phải pi-id → Tải trực tiếp vào folder item, không chia folder màu');
    }

    // Lặp qua từng item
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const dataKey = item.getAttribute('data-key');
        const isRemove = item.classList.contains('remove_item');

        // Bỏ qua remove_item hoặc pi-id
        if (isRemove || item.classList.contains('pi-id')) {
            console.log(`⏭️ Bỏ qua item ${i + 1}/${items.length} (Skipped: remove_item or pi-id)`);
            continue;
        }

        console.log(`📥 Đang tải item ${i + 1}/${items.length}: ${dataKey}`);

        // Click vào item
        item.click();

        // Đợi ảnh render
        await new Promise(r => setTimeout(r, 1500));

        // Kiểm tra và tải màu (nếu có)
        const colors = scanColors();
        if (colors.length > 0) {
            console.log(`🎨 Tìm thấy ${colors.length} màu cho item này`);
            if (shouldSkipColorFolders) {
                console.log(`📷 Tải tất cả màu trực tiếp vào folder layer (không chia folder màu)`);
                await crawlColorsWithoutFolders(colors, currentLayerName);
            } else {
                await crawlColors(colors, currentLayerName);
            }
        } else {
            console.log(`📷 Item không có màu, chỉ tải 1 ảnh`);
        }
    }

    // Tắt crawling mode
    isCrawling = false;
    try {
        chrome.runtime.sendMessage({ type: 'STOP_CRAWLING' });
    } catch (e) { }

    alert(`✅ Đã tải xong layer: ${currentLayerName} (${items.length} items)!`);
    console.log('🎉 Hoàn thành auto crawl!');
}

// Quét màu
function scanColors() {
    let colorUl = document.querySelector('.imagemaker_colorBox .simplebar-content ul');
    let colors = [];

    if (colorUl) {
        const lis = Array.from(colorUl.querySelectorAll('li[data-key]'));
        colors = lis.filter(li => {
            const bg = li.style.background;
            return bg && bg.includes('rgb');
        });
    }

    return colors;
}

// Crawl qua tất cả màu
async function crawlColors(colors, itemName) {
    const processedColors = new Set();

    for (let i = 0; i < colors.length; i++) {
        const colorLi = colors[i];
        const bgStyle = colorLi.style.background;
        const hexColor = rgbToHex(bgStyle);

        if (processedColors.has(hexColor)) {
            console.log(`⏭️ Bỏ qua màu trùng: ${hexColor}`);
            continue;
        }

        processedColors.add(hexColor);
        console.log(`🎨 Đang tải màu ${i + 1}/${colors.length}: ${hexColor}`);

        // Click màu
        colorLi.click();

        // Gửi color info
        sendColorInfo(itemName);

        // Đợi ảnh render
        await new Promise(r => setTimeout(r, 1500));
    }
}

// Crawl qua tất cả màu NHƯNG không tạo folder màu (tải trực tiếp vào folder item)
async function crawlColorsWithoutFolders(colors, itemName) {
    const processedColors = new Set();
    const maker = getMakerID();

    // Gửi message báo cho background: KHÔNG tạo folder màu
    try {
        chrome.runtime.sendMessage({
            type: 'COLOR_SELECTED',
            makerID: maker,
            color: { hex: null }, // Không gửi màu
            itemName: itemName || currentLayerName,
            layerName: currentLayerName,
            hasColorPalette: false // Quan trọng: báo không có bảng màu
        });
    } catch (e) {
        console.warn("⚠️ Failed to send no-color-folder info:", e.message);
    }

    for (let i = 0; i < colors.length; i++) {
        const colorLi = colors[i];
        const bgStyle = colorLi.style.background;
        const hexColor = rgbToHex(bgStyle);

        if (processedColors.has(hexColor)) {
            console.log(`⏭️ Bỏ qua màu trùng: ${hexColor}`);
            continue;
        }

        processedColors.add(hexColor);
        console.log(`🎨 Đang tải màu ${i + 1}/${colors.length}: ${hexColor} (không chia folder)`);

        // Click màu
        colorLi.click();

        // Đợi ảnh render
        await new Promise(r => setTimeout(r, 1500));

        // Không cần gửi color info vì đã set hasColorPalette = false ở trên
    }
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_CRAWL') {
        startAutoCrawl();
    }
    return true;
});

// ==========================================
// NEW LOGIC: Layer & Color Change Detection
// ==========================================

function onLayerChanged() {
    const activeLayer = getCurrentActiveLayer();
    if (!activeLayer) return;

    currentLayerName = getLayerName(activeLayer);
    currentLayerItemCount = getItemCountInActiveLayer();

    console.log(`🔄 Layer changed: ${currentLayerName} (${currentLayerItemCount} items)`);

    // Add click listeners to items in this layer
    addClickListenersToItems(activeLayer);

    // Initial check (Wait for UI to update color box)
    setTimeout(() => {
        checkAndLogColors();
    }, 300);

    try {
        chrome.runtime.sendMessage({
            type: 'LAYER_CHANGED',
            layerName: currentLayerName,
            itemCount: currentLayerItemCount,
            colorCount: 0
        });
    } catch (e) { }
}

function addClickListenersToItems(layer) {
    const items = layer.querySelectorAll('.simplebar-content > ul > li');
    items.forEach(item => {
        // Remove old listeners to avoid duplicates (optional, but good practice if called multiple times)
        // Since we can't easily remove anonymous functions, we'll just add new ones. 
        // A better approach is event delegation, but direct listener is fine for now.
        item.addEventListener('click', () => {
            // Wait for Picrew to update the color box
            setTimeout(() => {
                checkAndLogColors(item);
            }, 100); // 100ms delay
        });
    });
}

function checkAndLogColors(clickedItem = null) {
    // Log danh sách màu để debug theo yêu cầu
    const colorUl = document.querySelector('.imagemaker_colorBox .simplebar-content ul');
    if (colorUl) {
        const hasEmptyColor = colorUl.querySelector('li.emptycolor');
        if (hasEmptyColor) {
            console.log('🎨 Item này không có màu (Found li.emptycolor)');
        } else {
            console.log('🎨 Danh sách màu (ul) hiện tại:', colorUl);
        }
    }

    const colors = scanColors();
    const colorCount = colors.length;
    const colorHexList = colors.map(li => rgbToHex(li.style.background));

    console.log('🎨 Colors found:', colorCount, colorHexList);

    if (clickedItem) {
        const dataKey = clickedItem.getAttribute('data-key');
        console.log(`👉 Item clicked: ${dataKey}. Colors available: ${colorCount}`);
    }

    // Send to background
    try {
        chrome.runtime.sendMessage({
            type: 'COLORS_DETECTED',
            count: colorCount,
            colors: colorHexList,
            hasColors: colorCount > 0
        });
    } catch (e) { }
}

// ==========================================
// INITIALIZATION
// ==========================================

function init() {
    makerID = getMakerID();
    if (!makerID) {
        console.log('⚠️ Không phải trang Picrew Maker');
        return;
    }

    console.log('═══════════════════════════════════════════════');
    console.log('🎨 Picrew Extension loaded for Maker:', makerID);
    console.log('═══════════════════════════════════════════════');

    // Bắt đầu observe layer changes (với retry logic)
    observeLayerChanges();

    // Detect layer hiện tại ngay khi load (đợi lâu hơn để đảm bảo DOM load xong)
    setTimeout(() => {
        onLayerChanged();
    }, 2000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('🎨 Picrew Layer Detector đã được tải!');
