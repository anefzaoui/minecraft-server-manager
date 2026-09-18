---
title: 'Bảng điều khiển & lệnh trò chuyện'
description: 'Tab Bảng điều khiển truyền nhật ký máy chủ theo thời gian thực và cung cấp cho bạn một hộp lệnh để gửi bất kỳ lệnh nào của máy chủ.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Quay lại mục lục tài liệu](/docs/)

## Bảng điều khiển trực tiếp

Tab **Console** (Bảng điều khiển) hiển thị nhật ký máy chủ theo thời gian thực và cung cấp một ô nhập lệnh để bạn gửi bất kỳ lệnh nào của máy chủ. Không cần `docker exec`, không cần SSH. Đầu ra hiển thị ngay lập tức, bao gồm cả màu sắc.

![Console](/docs/images/server-console.png)

Bảng điều khiển cũng là nơi bảng quản lý đọc trạng thái của máy chủ: nó theo dõi nhật ký để phân loại giai đoạn khởi động ("Loading mods", "Generating world", "Finishing startup") và gọi lệnh `list` để theo dõi những người đang trực tuyến, vì vậy bảng điều khiển và các thẻ máy chủ luôn phản ánh thực tế.

Việc thăm dò này mở một kết nối RCON tồn tại trong thời gian ngắn mỗi chu kỳ, mà máy chủ ghi lại dưới dạng một cặp `Thread RCON Client … started` / `shutting down` sau mỗi ~20 giây, và (trên các máy chủ mà lõi hoặc plugin của chúng lặp lại) một dòng `Rcon issued server command: …` cho mỗi lần đọc chỉ đọc - `list` để đếm người chơi, cộng với `time query …` và các lần đọc `gamerule <name>` khi trang World Controls đang mở. Nút chuyển đổi **Hide RCON noise** (Ẩn tiếng ồn RCON) phía trên nhật ký lọc bỏ các dòng đó (cùng với các dòng khởi động trình nghe RCON). Nút này được bật theo mặc định và được ghi nhớ cho mỗi trình duyệt; hãy tắt nó để xem luồng thô.

Các lệnh được gửi từ bảng quản lý có thể được thông báo trong trò chơi dưới một nhãn riêng cho mỗi máy chủ, để người chơi biết rằng một người điều hành đã hành động thay vì một bảng điều khiển bí ẩn.

## Lệnh chat

Lệnh chat cho phép người chơi kích hoạt các hành động của bảng quản lý bằng cách nhập một lệnh có tiền tố trong trò chuyện của trò chơi, ví dụ: `!spawn` để dịch chuyển ngẫu nhiên. Việc phát hiện dựa trên nhật ký và việc thực thi thông qua máy chủ, vì vậy **không cần mod**.

![Chat commands](/docs/images/chat-commands.png)

Mỗi lệnh có:

- Một **trigger** (ví dụ: `spawn`) và một **prefix** (mặc định là `!`).
- Một **action** (hành động): dịch chuyển ngẫu nhiên, dịch chuyển đến một cấu trúc, dịch chuyển đến một quần xã sinh vật, hoặc chạy các lệnh bảng điều khiển thô.
- Một **permission level** (cấp độ quyền): mọi người, người chơi trong danh sách trắng, hoặc chỉ người điều hành.
- Một **cooldown** (thời gian chờ), và các thông báo đang chờ xử lý / thành công / thất bại có thể tùy chỉnh với các placeholder như `{distance}`.

### Lưu ý về an toàn

Các lệnh có thể phá hoại máy chủ (`stop`, `op`, `ban`, `whitelist` và các lệnh tương tự) chỉ được phép trên các trigger **chỉ dành cho người điều hành**. Bảng quản lý kiểm tra các lệnh này ngay cả khi chúng được lồng bên trong một chuỗi `execute … run …`, vì vậy một trigger có quyền thấp không thể đưa một lệnh nguy hiểm vào. Văn bản trò chuyện thông thường chỉ đề cập đến các từ đó (như tin nhắn `say`) sẽ không bị ảnh hưởng.
