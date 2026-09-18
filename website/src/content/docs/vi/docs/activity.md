---
title: 'Nhật ký hoạt động'
description: 'Trang Hoạt động là nhật ký kiểm toán đầy đủ: một bản ghi có thể tìm kiếm, theo thứ tự thời gian về mọi thứ đã xảy ra trong bảng điều khiển.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Hoạt động** là nhật ký kiểm toán đầy đủ: một bản ghi theo thời gian, có thể tìm kiếm về mọi thứ đã xảy ra trong bảng điều khiển.

![Hoạt động](/docs/images/activity.png)

## Những gì được ghi lại

- **Xác thực** - đăng nhập (bao gồm cả việc có sử dụng 2FA hay mã dự phòng hay không), và bật, tắt hoặc đặt lại 2FA.
- **Vòng đời máy chủ** - tạo, khởi động, dừng, khởi động lại, gặp sự cố và các sự kiện hết bộ nhớ.
- **Cảnh báo** - khởi động bị đình trệ, dừng thất bại, lịch trình thất bại, dừng do hạn ngạch, vùng chứa không khỏe, ngoại tuyến sau khi khởi động lại.
- **Dữ liệu** - tạo và khôi phục bản sao lưu, xuất bản thiết kế, cài đặt và nâng cấp gói.
- **Cấu hình** - thay đổi lệnh trò chuyện, thay đổi vai trò và chỉnh sửa cài đặt.

Mỗi mục nhập ghi lại ai đã thực hiện (tên người dùng hoặc bảng điều khiển/trình lập lịch cho các hành động tự động), máy chủ nào liên quan và khi nào. [Bảng điều khiển](/docs/dashboard/) hiển thị các mục nhập gần đây nhất; trang này là toàn bộ lịch sử. Các sự kiện vòng đời và cảnh báo cũng có thể được chuyển tiếp đến Discord (xem [Tích hợp](/docs/integrations/)).

Vì nó ghi lại các sự kiện liên quan đến bảo mật (đăng nhập, thay đổi 2FA, thay đổi vai trò), nhật ký hoạt động cũng là điểm dừng đầu tiên của bạn nếu có điều gì đó bất thường với một tài khoản.
