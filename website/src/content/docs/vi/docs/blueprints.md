---
title: 'Bản thiết kế'
description: 'Bản thiết kế lưu toàn bộ cấu hình của máy chủ Minecraft như một công thức có thể tái sử dụng để tạo máy chủ mới. Bí mật sẽ không bao giờ được bao gồm.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Quay lại mục lục tài liệu](/docs/)

**Bản thiết kế** (blueprint) ghi lại toàn bộ cấu hình của máy chủ (loại, phiên bản, tài nguyên, môi trường, ghim gói, mod tùy chỉnh, và tùy chọn cấu hình cùng thế giới của nó) vào một tệp `.mcserver.zip` duy nhất, có thể di chuyển được, bạn có thể dùng để tạo máy chủ mới. Thông tin nhạy cảm (mật khẩu, token và khóa trong môi trường) không bao giờ được ghi vào bản thiết kế.

![Blueprints](/docs/images/blueprints.png)

## Xuất

Từ tab **Cài đặt → Cấu hình** của máy chủ, sử dụng **Xuất dưới dạng Bản thiết kế** và chọn những gì cần bao gồm: luôn luôn là cấu hình của máy chủ, các thư mục cấu hình của nó (mặc định bật), và tùy chọn các tệp mod tùy chỉnh (tệp lớn hơn sẽ cài đặt mà không cần tải xuống bất cứ thứ gì) và thế giới đang hoạt động. Kết quả được lưu vào thư viện bản thiết kế của bạn và có thể tải xuống để chia sẻ.

**Nhân bản Máy chủ**, trên cùng một thẻ, thực hiện xuất và nhập trong một bước để tạo bản sao của máy chủ, có hoặc không có thế giới của nó.

## Nhập & tạo từ bản thiết kế

Nhập một tệp bản thiết kế (**Nhập Bản thiết kế** trên trang **Bản thiết kế**) hoặc chọn một tệp từ thư viện (**Tạo Máy chủ** trên thẻ của nó, hoặc tab **Từ Bản thiết kế** của trình hướng dẫn) để tạo một máy chủ mới được cấu hình sẵn giống hệt bản gốc. Máy chủ mới sẽ có các cổng riêng và mật khẩu RCON mới. Các mod tùy chỉnh không được nhúng sẽ được tải xuống lại và kiểm tra với các mã băm mà bản thiết kế đã ghi lại. Thư viện cũng bắt đầu với hai bản thiết kế khởi đầu, một cho Paper và một cho Fabric.

Đây là cách nhanh nhất để:

- Khởi chạy các máy chủ giống hệt nhau (một mạng lưới máy chủ minigame, các bản sao thử nghiệm của môi trường sản xuất).
- Di chuyển máy chủ giữa các bảng điều khiển.
- Giữ một mẫu đã biết tốt mà bạn luôn có thể quay lại.

Vì bản thiết kế ghi lại [ghim gói](/docs/modpacks/) chính xác, một máy chủ modpack được tạo từ bản thiết kế sẽ cài đặt cùng một phiên bản đã được ghim, không có nâng cấp bất ngờ.
