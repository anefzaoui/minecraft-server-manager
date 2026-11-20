---
title: 'Bản đồ trực tiếp'
description: 'Bật bản đồ 3D trực tiếp BlueMap của thế giới máy chủ chỉ bằng một cú nhấp chuột, được phục vụ riêng qua đăng nhập của bảng điều khiển.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Tab **Thế giới → Bản đồ** của máy chủ hiển thị bản đồ 3D trực tiếp, có thể thu phóng của thế giới máy chủ, được vẽ bởi [BlueMap](https://bluemap.bluecolored.de/) (miễn phí và mã nguồn mở), bao gồm vị trí người chơi và mọi chiều không gian. Bảng điều khiển sẽ cài đặt, cấu hình và phục vụ bản đồ này; bạn không bao giờ cần mở cổng hay chỉnh sửa tệp cấu hình cho nó.

## Bật tính năng

1. Mở máy chủ, sau đó vào **Thế giới → Bản đồ**.
2. Nhấn **Bật Bản đồ Trực tiếp**. Bảng điều khiển sẽ cài đặt bản dựng BlueMap phù hợp với trình tải máy chủ và phiên bản Minecraft từ Modrinth, chấp nhận tải tài nguyên của BlueMap thay bạn, và chọn một cổng miễn phí cho nó.
3. Khởi động lại máy chủ (thay đổi sẽ có hiệu lực vào lần khởi động tiếp theo, và máy chủ sẽ được đánh dấu là đang chờ khởi động).

BlueMap sẽ hiển thị ở chế độ nền, vì vậy bản đồ mới sẽ mất vài phút để vẽ các ô đầu tiên. Cho đến lúc đó, tab sẽ hiển thị bản đồ chưa sẵn sàng và tự động kiểm tra lại. Khi đã sẵn sàng, **Toàn màn hình** sẽ mở bản đồ trong một tab trình duyệt riêng.

Tính năng này hoạt động trên các máy chủ có trình tải mod (Fabric, Quilt, Forge, NeoForge) và trên các máy chủ plugin (Paper, Purpur và các phiên bản khác của Paper, Spigot), bao gồm cả máy chủ modpack. Máy chủ Vanilla không có bản dựng BlueMap và tab sẽ hiển thị thông báo này.

## Ai có thể xem

Bản đồ chỉ được phục vụ thông qua bảng điều khiển, sau khi đăng nhập: bất kỳ ai có thể xem máy chủ trong bảng điều khiển đều có thể mở bản đồ của nó, và không ai khác. Cổng của BlueMap không bao giờ được phép mở ra internet ([tổng quan về các cổng](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Bật hoặc tắt bản đồ yêu cầu quyền **Cài đặt** của máy chủ ([người dùng & vai trò](/docs/users-and-roles/#per-server-permissions)).

Khi chính bảng điều khiển chạy trong Docker, nó sẽ truy cập BlueMap bên trong container của máy chủ; [README](https://github.com/anefzaoui/minecraft-server-manager#installation) giải thích chi tiết cho các thiết lập reverse-proxy.

## Tắt tính năng

**Tắt Bản đồ** sẽ gỡ bỏ tệp jar BlueMap mà bảng điều khiển đã cài đặt và giải phóng cổng của nó, cũng có hiệu lực từ lần khởi động tiếp theo. Bản thân thế giới không bị ảnh hưởng; các ô bản đồ đã hiển thị vẫn nằm trong thư mục của máy chủ cho đến khi bạn xóa chúng trên tab **Tệp**.

Liên quan: [thế giới & tệp](/docs/worlds-and-files/), [lời mời & trang trạng thái](/docs/invites-and-status-page/).
