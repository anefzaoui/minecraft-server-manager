---
title: 'Tạo & quản lý máy chủ'
description: 'Nhấp vào Tạo máy chủ (thanh trên cùng) hoặc thẻ Tạo máy chủ để mở trình hướng dẫn.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Quay lại mục lục tài liệu](/docs/)

## Tạo máy chủ

Nhấn **Tạo máy chủ** (thanh trên cùng) hoặc thẻ **Tạo máy chủ** để mở trình hướng dẫn.

![Tạo máy chủ](/docs/images/create-wizard.png)

Trình hướng dẫn điền sẵn các trường bộ nhớ, CPU và giới hạn dung lượng đĩa từ **Mặc định cho máy chủ mới** trên trang Cài đặt, mà quản trị viên có thể thay đổi bất kỳ lúc nào.

![Mặc định cho máy chủ mới](/docs/images/settings-defaults.png)

Bạn chọn:

- Một **tên** (và biểu tượng tùy chọn, màu nhấn, cùng các thẻ để sắp xếp nhóm máy chủ của bạn).
- Một **loại máy chủ** - vanilla, Paper, Fabric, Forge, NeoForge, và nhiều hơn nữa, mỗi loại được ánh xạ tới image itzg phù hợp ở phía sau.
- Một **phiên bản Minecraft** - `LATEST`, một bản snapshot, hoặc một phiên bản cụ thể.
- **Tài nguyên** - RAM (heap), giới hạn bộ nhớ container, CPU và giới hạn dung lượng đĩa.

Ưu tiên modpack? Thẻ **Từ modpack** sẽ cài đặt một gói CurseForge, Modrinth, FTB, hoặc GT New Horizons thay thế (xem [Modpacks](/docs/modpacks/)), hoặc nhận một **zip tùy chỉnh bạn tải lên**: một bản xuất modpack CurseForge (`manifest.json`) hoặc bất kỳ tệp zip nào chứa các tệp mod. Tệp manifest (hoặc đa số phiếu bầu trên các tệp jar được xác định) sẽ điền thông tin về loader và phiên bản Minecraft, và mọi mod sẽ được cài đặt trong một tác vụ. Bạn cũng có thể bắt đầu từ một [Blueprint](/docs/blueprints/) đã lưu.

Bảng điều khiển sẽ tự động chọn một runtime Java phù hợp cho phiên bản của bạn, tải image, tạo container và (tùy chọn) khởi động nó, tất cả từ một biểu mẫu duy nhất.

## Danh sách máy chủ

Trang **Máy chủ** liệt kê toàn bộ nhóm máy chủ của bạn với trạng thái và các số liệu thống kê nhanh.

![Danh sách máy chủ](/docs/images/servers-list.png)

## Một máy chủ đơn lẻ

![Người chơi](/docs/images/players.png)

Mở một máy chủ sẽ cung cấp cho bạn một không gian làm việc có nhiều tab:

- **Tổng quan** - trạng thái, số liệu thống kê trực tiếp, thời gian hoạt động và các điều khiển chính để khởi động / dừng / khởi động lại.
- **Bảng điều khiển** - luồng nhật ký trực tiếp và đầu vào lệnh, cộng với trò chuyện trong trò chơi ([chi tiết](/docs/console-and-chat/)).
- **Người chơi** - ai đang trực tuyến, cùng với kho đồ, số liệu thống kê và [lệnh trò chuyện](/docs/console-and-chat/).
- **Mods** - danh sách mod đã cài đặt, [trình duyệt mod](/docs/modpacks/), và các bản cập nhật nội dung.
- **Thế giới** - [thế giới, bản đồ trực tiếp và trình quản lý tệp](/docs/worlds-and-files/).
- **Sao lưu** - [ảnh chụp nhanh và khôi phục](/docs/backups/) cho máy chủ này.
- **Giám sát** - lịch sử và số liệu trực tiếp cho từng máy chủ, bao gồm cả báo cáo sự cố (xem bên dưới).
- **Cài đặt** - mọi thứ về cách máy chủ hoạt động, cộng với [tích hợp](/docs/integrations/) (Discord, trang trạng thái, lời mời, chatbot).

![Tổng quan máy chủ](/docs/images/server-overview.png)

Thanh **Điều khiển Thế giới** sẽ hiển thị trên mọi tab: đồng hồ trong trò chơi, thời tiết, các quy tắc trò chơi phổ biến dưới dạng các chip chuyển đổi và "Hiển thị tất cả quy tắc thế giới" cho các quy tắc còn lại.

![Điều khiển thế giới](/docs/images/world-controls.png)

**Giám sát → Trực tiếp** hiển thị TPS và mili giây mỗi tick, một thẻ sức khỏe và độ ổn định với 24 giờ / 7 ngày gần nhất của các sự cố và lần khởi động lại, cùng với kích thước của từng thế giới.

![Giám sát trực tiếp](/docs/images/monitoring-live.png)

## Cài đặt máy chủ

Tab **Cài đặt** là giao diện cấu hình đầy đủ: đổi tên, tài nguyên, chính sách cập nhật, tự động khởi động / tự động khởi động lại, biến môi trường và các ghi đè Docker nâng cao. Các trường thay đổi cách container hoạt động sẽ được đánh dấu rõ ràng là cần khởi động lại.

![Cài đặt máy chủ](/docs/images/server-settings.png)

**Về đồng hồ đo bộ nhớ.** "RAM (Java heap)" được cung cấp cho Java cả làm heap khởi động và heap tối đa, và Java sẽ lấp đầy heap mà nó được cấp ngay từ đầu trong phút đầu tiên, có hoặc không có các cài đặt trước cờ Aikar / MeowIce. Do đó, đồng hồ đo bộ nhớ sẽ ổn định ở khoảng kích thước heap và ở đó ngay cả khi không có ai chơi; vạch trên đồng hồ đánh dấu vị trí heap nằm dưới giới hạn container, và ghi chú bên dưới nó cho biết điều đó. Nếu bạn muốn bộ nhớ theo dõi việc sử dụng thực tế, hãy đặt **Heap ban đầu** nhỏ hơn (nâng cao): trên heap 2 GB, việc sử dụng khi không hoạt động đã giảm từ 2,6 GB xuống khoảng 1,3 GB theo số liệu đo lường của chúng tôi. Java cũng cần bộ nhớ bên ngoài heap (khoảng 0,5 GB trên vanilla, 1,5 đến 2 GB trên modpack lớn), đó là lý do tại sao khoảng trống của giới hạn container dành cho việc đó. Xem "Hai giới hạn bộ nhớ" trong README để biết các con số.

> Các trường ghi đè Docker nâng cao (tên container tùy chỉnh, cổng bổ sung và mount bind, cùng các ghi đè thô) chỉ dành cho **quản trị viên**, vì mount bind cộng với quyền truy cập Docker của bảng điều khiển về cơ bản là quyền root trên máy chủ. Xem [Người dùng & vai trò](/docs/users-and-roles/).

## Báo cáo sự cố & phân tích mclo.gs

Báo cáo sự cố (`crash-reports/*.txt` và các tệp JVM `hs_err_pid*.log`) được thu thập tự động, phân tích thành một bản tóm tắt một dòng với ngoại lệ và các mod bị nghi ngờ, và được liệt kê trong **Giám sát → Lịch sử**:

![Thẻ báo cáo sự cố](/docs/images/crash-mclogs-card.png)

Mỗi thẻ báo cáo cung cấp một trình xem tích hợp (với các phần có thể thu gọn và các ngoại lệ được làm nổi bật), sao chép ngăn xếp lỗi và tải xuống, cộng với hai hành động [mclo.gs](https://mclo.gs):

- **Chia sẻ lên mclo.gs** xuất bản báo cáo dưới dạng một bản dán công khai và sao chép liên kết - thứ mà các tác giả mod và Discord hỗ trợ yêu cầu. Liên kết được ghi nhớ trên báo cáo, vì vậy không có gì được tải lên hai lần.
- **Phân tích** chạy các thông tin chi tiết tự động của mclo.gs trên bản dán: các sự cố đã biết với các bản sửa lỗi được đề xuất (phụ thuộc bị thiếu, không khớp phiên bản, xung đột mod phổ biến), được hiển thị ngay trong bảng điều khiển.

![Thông tin chi tiết mclo.gs](/docs/images/crash-insights.png)

Cả hai hành động đều yêu cầu xác nhận rõ ràng, vì một bản dán là công khai: báo cáo sự cố có thể bao gồm tên người chơi và danh sách mod đầy đủ của bạn. Bảng điều khiển không bao giờ tự động tải lên bất cứ thứ gì.
