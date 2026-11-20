---
title: 'Sao lưu máy chủ Minecraft có thể khôi phục thực sự'
description: 'Cách tạo bản sao lưu máy chủ Minecraft có thể khôi phục thực sự: bản sao nhất quán, lưu trữ ở nơi khác và được kiểm tra ít nhất một lần.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Hầu hết các máy chủ đều có bản sao lưu. Tuy nhiên, ít máy chủ có bản sao lưu hoạt động, và sự khác biệt chỉ được phát hiện vào ngày tồi tệ nhất. Ba yếu tố phân biệt chúng: bản sao nhất quán, nó nằm ở một nơi khác và ai đó đã khôi phục nó ít nhất một lần.

## Sao chép thế giới khi nó không bị ghi

Máy chủ đang chạy liên tục ghi các tệp vùng. Sao chép chúng giữa chừng khi đang ghi, bạn sẽ nhận được một tệp nửa cũ nửa mới, tệp này hoặc không tải được hoặc tải với một lỗ hổng trên mặt đất nơi từng có căn cứ của ai đó. Sẽ không có cảnh báo nào cho bạn, vì bản sao đã thành công.

Có hai cách đúng để sao chép:

1. **Dừng máy chủ**, sao chép, sau đó khởi động lại. Đơn giản, trung thực và không được ưa chuộng vì thời gian ngừng hoạt động.
2. **Yêu cầu trò chơi dừng ghi trước.** Chạy `save-off`, sau đó `save-all flush`, đợi cho đến khi hoàn tất, sao chép, sau đó `save-on`. Thế giới sẽ hoàn chỉnh và yên tĩnh trong suốt thời gian sao chép.

Không bao giờ bỏ qua bước này để sao chép. Ảnh chụp nhanh ở cấp độ hệ thống tệp hoặc ổ đĩa chỉ tốt nếu nó thực sự nguyên tử, còn `cp -r` khi người chơi đang đặt các khối thì không.

## Sao lưu nhiều hơn thế giới

Chỉ khôi phục thế giới sẽ lấy lại địa hình và làm mất máy chủ. Bạn cũng cần:

- `server.properties`, và bất kỳ tệp nào khác đặt ra các quy tắc.
- Các tệp jar mod hoặc plugin, với các phiên bản chính xác đang chạy. Thế giới sẽ không tải được nếu thiếu các mod đã tạo ra các khối của nó.
- Dữ liệu người chơi, bao gồm `whitelist.json`, `ops.json` và các thư mục thống kê và thành tích.
- Phiên bản gói, nếu nó đến từ một gói. Ghi lại nó là đủ.

Cách kiểm tra nhanh nhất về bất kỳ bản sao lưu nào: bạn có thể xây dựng lại máy chủ này trên một máy mới chỉ từ kho lưu trữ không? Nếu câu trả lời cần một câu bắt đầu bằng "và sau đó tôi sẽ cài đặt lại", thì đó không phải là bản sao lưu hoàn chỉnh.

## Một bản sao trên cùng một ổ đĩa không phải là bản sao lưu

Bản sao lưu nằm trên máy mà nó bảo vệ chỉ giải quyết được một lỗi: bạn đã xóa thứ gì đó. Nó không giải quyết được trường hợp ổ đĩa bị hỏng, nhà cung cấp đình chỉ tài khoản, hoặc một lỗi xóa toàn bộ thư mục.

Giữ cho nó đơn giản thay vì hoàn hảo:

- Một bản sao cục bộ, cho trường hợp phổ biến, đó là ai đó phá hoại hoặc một bản cập nhật tồi tệ.
- Một bản sao ở nơi khác. Một máy khác, một kho lưu trữ đối tượng, hoặc một NAS tại nhà kéo hàng đêm qua SSH.
- Đủ lịch sử để sống sót qua một sự cố mà bạn không nhận thấy ngay lập tức. Sự hỏng hóc thường được phát hiện sau vài ngày, và nếu bạn giữ ba ngày sao lưu, bạn đã ghi đè lên bản tốt.

Bảy bản sao hàng ngày cộng với bốn bản sao hàng tuần giải quyết gần như mọi sự cố thực tế và tốn rất ít dung lượng.

## Kiểm tra khôi phục trước khi bạn cần

Chọn một bản sao lưu, khôi phục nó vào một máy chủ dự phòng và tham gia. Đó là toàn bộ bài kiểm tra, mất mười lăm phút và nó bắt được tất cả các lỗi cổ điển: kho lưu trữ thiếu thư mục mod, thế giới cần một phiên bản mà bạn không còn chạy, quyền truy cập khiến tệp không thể đọc được, một lần tải lên bị cắt cụt.

Thực hiện một lần khi bạn thiết lập sao lưu, và một lần nữa sau bất kỳ thay đổi lớn nào đối với máy chủ.

## Kích thước và cách giữ cho nó hợp lý

Thế giới phát triển vì người chơi khám phá. Một thế giới nơi ai đó đã bay mười nghìn khối theo một đường thẳng sẽ mang theo mọi khối dọc theo đường đó mãi mãi, và hầu hết các khối đó sẽ không bao giờ được truy cập lại.

Ba đòn bẩy, theo thứ tự mức độ hiệu quả:

1. **Cắt bớt các khối chưa được truy cập.** Các công cụ cắt theo thời gian chạm cuối cùng thường loại bỏ một phần lớn thế giới đã đi lại nhiều mà không có tác động rõ ràng trong trò chơi.
2. **Nén đúng cách.** Các tệp vùng nén tốt; kho lưu trữ của chúng không hưởng lợi từ bất kỳ phương pháp nào kỳ lạ.
3. **Không giữ mọi bản sao hàng giờ trong một năm.** Lịch sử lưu giữ quan trọng hơn nén.

## Trong Minecraft Server Manager

Sao lưu đi theo quy trình `save-off`, flush, copy, `save-on`, và yêu cầu dừng hoặc khởi động lại giữa chừng khi sao lưu sẽ bị từ chối cho đến khi bản sao hoàn tất thay vì chạy đua với nó. Kho lưu trữ bao gồm toàn bộ thư mục máy chủ, vì vậy các mod, cấu hình và dữ liệu người chơi đi kèm với thế giới.

Sao lưu có thể chạy theo lịch trình cùng với việc khởi động lại và lệnh, và mọi máy chủ mới đều bắt đầu với lịch trình sao lưu hàng ngày. Số lượng bản sao lưu được tính riêng cho từng loại, vì vậy mười bản sao theo lịch trình tích lũy không thể thay thế bản sao bạn đã thực hiện thủ công trước một thay đổi rủi ro, và giới hạn về tuổi và kích thước được áp dụng thêm. Quản trị viên thay đổi tất cả chúng trên trang Cài đặt, hoặc cho từng máy chủ trên tab Sao lưu của nó. Khôi phục sẽ lấy bản sao lưu mới nhất trước, vì vậy việc khôi phục về thời điểm sai cũng có thể hoàn tác được. Thế giới có thể được thu nhỏ riêng hoặc như một phần của bản sao lưu, đây là đòn bẩy quan trọng nhất về kích thước.

Toàn bộ bảng điều khiển, bao gồm mọi bản sao lưu, nằm trong một thư mục. Sao chép thư mục đó sang nơi khác là một nửa câu chuyện ngoài máy, và đó là điều duy nhất bạn phải sao chép một cách có chủ ý.

Liên quan: [sao lưu trong bảng điều khiển](/docs/backups/), [lịch trình](/docs/schedules/), [thu nhỏ thế giới](/docs/world-shrink/), [di chuyển máy chủ sang máy chủ khác](/docs/guide-moving-a-server/).
