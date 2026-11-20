---
title: 'Bắt đầu'
description: 'Cài đặt Minecraft Server Manager và hoàn tất thiết lập lần đầu: kiểm tra hệ thống, múi giờ của bạn và tài khoản quản trị viên.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Quay lại mục lục tài liệu](/docs/)

## Thiết lập lần đầu

Lần đầu tiên bạn mở bảng điều khiển, một trình hướng dẫn thiết lập ngắn sẽ dẫn bạn qua các bước:

1.  **Kiểm tra hệ thống** đảm bảo Docker có thể truy cập được, Node.js đủ mới và thư mục dữ liệu có thể ghi. Nếu Docker chưa chạy, bạn vẫn có thể tiếp tục; việc tạo và khởi động máy chủ sẽ chờ cho đến khi nó hoạt động.
2.  **Tạo Tài khoản Quản trị viên của bạn**. Đây là tài khoản duy nhất tồn tại cho đến khi bạn thêm tài khoản khác và nó có toàn quyền kiểm soát. Chọn tên người dùng (từ 2 đến 32 ký tự) và mật khẩu ít nhất 8 ký tự. Bạn sẽ được đăng nhập ngay khi tài khoản được tạo.
3.  **Cấu hình Bảng điều khiển** (tùy chọn): một tên miền công khai để hiển thị cho người chơi trong địa chỉ kết nối, khóa API CurseForge và múi giờ của bạn. Tất cả đều có thể được thay đổi sau này trong **Cài đặt**.

Bước cuối cùng sẽ cung cấp tùy chọn **Tạo máy chủ** hoặc **Đi tới Bảng điều khiển**.

![Bước Kiểm tra hệ thống của thiết lập lần đầu](/docs/images/setup-system-check.png)

> **Các cài đặt được hiển thị công khai được bảo vệ bằng PIN.** Nếu bạn khởi động bảng điều khiển được liên kết với một địa chỉ không phải loopback (`PANEL_HOST` khác với `127.0.0.1`), trang thiết lập cũng sẽ yêu cầu **Mã PIN gồm 6 chữ số**. Bảng điều khiển sẽ in mã này ra bảng điều khiển của nó khi khởi động. Nhập mã này cùng với tên người dùng và mật khẩu của bạn. Điều này ngăn chặn kẻ lạ mặt truy cập cổng trước tiên chiếm quyền tài khoản quản trị viên. Mã PIN sẽ biến mất sau khi tài khoản quản trị viên tồn tại.

## Đăng nhập

Sau khi thiết lập, bảng điều khiển sẽ được bảo vệ bằng màn hình đăng nhập. Nhập tên người dùng và mật khẩu của bạn để tiếp tục.

![Đăng nhập](/docs/images/login.png)

Nếu [xác thực hai yếu tố](/docs/two-factor-authentication/) được bật cho tài khoản của bạn, bạn sẽ được yêu cầu nhập mã gồm 6 chữ số từ ứng dụng xác thực của mình ngay sau mật khẩu.

## Tìm hiểu cách sử dụng

Mọi thứ đều bắt đầu từ thanh bên trái:

- **Bảng điều khiển** - xem nhanh tất cả các máy chủ ([chi tiết](/docs/dashboard/)).
- **Máy chủ**, **Modpacks**, **Thế giới**, **Bản thiết kế** - tạo và quản lý máy chủ cùng nội dung của chúng.
- **Cập nhật**, **Sao lưu**, **Lịch trình**, **Lưu trữ**, **Hoạt động** - khía cạnh vận hành: những gì đã lỗi thời, ảnh chụp nhanh của bạn, tự động hóa, mức sử dụng đĩa và nhật ký kiểm toán.
- **Quyền** (dưới cùng, chỉ dành cho quản trị viên): mỗi người dùng có thể làm gì trên mỗi máy chủ ([chi tiết](/docs/users-and-roles/#per-server-permissions)).
- **Cài đặt** (dưới cùng, chỉ dành cho quản trị viên): khóa API, cấu hình bảng điều khiển, cài đặt mặc định cho máy chủ mới, [lưu giữ bản sao lưu](/docs/backups/#retention), người dùng, bảo mật đăng nhập và API công khai.

Bên dưới đó, thanh bên liệt kê các máy chủ của bạn. Mở một máy chủ sẽ hiển thị các tab riêng của nó: **Tổng quan**, **Bảng điều khiển**, **Người chơi**, **Bản sửa lỗi**, **Thế giới**, **Sao lưu**, **Giám sát** và **Cài đặt**, hầu hết đều có các tab phụ liên quan (ví dụ: **Cài đặt → Cấu hình** chứa cài đặt của máy chủ và cổng trò chơi của nó). Xem [Một máy chủ duy nhất](/docs/servers/#a-single-server).

Thanh trên cùng có nút **Tạo máy chủ**, **chuyển đổi chủ đề** (tối/sáng) và **menu tài khoản** của bạn, nơi bạn có thể thay đổi ảnh đại diện, quản lý [xác thực hai yếu tố](/docs/two-factor-authentication/) hoặc đăng xuất.

## Trên điện thoại hoặc máy tính bảng

Mọi trang đều được thiết kế trước tiên cho màn hình hẹp và sau đó mở rộng ra: thanh bên được ẩn sau nút menu, bảng dữ liệu được xếp chồng thành các thẻ, thanh công cụ được gói lại và thanh điều khiển thế giới thu gọn thành một thẻ bạn mở khi cần. Các nút và chip có kích thước vùng chạm thực tế. Không có gì chỉ dành cho máy tính để bàn.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Bảng điều khiển trên điện thoại" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Tổng quan máy chủ trên điện thoại" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Bảng điều khiển trên điện thoại" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Tab Bản sửa lỗi trên điện thoại" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Khả năng tương thích phiên bản trên điện thoại" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Cài đặt trên điện thoại" width="180">
</p>

## Những gì bạn cần

Bảng điều khiển giao tiếp với Docker để chạy máy chủ, vì vậy nó cần quyền truy cập vào một daemon Docker (Docker Desktop hoặc socket Docker Engine). Khi Docker có thể truy cập được, ô Docker trên bảng điều khiển sẽ hiển thị **Đã kết nối** và phiên bản của nó. Nếu không, bảng điều khiển vẫn chạy. Bạn chỉ không thể khởi động máy chủ cho đến khi daemon hoạt động.

## Các bước tiếp theo

- [Tạo máy chủ đầu tiên của bạn →](/docs/servers/)
- [Bảo mật tài khoản của bạn bằng 2FA →](/docs/two-factor-authentication/)
