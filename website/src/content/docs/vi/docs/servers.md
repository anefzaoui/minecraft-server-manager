---
title: 'Tạo & quản lý máy chủ'
description: 'Tạo, khởi động, dừng, xây dựng lại và cấu hình máy chủ Minecraft trong bảng điều khiển: trình hướng dẫn tạo, cài đặt, bộ nhớ và cổng trò chơi.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Quay lại mục lục tài liệu](/docs/)

## Tạo máy chủ

Nhấn **Tạo Máy Chủ** (thanh trên cùng) hoặc thẻ **Tạo Máy Chủ** để mở trình hướng dẫn.

![Tạo máy chủ](/docs/images/create-wizard.png)

Trình hướng dẫn điền sẵn bộ nhớ Java heap và giới hạn đĩa từ **Mặc định cho máy chủ mới** trên trang Cài đặt, mà quản trị viên có thể thay đổi bất kỳ lúc nào. Máy chủ mới cũng lấy giới hạn CPU từ đó.

![Mặc định cho máy chủ mới](/docs/images/settings-defaults.png)

Bạn chọn:

- Một **tên** (và mô tả, biểu tượng, màu nhấn tùy chọn). Thẻ để tổ chức đội của bạn sẽ được thêm sau, trên cài đặt của máy chủ.
- Một **loại máy chủ**: Vanilla, Paper, hoặc Purpur trên tab **Vanilla**. Đối với máy chủ đã cài mod, tab **Từ Mod** chọn trình tải (Fabric, Forge, NeoForge, hoặc Quilt), phiên bản Minecraft, và bản dựng trình tải (mới nhất, hoặc một bản cụ thể), sau đó cho phép bạn tìm kiếm mod.
- Một **phiên bản Minecraft**: `LATEST`, bản snapshot, hoặc một phiên bản cụ thể (bao gồm cả bản beta và alpha).
- Một **cổng game**: một cổng miễn phí sẽ được gợi ý. Console từ xa (RCON) sử dụng cổng cao hơn 1000 (mặc định). Bạn có thể thay đổi sau (xem [Thay đổi cổng game](#changing-the-game-port)).
- **Tài nguyên**: bộ nhớ Java heap (giới hạn bộ nhớ container được đặt cao hơn 50%) và giới hạn đĩa.

**Tùy chọn Nâng cao** mở ra mọi cài đặt khác mà ảnh máy chủ hỗ trợ, cộng thêm các biến môi trường bổ sung và (đối với quản trị viên) cài đặt Docker nâng cao.

Ưu tiên modpack? Tab **Từ Modpack** cài đặt một gói CurseForge, Modrinth, hoặc GT New Horizons thay thế (xem [Modpacks](/docs/modpacks/)), hoặc nhận một **zip tùy chỉnh bạn tải lên**: một tệp `.mrpack` của Modrinth, một bản xuất modpack của CurseForge (`manifest.json`), hoặc bất kỳ zip nào chứa các tệp jar mod. Tệp manifest (hoặc đa số phiếu bầu trên các tệp jar được xác định) sẽ điền trình tải và phiên bản Minecraft, và mọi mod sẽ được cài đặt trong một tác vụ. Bạn cũng có thể bắt đầu từ một [Blueprint](/docs/blueprints/) đã lưu trên tab **Từ Blueprint**.

Bảng điều khiển tự động chọn một runtime Java hợp lý cho phiên bản của bạn, tải ảnh, tạo container, và khởi động nó, tất cả từ một biểu mẫu duy nhất.

## Danh sách máy chủ

Trang **Máy Chủ** liệt kê toàn bộ đội của bạn với trạng thái và số liệu thống kê nhanh.

![Danh sách máy chủ](/docs/images/servers-list.png)

## Một máy chủ đơn lẻ

![Người chơi](/docs/images/players.png)

Mở một máy chủ sẽ cho bạn một không gian làm việc có nhiều tab:

- **Tổng quan**: địa chỉ để chia sẻ với người chơi, mô tả, mức sử dụng trực tiếp, và ai đang trực tuyến.
- **Console**: luồng nhật ký trực tiếp và đầu vào lệnh, trò chuyện trong game, và [lệnh console](/docs/console-and-chat/).
- **Người chơi**: danh sách, cộng thêm kho đồ và thống kê.
- **Mods**: danh sách mod đã cài đặt, [trình duyệt mod](/docs/modpacks/), và cập nhật nội dung. Trên máy chủ đã cài mod, tab phụ **Phiên bản** kiểm tra xem các mod của bạn có bản dựng cho các phiên bản Minecraft tương lai nào không ([cập nhật](/docs/updates/#minecraft-version-compatibility)).
- **Thế giới**: [thế giới, bản đồ trực tiếp, và trình quản lý tệp](/docs/worlds-and-files/).
- **Sao lưu**: [ảnh chụp nhanh và khôi phục](/docs/backups/) cho máy chủ này.
- **Giám sát**: lịch sử và số liệu trực tiếp cho từng máy chủ, bao gồm cả báo cáo lỗi (xem bên dưới).
- **Cài đặt**: **Cấu hình** (mọi thứ về cách máy chủ chạy), cộng thêm [tích hợp](/docs/integrations/) (Discord, Trang Trạng Thái, Lời Mời, và, đối với quản trị viên, Chatbot).

Các điều khiển bắt đầu, dừng và khởi động lại nằm ở đầu mỗi tab. Những gì bạn có thể làm trên mỗi tab phụ thuộc vào [quyền của bạn trên máy chủ đó](/docs/users-and-roles/#per-server-permissions): ví dụ, tab phụ **Tệp** cần quyền Tệp, và gửi lệnh console cần quyền Console.

![Tổng quan máy chủ](/docs/images/server-overview.png)

Thanh **Điều khiển Thế giới** luôn hiển thị trên mọi tab: đồng hồ trong game, thời tiết, các gamerule phổ biến dưới dạng chip chuyển đổi, và "Hiển thị tất cả quy tắc thế giới" cho các quy tắc còn lại.

![Điều khiển thế giới](/docs/images/world-controls.png)

**Giám sát → Trực tiếp** hiển thị TPS và mili giây mỗi tick, một thẻ sức khỏe và ổn định với các lỗi (24 giờ qua và 7 ngày qua), các lần bị tắt do hết bộ nhớ, và tự động khởi động lại, và kích thước theo từng thế giới.

![Giám sát trực tiếp](/docs/images/monitoring-live.png)

## Cài đặt máy chủ

**Cài đặt → Cấu hình** là giao diện cấu hình đầy đủ: tên, mô tả, MOTD, biểu tượng, màu sắc và thẻ, tài nguyên, cổng game, chính sách cập nhật, khởi động khi bảng điều khiển khởi động và tự động khởi động lại khi gặp lỗi, mọi biến môi trường mà ảnh máy chủ hỗ trợ, cài đặt Docker nâng cao, và xuất, sao chép, xây dựng lại, và xóa blueprint. Các thay đổi chỉ có hiệu lực sau khi máy chủ được xây dựng lại sẽ được lưu ngay lập tức và chờ: một nút **Áp dụng Thay đổi** xuất hiện ở đầu máy chủ, và chúng cũng được áp dụng vào lần khởi động tiếp theo của máy chủ.

**Tự động khởi động lại khi gặp lỗi** sẽ khởi động lại một máy chủ bị lỗi, chờ lâu hơn giữa mỗi lần thử (5, 10, rồi 20 giây) và dừng sau 3 lần thử trong vòng 10 phút. Nó bỏ qua các lỗi mà bảng điều khiển nhận dạng là vấn đề thiết lập (EULA, sai Java, thế giới từ phiên bản mới hơn, cổng đang sử dụng, hết bộ nhớ, thiếu khóa CurseForge), vì những lỗi đó cần được sửa trước. Nếu một hành động khác đang bận với máy chủ (sao lưu, khôi phục, thay đổi cổng), nó sẽ chờ tối đa 30 phút, và nó sẽ bỏ cuộc ngay khi ai đó tự dừng hoặc khởi động máy chủ.

Các thay đổi cài đặt trực tiếp luôn được giữ nguyên qua các lần khởi động lại. Thay đổi PvP hoặc độ khó bằng thanh **Điều khiển Thế giới**, bật/tắt danh sách trắng trên tab **Người chơi**, hoặc chỉnh sửa `server.properties` trong trình chỉnh sửa **Tệp** sẽ xóa biến môi trường tương ứng (nếu có một biến được đặt) và đánh dấu máy chủ cần được xây dựng lại, để giá trị trên đĩa được ưu tiên thay vì được áp dụng lại bởi ảnh container khi khởi động lần sau.

![Cài đặt máy chủ](/docs/images/server-settings.png)

**Về đồng hồ bộ nhớ.** "RAM (Java heap)" được cung cấp cho Java cả làm điểm bắt đầu và giới hạn tối đa cho heap, và Java sẽ điền đầy heap mà nó được cấp trước trong vòng một phút đầu tiên, có hoặc không có các cài đặt trước của Aikar / MeowIce. Vì vậy, đồng hồ bộ nhớ sẽ ổn định ở khoảng kích thước heap và ở đó ngay cả khi không có ai chơi; điểm đánh dấu trên đồng hồ cho biết heap nằm ở đâu dưới giới hạn container, và ghi chú bên dưới nó cho biết điều đó. Nếu bạn muốn bộ nhớ theo dõi việc sử dụng thực tế, hãy cấp cho máy chủ một heap khởi đầu nhỏ hơn với **Heap ban đầu** trong thẻ Tài nguyên trên **Cài đặt → Cấu hình** (hoặc dưới **Tùy chọn Nâng cao** trong trình hướng dẫn), ví dụ 512 MB: trên heap 2 GB, việc sử dụng khi không hoạt động giảm từ 2,6 GB xuống khoảng 1,3 GB theo đo lường của chúng tôi. Java cũng cần bộ nhớ bên ngoài heap (khoảng 0,5 GB trên vanilla, 1,5 đến 2 GB trên modpack lớn), đó là lý do tại sao khoảng trống của giới hạn container dành cho việc này. Xem "Hai giới hạn bộ nhớ" trong README để biết các con số.

> **Cài đặt Docker Nâng cao** (tên container, mạng Docker, ánh xạ cổng bổ sung, và các ràng buộc volume bổ sung) **chỉ dành cho quản trị viên**, vì một bind mount cộng với quyền truy cập Docker của bảng điều khiển về cơ bản là quyền root trên host. Xem [Người dùng & vai trò](/docs/users-and-roles/).

### Thay đổi cổng game

Thẻ **Cổng Game** trên **Cài đặt → Cấu hình** cho phép di chuyển máy chủ sang một cổng khác bất kỳ lúc nào, với nút **Lưu Cổng** riêng. **Sử dụng Cổng Miễn Phí Tiếp Theo** chọn cổng miễn phí thấp nhất, và thẻ sẽ kiểm tra bất kỳ cổng nào bạn nhập trước khi bạn lưu nó. RCON luôn theo sau ở mức 1000 trên cổng game (độ lệch mặc định). Quản trị viên có thể chọn bất kỳ cổng nào từ 1024 trở lên; những người khác chọn từ cổng game đầu tiên (25565 theo mặc định) trở lên. Lưu sẽ áp dụng thay đổi ngay lập tức: máy chủ đã dừng chỉ di chuyển, và máy chủ đang chạy sẽ hỏi trước, sau đó khởi động lại trên cổng mới (thế giới được lưu trước, và người chơi kết nối lại trên cổng mới). Nếu máy chủ không thể khởi động trên cổng mới, nó sẽ quay lại cổng cũ. Thay đổi bị từ chối khi các thay đổi khác đang chờ **Áp dụng Thay đổi**, vì vậy hãy áp dụng chúng trước. Thay đổi cổng yêu cầu quyền Cài đặt trên máy chủ đó.

![Thẻ Cổng Game](/docs/images/server-port.png)

![Lời nhắc trước khi máy chủ đang chạy khởi động lại trên cổng mới](/docs/images/port-restart.png)

## Báo cáo lỗi & phân tích mclo.gs

Báo cáo lỗi (`crash-reports/*.txt` và các tệp JVM `hs_err_pid*.log`) được thu thập tự động, phân tích thành một bản tóm tắt một dòng với ngoại lệ và các mod bị nghi ngờ, và liệt kê dưới **Giám sát → Lịch sử**:

![Thẻ báo cáo lỗi](/docs/images/crash-mclogs-card.png)

Mỗi thẻ báo cáo cung cấp một trình xem tích hợp (với các phần có thể thu gọn và các ngoại lệ được làm nổi bật), sao chép ngăn xếp lỗi, và tải xuống, cộng thêm hai hành động [mclo.gs](https://mclo.gs):

- **Chia sẻ lên mclo.gs** xuất bản báo cáo dưới dạng một bản dán công khai và sao chép liên kết: thứ mà các tác giả mod và Discord hỗ trợ yêu cầu. Liên kết được ghi nhớ trên báo cáo, vì vậy không có gì bị tải lên hai lần.
- **Phân tích** chạy các thông tin chi tiết tự động của mclo.gs trên bản dán: các sự cố đã biết với các giải pháp được đề xuất (phụ thuộc bị thiếu, không khớp phiên bản, xung đột mod phổ biến), hiển thị ngay trong bảng điều khiển.

![Thông tin chi tiết mclo.gs](/docs/images/crash-insights.png)

Cả hai hành động đều nằm sau một xác nhận rõ ràng, vì một bản dán là công khai: báo cáo lỗi có thể bao gồm tên người chơi và danh sách mod đầy đủ của bạn. Bảng điều khiển không bao giờ tự động tải lên bất cứ thứ gì.
