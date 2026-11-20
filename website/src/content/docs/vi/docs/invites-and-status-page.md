---
title: 'Lời mời & trang trạng thái'
description: 'Mời bạn bè đến một máy chủ với địa chỉ, phiên bản và gói mod client, đồng thời chia sẻ một trang trạng thái công khai hiển thị những gì bạn chọn.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Hai tab trong nhóm **Cài đặt** của máy chủ giúp người chơi tìm và tham gia máy chủ: **Lời mời** ghi lại mọi thứ bạn bè cần để kết nối, và **Trang trạng thái** xuất bản một trang công khai nhỏ hiển thị liệu máy chủ có đang hoạt động hay không. Cả hai đều yêu cầu quyền **Cài đặt** của máy chủ ([người dùng & vai trò](/docs/users-and-roles/#per-server-permissions)).

## Lời mời

**Cài đặt → Lời mời** có một thẻ **Mời bạn bè**:

- **Địa chỉ để chia sẻ** liệt kê các địa chỉ của máy trên mạng cục bộ của bạn cùng với cổng trò chơi của máy chủ, địa chỉ công cộng của bạn khi bảng điều khiển có thể phát hiện ra nó (người chơi bên ngoài mạng của bạn chỉ có thể truy cập qua chuyển tiếp cổng), và **Địa chỉ tùy chỉnh…** cho một tên miền hoặc địa chỉ bạn tự thiết lập, chẳng hạn như `play.example.com:25565`.
- **Văn bản lời mời** là một tin nhắn sẵn sàng để dán với tên máy chủ, địa chỉ bạn đã chọn, phiên bản và loại Minecraft của nó. **Sao chép văn bản lời mời** sẽ đưa nó vào bảng nhớ tạm. Khi danh sách trắng được bật, văn bản sẽ yêu cầu bạn bè cung cấp tên người dùng Minecraft của họ, và thẻ sẽ nhắc bạn thêm từng người bạn vào tab **Người chơi** trước khi họ tham gia.
- **Bạn bè cần gì** cho biết những gì cần ở phía người chơi: không gì khác ngoài phiên bản Minecraft phù hợp cho máy chủ vanilla hoặc plugin (Paper và tương tự), hoặc các mod của máy chủ cho máy chủ đã cài mod.

### Gói mod client

Trên máy chủ đã cài mod, thẻ cũng cung cấp **Tải xuống gói mod client (.mrpack)**. Bạn bè nhập nó vào Prism Launcher hoặc Modrinth App, ứng dụng này sẽ cài đặt phiên bản Minecraft và trình tải mod của máy chủ, tải xuống các mod và thêm máy chủ vào danh sách nhiều người chơi của họ với địa chỉ bạn đã chọn.

Tệp được tạo từ các mod bạn tự thêm vào máy chủ (lớp phủ mod tùy chỉnh) có nguồn gốc từ Modrinth. Các mod từ các nguồn khác được liệt kê trên thẻ thay thế, vì vậy bạn bè có thể tự tay thêm các tệp đó vào thư mục `mods` của họ. Trên một máy chủ được tạo từ gói mod, bạn bè nên cài đặt gói đó, ở phiên bản mà máy chủ đang chạy, trong trình khởi chạy của họ; tab **Tổng quan** hiển thị phiên bản.

### Chơi qua internet

**Chơi qua internet (chuyển tiếp cổng)** ở cuối thẻ giải thích về phía bộ định tuyến: chuyển tiếp cổng trò chơi của máy chủ (TCP và UDP) đến máy chạy bảng điều khiển, sau đó chia sẻ địa chỉ công cộng của bạn cùng với cổng. Nếu nhà cung cấp dịch vụ internet của bạn sử dụng CGNAT, chuyển tiếp cổng sẽ không hoạt động và dịch vụ đường hầm (ví dụ: playit.gg) là cách để truy cập. Bảng điều khiển không tự mở cổng bộ định tuyến. Chỉ các cổng trò chơi mới thuộc về internet; giữ các cổng riêng của bảng điều khiển và các cổng RCON đóng ([cổng tổng quan](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Trang trạng thái

**Cài đặt → Trang trạng thái** bật một trang công khai cho một máy chủ, mặc định là tắt:

1. Bật thẻ.
2. Chọn **Địa chỉ trang**: trang sẽ nằm tại `/status/<address>` trên bảng điều khiển của bạn, và địa chỉ là 3 đến 40 chữ cái thường, số hoặc dấu gạch ngang, duy nhất trên tất cả các máy chủ của bạn.
3. Nhấn **Lưu**. **Mở trang** và **Sao chép liên kết** sau đó cung cấp cho bạn liên kết để chia sẻ.

Bất kỳ ai có liên kết đều thấy tên máy chủ, MOTD, phiên bản, liệu nó có đang chạy hay không, số lượng người chơi và thời gian hoạt động, và không gì khác. Trang không có liên kết vào bảng điều khiển và không yêu cầu đăng nhập. Nó đọc trạng thái trong bộ nhớ của bảng điều khiển, vì vậy khách truy cập không bao giờ gây ra công việc cho Docker daemon.

Tắt trang sẽ giữ nguyên địa chỉ của nó, vì vậy bật lại sẽ khôi phục cùng một liên kết. Đối với trang hoặc bot của riêng bạn, [API công khai](/docs/public-api/) trả về cùng loại trạng thái dưới dạng JSON.

Liên quan: [Thông báo Discord](/docs/integrations/), [bản đồ trực tiếp](/docs/live-map/), [tạo và quản lý máy chủ](/docs/servers/).
