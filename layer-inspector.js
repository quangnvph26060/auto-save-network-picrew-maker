// Layer Inspector - Log thông tin khi click vào layer
// Inject script này vào console của trang Picrew để test

(function() {
    console.log("🔍 Layer Inspector Started!");
    
    // Hàm chuyển RGB sang HEX
    function rgbToHex(rgb) {
        const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return null;
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
    }
    
    // Hàm lấy tất cả màu hiện tại
    function getAllColors() {
        const colorUl = document.querySelector('.imagemaker_colorBox .simplebar-content ul');
        if (!colorUl) return [];
        
        const lis = Array.from(colorUl.querySelectorAll('li[data-key]'));
        return lis.filter(li => {
            const bg = li.style.background;
            return bg && bg.includes('rgb');
        });
    }
    
    // Hàm lấy tất cả layer trong slide hiện tại
    function getAllLayersInCurrentSlide() {
        const layers = [];
        const currentSlide = document.querySelector('.splide__slide.is-active, .splide__slide.is-visible');
        
        if (currentSlide) {
            const slideLis = currentSlide.querySelectorAll('li[data-key]');
            slideLis.forEach(li => {
                const isRemoveItem = li.classList.contains('remove_item');
                const isColor = li.closest('.imagemaker_colorBox') || 
                              (li.style.background && li.style.background.includes('rgb'));
                
                if (!isRemoveItem && !isColor) {
                    layers.push(li);
                }
            });
        }
        
        return layers;
    }
    
    // Hàm lấy tên layer
    function getLayerName(layerElement) {
        if (layerElement.title) return layerElement.title;
        if (layerElement.getAttribute('aria-label')) return layerElement.getAttribute('aria-label');
        
        const img = layerElement.querySelector('img');
        if (img && img.alt) return img.alt;
        
        return layerElement.getAttribute('data-key') || 'Unknown';
    }
    
    // Hàm lấy các sub-layer (layer con) của layer hiện tại
    function getSubLayers(layerElement) {
        const subLayers = [];
        
        // Tìm container chứa các sub-layer (thường là ul gần đó)
        const parentUl = layerElement.closest('ul');
        if (parentUl) {
            const allLisInUl = Array.from(parentUl.querySelectorAll('li[data-key]'));
            allLisInUl.forEach(li => {
                const isRemoveItem = li.classList.contains('remove_item');
                const isColor = li.closest('.imagemaker_colorBox') || 
                              (li.style.background && li.style.background.includes('rgb'));
                
                if (!isRemoveItem && !isColor) {
                    subLayers.push(li);
                }
            });
        }
        
        return subLayers;
    }
    
    // Hàm log thông tin layer
    function logLayerInfo(layerElement) {
        console.clear();
        console.log("═══════════════════════════════════════════════");
        console.log("🎯 LAYER CLICKED!");
        console.log("═══════════════════════════════════════════════");
        
        // 1. Thông tin layer chính
        const layerName = getLayerName(layerElement);
        const dataKey = layerElement.getAttribute('data-key');
        const isSelected = layerElement.classList.contains('selected');
        
        console.log("\n📌 LAYER INFO:");
        console.log(`   Name: ${layerName}`);
        console.log(`   data-key: ${dataKey}`);
        console.log(`   Selected: ${isSelected}`);
        
        // 2. Tất cả layer trong slide hiện tại
        const allLayers = getAllLayersInCurrentSlide();
        console.log("\n📋 ALL LAYERS IN CURRENT SLIDE:");
        allLayers.forEach((layer, index) => {
            const name = getLayerName(layer);
            const key = layer.getAttribute('data-key');
            const selected = layer.classList.contains('selected');
            const isCurrent = layer === layerElement;
            console.log(`   ${index + 1}. ${name} (${key}) ${selected ? '✅' : '⬜'} ${isCurrent ? '👈 CURRENT' : ''}`);
        });
        
        // 3. Sub-layers (layer con)
        const subLayers = getSubLayers(layerElement);
        if (subLayers.length > 1) {
            console.log("\n🔸 SUB-LAYERS (Layer con):");
            subLayers.forEach((subLayer, index) => {
                const name = getLayerName(subLayer);
                const key = subLayer.getAttribute('data-key');
                const selected = subLayer.classList.contains('selected');
                console.log(`   ${index + 1}. ${name} (${key}) ${selected ? '✅' : '⬜'}`);
            });
        } else {
            console.log("\n🔸 SUB-LAYERS: None (single layer)");
        }
        
        // 4. Bảng màu hiện tại
        const colors = getAllColors();
        console.log("\n🌈 COLOR PALETTE:");
        if (colors.length > 0) {
            colors.forEach((colorLi, index) => {
                const bg = colorLi.style.background;
                const hex = rgbToHex(bg);
                const selected = colorLi.classList.contains('selected');
                console.log(`   ${index + 1}. ${hex} ${selected ? '✅' : '⬜'}`);
            });
        } else {
            console.log("   ⚠️ No colors found");
        }
        
        // 5. Cấu trúc folder đề xuất
        const makerID = window.location.pathname.match(/\/image_maker\/(\d+)/)?.[1] || 'Unknown';
        const itemName = "CurrentItem"; // Placeholder
        const selectedColor = colors.find(c => c.classList.contains('selected'));
        const colorHex = selectedColor ? rgbToHex(selectedColor.style.background) : 'NoColor';
        
        console.log("\n📁 SUGGESTED FOLDER STRUCTURE:");
        console.log(`   Maker_${makerID}/${itemName}/${colorHex}/${layerName}/`);
        
        console.log("\n═══════════════════════════════════════════════");
    }
    
    // Lắng nghe click vào tất cả các element có data-key
    document.addEventListener('click', (e) => {
        const target = e.target.closest('li[data-key]');
        if (!target) return;
        
        // Kiểm tra xem có phải là layer không (không phải màu)
        const isColor = target.closest('.imagemaker_colorBox') || 
                       (target.style.background && target.style.background.includes('rgb'));
        
        if (!isColor) {
            // Đợi một chút để UI update
            setTimeout(() => {
                logLayerInfo(target);
            }, 100);
        }
    });
    
    console.log("✅ Layer Inspector Ready! Click vào bất kỳ layer nào (hàng giữa) để xem thông tin.");
    console.log("💡 Tip: Mở Console để xem output");
})();
