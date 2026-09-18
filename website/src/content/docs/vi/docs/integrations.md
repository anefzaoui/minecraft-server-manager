---
title: 'Tích hợp'
description: 'Mỗi máy chủ đều có các tích hợp của riêng mình trong nhóm Cài đặt: Discord, Trang trạng thái công khai, Lời mời một cú nhấp chuột và tab Chatbot tùy chọn.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Mỗi máy chủ mang các tích hợp của mình trong nhóm **Cài đặt**: **Discord**, **Trang trạng thái** công khai, **Lời mời** chỉ với một cú nhấp chuột và tab **Trò chuyện tự động** tùy chọn. Trang này bao gồm Discord (các mục khác có tài liệu và trợ giúp thiết lập riêng trong bảng điều khiển).

## Thông báo Discord

Bảng điều khiển chuyển tiếp các sự kiện của máy chủ đến một kênh Discord thông qua webhook. Không cần bot, không cần OAuth.

### Thiết lập

1. Trong Discord: **Cài đặt máy chủ → Tích hợp → Webhooks → Webhook mới**. Chọn kênh và sao chép URL webhook.
2. Trong bảng điều khiển, mở tab **Cài đặt → Discord** của máy chủ, dán URL vào **URL Webhook**, bật thẻ **bật** và **Lưu**. URL được lưu trữ được mã hóa (trong cùng một bộ lưu trữ khi nghỉ như khóa API của bạn).
3. Sử dụng **Gửi bài kiểm tra** để xác nhận hoạt động.

![Tích hợp Discord](/docs/images/integrations-discord.png)

Để thay thế một URL đã lưu, hãy dán một URL mới và lưu; để trống trường để giữ nguyên URL hiện tại. URL đã lưu được hiển thị che giấu (mã thông báo bị ẩn).

### Những gì được gửi

Thông báo được nhóm thành các danh mục có thể bật/tắt. Tất cả đều được bật theo mặc định.

| Danh mục           | Sự kiện                                                      |
| ------------------ | ------------------------------------------------------------ |
| **Bắt đầu / dừng** | Máy chủ đã khởi động, máy chủ đã dừng                        |
| **Sự cố**          | Sự cố, phát hiện vòng lặp sự cố, báo cáo sự cố mới           |
| **Sao lưu**        | Đã tạo bản sao lưu, đã khôi phục bản sao lưu                 |
| **Cập nhật**       | Đã áp dụng cập nhật, đã hoàn tác cập nhật, cập nhật thất bại |
| **Đá / cấm**       | Người chơi bị đá, người chơi bị cấm                          |
| **Cảnh báo**       | Những thứ lặng lẽ làm hỏng máy chủ (xem bên dưới)            |

### Danh mục Cảnh báo

`Cảnh báo` là kênh "cần người xử lý", dành cho các điều kiện trước đây chỉ hiển thị trong bảng điều khiển:

| Sự kiện                 | Ý nghĩa                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Container đã bị dừng do hết bộ nhớ.                                                                                   |
| `unhealthy`             | Tiến trình đang chạy nhưng kiểm tra `mc-health` đang thất bại: một máy chủ hoạt động nhưng không ổn định.             |
| `startup-stalled`       | Vẫn đang khởi động sau khoảng 10 phút mà không có "Done" trong nhật ký (với chẩn đoán về những gì cần sửa, nếu biết). |
| `stop-failed`           | Việc dừng máy chủ một cách êm ái không có hiệu lực và container vẫn đang chạy.                                        |
| `schedule-failed`       | Việc khởi động lại / sao lưu / lệnh theo lịch trình đã thất bại.                                                      |
| `quota-exceeded`        | Hạn ngạch đĩa chế độ nghiêm ngặt đã bị vi phạm và máy chủ đã bị dừng.                                                 |
| `offline-after-restart` | Máy chủ đã hoạt động trước khi bảng điều khiển khởi động lại, hiện không hoạt động và sẽ không tự động khởi động lại. |
| `crash-report`          | Một báo cáo sự cố mới đã được ghi lại và phân tích cú pháp.                                                           |
| `update-failed`         | Nâng cấp được giám sát không hoạt động ổn định.                                                                       |

### Cách thức phân phối hoạt động

Một cầu nối nền sẽ kiểm tra [nhật ký hoạt động](/docs/activity/) sau mỗi 15 giây và chuyển tiếp các hàng đã được ánh xạ. Nếu một POST webhook thất bại tạm thời, hàng đó sẽ được thử lại trong các lần kiểm tra sau thay vì bị bỏ qua; một webhook không thể truy cập vĩnh viễn sẽ bị tắt tiếng (một dòng nhật ký mỗi giờ) sau vài lần thử. Cầu nối không bao giờ phát lại các sự kiện từ trước khi bảng điều khiển khởi động.
