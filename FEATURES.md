# Auto Save Network Image - Danh sách tính năng đã triển khai

## 📋 Tổng quan
Extension Chrome tự động tải ảnh từ network requests, đặc biệt tối ưu cho website Picrew.me với khả năng tự động tổ chức file theo Maker ID, Item, Màu và Layer.

---

## 🎯 Chức năng chính

### 1. Tự động tải ảnh từ Network Requests
- ✅ Theo dõi tất cả network requests trong trình duyệt
- ✅ Tự động phát hiện và tải các file ảnh (png, jpg, gif, webp)
- ✅ Bỏ qua các icon/logo nhỏ để tránh tải file không cần thiết
- ✅ Đặt tên file tự động theo số thứ tự (1.jpg, 2.png, ...)
- ✅ Tự động tăng counter sau mỗi lần tải thành công

### 2. Bật/Tắt Extension
- ✅ Nút bật/tắt trong popup
- ✅ Badge hiển thị ON/OFF trên icon extension
- ✅ Tự động reset counter về 1 khi tắt extension
- ✅ Hiển thị trạng thái rõ ràng (CHẠY/NGỦ)

### 3. Tùy chỉnh thư mục lưu (Chế độ thường)
- ✅ Đặt tên thư mục tùy chỉnh
- ✅ Mặc định: `AutoCaptured`
- ✅ Hiển thị thư mục hiện tại trong popup
- ✅ Nút lưu với hiệu ứng xác nhận

### 4. Reset Counter
- ✅ Nút reset để đưa counter về 1
- ✅ Hiển thị số file tiếp theo sẽ được tải

---

## 🎨 Chế độ Picrew (Đặc biệt cho picrew.me)

### 5. Tự động phát hiện Maker ID
- ✅ Lấy Maker ID từ URL (`/image_maker/{ID}/`)
- ✅ Tự động kích hoạt khi vào trang Picrew

### 6. Tự động phát hiện Màu
- ✅ Phát hiện màu đang được chọn (RGB → HEX)
- ✅ Tự động gửi thông tin màu về background script
- ✅ Reset counter về 1 khi đổi màu
- ✅ Hiển thị mã màu trong popup với preview

### 7. Tự động phát hiện Item
- ✅ Lấy tên Item từ DOM (title, aria-label, data attribute)
- ✅ Fallback: Dùng index nếu không tìm thấy tên
- ✅ Tự động làm sạch tên (loại bỏ ký tự đặc biệt)

### 8. Tự động phát hiện Layer
- ✅ Phát hiện các layer con trong cùng `splide__slide`
- ✅ Lấy tên layer từ DOM
- ✅ Tự động làm sạch tên layer

### 9. Cấu trúc folder tự động (Picrew Mode)
```
Downloads/
  └── Maker_{MakerID}/
      └── {Tên Item}/
          └── {ColorHex}/
              ├── 1.jpg
              ├── 2.jpg
              └── ...
```

**Ví dụ:**
```
Downloads/
  └── Maker_1469769/
      └── 1386388/          ← data-key của Item (vì Picrew không cung cấp tên)
          ├── FAF2EC/       ← Màu 1
          │   ├── 1.jpg     ← Layer 1
          │   ├── 2.jpg     ← Layer 2
          │   └── 3.jpg     ← Layer 3
          └── FFE599/       ← Màu 2
              ├── 1.jpg     ← Layer 1
              ├── 2.jpg     ← Layer 2
              └── 3.jpg     ← Layer 3
    └── 1386383/   
        ├── 1.jpg     ← Layer 1
        ├── 2.jpg     ← Layer 2
        └── 3.jpg     ← Layer 3
```

**Lưu ý:** 
- Tên Item sử dụng `data-key` (ID số) vì Picrew không cung cấp tên text trong HTML
- Mỗi folder màu chứa tất cả layer: 1.jpg (layer 1), 2.jpg (layer 2), 3.jpg (layer 3)...
- Counter reset về 1 khi bắt đầu layer mới để đảm bảo tất cả folder màu có cùng số file

### 10. UI Popup thông minh
- ✅ Tự động ẩn input "Tên thư mục" khi ở Picrew Mode
- ✅ Hiển thị thông tin Maker ID và Màu hiện tại
- ✅ Preview màu với ô màu nhỏ
- ✅ Hiển thị đường dẫn folder tự động

---

## ⚡ Tính năng Auto Crawl

### 11. Tải tất cả màu của Layer
- ✅ Nút "⚡ Tải Tất Cả Màu" trong popup
- ✅ Tự động quét và phát hiện tất cả màu có sẵn
- ✅ Tự động click qua từng màu và tải ảnh
- ✅ Tự động bỏ qua layer không có màu (như layer X - ẩn)
- ✅ Hiển thị số lượng màu tìm được
- ✅ Thông báo khi hoàn thành

### 12. Tự động chuyển Layer
- ✅ Checkbox "🔄 Tự động chuyển Item tiếp theo"
- ✅ Tự động bỏ qua layer không có bảng màu (layer X - ẩn)
- ✅ Sau khi tải xong tất cả màu của 1 layer → tự động click layer tiếp theo
- ✅ Tự động tải tất cả màu của layer mới
- ✅ Lặp lại cho đến khi hết layer trong item hiện tại

### 13. Tự động chuyển Item
- ✅ Sau khi hết layer → tự động click item tiếp theo
- ✅ Tự động tải tất cả layer và màu của item mới
- ✅ Lặp lại cho đến khi hết tất cả item
- ✅ Thông báo khi hoàn thành tất cả

### 14. Logic phát hiện Layer thông minh
- ✅ Tìm layer trong cùng `splide__slide` hiện tại
- ✅ Loại trừ `remove_item` và màu
- ✅ Nhiều phương pháp click (direct, events, child element)
- ✅ Kiểm tra trạng thái selected sau khi click

---

## 🛡️ Xử lý lỗi và ổn định

### 15. Error Handling
- ✅ Try-catch cho tất cả `chrome.runtime.sendMessage`
- ✅ Kiểm tra `chrome.runtime.lastError`
- ✅ Xử lý lỗi "Extension context invalidated"
- ✅ Log cảnh báo thay vì crash

### 16. Log và Debug
- ✅ Log chi tiết trong console
- ✅ Hiển thị số lượng layer/item tìm được
- ✅ Log trạng thái click và selection
- ✅ Log đường dẫn folder và file path

---

## 📁 Cấu trúc file

```
AutoSaveNetworkImg/
├── manifest.json          # Cấu hình extension
├── background.js          # Service worker - xử lý download
├── content.js            # Content script - logic Picrew
├── popup.html            # Giao diện popup
├── popup.js              # Logic popup
└── FEATURES.md           # File này
```

---

## 🔧 Permissions sử dụng

- `webRequest`: Theo dõi network requests
- `downloads`: Tự động tải file
- `storage`: Lưu trạng thái và cài đặt
- `activeTab`: Truy cập tab hiện tại

---

## 📝 Ghi chú kỹ thuật

### Cách hoạt động:
1. **Background Script**: Lắng nghe network requests → Tải ảnh → Tạo folder tự động
2. **Content Script**: Chạy trên Picrew → Phát hiện Item/Layer/Màu → Gửi message về background
3. **Popup**: Hiển thị trạng thái → Điều khiển extension → Gửi lệnh crawl

### Quy trình Auto Crawl (Cập nhật):
1. Kiểm tra layer hiện tại có bảng màu không
2. Nếu KHÔNG có màu (layer X - ẩn) → Tự động chuyển sang layer tiếp theo
3. Nếu CÓ màu → Quét và tải tất cả màu (1.5s delay mỗi màu)
4. Sau khi hết màu → Click layer tiếp theo
5. Sau khi hết layer → Click item tiếp theo
6. Lặp lại cho đến khi hoàn thành tất cả item

### Cấu trúc folder logic:
- **Picrew Mode**: `Maker_{ID}/{ItemName}/{ColorHex}/`
- **Chế độ thường**: `{FolderName}/`
- **Lưu ý**: Tất cả layer của cùng một màu sẽ lưu chung trong folder màu đó

---

## 🎉 Tính năng nổi bật

1. ✅ **Tự động hoàn toàn**: Chỉ cần bật extension và chọn item → Tự động tải tất cả
2. ✅ **Tổ chức file thông minh**: Folder tự động theo Maker → Item → Màu → Layer
3. ✅ **UI thân thiện**: Tự động ẩn/hiện các phần không cần thiết
4. ✅ **Ổn định**: Xử lý lỗi tốt, không crash khi extension reload
5. ✅ **Log chi tiết**: Dễ debug và theo dõi quá trình

---

## 📌 Lưu ý

- Extension KHÔNG tự động tải khi vừa load trang (chỉ tải khi bấm nút)
- Extension tự động tạo folder nếu chưa tồn tại
- Counter reset về 1 khi bắt đầu layer mới (để mỗi folder màu có 1.jpg, 2.jpg, 3.jpg...)
- Counter KHÔNG reset khi đổi màu (để các folder màu có cùng số file)
- Tên Item sử dụng `data-key` (ID số) vì Picrew không cung cấp tên text
- Tự động bỏ qua layer không có bảng màu (layer X - ẩn)
- Thời gian chờ giữa các màu: 1.5 giây (có thể điều chỉnh)
- Thời gian chờ sau khi click layer/item: 1.5 giây

---

**Phiên bản**: 1.0  
**Ngày cập nhật**: 2024

