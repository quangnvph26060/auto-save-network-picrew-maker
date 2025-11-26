// Content Script - Chạy trên trang Picrew
// Logic: Auto Download All Colors for Current Item (Robust Version with Specific Selector)

let currentColor = null;
let makerID = null;
let isCrawling = false;
let autoNextItem = false; // Flag để bật/tắt tự động chuyển item
let currentItemName = null; // Tên item hiện tại (ví dụ: "Mũi", "Mắt"...)
let currentLayerName = null; // Tên layer hiện tại
let lastProcessedItem = null; // Lưu item đã xử lý để biết khi nào chuyển item mới

// Lấy Maker ID từ URL
function getMakerID() {
    const match = window.location.pathname.match(/\/image_maker\/(\d+)/);
    return match ? match[1] : null;
}

// Lấy tên Item hiện tại đang được chọn
function getCurrentItemName() {
    // Tìm item đang selected
    const selectedItem = getCurrentSelectedItem();
    if (!selectedItem) return null;

    // Dùng data-key làm tên Item (vì Picrew không cung cấp tên text)
    const dataKey = selectedItem.getAttribute('data-key');
    if (dataKey) {
        return dataKey;
    }

    // Fallback: Dùng index nếu không có data-key
    const items = getAllItems();
    const index = items.indexOf(selectedItem);
    return `Item_${index + 1}`;
}

// Lấy tên Layer hiện tại (nếu có nhiều layer cho 1 item)
function getCurrentLayerName() {
    // Tìm các layer con của item hiện tại
    // Layer thường là các option con bên trong item
    const selectedItem = getCurrentSelectedItem();
    if (!selectedItem) return null;

    // Kiểm tra xem có sub-items/layers không
    const layerContainer = selectedItem.closest('[class*="layer"], [class*="sub"], [class*="option"]');
    if (layerContainer) {
        // Tìm layer đang active
        const activeLayer = layerContainer.querySelector('.active, .selected, [class*="active"]');
        if (activeLayer) {
            // Lấy tên layer
            if (activeLayer.title) return activeLayer.title;
            if (activeLayer.getAttribute('aria-label')) return activeLayer.getAttribute('aria-label');
            if (activeLayer.textContent?.trim()) return activeLayer.textContent.trim();
        }
    }

    // Nếu không có layer, trả về null (sẽ dùng "default" hoặc bỏ qua)
    return null;
}

// Chuyển RGB sang HEX
function rgbToHex(rgb) {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);

    return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
}

// Phát hiện màu đang chọn
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

// Gửi thông tin về background script
function sendColorInfo() {
    const color = detectSelectedColor();
    const maker = getMakerID();

    if (color && maker) {
        try {
            chrome.runtime.sendMessage({
                type: 'COLOR_SELECTED',
                makerID: maker,
                color: color
            });
            currentColor = color.hex;
            makerID = maker;
        } catch (e) {
            console.warn("⚠️ Failed to send color info:", e.message);
        }
    }
}

// Lắng nghe thay đổi màu
function observeColorChanges() {
    // KHÔNG tự động gửi màu khi load trang
    // Chỉ gửi khi đang trong quá trình crawl (trong startAutoCrawl)

    // KHÔNG lắng nghe click màu tự động nữa
    // Màu sẽ được xử lý trong vòng lặp startAutoCrawl

    console.log("ℹ️ observeColorChanges đã bị vô hiệu hóa - chỉ tải khi bấm nút");
}

// ==========================================
// AUTO CRAWLER LOGIC (Robust Color Detection)
// ==========================================

// Hàm quét và log màu (Tách riêng để gọi lúc khởi động)
function scanAndLogColors(isAuto = false) {
    console.log("🔍 Đang quét bảng màu...");

    // 1. Lấy danh sách MÀU (Zone 3)
    // Chiến thuật: Dùng Selector chính xác từ User cung cấp
    // .imagemaker_colorBox .simplebar-content ul

    let colorUl = document.querySelector('.imagemaker_colorBox .simplebar-content ul');
    let colors = [];

    if (colorUl) {
        // Lấy các li trực tiếp của ul này
        const lis = Array.from(colorUl.querySelectorAll('li[data-key]'));

        // Lọc ra các li có background rgb
        colors = lis.filter(li => {
            const bg = li.style.background;
            return bg && bg.includes('rgb');
        });

        if (colors.length > 0) {
            console.log("✅ Đã tìm thấy bảng màu qua Selector cụ thể!");
        }
    }

    if (colors.length === 0) {
        // Fallback: Quét tất cả UL như cũ
        const allUls = Array.from(document.querySelectorAll('ul'));
        for (const ul of allUls) {
            const lis = Array.from(ul.querySelectorAll('li[data-key]'));
            const colorLis = lis.filter(li => {
                const bg = li.style.background;
                return bg && bg.includes('rgb');
            });
            if (colorLis.length >= 2) { // Yêu cầu ít nhất 2 màu để chắc chắn
                colors = colorLis;
                console.log("✅ Đã tìm thấy bảng màu qua quét:", ul);
                if (colors.length > 1) break;
            }
        }
    }

    // LOG RA CÁC MÃ MÀU (Theo yêu cầu)
    if (colors.length > 0) {
        console.group("🌈 Các màu đã phát hiện (Sẵn sàng tải):");
        colors.forEach((li, index) => {
            const bg = li.style.background;
            const hex = rgbToHex(bg);
            console.log(`${index + 1}. RGB: ${bg} -> HEX: ${hex}`);
        });
        console.groupEnd();
        if (isAuto) {
            console.log("✅ Đã tự động phát hiện bảng màu.");
        }

        // LOG RA CÁC LAYER (Nếu có)
        const layers = getAllLayers();
        if (layers.length > 0) {
            console.group("📋 Các Layer trong Slide hiện tại:");
            layers.forEach((layer, index) => {
                const dataKey = layer.getAttribute('data-key');
                const isSelected = layer.classList.contains('selected');
                const title = layer.title || layer.getAttribute('aria-label') || 'N/A';
                console.log(`${index + 1}. data-key="${dataKey}" | đã chọn=${isSelected} | tên="${title}"`);
            });
            console.groupEnd();

            // Log layer hiện tại
            const currentLayer = layers.find(l => l.classList.contains('selected'));
            if (currentLayer) {
                const layerName = getCurrentLayerName();
                console.log(`✅ Layer hiện tại: ${layerName || 'N/A'} (data-key: ${currentLayer.getAttribute('data-key')})`);
            } else {
                console.log("⚠️ Chưa có layer nào được chọn");
            }
        } else {
            console.log("ℹ️ Không phát hiện layer (item chỉ có 1 layer)");
        }

        // CHỈ gửi màu về background khi đang crawl (không tự động gửi khi load trang)
        // Màu sẽ được gửi trong vòng lặp startAutoCrawl
    } else {
        if (isAuto) {
            console.log("⏳ Đang chờ chọn Item... (Vui lòng chọn một Item)");
        } else {
            console.log("⚠️ Không tìm thấy bảng màu. Vui lòng chọn Item trước.");
        }
    }

    return colors;
}

// Hàm tìm danh sách tất cả các Item (không phải màu, không phải layer)
function getAllItems() {
    // Item ở hàng 2: Không nằm trong splide__slide, không phải màu
    const allItems = [];

    // Tìm tất cả các li có data-key
    const allLis = document.querySelectorAll('li[data-key]');
    allLis.forEach(li => {
        // Loại trừ màu (nằm trong .imagemaker_colorBox hoặc có background rgb)
        const isColor = li.closest('.imagemaker_colorBox') ||
            (li.style.background && li.style.background.includes('rgb'));

        // Loại trừ layer (nằm trong splide__slide)
        const isLayer = li.closest('.splide__slide');

        // Loại trừ remove_item
        const isRemoveItem = li.classList.contains('remove_item');

        if (!isColor && !isLayer && !isRemoveItem && !allItems.includes(li)) {
            allItems.push(li);
        }
    });

    console.log(`📋 Đã tìm thấy ${allItems.length} item (hàng 2) tổng cộng`);
    return allItems;
}

// Hàm tìm item hiện tại đang được chọn
function getCurrentSelectedItem() {
    const items = getAllItems();
    return items.find(item => item.classList.contains('selected'));
}

// Hàm tìm các layer con của item hiện tại
// Lấy TẤT CẢ layer (kể cả không hiển thị) để có thể chuyển qua hết
function getAllLayers() {
    console.log("🔍 Đang quét layer của item hiện tại...");

    const layers = [];

    // Tìm splide__list đang chứa slide active (đây là container của item hiện tại)
    const activeSlide = document.querySelector('.splide__slide.is-active, .splide__slide.is-visible');
    if (!activeSlide) {
        console.log("⚠️ Không tìm thấy slide active");
        return [];
    }

    // Tìm splide__list cha của slide active
    const splideList = activeSlide.closest('.splide__list');
    if (!splideList) {
        console.log("⚠️ Không tìm thấy splide__list");
        return [];
    }

    // Lấy TẤT CẢ slide (kể cả không hiển thị) để có thể chuyển qua hết
    const allSlides = splideList.querySelectorAll('.splide__slide');
    console.log(`Đã tìm thấy ${allSlides.length} slide tổng cộng`);

    // Duyệt qua tất cả slide
    allSlides.forEach((slide, slideIndex) => {
        const slideLis = slide.querySelectorAll('li[data-key]');

        slideLis.forEach(li => {
            // Loại trừ remove_item
            const isRemoveItem = li.classList.contains('remove_item');

            // Loại trừ màu (có background rgb hoặc nằm trong colorBox)
            const isColor = li.closest('.imagemaker_colorBox') ||
                (li.style.background && li.style.background.includes('rgb'));

            if (!isRemoveItem && !isColor && !layers.includes(li)) {
                layers.push(li);
            }
        });
    });

    console.log(`📊 Tổng số layer tìm thấy: ${layers.length}`);
    return layers;
}

// Hàm tìm layer tiếp theo để click
function getNextLayer() {
    const layers = getAllLayers();
    if (layers.length === 0) {
        console.log("⚠️ Không có layer nào để chuyển tiếp");
        return null;
    }

    // Tìm layer đang selected
    const selectedLayer = layers.find(layer => layer.classList.contains('selected'));

    if (!selectedLayer) {
        // Nếu không có layer nào selected, chọn layer đầu tiên
        console.log("ℹ️ Không tìm thấy layer đã chọn, dùng layer đầu tiên");
        return layers[0];
    }

    const currentIndex = layers.indexOf(selectedLayer);
    console.log(`📍 Chỉ số layer hiện tại: ${currentIndex + 1}/${layers.length} (data-key: ${selectedLayer.getAttribute('data-key')})`);

    if (currentIndex < layers.length - 1) {
        const nextLayer = layers[currentIndex + 1];
        console.log(`➡️ Đã tìm thấy layer tiếp theo: chỉ số ${currentIndex + 2}/${layers.length} (data-key: ${nextLayer.getAttribute('data-key')})`);
        return nextLayer;
    }

    // Đã hết layer trong slide hiện tại
    console.log("✅ Đã xử lý hết tất cả layer trong slide hiện tại");
    return null;
}

// Hàm tìm item tiếp theo để click
function getNextItem() {
    const items = getAllItems();
    const currentItem = getCurrentSelectedItem();

    if (!currentItem) {
        // Nếu không có item nào được chọn, chọn item đầu tiên
        return items.length > 0 ? items[0] : null;
    }

    const currentIndex = items.indexOf(currentItem);
    if (currentIndex < items.length - 1) {
        return items[currentIndex + 1];
    }

    // Đã hết item
    return null;
}

async function startAutoCrawl(shouldAutoNext = false) {
    if (isCrawling) return;
    isCrawling = true;

    // Bật crawling mode trong background
    try {
        chrome.runtime.sendMessage({ type: 'START_CRAWLING' });
    } catch (e) {
        console.warn("⚠️ Không thể bật crawling mode:", e.message);
    }

    console.log("🚀 Bắt đầu vòng lặp tự động tải màu...");
    console.log("�  Chế độ: Tự động chuyển Layer (KHÔNG tự động chuyển Item)");

    // Log thông tin item hiện tại
    const selectedItem = getCurrentSelectedItem();
    const currentItemName = getCurrentItemName();
    console.log(`📍 Item hiện tại: ${currentItemName || 'N/A'} (data-key: ${selectedItem?.getAttribute('data-key') || 'N/A'})`);

    // Kiểm tra số lượng layer trước
    const allLayersCheck = getAllLayers();
    const totalLayers = allLayersCheck.length;
    console.log(`🔢 Tổng số layer phát hiện: ${totalLayers}`);

    // Gọi hàm quét màu để lấy danh sách
    const colors = scanAndLogColors();

    // TRƯỜNG HỢP 3: Chỉ có 1 layer duy nhất → Lưu trực tiếp vào folder Item (không tạo folder màu)
    if (totalLayers === 1) {
        console.log("⚡ Item chỉ có 1 layer → Lưu trực tiếp vào folder Item");
        
        const currentMaker = getMakerID();
        const itemName = getCurrentItemName();
        
        // Gửi thông tin: Không có màu, chỉ 1 layer
        try {
            chrome.runtime.sendMessage({
                type: 'COLOR_SELECTED',
                makerID: currentMaker,
                color: {
                    hex: 'NO_COLOR',
                    rgb: '',
                    dataKey: ''
                },
                itemName: itemName,
                layerName: null,
                hasColorPalette: false
            });
        } catch (e) { }
        
        // Bật crawling và đợi tải ảnh
        isCrawling = true;
        try {
            chrome.runtime.sendMessage({ type: 'START_CRAWLING' });
        } catch (e) { }
        
        console.log(`📥 Đang tải layer duy nhất...`);
        await new Promise(r => setTimeout(r, 2000)); // Đợi lâu hơn để chắc chắn tải xong
        
        // Tắt crawling
        isCrawling = false;
        try {
            chrome.runtime.sendMessage({ type: 'STOP_CRAWLING' });
        } catch (e) { }
        
        const itemNameDisplay = getCurrentItemName() || 'Item này';
        alert(`✅ Đã tải xong Item: ${itemNameDisplay} (1 layer)!`);
        console.log(`🎉 Đã hoàn thành Item: ${itemNameDisplay}!`);
        return;
    }

    // TRƯỜNG HỢP 2: Không có màu + nhiều layer
    if (colors.length === 0) {
        console.log("⚠️ Item này không có bảng màu → Tải tất cả layer vào folder Item");
        
        // Gửi thông tin item không có màu về background
        const currentMaker = getMakerID();
        const itemName = getCurrentItemName();
        try {
            chrome.runtime.sendMessage({
                type: 'COLOR_SELECTED',
                makerID: currentMaker,
                color: {
                    hex: 'NO_COLOR',
                    rgb: '',
                    dataKey: ''
                },
                itemName: itemName,
                layerName: null,
                hasColorPalette: false // Item này KHÔNG có bảng màu
            });
        } catch (e) { }
        
        // BẬT crawling mode để tải ảnh (QUAN TRỌNG!)
        isCrawling = true;
        try {
            chrome.runtime.sendMessage({ type: 'START_CRAWLING' });
        } catch (e) { }
        
        // Tải layer đầu tiên
        const firstLayer = getNextLayer();
        if (firstLayer) {
            console.log(`📥 Bắt đầu tải layer đầu tiên`);
            firstLayer.click();
            await new Promise(r => setTimeout(r, 1500));
        }
        
        // Vòng lặp tự động chuyển layer (giống logic có màu)
        let layerCount = 1;
        const maxLayers = 50; // Giới hạn tối đa để tránh vòng lặp vô hạn
        
        while (layerCount < maxLayers) {
            const nextLayer = getNextLayer();
            
            if (!nextLayer) {
                console.log(`✅ Đã hết layer (đã tải ${layerCount} layer)`);
                break;
            }
            
            const layerDataKey = nextLayer.getAttribute('data-key');
            const layerName = getLayerName(nextLayer);
            
            console.log(`📥 Đang tải layer ${layerCount + 1}: ${layerName} (${layerDataKey})`);
            
            // Scroll element vào view (nếu cần)
            try {
                nextLayer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (e) { }
            
            // Đợi scroll xong
            await new Promise(r => setTimeout(r, 300));
            
            // Click layer tiếp theo
            nextLayer.click();
            
            // Đợi ảnh render và tải (tăng thời gian chờ)
            await new Promise(r => setTimeout(r, 2000));
            
            layerCount++;
        }
        
        console.log(`✅ Đã tải xong ${layerCount} layer của Item này`);
        
        // Tắt crawling mode
        isCrawling = false;
        try {
            chrome.runtime.sendMessage({ type: 'STOP_CRAWLING' });
        } catch (e) { }
        
        const itemNameDisplay = getCurrentItemName() || 'Item này';
        alert(`✅ Đã tải xong toàn bộ Item: ${itemNameDisplay} (${layerCount} layer)!`);
        console.log(`🎉 Đã hoàn thành tất cả layer của Item: ${itemNameDisplay}!`);
        return;
    }

    const currentItem = getCurrentSelectedItem();
    const itemInfo = currentItem ? `Item ${getAllItems().indexOf(currentItem) + 1}/${getAllItems().length}` : 'Item';
    const currentItemDataKey = currentItem?.getAttribute('data-key');

    // Reset counter về 1 mỗi khi bắt đầu vòng lặp màu mới (mỗi layer)
    try {
        chrome.runtime.sendMessage({ type: 'RESET_COUNTER' });
        console.log(`🔄 Đã reset counter về 1 cho layer mới`);
    } catch (e) {
        console.warn("⚠️ Không thể reset counter:", e.message);
    }

    // Cập nhật item hiện tại
    lastProcessedItem = currentItemDataKey;

    // 2. Vòng lặp qua từng MÀU (bỏ qua màu trùng)
    const processedColors = new Set(); // Lưu các màu đã xử lý

    for (let i = 0; i < colors.length; i++) {
        const colorLi = colors[i];

        // Lấy thông tin màu trực tiếp từ element
        const bgStyle = colorLi.style.background;
        const hexColor = rgbToHex(bgStyle);
        const dataKey = colorLi.getAttribute('data-key');
        const currentMaker = getMakerID();

        // Kiểm tra màu đã được xử lý chưa
        if (processedColors.has(hexColor)) {
            console.log(`⏭️ Bỏ qua màu trùng ${i + 1}/${colors.length} (${hexColor}) - Đã tải rồi`);
            continue; // Bỏ qua màu này
        }

        // Đánh dấu màu đã xử lý
        processedColors.add(hexColor);

        if (hexColor && currentMaker) {
            const itemName = getCurrentItemName();
            const layerName = getCurrentLayerName();

            console.log(`🎨 Đang đặt folder đích thành Màu: ${hexColor} (Item: ${itemName || 'N/A'}, Layer: ${layerName || 'N/A'})`);
            // Gửi tin nhắn cập nhật folder NGAY LẬP TỨC
            try {
                chrome.runtime.sendMessage({
                    type: 'COLOR_SELECTED',
                    makerID: currentMaker,
                    color: {
                        hex: hexColor,
                        rgb: bgStyle,
                        dataKey: dataKey
                    },
                    itemName: itemName,
                    layerName: layerName,
                    hasColorPalette: true // Item này có bảng màu
                });
            } catch (e) {
                // console.warn("⚠️ Failed to send message:", e.message);
            }
        }

        // Click Màu
        colorLi.click();
        console.log(`👉 Đã click Màu ${i + 1}/${colors.length} (${hexColor})`);

        // Đợi ảnh render và download
        // Thời gian chờ: 1.5s (có thể tăng nếu mạng chậm)
        await new Promise(r => setTimeout(r, 1500));
    }

    isCrawling = false;

    // Tắt crawling mode tạm thời
    try {
        chrome.runtime.sendMessage({ type: 'STOP_CRAWLING' });
    } catch (e) {
        console.warn("⚠️ Không thể tắt crawling mode:", e.message);
    }

    console.log("✅ Đã hoàn thành vòng lặp tải màu cho layer hiện tại!");

    // Tự động chuyển sang layer tiếp theo (KHÔNG chuyển item)
    console.log("🔍 Đang kiểm tra layer tiếp theo...");
    const layers = getAllLayers();
    const nextLayer = getNextLayer();

    if (nextLayer && layers.length > 0) {
        const currentLayerIndex = layers.findIndex(l => l.classList.contains('selected'));
        const nextIndex = currentLayerIndex >= 0 ? currentLayerIndex + 2 : 1;
        const dataKey = nextLayer.getAttribute('data-key');
        console.log(`➡️ Tự động chuyển sang layer tiếp theo: ${nextIndex}/${layers.length} (data-key: ${dataKey})`);

        // Click layer tiếp theo
        nextLayer.click();
        console.log(`✅ Đã click layer tiếp theo`);

        // Đợi UI update
        console.log(`⏳ Đang chờ UI cập nhật...`);
        await new Promise(r => setTimeout(r, 2000));

        // Kiểm tra xem layer đã được chọn chưa
        const isNowSelected = nextLayer.classList.contains('selected');
        console.log(`📍 Trạng thái chọn layer: ${isNowSelected ? 'ĐÃ CHỌN ✅' : 'CHƯA CHỌN ❌'}`);

        if (isNowSelected) {
            // Quét lại màu sau khi chuyển layer thành công
            const newColors = scanAndLogColors();
            if (newColors.length > 0) {
                console.log(`✅ Đã tìm thấy ${newColors.length} màu cho layer mới, tiếp tục...`);
                // Tự động chạy lại cho layer tiếp theo
                startAutoCrawl();
                return;
            } else {
                console.log(`⚠️ Không tìm thấy màu cho layer mới`);
            }
        }
    } else {
        console.log(`ℹ️ Không còn layer nào trong item hiện tại (tổng: ${layers.length})`);
    }

    // Đã hết layer → Thông báo hoàn thành
    try {
        chrome.runtime.sendMessage({ type: 'STOP_CRAWLING' });
    } catch (e) { }

    const itemName = getCurrentItemName() || 'Item này';
    alert(`✅ Đã tải xong toàn bộ Item: ${itemName}!`);
    console.log(`🎉 Đã hoàn thành tất cả layer của Item: ${itemName}!`);
}


// Hàm log thông tin khi click vào layer
function logLayerClickInfo(layerElement) {
    console.log("═══════════════════════════════════════════════");
    console.log("🎯 LAYER CLICKED!");
    console.log("═══════════════════════════════════════════════");

    // 1. Thông tin layer chính
    const layerName = getCurrentLayerName() || getLayerName(layerElement);
    const dataKey = layerElement.getAttribute('data-key');
    const isSelected = layerElement.classList.contains('selected');

    console.log("\n📌 LAYER INFO:");
    console.log(`   Name: ${layerName}`);
    console.log(`   data-key: ${dataKey}`);
    console.log(`   Selected: ${isSelected}`);

    // 2. Tất cả layer trong slide hiện tại
    const allLayers = getAllLayers();
    console.log("\n📋 ALL LAYERS IN CURRENT SLIDE:");
    allLayers.forEach((layer, index) => {
        const name = getLayerName(layer);
        const key = layer.getAttribute('data-key');
        const selected = layer.classList.contains('selected');
        const isCurrent = layer === layerElement;
        console.log(`   ${index + 1}. ${name} (${key}) ${selected ? '✅' : '⬜'} ${isCurrent ? '👈 CURRENT' : ''}`);
    });

    // 3. Sub-layers (nếu có nhiều layer trong cùng ul)
    const parentUl = layerElement.closest('ul');
    if (parentUl) {
        const subLayers = Array.from(parentUl.querySelectorAll('li[data-key]')).filter(li => {
            const isRemoveItem = li.classList.contains('remove_item');
            const isColor = li.closest('.imagemaker_colorBox') ||
                (li.style.background && li.style.background.includes('rgb'));
            return !isRemoveItem && !isColor;
        });

        if (subLayers.length > 1) {
            console.log("\n🔸 SUB-LAYERS (Layer con trong cùng UL):");
            subLayers.forEach((subLayer, index) => {
                const name = getLayerName(subLayer);
                const key = subLayer.getAttribute('data-key');
                const selected = subLayer.classList.contains('selected');
                console.log(`   ${index + 1}. ${name} (${key}) ${selected ? '✅' : '⬜'}`);
            });
        }
    }

    // 4. Bảng màu hiện tại
    const colors = scanAndLogColors(false);

    // 5. Cấu trúc folder đề xuất
    const makerID = getMakerID() || 'Unknown';
    const itemName = getCurrentItemName() || 'CurrentItem';
    const selectedColor = colors.find(c => c.classList.contains('selected'));
    const colorHex = selectedColor ? rgbToHex(selectedColor.style.background) : 'NoColor';

    console.log("\n📁 SUGGESTED FOLDER STRUCTURE:");
    console.log(`   Maker_${makerID}/${itemName}/${colorHex}/${layerName}/`);

    console.log("\n═══════════════════════════════════════════════");
}

// Hàm lấy tên layer từ element
function getLayerName(layerElement) {
    if (layerElement.title) return layerElement.title;
    if (layerElement.getAttribute('aria-label')) return layerElement.getAttribute('aria-label');

    const img = layerElement.querySelector('img');
    if (img && img.alt) return img.alt;

    return layerElement.getAttribute('data-key') || 'Unknown';
}


// Lắng nghe lệnh từ Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_CRAWL') {
        startAutoCrawl();
    }
    return true; // Giữ message port mở
});

// Khởi động
function init() {
    observeColorChanges();

    // KHÔNG tự động quét màu khi load trang
    // Chỉ quét khi user bấm nút "Tải tất cả màu"
    console.log("✅ Extension đã sẵn sàng! Bấm 'Tải tất cả màu' để bắt đầu.");

    // 3. Lắng nghe click vào Layer để LOG THÔNG TIN
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-key]');
        if (target) {
            const isColor = target.closest('.imagemaker_colorBox');

            if (!isColor) {
                // Đợi UI update
                setTimeout(() => {
                    logLayerClickInfo(target);
                }, 100);
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('🎨 Picrew Auto Color Loop đã được tải!');
