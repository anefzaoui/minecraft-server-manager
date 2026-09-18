---
title: 'Bảng điều khiển'
description: 'Bảng điều khiển là trung tâm của bạn: hiển thị mọi máy chủ, trạng thái trực tiếp của chúng và nguồn cấp dữ liệu hoạt động gần đây.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Bảng điều khiển là trung tâm của bạn: mọi máy chủ, trạng thái trực tiếp của chúng và nguồn cấp dữ liệu về những gì đã xảy ra.

![Bảng điều khiển](/docs/images/dashboard.png)

## Các ô tóm tắt

Ở phía trên cùng:

- **Máy chủ trực tuyến** - số lượng máy chủ của bạn hiện đang chạy.
- **Người chơi kết nối** - tổng số người chơi trên tất cả các máy chủ đang chạy.
- **Bản cập nhật có sẵn** - bao nhiêu máy chủ, gói hoặc mod có phiên bản mới hơn ([xem Cập nhật](/docs/updates/)).
- **Docker** - liệu bảng điều khiển có thể truy cập được daemon Docker và phiên bản của nó hay không.

## Thẻ máy chủ

Mỗi máy chủ hiển thị dưới dạng một thẻ với trạng thái (Đang chạy, Đang khởi động, Đã dừng, Bị lỗi), loại và phiên bản Minecraft, cùng cổng trò chơi của nó. Đối với các máy chủ đang chạy, bạn cũng nhận được thông tin **người chơi**, **CPU**, **bộ nhớ** và **đĩa** trực tiếp, được cập nhật liên tục.

Nhấp vào một thẻ để mở máy chủ đó. Thẻ **Tạo máy chủ** trống và nút **Tạo máy chủ** ở thanh trên cùng đều khởi động [trình hướng dẫn tạo](/docs/servers/).

Bạn có thể tìm kiếm và sắp xếp các máy chủ của mình, đồng thời chuyển đổi giữa bố cục lưới và danh sách bằng công tắc ở bên phải.

## Hoạt động gần đây

Nguồn cấp dữ liệu ở phía dưới là một nhật ký kiểm toán trực tiếp, dễ đọc: đăng nhập, sao lưu, xuất bản thiết kế, kiểm tra cập nhật, thay đổi lệnh trò chuyện, khởi động và dừng máy chủ, v.v. Mỗi mục nhập được gắn thẻ với máy chủ mà nó thuộc về (hoặc chính bảng điều khiển) và thời gian xảy ra. Toàn bộ lịch sử nằm trên trang [Hoạt động](/docs/activity/).
