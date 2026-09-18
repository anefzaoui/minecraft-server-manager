---
title: 'Gói Mod'
description: 'Trang Gói Mod (và tab Từ gói mod trong trình hướng dẫn tạo) cài đặt một gói mod làm máy chủ, luôn được ghim vào một phiên bản gói chính xác để có thể khởi động lại'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Modpacks** (và tab **Từ modpack** trong [trình hướng dẫn tạo máy chủ](/docs/servers/)) cài đặt một modpack làm máy chủ, luôn **ghim vào một phiên bản gói chính xác** để khi khởi động lại sẽ không bao giờ nâng cấp gói một cách âm thầm.

![Modpacks](/docs/images/modpacks.png)

## Nền tảng được hỗ trợ

- **CurseForge** - tìm kiếm hoặc dán URL của gói. Cần khóa API CurseForge để tìm kiếm và các gói riêng tư (thêm khóa tại Cài đặt → Khóa API).
- **Modrinth** - tìm kiếm theo tên.
- **FTB** - các gói Feed The Beast.
- **GT New Horizons** - gói chuyên sâu 1.7.10, được cài đặt từ chỉ mục phát hành của GTNH. GTNH chọn runtime Java của nó cho mỗi phiên bản gói (2.8.0+ chạy trên **Java 25** thông qua các bản vá lwjgl3ify đi kèm, các bản phát hành cũ hơn chạy trên Java 21 hoặc 17), và trình hướng dẫn sẽ tăng RAM và dung lượng đĩa của máy chủ lên mức tối thiểu hợp lý cho nó.
- **Zip tùy chỉnh** - không phải là một gói đã xuất bản: tải lên một **bản xuất modpack CurseForge** (tệp zip có `manifest.json` mà ứng dụng CurseForge tạo ra cho một bộ mod được chọn thủ công) hoặc **bất kỳ tệp zip nào chứa các tệp jar mod**. Bảng điều khiển sẽ phân giải manifest hàng loạt thông qua API CurseForge (hoặc xác định từng tệp jar theo hash/fingerprint/metadata), xem trước những gì phù hợp và cài đặt mọi thứ trong một tác vụ - bao gồm cả cấu hình `overrides/` của gói nếu bạn chọn. Các mod mà tác giả của chúng không cho phép tải xuống tự động sẽ được liệt kê kèm theo liên kết trình duyệt và một khe tải lên thủ công thay vì gây lỗi cài đặt.

## Cách thức hoạt động của việc ghim

Khi bạn chọn một gói, bảng điều khiển sẽ phân giải phiên bản chính xác, ghi lại nó và cài đặt phiên bản đó. Trên trang **Cập nhật**, bạn sẽ được thông báo khi có phiên bản mới hơn; việc nâng cấp là một hành động có chủ đích, được bảo vệ với bản sao lưu trước khi cập nhật và khả năng hoàn nguyên. Các máy chủ theo dõi ổn định sẽ không bao giờ được cung cấp bản beta.

Các máy chủ được tạo trên các phiên bản bảng điều khiển rất cũ (trước 0.9.7) có thể bị _không được ghim_, nghĩa là hình ảnh container sẽ âm thầm cài đặt phiên bản gói mới nhất mỗi khi khởi động. Bảng điều khiển hiện sửa chữa chúng khi khởi động: nó khóa từng máy chủ vào phiên bản thực sự được cài đặt (đọc từ hồ sơ của bảng điều khiển hoặc manifest cài đặt của hình ảnh, không bao giờ là "mới nhất" được phân giải lại) và ghi lại một sự kiện. Nếu nó không thể xác định những gì đã được cài đặt, trang Cài đặt của máy chủ sẽ hiển thị cảnh báo yêu cầu bạn chọn phiên bản thủ công, và mọi nỗ lực lưu cấu hình modpack không được ghim sẽ bị từ chối hoàn toàn.

## Chính sách cập nhật

Mỗi máy chủ có một chính sách cập nhật trong **Cài đặt**, và cả ba tùy chọn đều có nghĩa đúng như tên gọi của chúng:

- **Chỉ thủ công** - không có gì thay đổi tự động, và máy chủ hoàn toàn bị loại khỏi huy hiệu cập nhật và trang Cập nhật. Chế độ "để tôi yên": lý tưởng cho một gói được tinh chỉnh thủ công hoặc nhập mà bạn không bao giờ muốn bị thay đổi.
- **Thông báo cho tôi** (mặc định) - kiểm tra hàng ngày sẽ hiển thị các bản cập nhật có sẵn dưới dạng huy hiệu và trên trang Cập nhật; việc áp dụng chúng luôn là do bạn nhấp chuột.
- **Tự động cập nhật** - sau khi kiểm tra hàng ngày theo lịch trình, các bản cập nhật **gói** đang chờ xử lý sẽ được áp dụng thông qua cùng một quy trình được bảo vệ như nâng cấp thủ công: sao lưu trước khi cập nhật, giám sát sức khỏe và hoàn nguyên tự động nếu phiên bản mới không khởi động được. Các bản cập nhật sẽ chuyển máy chủ sang phiên bản Minecraft khác luôn bị bỏ qua với một sự kiện thay thế - việc chuyển đổi thế giới vĩnh viễn là một quyết định mà bảng điều khiển từ chối đưa ra thay bạn. Các nút "kiểm tra ngay" thủ công chỉ kiểm tra; chúng không bao giờ kích hoạt tự động cập nhật.

## Nâng cấp gói

Từ một máy chủ đã được ghim, bạn có thể nâng cấp lên phiên bản mới hơn trong một hành động. Bảng điều khiển sẽ sao lưu trước, thay đổi phiên bản đã ghim, tạo lại container (phân giải lại Java nếu phiên bản mới yêu cầu runtime khác) và giám sát lần khởi động đầu tiên, với một khoảng thời gian rộng rãi cho các gói lớn như GTNH tải xuống vài gigabyte và xây dựng thế giới với hàng trăm mod khi khởi động lần đầu.
