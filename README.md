# MikuYTBypass

Extension MV3 (Chrome/Edge) để giảm quảng cáo YouTube bằng 3 cách:

- Chặn một số domain/endpoint quảng cáo bằng `declarativeNetRequest`
- Ẩn các khối quảng cáo trên giao diện YouTube
- Tự bấm `Skip` và tua nhanh khi phát pre-roll/mid-roll ads

Bản hiện tại đã nâng lên mức bypass mạnh hơn:

- Tiêm script vào page context để lọc `adPlacements`, `playerAds`, `adSlots` từ response/player data
- Hook `fetch` theo endpoint player để sanitize JSON liên quan đến player
- Loại bỏ popup cảnh báo anti-adblock phổ biến của YouTube

Đã tối ưu hiệu năng:

- Bỏ hook `JSON.parse` toàn cục (nguyên nhân gây chậm trang)
- Bỏ quét sâu lặp vô hạn, chỉ sweep ngắn lúc vào trang và khi YouTube điều hướng
- Giảm tần suất vòng lặp UI, chỉ giữ vòng nhanh khi ở trang `/watch`

## Cài đặt (Load unpacked)

1. Mở `chrome://extensions` (hoặc `edge://extensions`)
2. Bật `Developer mode`
3. Chọn `Load unpacked`
4. Trỏ tới thư mục dự án này (`MikuYTBypass`)
5. Sau mỗi lần chỉnh code: bấm `Reload` extension ở trang extensions

## File chính

- `manifest.json`: khai báo extension + quyền + ruleset
- `rules.json`: danh sách luật chặn request quảng cáo
- `content.js`: logic ẩn/skip/tua quảng cáo trong player + xử lý popup
- `inject.js`: patch trực tiếp trong page context

## Lưu ý

- YouTube thay đổi liên tục, nên selector hoặc endpoint có thể cần cập nhật.
- Dùng cho mục đích cá nhân/local.
