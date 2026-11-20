---
title: 'Thế giới & tệp'
description: 'Thư viện thế giới, tải lên và hoán đổi thế giới, tab mod và plugin, cùng trình quản lý tệp trong trình duyệt.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Quay lại mục lục tài liệu](/docs/)

## Thế giới (Worlds)

Trang **Thế giới (Worlds)** là thư viện thế giới: mọi thế giới đã lưu ở một nơi. **Tải lên Thế giới (Upload World)** nhận một kho lưu trữ `.zip` hoặc `.tar` và tự động tìm thế giới bên trong nó, **Lưu vào Thư viện (Save to Library)** chụp nhanh thế giới đang hoạt động của máy chủ (nó hoạt động khi máy chủ đang chạy), và mỗi thế giới trong thư viện có thể được tải xuống hoặc cài đặt vào bất kỳ máy chủ nào bằng **Cài đặt vào… (Install to…)**. Việc cài đặt sẽ thay thế thế giới của máy chủ (máy chủ phải được dừng, và thế giới hiện tại của nó sẽ được sao lưu trước) hoặc thêm nó vào cùng, để kích hoạt sau. Một kiểm tra tương thích chạy trước mỗi lần cài đặt.

Tab **Thế giới (World) → Thế giới (Worlds)** của máy chủ liệt kê các thế giới trên máy chủ đó. Từ đó bạn có thể kích hoạt một thế giới khác (với máy chủ đã dừng), tải xuống, sao chép, đổi tên, hoặc [thu nhỏ](/docs/world-shrink/) thế giới, sao chép nó sang máy chủ khác, xóa một thế giới không hoạt động, và đặt lại thế giới đang hoạt động với một hạt giống (seed) mới, đã giữ lại, hoặc tùy chỉnh (một bản sao lưu an toàn sẽ được cung cấp trước). Thư viện tương tự nằm bên dưới, với **Cài đặt tại đây (Install Here)**.

![Thế giới](/docs/images/worlds.png)

## Trình quản lý tệp (The file manager)

Trong phần **Thế giới (World)** của máy chủ, tab **Tệp (Files)** là một trình quản lý tệp đầy đủ trong trình duyệt cho thư mục dữ liệu của máy chủ đó. Liệt kê, đọc, chỉnh sửa, đổi tên, di chuyển, sao chép, xóa và tải lên tệp, tạo thư mục, và tìm kiếm văn bản của tệp dưới một thư mục với **Tìm trong Tệp (Find in Files)**: mọi thứ bạn thường làm qua SSH, từ trình duyệt.

![Trình quản lý tệp](/docs/images/server-files.png)

Các tệp văn bản mở trong trình chỉnh sửa với giới hạn 8 MB; các tệp lớn hơn có thể được tải xuống. Tải lên chấp nhận tối đa 20 tệp cùng lúc.

### Ở trong vùng an toàn (Staying inside the sandbox)

Mọi thao tác tệp đều bị giới hạn trong thư mục dữ liệu của máy chủ. Bảng điều khiển phân giải từng đường dẫn và từ chối bất kỳ thứ gì có thể thoát ra: duyệt `..`, đường dẫn tuyệt đối, và thậm chí cả các liên kết tượng trưng (symlinks) trỏ ra ngoài thư mục (bao gồm cả các liên kết bị hỏng chưa tồn tại). Một mod hoặc plugin không thể tạo một liên kết để lừa trình quản lý tệp đọc hoặc ghi ở nơi khác trên máy chủ.

## Mod

Đối với các máy chủ đã cài đặt mod và plugin, tab **Mod (Mods)** (nhóm riêng trong thanh bên của máy chủ) quản lý bộ mod: duyệt và thêm mod, và xem những gì đã được cài đặt. Từ mỗi hàng mod đã cài đặt, bạn có thể cập nhật nó (hoặc bỏ qua cập nhật đó), [hoàn tác](/docs/updates/#undoing-a-mod-update) nó, vô hiệu hóa nó, hoặc xóa nó, và **Cập nhật Tất cả (Update All)** áp dụng mọi bản cập nhật có sẵn với một lần khởi động lại. Các bản cập nhật mod và gói cũng xuất hiện trên trang [Cập nhật (Updates)](/docs/updates/).

### Thêm mod (Adding mods)

![Mod](/docs/images/mods.png)

Bốn cách để thêm, tất cả đều từ thanh công cụ của tab Mod:

- **Tìm kiếm Mod (Search Mods)**: tìm kiếm **Modrinth hoặc CurseForge** (nút CurseForge xuất hiện khi khóa API được lưu trữ trong **Cài đặt (Settings) → Khóa API (API Keys)**), và trên các máy chủ plugin cũng có **Hangar** (kho lưu trữ plugin của PaperMC) và **SpigotMC** (qua proxy CDN của Spiget), cả hai đều không cần khóa. Tab **Gói dữ liệu (Datapacks)** tìm kiếm các gói dữ liệu của Modrinth. Mọi thứ đều được lọc theo trình tải (loader) và phiên bản Minecraft của máy chủ (một ô kiểm cũng hiển thị các bản dựng không được liệt kê là tương thích, với rủi ro của bạn); các máy chủ Quilt tự động thấy các bản dựng được gắn thẻ fabric, vì Quilt chạy các mod fabric. Kết quả đã có trên máy chủ hiển thị huy hiệu **Đã cài đặt (Installed)**. Nếu một tác giả CurseForge không cho phép tải xuống tự động (hoặc một tài nguyên SpigotMC được lưu trữ bên ngoài), bảng điều khiển sẽ thông báo ngay và cung cấp tùy chọn **Mở CurseForge (Open CurseForge)** (hoặc **Mở SpigotMC (Open SpigotMC)**) + **Tải lên Jar (Upload Jar)** thay vì thất bại giữa chừng.

  ![Tìm kiếm Hangar](/docs/images/mods-search-hangar.png)

- **Nhập Zip (Import Zip)**: một nút, ba hình dạng, tự động phát hiện:
  - Một **gói mod Modrinth (`.mrpack`)**: mọi tệp được ghim đều được chuẩn hóa trở lại dự án Modrinth của nó thông qua tra cứu băm (hash lookup) (vì vậy các mod được nhập giữ nguyên tên, biểu tượng thực và vẫn có thể kiểm tra cập nhật; các tệp mà Modrinth không biết sẽ cài đặt từ URL của gói đó), được xác minh với tổng kiểm tra sha512 của gói trong khi tải xuống, và được xem trước với các phán quyết phù hợp. Các tệp chỉ dành cho máy khách (client-only) sẽ bị bỏ qua một cách rõ ràng, và cả hai cây ghi đè (`overrides/`, sau đó là `server-overrides/`; bản sao dành riêng cho máy chủ sẽ được ưu tiên) đều có thể được áp dụng.

    ![Nhập mrpack](/docs/images/mrpack-import.png)

  - Một **xuất gói mod CurseForge** (tệp zip mà ứng dụng CurseForge tạo ra, với `manifest.json`): mọi mod được ghim đều được giải quyết hàng loạt, xem trước với các cảnh báo (trình tải/MC sai cho máy chủ này, tệp không còn trên CurseForge, mod cần tải xuống thủ công), và cài đặt với tiến trình thực tế. `overrides/` của gói (cấu hình, tập lệnh) có thể tùy chọn được áp dụng; bất kỳ tệp nào bị ghi đè sẽ được sao lưu trước vào `.import-backups/<timestamp>/` bên trong thư mục máy chủ.
  - Một **tệp zip chứa các tệp jar** bạn tự thu thập: mỗi tệp jar được xác định (khớp băm Modrinth → vân tay CurseForge → siêu dữ liệu của tệp jar) và đánh giá so với máy chủ (_phù hợp / trình tải sai / phiên bản MC sai / đã cài đặt / không xác định_), vì vậy bạn chọn những gì thực sự thuộc về trước khi bất cứ điều gì được cài đặt.
- **Thêm theo URL (Add by URL)**: dán hầu hết mọi thứ: các trang dự án Modrinth, CurseForge, Hangar, hoặc SpigotMC, một URL kho lưu trữ GitHub hoặc bản phát hành (một `owner/repo` đơn giản cũng hoạt động; cài đặt GitHub ưu tiên bản phát hành ổn định mới nhất và bỏ qua các tệp phụ `-sources`/`-javadoc`), một slug Modrinth đơn giản, hoặc bất kỳ URL `.jar` trực tiếp nào. Bảng điều khiển phân giải bản dựng phù hợp cho trình tải và phiên bản MC của máy chủ.

  ![Thêm theo liên kết](/docs/images/mods-add-by-link.png)

- **Tải lên Jar (Upload Jar)** (từ phương án dự phòng tìm kiếm hoặc bộ giải quyết tải xuống đang chờ xử lý): các tệp jar được tải lên được xác định theo cùng một cách, vì vậy chúng giữ nguyên tên, phiên bản, biểu tượng thực và có thể kiểm tra cập nhật.

Mọi cài đặt từ kho lưu trữ đều được **xác minh tổng kiểm tra trong khi tải xuống**: luồng được kiểm tra với hàm băm mạnh nhất mà kho lưu trữ công bố (sha512 → sha256 → sha1 → md5) và một sự không khớp sẽ hủy bỏ trước khi bất cứ thứ gì được lưu vào máy chủ.

Toàn bộ một tệp zip (bao gồm cả `.mrpack`) cũng có thể **tạo một máy chủ**: trong tab **Từ Gói Mod (From Modpack)** của trình hướng dẫn, tải nó lên và tệp kê khai gói (hoặc đa số phiếu bầu trên các tệp jar được xác định) sẽ điền trình tải, phiên bản Minecraft và bản dựng trình tải.
