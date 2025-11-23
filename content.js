// Content Script - Chạy trên trang Picrew
// Logic: Auto Download All Colors for Current Item (Robust Version with Specific Selector)

let currentColor = null;
let makerID = null;
let isCrawling = false;
let autoNextItem = false; // Flag để bật/tắt tự động chuyển item
let currentItemName = null; // Tên item hiện tại (ví dụ: "Mũi", "Mắt"...)
let currentLayerName = null; // Tên layer hiện tại

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

    // Thử nhiều cách để lấy tên:
    // 1. Từ title attribute
    if (selectedItem.title) return selectedItem.title;
    
    // 2. Từ aria-label
    if (selectedItem.getAttribute('aria-label')) {
        return selectedItem.getAttribute('aria-label');
    }
    
    // 3. Từ data attribute
    if (selectedItem.getAttribute('data-name')) {
        return selectedItem.getAttribute('data-name');
    }
    
    // 4. Tìm label gần đó
    const label = selectedItem.closest('[class*="item"]')?.querySelector('label, .label, [class*="label"]');
    if (label) {
        return label.textContent?.trim() || label.innerText?.trim();
    }
    
    // 5. Tìm trong container có title
    const container = selectedItem.closest('[class*="itemBox"], [class*="item_box"], [class*="category"]');
    if (container) {
        const title = container.querySelector('h3, h4, .title, [class*="title"]');
        if (title) return title.textContent?.trim();
    }
    
    // 6. Fallback: Dùng index
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
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("⚠️ Error sending color info:", chrome.runtime.lastError.message);
                } else {
                    currentColor = color.hex;
                    makerID = maker;
                }
            });
        } catch (e) {
            console.warn("⚠️ Failed to send color info:", e.message);
        }
    }
}

// Lắng nghe thay đổi màu
function observeColorChanges() {
    sendColorInfo();

    const colorList = document.querySelector('ul');
    if (colorList) {
        colorList.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI' && e.target.hasAttribute('data-key')) {
                setTimeout(sendColorInfo, 100);
            }
        });
    }

    const observer = new MutationObserver(() => {
        const newColor = detectSelectedColor();
        if (newColor && newColor.hex !== currentColor) {
            sendColorInfo();
        }
    });

    const targetNode = document.querySelector('ul');
    if (targetNode) {
        observer.observe(targetNode, {
            attributes: true,
            subtree: true,
            attributeFilter: ['class']
        });
    }
}

// ==========================================
// AUTO CRAWLER LOGIC (Robust Color Detection)
// ==========================================

// Hàm quét và log màu (Tách riêng để gọi lúc khởi động)
function scanAndLogColors(isAuto = false) {
    console.log("🔍 Scanning for color palette...");

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
            console.log("✅ Found Color Palette Container via Specific Selector!");
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
                console.log("✅ Found Color Palette via Scan:", ul);
                if (colors.length > 1) break;
            }
        }
    }

    // LOG RA CÁC MÃ MÀU (Theo yêu cầu)
    if (colors.length > 0) {
        console.group("🌈 Detected Colors (Ready to Download):");
        colors.forEach((li, index) => {
            const bg = li.style.background;
            const hex = rgbToHex(bg);
            console.log(`${index + 1}. RGB: ${bg} -> HEX: ${hex}`);
        });
        console.groupEnd();
        if (isAuto) {
            console.log("✅ Auto-detected color palette.");
        }

        // QUAN TRỌNG: Tự động gửi màu đang selected về background để tạo folder
        // Tìm màu đang được chọn (selected) trong danh sách colors
        const selectedColorLi = colors.find(li => li.classList.contains('selected'));
        let colorToSend = null;

        if (selectedColorLi) {
            // Nếu có màu đang selected, dùng màu đó
            const bgStyle = selectedColorLi.style.background;
            const hexColor = rgbToHex(bgStyle);
            if (hexColor) {
                colorToSend = {
                    hex: hexColor,
                    rgb: bgStyle,
                    dataKey: selectedColorLi.getAttribute('data-key')
                };
            }
        } else {
            // Nếu chưa có màu nào được chọn, dùng màu đầu tiên
            const firstColor = colors[0];
            if (firstColor) {
                const bgStyle = firstColor.style.background;
                const hexColor = rgbToHex(bgStyle);
                if (hexColor) {
                    colorToSend = {
                        hex: hexColor,
                        rgb: bgStyle,
                        dataKey: firstColor.getAttribute('data-key')
                    };
                }
            }
        }

        // Gửi message về background để tạo folder
        if (colorToSend) {
            const maker = getMakerID();
            const itemName = getCurrentItemName();
            const layerName = getCurrentLayerName();
            
            if (maker) {
                console.log(`📤 Auto-sending color to background: ${colorToSend.hex} (Maker: ${maker}, Item: ${itemName || 'N/A'}, Layer: ${layerName || 'N/A'})`);
                try {
                    chrome.runtime.sendMessage({
                        type: 'COLOR_SELECTED',
                        makerID: maker,
                        color: colorToSend,
                        itemName: itemName,
                        layerName: layerName
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn("⚠️ Error sending message:", chrome.runtime.lastError.message);
                        } else {
                            currentColor = colorToSend.hex;
                            makerID = maker;
                            currentItemName = itemName;
                            currentLayerName = layerName;
                        }
                    });
                } catch (e) {
                    console.warn("⚠️ Failed to send message:", e.message);
                }
            }
        }
    } else {
        if (isAuto) {
            console.log("⏳ Waiting for Item selection... (Please select an Item)");
        } else {
            console.log("⚠️ No color palette found. Please select an Item first.");
        }
    }

    return colors;
}

// Hàm tìm danh sách tất cả các Item (không phải màu)
function getAllItems() {
    // Tìm tất cả các item trong các zone (thường là các ul chứa item, không phải màu)
    // Item thường nằm trong các container như .imagemaker_itemBox hoặc các ul không phải màu
    const allItems = [];
    
    // Tìm tất cả các li có data-key nhưng KHÔNG nằm trong .imagemaker_colorBox
    const allLis = document.querySelectorAll('li[data-key]');
    allLis.forEach(li => {
        // Loại trừ màu (nằm trong .imagemaker_colorBox)
        const isColor = li.closest('.imagemaker_colorBox');
        if (!isColor) {
            // Kiểm tra xem có phải là màu không (có background rgb)
            const hasColorBg = li.style.background && li.style.background.includes('rgb');
            
            if (!hasColorBg) {
                // Kiểm tra xem có phải là item không (thường có class hoặc nằm trong container item)
                const isItem = li.closest('.imagemaker_itemBox') || 
                              li.closest('[class*="item"]') ||
                              li.closest('[class*="category"]');
                
                if (isItem && !allItems.includes(li)) {
                    allItems.push(li);
                }
            }
        }
    });
    
    console.log(`📋 Found ${allItems.length} total items`);
    return allItems;
}

// Hàm tìm item hiện tại đang được chọn
function getCurrentSelectedItem() {
    const items = getAllItems();
    return items.find(item => item.classList.contains('selected'));
}

// Hàm tìm các layer con của item hiện tại
// Layer con nằm trong cùng một splide__slide (theo cấu trúc HTML từ user)
function getAllLayers() {
    const selectedItem = getCurrentSelectedItem();
    if (!selectedItem) {
        console.log("⚠️ No selected item found for layer detection");
        return [];
    }

    console.log("🔍 Scanning for layers in current splide slide...");
    
    const layers = [];
    
    // QUAN TRỌNG: Tìm splide__slide hiện tại (có class is-active hoặc is-visible)
    const currentSlide = selectedItem.closest('.splide__slide');
    if (currentSlide) {
        console.log(`Found current slide:`, currentSlide.id);
        
        // Tìm tất cả các li[data-key] trong slide hiện tại
        const slideLis = currentSlide.querySelectorAll('li[data-key]');
        console.log(`Found ${slideLis.length} li elements in current slide`);
        
        slideLis.forEach(li => {
            // Loại trừ remove_item (có class remove_item)
            const isRemoveItem = li.classList.contains('remove_item');
            
            // Loại trừ màu (có background rgb hoặc nằm trong colorBox)
            const isColor = li.closest('.imagemaker_colorBox') || 
                          (li.style.background && li.style.background.includes('rgb'));
            
            if (!isRemoveItem && !isColor && !layers.includes(li)) {
                layers.push(li);
                const dataKey = li.getAttribute('data-key');
                const isSelected = li.classList.contains('selected');
                console.log(`  ✅ Found layer: data-key="${dataKey}", selected=${isSelected}`);
            }
        });
    } else {
        console.log("⚠️ Could not find current splide__slide");
        
        // Fallback: Tìm trong simplebar-content của slide đang active
        const activeSlide = document.querySelector('.splide__slide.is-active, .splide__slide.is-visible');
        if (activeSlide) {
            const slideLis = activeSlide.querySelectorAll('li[data-key]');
            slideLis.forEach(li => {
                const isRemoveItem = li.classList.contains('remove_item');
                const isColor = li.closest('.imagemaker_colorBox') || 
                              (li.style.background && li.style.background.includes('rgb'));
                
                if (!isRemoveItem && !isColor && !layers.includes(li)) {
                    layers.push(li);
                    console.log(`  ✅ Found layer in active slide:`, li.getAttribute('data-key'));
                }
            });
        }
    }

    console.log(`📊 Total layers found: ${layers.length}`);
    if (layers.length > 0) {
        const selectedLayer = layers.find(l => l.classList.contains('selected'));
        const selectedIndex = selectedLayer ? layers.indexOf(selectedLayer) : -1;
        console.log(`   Current layer index: ${selectedIndex >= 0 ? selectedIndex + 1 : 'N/A'}/${layers.length}`);
        console.log(`   Layer data-keys:`, layers.map(l => l.getAttribute('data-key')));
    } else {
        console.log(`   ⚠️ No layers found in current slide`);
    }
    return layers;
}

// Hàm tìm layer tiếp theo để click
function getNextLayer() {
    const layers = getAllLayers();
    if (layers.length === 0) {
        console.log("⚠️ No layers available to get next");
        return null;
    }

    // Tìm layer đang selected
    const selectedLayer = layers.find(layer => layer.classList.contains('selected'));

    if (!selectedLayer) {
        // Nếu không có layer nào selected, chọn layer đầu tiên
        console.log("ℹ️ No selected layer found, using first layer in list");
        return layers[0];
    }

    const currentIndex = layers.indexOf(selectedLayer);
    console.log(`📍 Current layer index: ${currentIndex + 1}/${layers.length} (data-key: ${selectedLayer.getAttribute('data-key')})`);
    
    if (currentIndex < layers.length - 1) {
        const nextLayer = layers[currentIndex + 1];
        console.log(`➡️ Next layer found: index ${currentIndex + 2}/${layers.length} (data-key: ${nextLayer.getAttribute('data-key')})`);
        return nextLayer;
    }

    // Đã hết layer trong slide hiện tại
    console.log("✅ All layers in current slide processed");
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
    autoNextItem = shouldAutoNext;
    
    console.log("🚀 Starting Auto Color Loop...");
    if (autoNextItem) {
        console.log("🔄 Auto-next-item mode: ON");
    }

    // Gọi hàm quét màu để lấy danh sách
    const colors = scanAndLogColors();

    if (colors.length === 0) {
        alert("❌ Không tìm thấy bảng màu nào! Hãy chắc chắn bạn đã chọn Item.");
        isCrawling = false;
        return;
    }

    const currentItem = getCurrentSelectedItem();
    const itemInfo = currentItem ? `Item ${getAllItems().indexOf(currentItem) + 1}/${getAllItems().length}` : 'Item';
    alert(`Tìm thấy ${colors.length} màu! Bắt đầu tải ${itemInfo}...`);

    // 2. Vòng lặp qua từng MÀU
    for (let i = 0; i < colors.length; i++) {
        const colorLi = colors[i];

        // Lấy thông tin màu trực tiếp từ element
        const bgStyle = colorLi.style.background;
        const hexColor = rgbToHex(bgStyle);
        const dataKey = colorLi.getAttribute('data-key');
        const currentMaker = getMakerID();

        if (hexColor && currentMaker) {
            const itemName = getCurrentItemName();
            const layerName = getCurrentLayerName();
            
            console.log(`🎨 Setting target folder to Color: ${hexColor} (Item: ${itemName || 'N/A'}, Layer: ${layerName || 'N/A'})`);
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
                    layerName: layerName
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn("⚠️ Error sending message:", chrome.runtime.lastError.message);
                    }
                });
            } catch (e) {
                console.warn("⚠️ Failed to send message:", e.message);
            }
        }

        // Click Màu
        colorLi.click();
        console.log(`👉 Clicked Color ${i + 1}/${colors.length} (${hexColor})`);

        // Đợi ảnh render và download
        // Thời gian chờ: 1.5s (có thể tăng nếu mạng chậm)
        await new Promise(r => setTimeout(r, 1500));
    }

    isCrawling = false;
    console.log("✅ Auto Color Loop Finished!");
    
    // Nếu bật auto-next-item, tự động chuyển sang layer hoặc item tiếp theo
    if (autoNextItem) {
        // 1. Thử chuyển sang layer tiếp theo trước (nếu có)
        console.log("🔍 Checking for next layer in current slide...");
        const layers = getAllLayers();
        const nextLayer = getNextLayer();
        
        if (nextLayer && layers.length > 0) {
            const currentLayerIndex = layers.findIndex(l => l.classList.contains('selected'));
            const nextIndex = currentLayerIndex >= 0 ? currentLayerIndex + 2 : 1;
            const dataKey = nextLayer.getAttribute('data-key');
            console.log(`➡️ Auto-moving to next layer: ${nextIndex}/${layers.length} (data-key: ${dataKey})`);
            console.log(`   Next layer element:`, nextLayer);
            
            // Click layer tiếp theo - thử nhiều cách
            let clickSuccess = false;
            
            // Cách 1: Click trực tiếp
            try {
                nextLayer.click();
                clickSuccess = true;
                console.log(`   ✅ Clicked layer directly`);
            } catch (e) {
                console.log(`   ⚠️ Direct click failed:`, e.message);
            }
            
            // Cách 2: Trigger mouse events
            if (!clickSuccess) {
                try {
                    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
                    const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
                    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                    
                    nextLayer.dispatchEvent(mouseDown);
                    await new Promise(r => setTimeout(r, 50));
                    nextLayer.dispatchEvent(mouseUp);
                    await new Promise(r => setTimeout(r, 50));
                    nextLayer.dispatchEvent(clickEvent);
                    clickSuccess = true;
                    console.log(`   ✅ Clicked layer via events`);
                } catch (e) {
                    console.log(`   ⚠️ Event click failed:`, e.message);
                }
            }
            
            // Cách 3: Tìm và click div con (thường có div bên trong li)
            if (!clickSuccess) {
                const clickableChild = nextLayer.querySelector('div');
                if (clickableChild) {
                    try {
                        clickableChild.click();
                        clickSuccess = true;
                        console.log(`   ✅ Clicked child div element`);
                    } catch (e) {
                        console.log(`   ⚠️ Child div click failed:`, e.message);
                    }
                }
            }
            
            if (!clickSuccess) {
                console.error(`   ❌ All click methods failed for layer`);
            }
            
            // Đợi UI update (tăng thời gian chờ để đảm bảo UI load xong)
            console.log(`   ⏳ Waiting for UI to update...`);
            await new Promise(r => setTimeout(r, 2000));
            
            // Kiểm tra xem layer đã được chọn chưa
            const isNowSelected = nextLayer.classList.contains('selected');
            console.log(`   📍 Layer selection status: ${isNowSelected ? 'SELECTED ✅' : 'NOT SELECTED ❌'}`);
            
            if (isNowSelected) {
                // Quét lại màu sau khi chuyển layer thành công
                const newColors = scanAndLogColors();
                if (newColors.length > 0) {
                    console.log(`   ✅ Found ${newColors.length} colors for new layer, continuing...`);
                    // Tự động chạy lại cho layer tiếp theo
                    startAutoCrawl(true);
                    return;
                } else {
                    console.log(`   ⚠️ No colors found for new layer, trying next layer/item...`);
                }
            } else {
                console.log(`   ⚠️ Layer was not selected after click, may need to try next item`);
            }
        } else {
            console.log(`   ℹ️ No more layers in current slide (total found: ${layers.length})`);
        }
        
        // 2. Nếu không còn layer, chuyển sang item tiếp theo
        const nextItem = getNextItem();
        if (nextItem) {
            const totalItems = getAllItems().length;
            const currentIndex = getAllItems().indexOf(getCurrentSelectedItem() || nextItem);
            console.log(`➡️ Auto-moving to next item: ${currentIndex + 2}/${totalItems}`);
            
            // Click item tiếp theo
            nextItem.click();
            
            // Đợi UI update
            await new Promise(r => setTimeout(r, 1000));
            
            // Tự động chạy lại cho item tiếp theo
            startAutoCrawl(true);
        } else {
            alert("✅ Đã tải xong TẤT CẢ Item, Layer và màu!");
            console.log("🎉 All items and layers completed!");
        }
    } else {
        alert("Đã tải xong tất cả màu của Item này!");
    }
}

// Lắng nghe lệnh từ Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_CRAWL') {
        const autoNext = message.autoNextItem || false;
        startAutoCrawl(autoNext);
        sendResponse({ status: "started" });
    }
});

// Khởi động
function init() {
    observeColorChanges();

    // 1. Quét ngay lập tức
    scanAndLogColors(true);

    // 2. Retry mỗi giây trong 5s đầu (đề phòng DOM load chậm)
    let attempts = 0;
    const retryInterval = setInterval(() => {
        attempts++;
        const colors = scanAndLogColors(true);
        if (colors.length > 0 || attempts >= 5) {
            clearInterval(retryInterval);
        }
    }, 1000);

    // 3. Lắng nghe click vào Item để TỰ ĐỘNG TẢI (Nếu được kích hoạt)
    // Hiện tại mặc định là tự động quét màu, nhưng chưa tự động tải.
    // Để tự động tải khi click item, ta gọi startAutoCrawl()

    document.addEventListener('click', (e) => {
        // Nếu click vào element có data-key (thường là item)
        // Loại trừ click vào màu (vì màu cũng có data-key, tránh vòng lặp vô tận)
        const target = e.target.closest('[data-key]');
        if (target) {
            // Kiểm tra xem có phải là click vào màu không?
            // Màu nằm trong .imagemaker_colorBox
            const isColor = target.closest('.imagemaker_colorBox');

            if (!isColor) {
                console.log("🖱️ Item clicked! Auto-triggering download in 1s...");
                // Đợi 1 chút để UI update item mới, sau đó mới chạy
                setTimeout(() => {
                    // Kiểm tra lại xem có bảng màu không trước khi chạy
                    const colors = scanAndLogColors(true);
                    if (colors.length > 0) {
                        startAutoCrawl();
                    } else {
                        console.log("⚠️ Item has no color palette. Skipping auto-download.");
                    }
                }, 1000);
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('Picrew Auto Color Loop (Robust) loaded!');
