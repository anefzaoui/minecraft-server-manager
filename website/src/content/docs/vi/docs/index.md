---
title: 'Tài liệu'
description: 'Một bảng điều khiển hoàn chỉnh, tự lưu trữ cho itzg/docker-minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

Bảng điều khiển hoàn chỉnh, tự lưu trữ cho [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server). Tạo, chạy và quản lý máy chủ Minecraft từ trình duyệt của bạn. Không cần dòng lệnh, không cần chỉnh sửa YAML thủ công.

![Dashboard](/docs/images/dashboard.png)

## Bắt đầu tại đây

- **[Bắt đầu](/docs/getting-started/)** - thiết lập lần đầu, đăng nhập và cách sử dụng.
- **[Bảng điều khiển](/docs/dashboard/)** - tổng quan nhanh về mọi máy chủ, người chơi và hoạt động.

## Chạy máy chủ

- **[Tạo & quản lý máy chủ](/docs/servers/)** - trình hướng dẫn tạo, các loại máy chủ, phiên bản và cài đặt cho từng máy chủ.
- **[Bảng điều khiển & lệnh trò chuyện](/docs/console-and-chat/)** - bảng điều khiển trực tiếp và các lệnh trò chuyện tùy chỉnh trong trò chơi chạy với tư cách người chơi.
- **[Gói Mod](/docs/modpacks/)** - cài đặt các gói CurseForge, Modrinth, FTB và GT New Horizons, luôn được ghim vào một phiên bản chính xác.
- **[Thế giới & tệp](/docs/worlds-and-files/)** - hoán đổi thế giới, quản lý mod và chỉnh sửa tệp trực tiếp trong trình duyệt.
- **[Thu nhỏ thế giới](/docs/world-shrink/)** - lấy lại dung lượng đĩa bằng cách xóa các khối mà không ai truy cập, độc lập hoặc như một phần của bản sao lưu.
- **[Bản đồ trực tiếp](/docs/live-map/)** - bản đồ 3D BlueMap một cú nhấp chuột của thế giới, nằm sau chức năng đăng nhập của bảng điều khiển.
- **[Lời mời & trang trạng thái](/docs/invites-and-status-page/)** - địa chỉ, văn bản mời và gói mod client cho bạn bè, và một trang trạng thái công khai.

## Dữ liệu & tự động hóa

- **[Chatbot cho từng máy chủ](/docs/chatbot/)** - trò chuyện cục bộ/tương thích OpenAI, tiếp cận, bản ghi được lưu giữ và các quyền hạn chơi game bị giới hạn.
- **[Sao lưu](/docs/backups/)** - ảnh chụp nhanh một cú nhấp chuột, sao lưu theo lịch trình, số lượng bản sao lưu cần giữ (toàn bộ bảng điều khiển hoặc cho từng máy chủ) và khôi phục.
- **[Bản thiết kế](/docs/blueprints/)** - chụp toàn bộ cấu hình của máy chủ và tạo các máy chủ mới từ đó.
- **[Lịch trình](/docs/schedules/)** - khởi động lại, sao lưu và lệnh theo lịch trình cron.
- **[Lưu trữ](/docs/storage/)** - mức sử dụng đĩa cho từng máy chủ và hạn ngạch được áp dụng bởi bảng điều khiển.
- **[Cập nhật](/docs/updates/)** - theo dõi các phiên bản máy chủ, gói, hình ảnh và mod mới, kiểm tra xem mod của bạn hỗ trợ phiên bản Minecraft nào và hoàn tác cập nhật mod.
- **[Nhật ký hoạt động](/docs/activity/)** - một bản ghi kiểm toán về mọi thứ đã xảy ra.
- **[Tích hợp](/docs/integrations/)** - thông báo webhook Discord và danh mục Cảnh báo.
- **[API công khai](/docs/public-api/)** - một API HTTP chỉ đọc, được xác thực bằng token để lấy trạng thái máy chủ từ bên ngoài bảng điều khiển.

## Tài khoản & bảo mật

- **[Người dùng & vai trò](/docs/users-and-roles/)** - quản trị viên, người vận hành và người xem, những gì mỗi người có thể làm và quyền cho từng máy chủ để tinh chỉnh chúng.
- **[Xác thực hai yếu tố](/docs/two-factor-authentication/)** - bảo vệ đăng nhập của bạn bằng ứng dụng xác thực.

## Hướng dẫn

Không đặc thù cho bảng điều khiển này: những câu hỏi mà mọi chủ sở hữu máy chủ Minecraft đều gặp phải.

- **[Máy chủ cần bao nhiêu RAM?](/docs/guide-server-memory/)** - hai con số cần đặt và lý do tại sao một máy chủ không hoạt động lại đọc là 12 GB.
- **[Vanilla, Paper, Fabric, Forge, NeoForge, Quilt](/docs/guide-choosing-a-loader/)** - nên chạy cái nào và sự khác biệt giữa plugin/mod đằng sau lựa chọn đó.
- **[Máy chủ của bạn sẽ không khởi động](/docs/guide-server-wont-start/)** - đọc nhật ký và một vài nguyên nhân phổ biến đằng sau hầu hết các lỗi.
- **[Sao lưu thực sự khôi phục được](/docs/guide-backups/)** - các bản sao nhất quán, những gì khác cần giữ và kiểm tra một bản sao trước khi bạn cần.
- **[Di chuyển máy chủ sang máy chủ khác](/docs/guide-moving-a-server/)** - thứ tự giúp giảm thời gian ngừng hoạt động và giữ nguyên vật phẩm trong kho.

## Bên trong

- **[Kiến trúc](/docs/architecture/)** - bảng điều khiển được cấu tạo như thế nào.
- **[Trang web](/docs/website/)** - cách minecraft-server-manager.com được xây dựng, dịch và triển khai từ kho lưu trữ này.

---

> Ảnh chụp màn hình trong các tài liệu này được chụp ở chế độ tối của bảng điều khiển. Bảng điều khiển bắt đầu ở chế độ tối trừ khi hệ điều hành của bạn ưu tiên chế độ sáng; hãy sử dụng công tắc chủ đề ở thanh trên cùng để chuyển đổi.
