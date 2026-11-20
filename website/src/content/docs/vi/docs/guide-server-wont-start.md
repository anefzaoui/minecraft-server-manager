---
title: 'Máy chủ Minecraft của bạn sẽ không khởi động'
description: 'Khắc phục sự cố máy chủ Minecraft không khởi động, theo thứ tự khả năng xảy ra: nhật ký, phiên bản Java, bộ nhớ, EULA và cổng, và mod.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Hãy làm theo danh sách này. Thứ tự được sắp xếp theo tần suất mỗi mục là câu trả lời, và bốn mục đầu tiên bao gồm hầu hết các trường hợp.

## 1. Đọc 20 dòng cuối, không phải dòng đầu

Cuộn xuống **cuối** nhật ký. Một "stack trace" Java được in ra từ trong ra ngoài, vì vậy phần đầu của khối văn bản là phần ít thú vị nhất. Cái bạn muốn là dòng `Caused by:` cuối cùng và bất cứ thứ gì theo sau nó. Dòng đơn lẻ đó thường cho biết tên của vấn đề.

Hai dấu hiệu cho bạn biết bạn đang ở đâu:

- `Exception in thread "main"` hoặc đường dẫn báo cáo sự cố gần cuối nghĩa là chính trò chơi đã gặp lỗi.
- Nhật ký đơn giản dừng giữa dòng, không có ngoại lệ nào cả, nghĩa là có thứ gì đó đã chấm dứt tiến trình từ bên ngoài. Chuyển đến mục 3.

## 2. UnsupportedClassVersionError nghĩa là sai Java

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Tệp lớp 52 là Java 8, 60 là 16, 61 là 17, 65 là 21, 69 là 25. Thông báo có nghĩa là máy chủ cần một phiên bản Java mới hơn phiên bản đang chạy; ngược lại, một gói cũ trên Java mới thường gặp lỗi mixin hoặc phản chiếu thay thế.

| Phiên bản Minecraft | Java |
| ------------------- | ---- |
| 1.16.5 trở về trước | 8    |
| 1.17                | 16   |
| 1.18 và 1.19        | 17   |
| 1.20 đến 1.20.4     | 17   |
| 1.20.5 đến 1.21.x   | 21   |
| 26.1 trở về sau     | 25   |

Các gói cũ thực sự cần Java 8. Phiên bản mới hơn không tốt hơn ở đây.

## 3. Mã thoát 137 là kernel, không phải mod

Nhật ký dừng giữa câu, không có báo cáo sự cố và container báo cáo 137. Đó là một lỗi hết bộ nhớ: tiến trình yêu cầu bộ nhớ mà máy không có, vì vậy nó đã bị chấm dứt.

Hầu như luôn luôn là heap Java được đặt bằng số lượng bộ nhớ của máy. Heap cần bộ nhớ của máy **trừ** chi phí hoạt động của JVM, khoảng 0,5 đến 1,5 GB trên máy chủ có mod. Giảm heap, hoặc tăng bộ nhớ máy. [Cần bao nhiêu RAM cho máy chủ](/docs/guide-server-memory/) có các con số.

## 4. EULA và cổng

Hai lỗi kinh điển với cách sửa một dòng:

- `You need to agree to the EULA in order to run the server.` Đặt `eula=true`, trong `eula.txt` hoặc với biến môi trường mà thiết lập của bạn sử dụng.
- `Address already in use` hoặc `FAILED TO BIND TO PORT`. Có thứ gì đó khác đang chiếm cổng 25565, thường là một bản sao trước đó của cùng một máy chủ chưa dừng hoàn toàn. Tìm và dừng nó thay vì thay đổi cổng, nếu không bạn sẽ có hai máy chủ.

## 5. Thiếu phụ thuộc của mod

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Phần lớn các mod Fabric cần Fabric API dưới dạng một tệp riêng biệt. Các mod Forge và NeoForge liệt kê các phụ thuộc của chúng trong chính lỗi. Cài đặt phiên bản được yêu cầu, không phải phiên bản mới nhất: "requires 0.91.x" nghĩa là dòng đó, và 0.92 sẽ thất bại trong cùng một kiểm tra.

Đôi khi phụ thuộc bị thiếu là chính trình tải:

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

Cách khắc phục là một bản dựng trình tải mới hơn, không phải mod khác. "47.4.14 or above" nghĩa là bất kỳ bản dựng nào từ đó trở lên, và Forge không xuất bản mọi số, vì vậy bản dựng cần cài đặt có thể là bản dựng tiếp theo. Trên một modpack, hãy cập nhật modpack trước: một modpack có phiên bản trình tải quá cũ cho các mod của nó là lỗi của tác giả.

## 6. Mod dành cho trình tải hoặc phiên bản sai

Một tệp jar cho trình tải khác không báo lỗi một cách lịch sự. Mong đợi lỗi mixin, `NoClassDefFoundError`, hoặc sự cố bên trong một lớp mà bạn chưa từng nghe đến. Kiểm tra trang của tệp jar: cả trình tải và phiên bản Minecraft đều phải khớp chính xác. 1.20.1 và 1.20.4 là các trò chơi khác nhau đối với các mod.

## 7. Thế giới từ phiên bản mới hơn

```
This world was created by a newer version of Minecraft
```

Thế giới nâng cấp về phía trước và không bao giờ quay lại. Khôi phục bản sao lưu từ trước khi nâng cấp, hoặc chạy phiên bản mà thế giới mong đợi. Không có đường dẫn hạ cấp nào giữ nguyên các chunk.

## Khi gặp sự cố sau khi chạy tốt trong nhiều tuần

Câu hỏi khác, thường là câu trả lời khác:

- **Nó gặp sự cố khi tải nặng**, với các bản ghi thời gian cho thấy tạm dừng dài: thu gom rác, vì vậy hãy xem xét kích thước heap trước các mod.
- **Nó gặp sự cố tại cùng một điểm trong thế giới**: một chunk bị hỏng hoặc một thực thể bị lỗi. Báo cáo sự cố thường ghi tên tọa độ.
- **Nó gặp sự cố ngay sau khi cập nhật**: mod đã cập nhật là nghi phạm, ngay cả khi dấu vết chỉ đến nơi khác. Hoàn nguyên nó và xem.
- **Nó gặp sự cố khi khởi động lại, trước đó vẫn ổn**: kiểm tra ổ đĩa. Ổ đĩa đầy tạo ra các lỗi ngoạn mục và gây hiểu lầm.

## Nhận trợ giúp thực sự hữu ích

Đăng **toàn bộ nhật ký**, không phải dòng cuối cùng, và cho biết bạn đã thay đổi gì trước khi nó bị lỗi. Dán nó vào một nơi được thiết kế cho nó, chẳng hạn như [mclo.gs](https://mclo.gs), thay vì vào trò chuyện. Bao gồm phiên bản Minecraft, trình tải, modpack và phiên bản của nó, và lượng heap mà máy chủ có. Một báo cáo với bốn thông tin đó sẽ được trả lời trong một lần; nếu không có chúng, sẽ mất năm lần.

## Trong Minecraft Server Manager

Các sự cố được phát hiện từ chính mã thoát của container, vì vậy một máy chủ bị lỗi vào lúc ba giờ sáng sẽ được ghi lại với đoạn trích nhật ký của nó thay vì được tìm thấy vào ngày hôm sau. Các nghi phạm thông thường trên trang này (EULA, sai Java, thế giới từ phiên bản mới hơn, cổng đã được sử dụng, Java hết bộ nhớ) được nhận dạng trong nhật ký đó và được đặt tên trong mục lịch sử với những việc cần làm, và tự động khởi động lại sẽ bỏ qua chúng, vì khởi động lại sẽ không khắc phục được chúng. Các báo cáo sự cố được phân tích cú pháp khi đến: ngoại lệ được làm nổi bật, ngăn xếp có thể thu gọn và các mod xuất hiện trong dấu vết được liệt kê là nghi phạm.

Bất kỳ báo cáo nào cũng có thể được chia sẻ lên mclo.gs từ thẻ của nó khi bạn cần trợ giúp (sau khi xác nhận, vì bản dán là công khai), và menu **Download** của bảng điều khiển có mọi tệp nhật ký dưới dạng một tệp zip, vì vậy "đăng toàn bộ nhật ký" là một lượt tải xuống thay vì một dự án khảo cổ. Lỗi hết bộ nhớ được ghi lại là lỗi hết bộ nhớ, giúp tiết kiệm một giờ thông thường để đổ lỗi cho một mod. Nếu có thứ gì đó khác thực sự cần cổng, thẻ **Game Port** trên **Settings → Configuration** sẽ di chuyển máy chủ đến một cổng miễn phí.

Một trình tải quá cũ được thay đổi từ tab **Versions** của máy chủ, tab này kiểm tra xem bản dựng có tồn tại và sao lưu trước khi xây dựng lại máy chủ ([thay đổi phiên bản trình tải mod](/docs/updates/#changing-the-mod-loader-version)).

Liên quan: [cần bao nhiêu RAM cho máy chủ](/docs/guide-server-memory/), [chọn trình tải](/docs/guide-choosing-a-loader/), [tạo và quản lý máy chủ](/docs/servers/).
