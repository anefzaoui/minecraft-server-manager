---
title: 'Bảng điều khiển'
description: 'Bảng điều khiển là trung tâm của bạn: hiển thị mọi máy chủ, trạng thái trực tiếp của chúng và nguồn cấp dữ liệu hoạt động gần đây.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Bảng điều khiển là trung tâm của bạn: mọi máy chủ, trạng thái trực tiếp của chúng và nguồn cấp dữ liệu liên tục về những gì đã xảy ra.

![Bảng điều khiển](/docs/images/dashboard.png)

## Các ô tóm tắt

Ở phía trên cùng:

- **Máy chủ đang hoạt động**: số lượng máy chủ của bạn hiện đang chạy, trên tổng số.
- **Người chơi đang kết nối**: tổng số người chơi trên tất cả các máy chủ đang chạy.
- **Cập nhật có sẵn**: bao nhiêu máy chủ, gói hoặc mod có phiên bản mới hơn ([xem Cập nhật](/docs/updates/)).
- **Docker**: liệu bảng điều khiển có thể truy cập được daemon Docker và phiên bản của nó hay không.

Một hàng thứ hai bổ sung **Bộ nhớ được cấp phát** (và lượng đang sử dụng), **Dung lượng lưu trữ đã sử dụng** trên tất cả các thư mục dữ liệu máy chủ, **Tình trạng · 24 giờ** (sự cố, dừng do hết bộ nhớ và tự động khởi động lại trong ngày qua), và **Cập nhật** được chia thành cập nhật mod và cập nhật cấp máy chủ. Bên dưới chúng, **Máy chủ theo Trạng thái** đếm số máy chủ của bạn ở mỗi trạng thái và **Tổng quan Tài nguyên** biểu đồ phần chia sẻ bộ nhớ và CPU của mỗi máy chủ.

## Thẻ máy chủ

Mỗi máy chủ hiển thị dưới dạng một thẻ với trạng thái của nó (Đang chạy, Đang khởi động, Đã dừng, Bị lỗi và các trạng thái ở giữa như Không lành mạnh hoặc Bị kẹt), loại và phiên bản Minecraft, cổng trò chơi và các thẻ của nó. Mỗi thẻ hiển thị **người chơi** và mức sử dụng **đĩa** so với hạn ngạch; các máy chủ đang chạy cũng hiển thị **CPU** và **bộ nhớ** trực tiếp, được cập nhật liên tục.

Nhấp vào một thẻ để mở máy chủ đó. Thẻ **Tạo máy chủ** trống và nút **Tạo máy chủ** ở thanh trên cùng đều khởi động [trình hướng dẫn tạo](/docs/servers/).

Bạn có thể tìm kiếm máy chủ của mình (theo tên, loại, phiên bản hoặc thẻ), sắp xếp chúng theo trạng thái, tên, kích thước, lần cuối khởi động hoặc tạo, và chuyển đổi giữa bố cục lưới và danh sách bằng công tắc ở bên phải.

## Hoạt động gần đây

Nguồn cấp dữ liệu ở dưới cùng hiển thị các mục mới nhất từ nhật ký kiểm toán dễ đọc của bảng điều khiển: đăng nhập, sao lưu, xuất bản thiết kế, kiểm tra cập nhật, thay đổi lệnh trò chuyện, khởi động và dừng máy chủ, v.v. Mỗi mục được gắn thẻ với máy chủ mà nó thuộc về (hoặc chính bảng điều khiển) và thời gian xảy ra. **Xem tất cả** mở lịch sử đầy đủ trên trang [Hoạt động](/docs/activity/).
