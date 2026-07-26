# Live Translate cho tab (Gemini)

Extension Chrome dịch audio của tab hiện tại sang tiếng Việt (hoặc 70+ ngôn ngữ khác) theo thời gian thực bằng model `gemini-3.5-live-translate-preview` — chỉ cần **1 click**, không cần vào Google AI Studio và làm thủ công các bước chọn model / share tab audio.

## Cài đặt

1. Tải source (`Code → Download ZIP`, giải nén) hoặc `git clone` repo này.
2. Mở `chrome://extensions`, bật **Developer mode** (góc phải trên).
3. Bấm **Load unpacked** và chọn thư mục vừa giải nén.
4. Click icon extension lần đầu → trang Cài đặt tự mở:
   - Dán **Gemini API key** (lấy miễn phí tại [aistudio.google.com/apikey](https://aistudio.google.com/apikey), không cần thẻ). Bấm **Kiểm tra** để xác nhận key hoạt động.
   - Chọn **ngôn ngữ đích** (mặc định: Tiếng Việt).
   - Bấm **Lưu**.

> Lưu ý: file `.crx` tải trực tiếp từ mạng sẽ bị Chrome chặn cài (chính sách từ Chrome 75). Cách cài đúng là **Load unpacked** như trên, hoặc chờ bản trên Chrome Web Store.

## Sử dụng

- Mở tab đang phát nội dung cần dịch (YouTube, Coursera, webinar, Zoom Web…).
- **Click icon extension** → badge hiện `ON`, audio gốc tắt tiếng, audio dịch phát ra kèm phụ đề (bản dịch + lời gốc) nổi ở cuối trang.
- **Click lần nữa** để dừng — audio gốc trở lại bình thường.
- Chuyển sang dịch tab khác: cứ click icon ở tab đó, phiên cũ tự dừng.

## Chi phí

Model Live Translate có **free tier** (0đ, không cần thẻ) — giống hệt khi dùng trực tiếp trên aistudio.google.com/live. Nếu dùng vượt hạn mức free tier và bạn đã bật billing thì mới bị tính (~$0.037/phút audio). Lưu ý free tier: Google có thể dùng dữ liệu để cải thiện sản phẩm.

## Bảo mật & quyền riêng tư

- API key chỉ lưu trong `chrome.storage.local` trên máy bạn, chỉ được gửi tới `generativelanguage.googleapis.com` (máy chủ Google) qua TLS.
- Extension **không** chạy script trên các trang web bạn duyệt; phụ đề chỉ được chèn vào đúng tab bạn bấm dịch (quyền `activeTab`).
- Không có mã từ xa, không analytics, không gửi dữ liệu cho bên thứ ba. CSP khóa kết nối chỉ cho phép tới Google.

## Đóng gói (dành cho dev)

```bash
./build.sh          # tạo dist/live-translate-tab-gemini-v<version>.zip
./build.sh --crx    # tạo cả .zip và .crx (cần Google Chrome)
```

- `.zip` là file dùng để upload lên [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (phí đăng ký $5 một lần).
- `.crx` chỉ hữu ích khi tự phân phối qua enterprise policy. Lần đầu chạy `--crx` sẽ sinh `key.pem` ở gốc project — **backup file này và không bao giờ commit nó**, vì extension ID được suy ra từ nó; mất key là mất khả năng phát hành bản cập nhật cho người dùng cũ.
- Muốn ra bản mới: sửa `version` trong `manifest.json` rồi build lại.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Badge `ERR` khi click | Trang hệ thống (`chrome://`, Web Store) không bắt được audio — thử trên trang web thường. |
| "Không kết nối được. Kiểm tra lại API key" | Mở Cài đặt → bấm **Kiểm tra** key; tạo key mới nếu cần. |
| Có phụ đề nhưng không nghe tiếng dịch | Kiểm tra âm lượng hệ thống; thử dừng và bật lại. |
| Mất phụ đề sau khi chuyển trang trong tab | Audio vẫn dịch tiếp; click icon 2 lần (dừng + bật lại) để hiện lại phụ đề. |
| "Mất kết nối — đang thử lại…" | Mạng chập chờn; extension tự kết nối lại tối đa 4 lần. |
