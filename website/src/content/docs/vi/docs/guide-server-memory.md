---
title: 'Máy chủ Minecraft cần bao nhiêu RAM?'
description: 'Máy chủ Minecraft cần bao nhiêu RAM cho phiên bản vanilla, Paper, mod nhẹ và modpack lớn, và bao nhiêu RAM cần để lại cho máy.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Câu trả lời ngắn gọn, cho một máy chủ sẽ thực sự được chơi:

| Bạn đang chạy gì                            | Heap Java   | Cấp cho máy chủ |
| ------------------------------------------- | ----------- | --------------- |
| Vanilla hoặc Paper, tối đa 10 người chơi    | 2 GB        | 4 GB            |
| Paper với plugin, 10 đến 30 người chơi      | 4 GB        | 6 GB            |
| Gói mod nhẹ, 40 đến 80 mod                  | 4 GB        | 6 GB            |
| Gói "tất cả trong một" lớn, 150 đến 300 mod | 6 đến 8 GB  | 10 GB           |
| GregTech New Horizons và những thứ tương tự | 8 đến 12 GB | 16 GB           |

Hai con số, không phải một. Đó là phần mà hầu hết các hướng dẫn bỏ qua, và đó là lý do tại sao mọi người mua máy chủ 4 GB, cấp cho Java 4 GB, rồi nhìn nó sập.

## Heap và máy chủ là hai con số khác nhau

Heap Java (`-Xmx`) là lượng bộ nhớ mà bản thân trò chơi có thể sử dụng cho thế giới, thực thể và dữ liệu mod. Máy chủ, hoặc container, phải chứa heap đó **cộng thêm** mọi thứ khác mà Java cần: siêu dữ liệu lớp, ngăn xếp luồng, quản lý bộ thu gom rác, bộ đệm mạng và chính JVM. Chi phí đó khoảng 0,5 đến 1,5 GB cho một máy chủ có mod.

Nếu heap bằng bộ nhớ của máy chủ, kernel sẽ tiêu diệt máy chủ ngay khi Java cố gắng truy cập vào chi phí đó. Trong Docker, điều này hiển thị dưới dạng mã thoát 137, và trong nhật ký thì không có gì cả: tiến trình đơn giản là biến mất giữa chừng. Mọi người thường đổ lỗi cho một mod.

Một quy tắc an toàn: **heap cộng thêm 25 phần trăm, và ít nhất một gigabyte trống.** Heap 8 GB cần máy chủ 10 GB.

## Nhiều RAM hơn không có nghĩa là hiệu suất tốt hơn

Minecraft bị giới hạn bởi một luồng trong hầu hết các hoạt động của nó. Cấp cho gói 40 mod 16 GB không làm cho các chunk được tạo nhanh hơn; nó làm cho mỗi lần tạm dừng thu gom rác kéo dài hơn, vì có nhiều thứ để quét hơn. Một máy chủ bị giật mỗi ba mươi giây thường là một máy chủ có heap quá lớn, không phải quá nhỏ.

Tăng heap khi bạn thấy những điều này, và không gì khác:

- `java.lang.OutOfMemoryError: Java heap space` trong nhật ký.
- Lặp lại "Can't keep up! Is the server overloaded?" với các tạm dừng thu gom rác trong timings.
- Mức sử dụng bộ nhớ tăng lên đến giới hạn và bị kẹt ở đó hàng giờ.

## Tại sao máy chủ của bạn hiển thị 12 GB đã sử dụng trong khi không có ai trực tuyến

Bởi vì bạn đã yêu cầu nó làm vậy. Hai cài đặt mặc định kết hợp với nhau:

1. Hình ảnh Docker phổ biến đặt heap khởi động bằng với tối đa, vì vậy `-Xms` và `-Xmx` đều là con số của bạn. Java yêu cầu nó ngay lập tức thay vì tăng dần.
2. Bộ cờ Aikar phổ biến bao gồm `-XX:+AlwaysPreTouch`, quét mọi trang của heap đó khi khởi động để các trang thực sự được cấp phát. Điều này là có chủ đích: nó đánh đổi thời gian khởi động chậm hơn và con số sử dụng nhàn rỗi lớn để giảm thiểu tạm dừng sau này.

Đo lường trên Paper 1.21.1 với heap 2 GB trong container 4 GB, lấy mẫu trong ba phút sau khi thế giới tải xong:

| Cấu hình                              | Bộ nhớ cư trú |
| ------------------------------------- | ------------- |
| Không có cờ                           | 2.60 GiB      |
| Cờ Aikar                              | 2.59 GiB      |
| Cờ Aikar không có `AlwaysPreTouch`    | 1.95 GiB      |
| Cờ Aikar với heap khởi động 512 MB    | 1.38 GiB      |
| Không có cờ với heap khởi động 512 MB | 1.25 GiB      |

Vì vậy, một máy chủ "sử dụng" 12 GB khi nhàn rỗi thường là heap 12 GB đã được "pre-touched", không phải là rò rỉ bộ nhớ. Giám sát của bạn đọc nó chính xác; con số chỉ không có ý nghĩa như bạn nghĩ.

Nếu bạn muốn một con số nhàn rỗi trung thực, hãy đặt heap khởi động thấp hơn mức tối đa. Bạn sẽ phải trả giá bằng một vài lần thu gom rác nhiều hơn ở giai đoạn đầu. Nếu bạn muốn thời gian khung hình ổn định, hãy cứ để nguyên và ngừng theo dõi biểu đồ.

## Người chơi quan trọng ít hơn bạn nghĩ

Tăng gấp đôi từ 10 lên 20 người chơi tốn ít chi phí hơn nhiều so với việc thêm năm mươi mod. Người chơi chủ yếu thêm thực thể và các chunk đã tải, những thứ này tăng dần một cách nhẹ nhàng. Mod thêm dữ liệu lớp, các bản đăng ký, các tính năng tạo thế giới và bộ nhớ đệm của riêng chúng, những thứ này không tăng dần. Hãy ưu tiên kích thước cho gói mod, sau đó thêm khoảng 100 đến 200 MB cho mỗi người chơi thông thường trên một máy chủ có mod.

Khoảng cách xem là đòn bẩy lớn khác. Giảm từ 12 xuống 8 chunk có thể tiết kiệm một gigabyte trên một máy chủ bận rộn và hầu như không nhận thấy trong quá trình chơi.

## Trong Minecraft Server Manager

Mỗi máy chủ có hai trường riêng biệt, **Java heap** và **giới hạn bộ nhớ container**, chính xác vì chúng là hai câu hỏi khác nhau. Trình hướng dẫn tạo đặt giới hạn container cao hơn heap 50% cho bạn, và bảng điều khiển từ chối lưu một máy chủ có giới hạn container không cao hơn heap của nó, bởi vì sự kết hợp đó dẫn đến mã thoát 137 thay vì một thông báo lỗi.

Thước đo bộ nhớ trên máy chủ hiển thị những gì container thực sự đang sử dụng, với một ghi chú khi heap đã được yêu cầu ngay từ đầu, vì vậy heap đã được "pre-touched" sẽ không bị đọc là vượt quá giới hạn. Một máy chủ bị kernel giết vì hết bộ nhớ sẽ được ghi lại chính xác như vậy trong lịch sử, thay vì là một sự cố bí ẩn.

Liên quan: [tạo và quản lý máy chủ](/docs/servers/),
[báo cáo sự cố](/docs/servers/#crash-reports--mclogs-analysis), [lưu trữ và hạn ngạch](/docs/storage/).
