---
title: 'Di chuyển máy chủ Minecraft sang máy chủ khác'
description: 'Di chuyển thế giới (world) thì dễ. Di chuyển một máy chủ mà người chơi vẫn có thể đăng nhập, với vật phẩm, nhà cửa và quyền hạn của họ còn nguyên vẹn, đó mới là phần dễ gặp sự cố.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Di chuyển một thế giới (world) thật dễ dàng. Di chuyển một máy chủ mà người chơi vẫn có thể đăng nhập, với kho đồ, nhà riêng và quyền hạn còn nguyên vẹn, đó mới là phần dễ gặp sự cố. Thứ tự dưới đây giúp thời gian ngừng hoạt động chỉ còn vài phút và giữ lại một phương án dự phòng nếu máy mới không đáp ứng mong đợi.

## Kiểm kê trước

Hãy ghi lại những điều này trước khi bạn chạm vào bất cứ thứ gì. Mỗi mục trong số chúng đều đã khiến quá trình di chuyển thất bại thảm hại khi bị giả định thay vì kiểm tra:

- **Phiên bản Minecraft và trình tải (loader)**, chính xác. 1.20.1 NeoForge không giống 1.20.1 Forge.
- **Danh sách mod hoặc plugin cùng với phiên bản.** Thế giới sẽ không tải được nếu thiếu các mod đã tạo ra nó.
- **Phiên bản Java**, theo sau phiên bản Minecraft.
- **`level-name`** từ `server.properties`. Thư mục thế giới thường không có tên là `world`.
- **Chế độ trực tuyến (Online mode).** Nếu máy chủ cũ chạy với `online-mode=false` và máy chủ mới chạy với bật chế độ này, hoặc ngược lại, mỗi người chơi sẽ nhận được một UUID khác nhau và do đó có một kho đồ hoàn toàn mới, trống rỗng. Đây là sai lầm đau đớn nhất trên trang này.
- **Bất cứ thứ gì nằm ngoài thư mục máy chủ**, chẳng hạn như cơ sở dữ liệu MySQL của một plugin.

## Sao chép khi máy chủ đang chạy, sau đó sao chép lại khi đã dừng

Bí quyết để giảm thiểu thời gian ngừng hoạt động là thực hiện việc sao chép chậm trước.

1. **Khi máy chủ đang chạy**, hãy sao chép toàn bộ thư mục máy chủ sang máy mới. Với một thế giới lớn, việc này có thể mất một giờ; không ai nhận thấy, vì không có gì bị dừng lại.
2. **Thông báo về việc khởi động lại, sau đó dừng máy chủ đúng cách.** Một lần dừng có kiểm soát sẽ khiến trò chơi ghi lại thế giới; việc tắt tiến trình đột ngột thì không.
3. **Sao chép lại.** Lần này chỉ những tệp đã thay đổi mới được di chuyển, vì vậy chỉ mất vài giây đến vài phút.
4. **Khởi động máy chủ trên máy mới**, trên một cổng không công khai nếu có thể, và tự mình tham gia. Kiểm tra một khu vực bạn biết rõ, kho đồ của bạn, và đảm bảo các plugin hoặc mod đã tải mà không có lỗi.
5. **Sau đó** mới hướng người chơi đến máy chủ mới.

`rsync -a --delete` là công cụ thường dùng cho các bước 1 và 3. Giữ nguyên quyền và dấu thời gian: một thế giới được sao chép bởi người dùng sai sẽ là một máy chủ không thể khởi động, và lỗi sẽ không nói rõ điều đó.

## Chưa xóa máy chủ cũ

Hãy giữ máy chủ cũ, đã dừng nhưng còn nguyên vẹn, trong ít nhất vài ngày. Đó là phương án khôi phục duy nhất thực sự. Giữ nó ở trạng thái tắt thay vì chạy, để không ai vô tình tham gia bản sao bị bỏ rơi và xây dựng ở đó trong một tuần.

## Đảm bảo địa chỉ IP tồn tại sau khi di chuyển

Nếu người chơi kết nối bằng địa chỉ IP trần, mỗi lần di chuyển sẽ buộc mọi người chơi phải chỉnh sửa danh sách máy chủ của họ, và một số người sẽ không bao giờ làm điều đó.

Hãy sử dụng một tên miền bạn kiểm soát, trỏ đến máy chủ. Việc di chuyển sau đó trở thành thay đổi DNS, và địa chỉ trong máy khách của mọi người vẫn giữ nguyên. Giảm thời gian tồn tại (time-to-live) của bản ghi DNS một ngày trước khi di chuyển để thay đổi được lan truyền nhanh chóng.

Nếu bạn muốn người chơi nhập một tên miền trần trong khi máy chủ chạy trên một cổng không chuẩn, bản ghi SRV sẽ làm được điều đó. Đó là cơ chế tương tự mà các nhà cung cấp dịch vụ thương mại sử dụng để cấp `play.something.net`.

## Kiểm tra máy mới trước khi tin tưởng

Ba điều khác biệt giữa các máy chủ và gây rắc rối sau khi di chuyển:

- **Tường lửa (Firewall).** Cổng trò chơi của bạn phải được mở, và chỉ cổng trò chơi của bạn. Đừng để lộ bảng quản lý hoặc bản đồ ra internet chỉ vì nó hoạt động trên localhost.
- **Tốc độ đơn nhân (Single-core speed).** Minecraft quan tâm nhiều hơn đến tốc độ của một lõi hơn là số lượng lõi. Tám lõi chậm sẽ tệ hơn hai lõi nhanh.
- **Ổ đĩa (Disk).** Một thế giới trên ổ đĩa cơ hoặc một ổ đĩa được chia sẻ nhiều sẽ bị giật khi tải các khối (chunk).

## Rời khỏi bảng điều khiển được quản lý

Nếu bạn đang sử dụng dịch vụ của một nhà cung cấp có bảng điều khiển thay vì một máy chủ riêng, hãy tìm chức năng tải xuống hoặc trình quản lý tệp, và lấy toàn bộ thư mục máy chủ thay vì chỉ thế giới. Lấy các tệp jar của plugin và mod, không phải danh sách: phiên bản rất quan trọng, và "mới nhất" sẽ là một tệp khác vào tháng tới.

Cũng hãy kiểm tra xem các bản sao lưu của bạn có thuộc về bạn không. Một bản sao lưu chỉ tồn tại bên trong bảng điều khiển bạn đang rời đi không phải là bản sao lưu bạn sở hữu.

## Trong Minecraft Server Manager

Toàn bộ bảng điều khiển là một thư mục. Sao chép nó sang một máy khác và khởi động bảng điều khiển ở đó sẽ mang theo mọi máy chủ, thế giới, bản sao lưu và cài đặt, điều này làm cho việc di chuyển bảng điều khiển trở thành một thao tác sao chép thay vì di chuyển.

Đối với một máy chủ thay vì tất cả, một bản thiết kế (blueprint) sẽ ghi lại cấu hình, bộ mod và phiên bản gói đã ghim (và, nếu bạn chọn, thế giới đang hoạt động) dưới dạng một tệp `.mcserver.zip` duy nhất có thể được nhập vào một bảng điều khiển khác để xây dựng lại cùng một máy chủ. Thế giới có thể được tải xuống và cài đặt riêng lẻ khi chỉ có thế giới cần di chuyển.

Nếu cổng trò chơi mà một máy chủ đã sử dụng đã bị chiếm trên máy mới, hoặc bạn muốn thử nghiệm trên cổng không công khai trước, hãy thay đổi nó trong **Settings → Configuration**: thẻ **Game Port** có tùy chọn **Use Next Free Port**, một máy chủ đang chạy sẽ hỏi trước khi khởi động lại trên cổng mới, và nếu không thể khởi động ở đó, nó sẽ quay lại cổng cũ. Chuyển sang cổng công khai khi bạn hướng người chơi đến đó.

Liên quan: [bản thiết kế](/docs/blueprints/), [bản sao lưu thực sự khôi phục được](/docs/guide-backups/), [thế giới và tệp](/docs/worlds-and-files/).
