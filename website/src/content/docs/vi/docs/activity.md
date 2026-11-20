---
title: 'Nhật ký hoạt động'
description: 'Trang Hoạt động là nhật ký kiểm toán đầy đủ: một bản ghi có thể tìm kiếm, theo thứ tự thời gian về mọi thứ đã xảy ra trong bảng điều khiển.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Hoạt động** là nhật ký kiểm toán đầy đủ: một bản ghi theo thời gian, có thể tìm kiếm, về mọi thứ đã xảy ra trong bảng điều khiển. Lọc theo máy chủ hoặc loại sự kiện, tìm kiếm tóm tắt và xuất những gì bạn đã lọc dưới dạng CSV hoặc JSON. Các mục ghi lại nhật ký (ví dụ: sự cố) sẽ mở nhật ký đó tại chỗ.

![Hoạt động](/docs/images/activity.png)

## Những gì được ghi lại

- **Xác thực**: đăng nhập (bao gồm việc có sử dụng 2FA hoặc mã dự phòng hay không), khóa tài khoản, thay đổi mật khẩu và bật, tắt hoặc đặt lại 2FA.
- **Vòng đời máy chủ**: tạo, khởi động, dừng, khởi động lại, sự cố, tự động khởi động lại và các sự kiện hết bộ nhớ.
- **Cảnh báo**: khởi động bị đình trệ, lỗi dừng, lịch trình thất bại, dừng do hạn ngạch, vùng chứa không khỏe, ngoại tuyến sau khi khởi động lại.
- **Dữ liệu**: tạo và khôi phục bản sao lưu, xuất bản thiết kế, cài đặt và nâng cấp gói, thay đổi mod và thế giới, và chỉnh sửa tệp.
- **Người chơi**: đá, cấm, thay đổi danh sách trắng và op, và ghi chú người chơi.
- **Cấu hình**: thay đổi lệnh trò chuyện, thay đổi người dùng và vai trò, thay đổi quyền cho từng máy chủ, thay đổi cổng trò chơi và chỉnh sửa cài đặt.

Mỗi mục ghi lại ai đã thực hiện (tên người dùng hoặc bảng điều khiển/lập lịch cho các hành động tự động), máy chủ nào liên quan và khi nào. [Bảng điều khiển](/docs/dashboard/) hiển thị các mục gần đây nhất; trang này là lịch sử đầy đủ. Người vận hành và người xem chỉ thấy các mục cho các máy chủ mà họ có thể xem (cộng với các mục toàn bảng điều khiển), và các thay đổi quyền cho từng máy chủ chỉ hiển thị cho quản trị viên. Các sự kiện vòng đời và cảnh báo cũng có thể được chuyển tiếp đến Discord (xem [Tích hợp](/docs/integrations/)).

Vì nó ghi lại các sự kiện liên quan đến bảo mật (đăng nhập, thay đổi 2FA, thay đổi vai trò và quyền), nhật ký hoạt động cũng là điểm dừng đầu tiên của bạn nếu có điều gì đó bất thường với một tài khoản.
