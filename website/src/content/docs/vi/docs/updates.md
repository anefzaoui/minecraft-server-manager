---
title: 'Cập nhật'
description: 'Trang Cập nhật theo dõi những gì đã lỗi thời trên toàn bộ hệ thống của bạn ở một nơi:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Cập nhật** theo dõi những gì đã lỗi thời trên toàn bộ hệ thống của bạn ở một nơi:

- Phiên bản **Modpack** ([modpacks](/docs/modpacks/)) so với Modrinth / CurseForge / chỉ mục phát hành GTNH.
- **Nội dung tùy chỉnh** bạn tự thêm - mods, datapacks, resource packs, plugins - mỗi loại so với nguồn của nó: Modrinth, CurseForge, Hangar, SpigotMC (Spiget), hoặc GitHub Releases. Tra cứu GitHub sử dụng xác thực lại ETag, vì vậy các lần kiểm tra hàng ngày hầu như không chạm đến giới hạn tốc độ của nó.
- Hình ảnh **Docker** lỗi thời: ID hình ảnh của mỗi container đang chạy so với một tag vừa được kéo (loại bỏ trùng lặp trên các máy chủ cùng một tag), được cung cấp dưới dạng nâng cấp chỉ có thể tạo lại.
- **Ghim phiên bản độc lập**: đối với máy chủ không có gói được quản lý, một ghim `mc_version` rõ ràng so với manifest của Mojang, và một biến môi trường loader-build rõ ràng (`PAPER_BUILD`, `FORGE_VERSION`, v.v.) so với registry của loader. Các bản dựng Paper đến từ **API Fill v3** hiện tại của PaperMC (điểm cuối v2 cũ đã ngừng nhận các phiên bản Minecraft mới).

![Cập nhật](/docs/images/updates.png)

## Cách hoạt động

Bảng điều khiển kiểm tra các phiên bản được ghim của mỗi máy chủ với nguồn gốc và liệt kê bất kỳ thứ gì có bản phát hành mới hơn. Một số đếm khớp cũng xuất hiện trên ô "Cập nhật có sẵn" của [bảng điều khiển](/docs/dashboard/).

Các lần kiểm tra chạy theo yêu cầu và có thể được lên lịch ([Lịch trình](/docs/schedules/)). **Chính sách** cập nhật là trên mỗi máy chủ: bạn quyết định xem bảng điều khiển chỉ thông báo cho bạn hay để mọi thứ thủ công.

## Áp dụng cập nhật

Cập nhật không bao giờ là im lặng. Khi bạn chọn nâng cấp một gói, bảng điều khiển sẽ:

1. Thực hiện **sao lưu trước cập nhật** (vì vậy có thể hoàn tác; 10 bản sao lưu trước cập nhật cuối cùng cho mỗi máy chủ được giữ lại).
2. Ghim lại phiên bản mới chính xác.
3. Tạo lại container, giải quyết lại runtime Java nếu cần.
4. Giám sát lần khởi động đầu tiên, với ngân sách thời gian cho mỗi nền tảng.

Nếu nó không khởi động thành công, bạn sẽ hoàn tác về bản sao lưu trước cập nhật. Một máy chủ theo dõi ổn định sẽ không bao giờ được cung cấp bản beta, và liên kết nhật ký thay đổi sẽ trỏ đến sự khác biệt thực tế trên mỗi phiên bản mà nguồn cung cấp. Một bản cập nhật thất bại cũng sẽ kích hoạt cảnh báo Discord [tích hợp](/docs/integrations/) nếu tích hợp được cấu hình.
