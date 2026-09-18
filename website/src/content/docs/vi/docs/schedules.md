---
title: 'Lịch trình'
description: 'Trang Lịch trình tự động hóa các tác vụ định kỳ bằng biểu thức cron.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Lịch trình** tự động hóa các tác vụ định kỳ bằng biểu thức cron. Không cần cron bên ngoài, không cần script.

![Lịch trình](/docs/images/schedules.png)

## Những gì bạn có thể lên lịch

- **Khởi động lại** - khởi động lại máy chủ hàng đêm để giữ cho máy chủ chạy lâu được ổn định.
- **Sao lưu** - ảnh chụp nhanh định kỳ (được gắn thẻ `scheduled` trên trang [Sao lưu](/docs/backups/)).
- **Lệnh** - chạy bất kỳ lệnh máy chủ nào theo lịch trình.
- **Kiểm tra cập nhật** - làm mới định kỳ những gì đã lỗi thời.

Mỗi lịch trình nhắm mục tiêu đến một máy chủ cụ thể (hoặc bảng điều khiển trên toàn cầu), chạy bằng biểu thức cron riêng và có thể được bật hoặc tắt mà không cần xóa. Thời gian chạy cuối cùng được hiển thị để bạn có thể xác nhận nó đang hoạt động.
