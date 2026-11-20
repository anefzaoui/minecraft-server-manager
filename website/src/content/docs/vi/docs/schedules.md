---
title: 'Lịch trình'
description: 'Trang Lịch trình tự động hóa các tác vụ định kỳ bằng biểu thức cron. Không cần cron bên ngoài, không cần script.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Lịch trình** tự động hóa các tác vụ định kỳ bằng biểu thức cron. Không cần cron bên ngoài, không cần script.

![Lịch trình](/docs/images/schedules.png)

## Những gì bạn có thể lên lịch

- **Khởi động lại**: khởi động lại máy chủ hàng đêm để giữ cho máy chủ hoạt động lâu dài luôn khỏe mạnh.
- **Dừng và khởi động**: tắt máy chủ qua đêm và bật lại vào buổi sáng.
- **Sao lưu**: ảnh chụp nhanh định kỳ (được gắn thẻ `scheduled` trên trang [Sao lưu](/docs/backups/)). Lịch sao lưu cũng có thể thu nhỏ thế giới sau mỗi lần sao lưu ([thu nhỏ thế giới](/docs/world-shrink/)). Mỗi máy chủ mới sẽ tự động nhận lịch sao lưu hàng ngày.
- **Lệnh**: chạy bất kỳ lệnh máy chủ nào theo lịch trình.
- **Kiểm tra cập nhật**: làm mới định kỳ những gì đã lỗi thời. Lần kiểm tra theo lịch trình cũng là thứ áp dụng các bản cập nhật cho các máy chủ được đặt thành [Tự động cập nhật](/docs/modpacks/#update-policy).

Mỗi lịch trình nhắm mục tiêu đến một máy chủ cụ thể (hoặc bảng điều khiển toàn cầu), chạy bằng biểu thức cron riêng và có thể được bật hoặc tắt mà không cần xóa. Trình chỉnh sửa xem trước các thời điểm chạy tiếp theo khi bạn nhập, thời gian cron tuân theo múi giờ của bảng điều khiển (được đặt trong **Cài đặt**), và bảng hiển thị lần chạy tiếp theo của mỗi lịch trình. Mỗi lần kích hoạt được ghi lại dưới dạng một sự kiện lịch sử, và cả những lần chạy thất bại.

Bảng điều khiển cũng tự thiết lập các lịch trình bảo trì của riêng nó khi khởi động lần đầu, mà bạn có thể đặt lại thời gian hoặc tắt: kiểm tra cập nhật hàng ngày, quét lại bộ nhớ lưu trữ sau mỗi sáu giờ, xóa các tệp tạm thời cũ hàng ngày, quét hết hạn cấm sau mỗi 15 phút (gỡ bỏ các lệnh cấm tạm thời đã hết hạn), và điền siêu dữ liệu nội dung vào ban đêm (điền tên và biểu tượng mod bị thiếu).

## Khi máy chủ bận

Một lần sao lưu hoặc khởi động theo lịch trình tìm thấy máy chủ của nó đang ở giữa một hành động khác (khôi phục, dọn dẹp sao lưu, thay đổi cổng) sẽ chờ và thử lại mỗi phút cho đến khi hành động đó hoàn tất, tối đa 30 phút. Một lần khởi động đang chờ sẽ bị hủy bỏ nếu ai đó khởi động hoặc dừng máy chủ trong thời gian đó. Một lần khởi động lại hoặc dừng theo lịch trình sẽ không được thử lại: nó sẽ bị bỏ qua và chạy lại vào thời điểm tiếp theo.
