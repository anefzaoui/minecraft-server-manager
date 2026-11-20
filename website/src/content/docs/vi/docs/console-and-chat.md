---
title: 'Bảng điều khiển & lệnh trò chuyện'
description: 'Tab Bảng điều khiển truyền nhật ký máy chủ theo thời gian thực và cung cấp cho bạn một hộp lệnh để gửi bất kỳ lệnh nào của máy chủ.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Quay lại mục lục tài liệu](/docs/)

## Bảng điều khiển trực tiếp

Tab **Bảng điều khiển** (Console) truyền nhật ký máy chủ theo thời gian thực và cung cấp một ô nhập lệnh để bạn gửi bất kỳ lệnh nào của máy chủ. Không cần `docker exec`, không cần SSH. Đầu ra hiển thị ngay lập tức, bao gồm cả màu sắc. Việc gửi lệnh yêu cầu quyền Console trên máy chủ đó; nếu không có quyền này, bạn vẫn có thể xem nhật ký.

Phía trên nhật ký, bạn có thể lọc các dòng theo văn bản (hoặc `/biểu thức chính quy/`) và theo cấp độ (INFO, WARN, ERROR). Nút **Tải xuống** (Download) cung cấp đầu ra gần đây, tệp `latest.log` đầy đủ hoặc tất cả các tệp nhật ký dưới dạng tệp zip.

![Bảng điều khiển](/docs/images/server-console.png)

Bảng điều khiển cũng là nơi bảng quản lý đọc trạng thái của máy chủ: nó theo dõi nhật ký để phân loại giai đoạn khởi động ("Đang tải mod", "Đang tạo thế giới", "Hoàn tất khởi động") và gọi lệnh `list` để theo dõi những người đang trực tuyến, do đó bảng điều khiển và các thẻ máy chủ luôn phản ánh thực tế.

Việc thăm dò này mở một kết nối RCON tồn tại trong thời gian ngắn mỗi chu kỳ, mà máy chủ ghi lại dưới dạng một cặp `Thread RCON Client … started` / `shutting down` sau khoảng ~20 giây, và (trên các máy chủ mà lõi hoặc plugin của chúng lặp lại) một dòng `Rcon issued server command: …` cho mỗi lần đọc không ghi (`list` để đếm người chơi, cộng với các lệnh đọc `time query …` và `gamerule <name>` khi World Controls đang mở). Nút chuyển đổi **Ẩn tiếng ồn bảng điều khiển** (Hide Console Noise) phía trên nhật ký sẽ lọc bỏ các dòng đó (cùng với các dòng khởi động trình lắng nghe RCON). Nút này được bật theo mặc định và được ghi nhớ cho mỗi trình duyệt; hãy tắt nó để xem luồng thô.

Các lệnh được gửi từ bảng quản lý có thể được thông báo trong trò chơi dưới một nhãn riêng cho mỗi máy chủ (hộp **Thông báo dưới dạng…** (Announce as…)), để người chơi biết một quản trị viên đã hành động thay vì một bảng điều khiển bí ẩn.

## Trò chuyện

**Bảng điều khiển → Trò chuyện** (Console → Chat) gửi tin nhắn vào trò chơi khi máy chủ đang chạy: Tin nhắn **Định dạng** (Styled) nhận màu sắc và định dạng, có thể gửi đến mọi người hoặc một người chơi trực tuyến, và tin nhắn **Thường** (Plain) gửi một bản phát sóng đơn giản `[Server]` đến mọi người.

![Bảng điều khiển → Trò chuyện](/docs/screenshots/04-chat.png)

## Lệnh trò chuyện

Các lệnh trò chuyện (**Bảng điều khiển → Lệnh** (Console → Commands)) cho phép người chơi kích hoạt các hành động của bảng quản lý bằng cách nhập một lệnh tiền tố trong trò chuyện của máy chủ, ví dụ: `!spawn` để dịch chuyển ngẫu nhiên. Việc phát hiện dựa trên nhật ký và thực thi thông qua máy chủ, vì vậy **không cần mod**.

![Lệnh trò chuyện](/docs/images/chat-commands.png)

Mỗi lệnh có:

- Một **kích hoạt** (ví dụ: `spawn`), được nhập sau **tiền tố** của máy chủ (`!` theo mặc định, một hoặc hai ký tự, không bao giờ là `/`).
- Một **hành động**: dịch chuyển ngẫu nhiên, dịch chuyển đến một công trình, dịch chuyển đến một quần xã sinh vật, hoặc chạy các lệnh bảng điều khiển thô.
- Một **cấp độ quyền**: mọi người, người chơi trong danh sách trắng, hoặc chỉ quản trị viên.
- Một **thời gian chờ** cho mỗi người chơi (30 giây theo mặc định), và các thông báo tùy chỉnh cho việc chờ đợi / thành công / thất bại với các chỗ giữ chỗ như `{distance}`.

### Lưu ý về an toàn

Các lệnh có thể phá hoại máy chủ (`stop`, `op`, `ban`, `whitelist` và các lệnh tương tự) chỉ được phép với các kích hoạt **chỉ dành cho quản trị viên**. Bảng quản lý kiểm tra các lệnh này ngay cả khi chúng được lồng bên trong một chuỗi `execute … run …`, vì vậy một kích hoạt có quyền thấp không thể đưa một lệnh nguy hiểm vào. Văn bản trò chuyện thông thường chỉ đề cập đến các từ đó (như tin nhắn `say`) sẽ không bị ảnh hưởng.
