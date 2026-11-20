---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: chọn loại nào?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge hay Quilt: loại máy chủ Minecraft nào để chạy, tùy thuộc vào những gì người chơi của bạn cài đặt.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Chọn dựa trên những gì bạn muốn người chơi cài đặt, không phải dựa trên những gì nghe có vẻ nhanh nhất.

| Bạn muốn                                                   | Chạy cái này            | Người chơi cài đặt |
| ---------------------------------------------------------- | ----------------------- | ------------------ |
| Sinh tồn với bạn bè, không có gì đặc biệt                  | Vanilla                 | Không có gì        |
| Máy chủ công cộng với cấp bậc, yêu cầu quyền và kiểm duyệt | Paper                   | Không có gì        |
| Gói mod cụ thể từ CurseForge hoặc Modrinth                 | Bất cứ điều gì được ghi | Gói đó             |
| Gói mod hiện đại bạn tự xây dựng                           | Fabric hoặc NeoForge    | Các mod tương tự   |
| Gói cũ từ kỷ nguyên 1.7 đến 1.12                           | Forge                   | Các mod tương tự   |

Đó là quyết định cuối cùng cho hầu hết mọi người. Phần còn lại của trang này là lý do tại sao.

## Plugin và mod không phải là một thứ

Đây là sự khác biệt mà mọi thứ khác dựa vào.

**Plugin** chỉ chạy trên máy chủ. Paper, Spigot và Bukkit tải chúng. Người chơi tham gia bằng một client thông thường, không sửa đổi và không bao giờ biết. Bất cứ thứ gì về cơ bản là quy tắc, quyền, kinh tế, yêu cầu quyền, trò chơi nhỏ hoặc kiểm duyệt đều là plugin, và đó là lý do tại sao hầu hết mọi máy chủ công cộng đều chạy Paper.

**Mod** thay đổi chính trò chơi: khối mới, chiều không gian mới, máy móc mới. Client phải tải cùng các mod như máy chủ, nếu không nó không thể hiểu máy chủ đang nói gì. Bất kỳ ai tham gia máy chủ có mod đều phải cài đặt gói trước.

Một máy chủ không thể có cả hai một cách có ý nghĩa. Các dự án lai tồn tại, gắn một API plugin vào một trình tải mod, và chúng hoạt động cho đến khi chúng không hoạt động, thường là vào thời điểm tồi tệ nhất. Nếu bạn cần cả hai, hãy chạy một proxy với một máy chủ có mod và một máy chủ plugin phía sau nó thay vì một máy chủ lai.

## Phía plugin

**Paper** là lựa chọn mặc định. Nó là một nhánh của Spigot với nhiều năm làm việc về hiệu suất và một tệp cấu hình cho hầu hết mọi hành vi đã từng làm phiền quản trị viên. Các plugin Vanilla từ kỷ nguyên Bukkit hầu hết vẫn chạy.

**Purpur** là một nhánh của Paper với nhiều tùy chỉnh hơn nữa, bao gồm cả các tùy chỉnh về lối chơi. Chọn nó nếu bạn muốn những cài đặt cụ thể đó; nếu không thì chọn Paper.

**Vanilla** đáng để chạy khi mục đích là trò chơi không thay đổi. Nó chậm hơn với nhiều người chơi và không có hệ thống quyền, vì vậy việc kiểm duyệt là thủ công.

Paper thay đổi một số hành vi vanilla theo mặc định vì hiệu suất. Nếu một cỗ máy redstone từ một video không hoạt động trên máy chủ của bạn, đó thường là lý do, và đó thường là một cài đặt.

## Phía mod

**Fabric** nhỏ gọn, cập nhật lên phiên bản Minecraft mới trong vòng vài ngày và mang theo hầu hết các mod hiệu suất hiện đại. Hầu hết mọi mod Fabric cũng cần Fabric API, đây là một bản tải xuống riêng biệt. Nếu mục tiêu của bạn là một máy chủ nhanh với một vài mod tiện ích, thì đây là lựa chọn.

**NeoForge** là nơi hệ sinh thái Forge cũ hiện đang hoạt động cho các phiên bản hiện tại. Nó tách khỏi Forge trong phiên bản 1.20.1 và hầu hết các gói lớn được xây dựng cho 1.20.2 trở lên nhắm đến nó. Nếu bạn đang bắt đầu một gói nặng ký mới ngày hôm nay, thì đây là lựa chọn.

**Forge** vẫn sở hữu quá khứ. Bất cứ thứ gì từ kỷ nguyên 1.7.10, 1.12.2 và 1.16.5, là một phần lớn của các gói được yêu thích, đều là Forge và sẽ luôn như vậy. Giữ nó cho những gói đó.

**Quilt** là một nhánh của Fabric chạy hầu hết các mod Fabric. Nó tồn tại vì những lý do chính đáng, nhưng nếu bạn không có lý do cụ thể để chọn nó, hãy chọn Fabric.

Các mod cho trình tải này không chạy trên trình tải khác. Một trang mod ghi là Fabric có nghĩa là Fabric.

## Nếu bạn đang cài đặt một gói, gói đó sẽ quyết định

Đừng chọn. Gói liệt kê trình tải và phiên bản Minecraft chính xác của nó, và cả hai phải khớp. "Gần đúng" không tồn tại ở đây: một gói cho 1.20.1 không chạy trên 1.20.4 và một gói 1.20.1 NeoForge không chạy trên 1.20.1 Forge.

Cài đặt gói theo ID hoặc liên kết của nó thay vì tự chọn mod, và ghim phiên bản. Các gói cập nhật, và một bản cập nhật xảy ra bất ngờ giữa mùa giải là cách thế giới bị hỏng.

## Phiên bản Java nào

Yêu cầu của Minecraft thay đổi theo trò chơi và chạy sai phiên bản sẽ tạo ra lỗi `UnsupportedClassVersionError` không hữu ích thay vì một thông báo rõ ràng.

| Phiên bản Minecraft | Java |
| ------------------- | ---- |
| 1.16.5 trở về trước | 8    |
| 1.17                | 16   |
| 1.18 và 1.19        | 17   |
| 1.20 đến 1.20.4     | 17   |
| 1.20.5 đến 1.21.x   | 21   |
| 26.1 trở về sau     | 25   |

Các gói cũ thực sự cần Java 8; đây là một trong số ít nơi trong phần mềm mà phiên bản mới nhất là sai.

## Trong Minecraft Server Manager

Trình tạo máy chủ sẽ hỏi bạn muốn chạy gì và chọn phiên bản Java từ bảng trên, vì vậy sự không khớp sẽ không bao giờ xảy ra do vô tình. Vanilla, Paper và Purpur nằm trên tab **Vanilla** của nó; tab **From Mods** nhận Fabric, Forge, NeoForge hoặc Quilt, với phiên bản Minecraft và bản dựng trình tải (mới nhất hoặc bản bạn ghim). Cài đặt một gói từ CurseForge, Modrinth hoặc GT New Horizons sẽ ghim nó vào một phiên bản chính xác. Nâng cấp chỉ xảy ra khi bạn áp dụng nó (hoặc sau kiểm tra hàng ngày, nếu chính sách cập nhật của máy chủ là **Tự động cập nhật**), luôn sao lưu trước và có thể hoàn nguyên.

Trình duyệt mod biết máy chủ đang chạy trình tải nào và lọc những gì nó cung cấp cho phù hợp, vì vậy một tệp jar Fabric không thể vô tình rơi vào máy chủ NeoForge.

Liên quan: [tạo và quản lý máy chủ](/docs/servers/), [gói mod](/docs/modpacks/),
[cần bao nhiêu RAM cho máy chủ](/docs/guide-server-memory/).
