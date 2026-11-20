---
title: 'Gói Mod'
description: 'Cài đặt các gói mod CurseForge, Modrinth, FTB và GT New Horizons dưới dạng máy chủ, luôn được ghim vào một phiên bản gói chính xác.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Modpacks** (và tab **Từ Modpack** trong [trình hướng dẫn tạo](/docs/servers/)) cài đặt một modpack dưới dạng máy chủ, luôn **được ghim vào một phiên bản gói chính xác** để việc khởi động lại không bao giờ có thể tự động nâng cấp gói mà bạn không biết.

![Modpacks](/docs/images/modpacks.png)

## Các nền tảng được hỗ trợ

- **CurseForge**: tìm kiếm theo tên. Cần có khóa API CurseForge (thêm khóa này trong **Cài đặt → Khóa API**).
- **Modrinth**: tìm kiếm theo tên.
- **FTB**: Các gói Feed The Beast, chỉ thông qua API (ID gói số cộng với ID phiên bản rõ ràng). Bảng điều khiển chưa kiểm tra các bản cập nhật gói FTB.
- **GT New Horizons**: gói chuyên gia 1.7.10, được cài đặt từ chỉ mục phát hành riêng của GTNH. GTNH chọn thời gian chạy Java của nó theo phiên bản gói (2.8.0+ chạy trên **Java 25** thông qua các bản vá lwjgl3ify đi kèm, các bản phát hành cũ hơn trên Java 21 hoặc 17), và trình hướng dẫn tăng RAM và ổ đĩa của máy chủ lên mức tối thiểu hợp lý cho nó.
- **Tệp zip tùy chỉnh**: không phải là một gói đã xuất bản. Tải lên **xuất modpack CurseForge** (tệp zip có `manifest.json` mà ứng dụng CurseForge tạo ra cho một bộ mod được chọn thủ công), một **Modrinth `.mrpack`**, hoặc **bất kỳ tệp zip nào của các tệp jar mod**. Bảng điều khiển giải quyết manifest hàng loạt (hoặc xác định từng tệp jar bằng hàm băm/dấu vân tay/siêu dữ liệu), xem trước những gì phù hợp và cài đặt mọi thứ trong một tác vụ, bao gồm cả cấu hình `overrides/` của gói nếu bạn chọn. Các mod mà tác giả của chúng không cho phép tải xuống tự động được liệt kê với liên kết trình duyệt và khe tải lên thủ công thay vì làm hỏng quá trình cài đặt.

## Cách hoạt động của việc ghim

Khi bạn chọn một gói, bảng điều khiển sẽ giải quyết phiên bản chính xác, ghi lại và cài đặt phiên bản đó. Trên trang **Cập nhật**, bạn sẽ được thông báo khi có phiên bản mới hơn (trừ khi [chính sách cập nhật](#update-policy) của máy chủ là **Chỉ thủ công**); nâng cấp là một hành động có chủ ý, được bảo vệ với bản sao lưu trước khi cập nhật và khôi phục. Các máy chủ theo dõi ổn định không bao giờ được cung cấp bản beta. Tab **Phiên bản** của máy chủ trả lời nửa còn lại của câu hỏi: các phiên bản Minecraft trong tương lai mà các mod nó thực sự có thể theo dõi ([cập nhật](/docs/updates/#minecraft-version-compatibility)).

Phiên bản trình tải mod cũng đi kèm với gói: máy chủ cài đặt bản dựng Forge, NeoForge hoặc Fabric mà gói khai báo. Nếu một gói Forge hoặc Fabric CurseForge khai báo một bản quá cũ so với các mod của nó, tab **Phiên bản** có thể ghi đè nó cho đến khi gói được sửa; một bản cập nhật gói sẽ loại bỏ ghi đè, vì phiên bản mới khai báo phiên bản riêng của nó ([thay đổi phiên bản trình tải mod](/docs/updates/#changing-the-mod-loader-version)).

Các máy chủ được tạo trên các phiên bản bảng điều khiển rất cũ (trước 0.9.7) có thể bị _bỏ ghim_, nghĩa là hình ảnh vùng chứa sẽ tự động cài đặt phiên bản gói mới nhất mỗi khi khởi động. Bảng điều khiển hiện sửa chữa những lỗi này khi khởi động: nó khóa từng lỗi vào phiên bản thực sự được cài đặt (đọc từ các bản ghi của bảng điều khiển hoặc manifest cài đặt của hình ảnh, không bao giờ là "mới nhất" được giải quyết mới) và ghi lại một sự kiện. Nếu không thể biết được những gì đã được cài đặt, trang Cài đặt của máy chủ sẽ hiển thị cảnh báo với nút **Chọn phiên bản…** (các gói CurseForge, Modrinth và GTNH) mở [bộ chọn phiên bản](#changing-the-pack-version), và mọi nỗ lực lưu cấu hình modpack chưa được ghim đều bị từ chối hoàn toàn.

## Chính sách cập nhật

Mỗi máy chủ có một thẻ **Chính sách cập nhật** trên tab **Cài đặt → Cấu hình** của nó, và cả ba tùy chọn đều có ý nghĩa như sau:

- **Chỉ thủ công** (mặc định): không có gì thay đổi tự động, và máy chủ hoàn toàn bị loại khỏi huy hiệu cập nhật và trang Cập nhật. Chế độ "để tôi yên": lý tưởng cho một gói được điều chỉnh thủ công hoặc được nhập mà bạn không bao giờ muốn chạm vào. Nó không khóa phiên bản: [**Thay đổi phiên bản…**](#changing-the-pack-version) hoạt động theo mọi chính sách. Để được thông báo về các phiên bản mới và áp dụng chúng bằng một cú nhấp chuột, hãy chọn **Thông báo cho tôi**.
- **Thông báo cho tôi**: kiểm tra hàng ngày sẽ hiển thị các bản cập nhật có sẵn dưới dạng huy hiệu và trên trang Cập nhật; việc áp dụng chúng luôn là do bạn nhấp.
- **Tự động cập nhật**: sau khi kiểm tra hàng ngày theo lịch trình, các bản cập nhật **gói** đang chờ xử lý được áp dụng thông qua cùng một đường dẫn được bảo vệ như một bản nâng cấp thủ công: sao lưu trước khi cập nhật, giám sát sức khỏe và khôi phục tự động nếu phiên bản mới không khởi động được. Các bản cập nhật sẽ chuyển máy chủ sang một phiên bản Minecraft khác luôn bị bỏ qua với một sự kiện thay vào đó: chuyển đổi một thế giới vĩnh viễn là một quyết định mà bảng điều khiển từ chối đưa ra cho bạn. Các nút **Kiểm tra ngay** thủ công chỉ kiểm tra; chúng không bao giờ kích hoạt tự động cập nhật.

## Nâng cấp một gói

Từ một máy chủ đã ghim, bạn có thể nâng cấp lên phiên bản mới hơn trong một hành động. Bảng điều khiển sẽ sao lưu trước, hoán đổi phiên bản đã ghim, xây dựng lại máy chủ (giải quyết lại Java nếu phiên bản mới cần một thời gian chạy khác) và giám sát lần khởi động đầu tiên, với một khoảng thời gian rộng rãi cho các gói lớn như GTNH tải xuống vài gigabyte và xây dựng một thế giới vài trăm mod khi khởi động lần đầu.

## Thay đổi phiên bản gói

Để chạy một phiên bản cụ thể, mới hơn hoặc cũ hơn, hãy sử dụng **Thay đổi phiên bản…** trên thẻ gói của tab **Tổng quan** của máy chủ. Trên trang **Modpacks**, mở thẻ của một gói đã cài đặt sẽ cung cấp cùng một lựa chọn: chọn một phiên bản trong danh sách thả xuống và nhấp vào **Chuyển sang phiên bản này**. Cả hai đều cần quyền **Nội dung** của máy chủ, và cả hai đều có sẵn cho các gói CurseForge, Modrinth và GTNH (các gói FTB chưa có danh sách phiên bản). Danh sách hiển thị 25 phiên bản mới nhất cho CurseForge và Modrinth, và mọi bản phát hành GTNH.

Việc chuyển đổi đi qua cùng một đường dẫn được bảo vệ như một bản nâng cấp: sao lưu trước khi cập nhật, ghim mới, xây dựng lại và khởi động lần đầu được giám sát, với khả năng khôi phục bằng một cú nhấp chuột nếu máy chủ không hoạt động bình thường. Các mod tùy chỉnh của bạn được giữ lại, cũng như các mod gói bạn đã tắt, cùng với các cài đặt cài đặt khác của gói (mod bị buộc vào, tệp bỏ qua, các dự án bổ sung). Cài đặt một gói khác sẽ bắt đầu lại các cài đặt đó, vì chúng chỉ có ý nghĩa đối với gói mà chúng được tạo ra.

Mỗi phiên bản được liệt kê với phiên bản Minecraft mà nó chạy, so sánh với phiên bản mà thế giới của bạn đã được lưu lần cuối bởi:

- **Cùng phiên bản Minecraft**: chuyển đổi sau khi xác nhận bình thường. Quay lại một phiên bản gói cũ hơn có thể làm mất các khối và vật phẩm từ các mod mà phiên bản đó không có, vì vậy bản sao lưu vẫn nằm trong tab Sao lưu trong mọi trường hợp.
- **Phiên bản Minecraft mới hơn**: được phép sau khi xác nhận cảnh báo rằng thế giới được chuyển đổi vĩnh viễn. Bản sao lưu được tạo trước là cách duy nhất để quay lại thế giới cũ.
- **Phiên bản Minecraft cũ hơn**: không khả dụng. Minecraft không thể tải một thế giới trên một phiên bản cũ hơn phiên bản đã lưu nó lần cuối, vì vậy bảng điều khiển từ chối thay vì để lại một máy chủ bị treo khi khởi động.
