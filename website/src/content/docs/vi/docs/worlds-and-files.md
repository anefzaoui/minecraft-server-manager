---
title: 'Thế giới & tệp'
description: 'Trang Thế giới quản lý dữ liệu thế giới trên các máy chủ của bạn: hoán đổi thế giới đang hoạt động, tải lên hoặc tải xuống một thế giới.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Quay lại mục lục tài liệu](/docs/)

## Thế giới

Trang **Thế giới** quản lý dữ liệu thế giới trên các máy chủ của bạn: hoán đổi thế giới đang hoạt động, tải lên hoặc tải xuống một thế giới.

![Thế giới](/docs/images/worlds.png)

## Trình quản lý tệp

Trong phần **Thế giới** của máy chủ, tab **Tệp** là một trình quản lý tệp đầy đủ trong trình duyệt cho thư mục dữ liệu của máy chủ đó. Liệt kê, đọc, chỉnh sửa, tạo, đổi tên, di chuyển, sao chép, xóa và tải lên tệp: mọi thứ bạn thường làm qua SSH, từ trình duyệt.

![Trình quản lý tệp](/docs/images/server-files.png)

Các tệp văn bản mở trong trình chỉnh sửa với giới hạn 2 MB; các tệp lớn hơn có thể được tải xuống. Tải lên chấp nhận nhiều tệp cùng lúc.

### Luôn ở trong vùng an toàn

Mọi thao tác tệp đều bị giới hạn trong thư mục dữ liệu của máy chủ. Bảng điều khiển phân giải từng đường dẫn và từ chối bất kỳ thứ gì có thể thoát ra: duyệt `..`, đường dẫn tuyệt đối và thậm chí cả symlink trỏ ra ngoài thư mục (bao gồm cả những symlink bị treo chưa tồn tại). Một mod hoặc plugin không thể tạo một liên kết để lừa trình quản lý tệp đọc hoặc ghi ở nơi khác trên máy chủ.

## Mods

Đối với các máy chủ đã cài đặt mod, tab **Mods** (nhóm riêng trong thanh bên máy chủ) quản lý bộ mod: duyệt và thêm mod, đồng thời xem những gì đã được cài đặt. Các bản cập nhật mod và gói mod sẽ hiển thị trên trang [Cập nhật](/docs/updates/).

### Thêm mods

![Mods](/docs/images/mods.png)

Bốn cách để thêm, tất cả đều từ thanh công cụ của tab Mods:

- **Tìm kiếm mods** - tìm kiếm trên **Modrinth hoặc CurseForge** (nút CurseForge xuất hiện sau khi khóa API được lưu trữ trong Cài đặt → Khóa API), và trên các máy chủ plugin cũng có **Hangar** (kho lưu trữ plugin của PaperMC) và **SpigotMC** (thông qua proxy CDN của Spiget) - cả hai đều không cần khóa. Mọi thứ đều được lọc theo trình tải (loader) và phiên bản Minecraft của máy chủ; máy chủ Quilt tự động hiển thị các bản dựng được gắn thẻ fabric, vì Quilt chạy các mod fabric. Kết quả đã có trên máy chủ sẽ hiển thị huy hiệu **Đã cài đặt**. Nếu một tác giả CurseForge không cho phép tải xuống tự động - hoặc một tài nguyên SpigotMC được lưu trữ bên ngoài - bảng điều khiển sẽ thông báo trước và cung cấp tùy chọn **Mở trang** + **Tải lên jar** thay vì lỗi trong quá trình cài đặt.

  ![Tìm kiếm Hangar](/docs/images/mods-search-hangar.png)

- **Nhập zip** - một nút, ba hình dạng, tự động phát hiện:
  - Một **gói mod Modrinth (`.mrpack`)**: mọi tệp được ghim đều được chuẩn hóa trở lại dự án Modrinth của nó thông qua tra cứu băm (vì vậy các mod được nhập giữ nguyên tên, biểu tượng thực và có thể kiểm tra cập nhật; các tệp mà Modrinth không biết sẽ cài đặt từ URL riêng của gói), được xác minh bằng tổng kiểm tra sha512 của gói trong khi tải xuống và xem trước với các kết quả phù hợp. Các tệp chỉ dành cho máy khách sẽ bị bỏ qua một cách rõ ràng, và cả hai cây ghi đè (`overrides/`, sau đó là `server-overrides/` - bản sao dành riêng cho máy chủ sẽ được ưu tiên) đều có thể được áp dụng.

    ![Nhập mrpack](/docs/images/mrpack-import.png)

  - Một **bản xuất gói mod CurseForge** (tệp zip mà ứng dụng CurseForge tạo ra, với `manifest.json`): mọi mod được ghim đều được phân giải hàng loạt, xem trước với các cảnh báo (trình tải/MC sai cho máy chủ này, tệp không còn trên CurseForge, mod cần tải xuống thủ công) và cài đặt với tiến trình thực tế. Các `overrides/` của gói (cấu hình, tập lệnh) cũng có thể tùy chọn được áp dụng - bất kỳ tệp nào bị ghi đè sẽ được sao lưu trước vào `.import-backups/<timestamp>/` bên trong thư mục máy chủ.
  - Một **tệp zip chứa các jar** bạn tự thu thập: mỗi jar được xác định (khớp băm Modrinth → dấu vân tay CurseForge → siêu dữ liệu của jar) và đánh giá so với máy chủ - _phù hợp / trình tải sai / phiên bản MC sai / đã cài đặt / không xác định_ - vì vậy bạn chọn những gì thực sự thuộc về trước khi bất kỳ thứ gì được cài đặt.
- **Thêm bằng liên kết** - dán hầu hết mọi thứ: trang dự án Modrinth, CurseForge, Hangar hoặc SpigotMC, URL kho lưu trữ hoặc bản phát hành GitHub (chỉ cần `owner/repo` cũng hoạt động - cài đặt GitHub ưu tiên bản phát hành ổn định mới nhất và bỏ qua các tệp sidecar `-sources`/`-javadoc`), một slug Modrinth trần hoặc bất kỳ URL `.jar` trực tiếp nào. Bảng điều khiển phân giải bản dựng phù hợp cho trình tải và phiên bản MC của máy chủ.

  ![Thêm bằng liên kết](/docs/images/mods-add-by-link.png)

- **Tải lên jar** (từ tùy chọn dự phòng tìm kiếm hoặc trình phân giải tải xuống đang chờ xử lý) - các jar được tải lên được xác định theo cùng một cách, vì vậy chúng giữ nguyên tên, phiên bản, biểu tượng thực và có thể kiểm tra cập nhật.

Mọi cài đặt từ kho lưu trữ đều được **xác minh bằng checksum trong khi tải xuống**: luồng được kiểm tra với thuật toán băm mạnh nhất mà kho lưu trữ công bố (sha512 → sha256 → sha1 → md5) và một sự không khớp sẽ hủy bỏ trước khi bất kỳ thứ gì được lưu vào máy chủ.

Toàn bộ tệp zip (`.mrpack` bao gồm) cũng có thể **tạo một máy chủ**: trong tab _Từ gói mod_ của trình hướng dẫn, tải nó lên và tệp kê khai gói (hoặc đa số phiếu bầu trên các jar được xác định) sẽ điền trình tải, phiên bản Minecraft và bản dựng trình tải.
