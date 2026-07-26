# 🎧 Live Translate

**Dịch audio của bất kỳ tab Chrome nào sang tiếng Việt, ngay lúc đang phát — chỉ 1 click.**

Đang xem khoá học Coursera, họp Zoom Web, webinar hay video YouTube tiếng Anh? Bấm icon extension một lần: bạn sẽ nghe giọng đọc tiếng Việt và thấy phụ đề nổi ở cuối trang, gần như tức thì.

- ⚡ **1 click** — không cần chọn model, không cần share tab, không cần setup gì thêm
- 🗣️ **Nghe + đọc** — vừa có giọng dịch, vừa có phụ đề (bản dịch kèm lời gốc)
- 🌍 **70+ ngôn ngữ** đích, mặc định tiếng Việt
- 💸 **Miễn phí** — dùng free tier của Google, không cần thẻ tín dụng
- 🔒 **Không thu thập dữ liệu** — không analytics, không server trung gian

Chạy bằng Live Translate API của Google AI Studio.

---

## 📥 Cài đặt (3 phút)

### Bước 1 — Tải extension

Bấm **Code → Download ZIP** ở đầu trang này, rồi **giải nén** file vừa tải.

> Giữ lại thư mục đã giải nén — đừng xoá, Chrome cần nó để chạy extension.

### Bước 2 — Nạp vào Chrome

1. Mở tab mới, vào `chrome://extensions`
2. Bật **Developer mode** (công tắc ở góc phải trên)
3. Bấm **Load unpacked** → chọn thư mục vừa giải nén
4. Ghim icon extension lên thanh công cụ cho dễ bấm (icon 🧩 → biểu tượng ghim)

### Bước 3 — Lấy API key miễn phí

1. Vào [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key** (đăng nhập Google là xong, **không cần thẻ**)
2. Copy key
3. Click icon extension → trang Cài đặt tự mở → dán key vào → bấm **Kiểm tra** → bấm **Lưu**

Xong. 🎉

---

## ▶️ Cách dùng

| | |
|---|---|
| **Bắt đầu dịch** | Mở tab đang phát nội dung → **click icon extension**. Badge hiện `ON`, tiếng gốc tắt, giọng dịch phát ra kèm phụ đề. |
| **Dừng** | **Click icon lần nữa.** Tiếng gốc trở lại bình thường. |
| **Đổi sang tab khác** | Cứ click icon ở tab mới — phiên cũ tự dừng. |
| **Đổi ngôn ngữ** | Click phải icon → **Options** → chọn ngôn ngữ đích → **Lưu**. |

---

## 💰 Chi phí

Model Live Translate có **free tier: 0đ, không cần thẻ** — giống hệt khi bạn dùng trực tiếp trên [aistudio.google.com/live](https://aistudio.google.com/live).

Chỉ khi bạn đã tự bật billing **và** dùng vượt hạn mức free tier thì mới bị tính phí (~$0.037/phút audio).

⚠️ Lưu ý về free tier: Google có thể dùng dữ liệu để cải thiện sản phẩm. Đừng dùng cho nội dung bảo mật.

---

## 🔒 Quyền riêng tư

- API key **chỉ lưu trên máy bạn** (`chrome.storage.local`), chỉ gửi tới máy chủ Google qua TLS
- Extension **không** chạy script trên các trang bạn duyệt — phụ đề chỉ chèn vào đúng tab bạn bấm dịch
- Không analytics, không mã tải từ xa, không bên thứ ba. Toàn bộ source code nằm ngay trong repo này, bạn đọc được hết.

---

## 🛠️ Gặp vấn đề?

| Hiện tượng | Cách xử lý |
|---|---|
| Badge hiện `ERR` | Trang hệ thống (`chrome://`, Chrome Web Store) không bắt được audio — thử trên trang web thường. |
| "Không kết nối được. Kiểm tra lại API key" | Mở Cài đặt → bấm **Kiểm tra**. Tạo key mới nếu cần. |
| Có phụ đề nhưng không nghe tiếng dịch | Kiểm tra âm lượng hệ thống, rồi click icon 2 lần (dừng + bật lại). |
| Mất phụ đề sau khi chuyển trang | Audio vẫn dịch tiếp; click icon 2 lần để hiện lại phụ đề. |
| "Mất kết nối — đang thử lại…" | Mạng chập chờn, extension tự kết nối lại tối đa 4 lần. |

---

## Dành cho developer

```bash
./build.sh          # tạo dist/live-translate-v<version>.zip
./build.sh --crx    # tạo cả .zip và .crx
```

Yêu cầu: Chrome 116+ (Manifest V3, `offscreen`, `tabCapture`).

File `.zip` dùng để upload lên Chrome Web Store. Lần đầu chạy `--crx` sẽ sinh `key.pem` — backup lại và **không commit**, vì extension ID được suy ra từ nó.

## Giấy phép

[MIT](LICENSE) — tự do dùng, sửa, phân phối. Copyright © 2026 Long Lagon.
