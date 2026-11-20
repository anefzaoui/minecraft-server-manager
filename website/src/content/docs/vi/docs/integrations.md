---
title: 'Tích hợp'
description: 'Mỗi máy chủ đều có các tích hợp của riêng mình trong nhóm Cài đặt: Discord, Trang trạng thái công khai, Lời mời một cú nhấp chuột và tab Chatbot tùy chọn (chỉ dành cho quản trị viên).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Mỗi máy chủ đều có các tích hợp riêng trong nhóm **Cài đặt**: **Discord**, **Trang trạng thái** công khai, **Lời mời** chỉ với một cú nhấp chuột và tab **Chatbot** tùy chọn (chỉ dành cho quản trị viên). Trang này đề cập đến Discord; [lời mời & trang trạng thái](/docs/invites-and-status-page/) bao gồm hai mục đó, và [chatbot](/docs/chatbot/) có trang riêng.

## Thông báo Discord

Bảng điều khiển chuyển tiếp các sự kiện của máy chủ đến một kênh Discord thông qua webhook. Không cần bot, không cần OAuth.

### Thiết lập

1. Trong Discord: **Cài đặt máy chủ → Tích hợp → Webhooks → Webhook mới**. Chọn kênh và sao chép URL webhook.
2. Trong bảng điều khiển, mở tab **Cài đặt → Discord** của máy chủ, dán URL vào **URL Webhook**, bật thẻ **bật** và **Lưu**. URL được lưu trữ được mã hóa (trong cùng một kho lưu trữ khi nghỉ như khóa API của bạn).
3. Sử dụng **Gửi thử nghiệm** để xác nhận hoạt động.

![Tích hợp Discord](/docs/images/integrations-discord.png)

Để thay thế một URL đã lưu, hãy dán một URL mới và lưu; để trống trường để giữ nguyên URL hiện tại. URL đã lưu được hiển thị dưới dạng che giấu (token bị ẩn).

### Nội dung được gửi

Thông báo được nhóm thành các danh mục có thể bật/tắt. Tất cả đều được bật theo mặc định.

| Danh mục             | Sự kiện                                                      |
| -------------------- | ------------------------------------------------------------ |
| **Khởi động / Dừng** | Máy chủ đã khởi động, máy chủ đã dừng                        |
| **Sự cố**            | Sự cố, phát hiện vòng lặp sự cố, báo cáo sự cố mới           |
| **Sao lưu**          | Đã tạo bản sao lưu, đã khôi phục bản sao lưu                 |
| **Cập nhật**         | Đã áp dụng cập nhật, đã hoàn tác cập nhật, cập nhật thất bại |
| **Đá / Cấm**         | Người chơi bị đá, người chơi bị cấm                          |
| **Cảnh báo**         | Những thứ âm thầm làm hỏng máy chủ (xem bên dưới)            |

### Danh mục Cảnh báo

`Cảnh báo` là kênh "cần người xử lý", dành cho các điều kiện trước đây chỉ hiển thị trong bảng điều khiển:

| Sự kiện                 | Ý nghĩa                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Container đã bị dừng do hết bộ nhớ.                                                                                        |
| `unhealthy`             | Tiến trình đang chạy nhưng kiểm tra `mc-health` đang thất bại: máy chủ hoạt động nhưng không ổn định.                      |
| `startup-stalled`       | Vẫn đang khởi động sau khoảng 10 phút mà không có "Done" trong nhật ký (kèm theo chẩn đoán về những gì cần sửa, nếu biết). |
| `stop-failed`           | Việc dừng máy chủ không thành công và container vẫn đang chạy.                                                             |
| `schedule-failed`       | Việc khởi động lại / sao lưu / lệnh theo lịch trình đã thất bại.                                                           |
| `quota-exceeded`        | Hạn ngạch đĩa chế độ nghiêm ngặt đã bị vi phạm và máy chủ đã bị dừng.                                                      |
| `offline-after-restart` | Máy chủ đã hoạt động trước khi bảng điều khiển khởi động lại, hiện tại không hoạt động và sẽ không tự động khởi động lại.  |
| `port-change-failed`    | Việc thay đổi cổng đã thất bại và máy chủ không thể được đặt lại về cổng cũ, do đó máy chủ bị dừng.                        |
| `auto-restart-gave-up`  | Máy chủ bị sự cố đã không được khởi động lại vì một hành động khác đã giữ nó bận quá lâu.                                  |

### Cách thức hoạt động của việc gửi thông báo

Một cầu nối nền sẽ kiểm tra [nhật ký sự kiện](/docs/activity/) sau mỗi 15 giây và chuyển tiếp các hàng đã được ánh xạ. Nếu một yêu cầu POST webhook thất bại tạm thời, hàng đó sẽ được thử lại trong các lần kiểm tra sau thay vì bị bỏ qua; sau vài lần thử thất bại, hàng đó sẽ bị bỏ qua và các lỗi gửi thông báo sẽ được ghi nhật ký tối đa một lần mỗi giờ cho mỗi máy chủ. Sau khi bảng điều khiển khởi động lại, cầu nối sẽ gửi các sự kiện mà nó chưa gửi được, nhưng không bao giờ quá hai giờ trước đó; trong lần chạy đầu tiên, nó bắt đầu từ sự kiện mới nhất.
