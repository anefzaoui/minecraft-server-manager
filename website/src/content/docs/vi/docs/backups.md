---
title: 'Sao lưu'
description: 'Trang Sao lưu hiển thị mọi bản chụp nhanh trên toàn bộ hệ thống của bạn, kèm theo kích thước, lý do và thời gian, có thể lọc theo máy chủ và theo lý do.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Sao lưu** hiển thị mọi bản ghi nhanh trên toàn bộ hệ thống của bạn, bao gồm kích thước, lý do và thời gian, có thể lọc theo máy chủ và theo lý do.

![Sao lưu](/docs/images/backups.png)

## Tạo bản sao lưu

Từ tab **Sao lưu** của máy chủ (hoặc thông qua [lịch trình](/docs/schedules/)), bạn có thể tạo bản sao lưu toàn bộ thư mục máy chủ chỉ bằng một cú nhấp chuột. Bảng điều khiển sẽ tạm dừng thế giới trước (`save-off` → `save-all`), nén dữ liệu, sau đó bật lại việc lưu (`save-on`), vì vậy các bản sao lưu nhất quán ngay cả trên một máy chủ đang chạy. Quá trình nén chạy trong một luồng worker nền để không làm chậm bảng điều khiển. Bản sao lưu được bắt đầu thông qua API có thể mang theo một ghi chú.

Mọi kho lưu trữ đều được **kiểm tra tính toàn vẹn** ngay tại thời điểm nó được ghi: bảng điều khiển mở lại tệp zip và đọc thư mục của nó. Kho lưu trữ bị hỏng hoặc không thể mở sẽ bị xóa và lệnh sao lưu sẽ thất bại ngay lập tức, thay vì vấn đề chỉ xuất hiện sau nhiều tháng khi việc khôi phục là thứ duy nhất ngăn bạn khỏi mất dữ liệu. Kho lưu trữ không có mục nào (máy chủ chưa bao giờ khởi động) được phép nhưng sẽ được gắn cờ trong sự kiện.

Chọn **"Cũng thu nhỏ thế giới sau đó"** (trên tab Sao lưu hoặc trong lịch trình sao lưu) để xóa các chunk hiếm khi được truy cập sau khi kho lưu trữ đã được ghi an toàn (xem **[Thu nhỏ thế giới](/docs/world-shrink/)**). Việc thu nhỏ chỉ chạy khi máy chủ bị dừng; trên máy chủ đang chạy, bản sao lưu vẫn diễn ra và việc thu nhỏ bị bỏ qua.

![Sao lưu máy chủ](/docs/images/server-backups.png)

## Lý do sao lưu

Các bản sao lưu được gắn thẻ theo lý do chúng được thực hiện:

- **thủ công**: bạn đã nhấp vào **Sao lưu ngay**. Thay thế thế giới đang hoạt động của máy chủ bằng một thế giới từ thư viện cũng sẽ tạo một bản sao lưu `thủ công` trước.
- **theo lịch trình**: được tạo bởi [lịch trình](/docs/schedules/). Mọi máy chủ mới cũng được tự động tạo một bản sao lưu theo lịch trình hàng ngày (phân bổ giữa 02:00 và 05:59), vì vậy máy chủ có phạm vi bảo hiểm tự động ngay từ ngày đầu, không chỉ trước các bản cập nhật.
- **trước cập nhật**: được thực hiện tự động trước khi nâng cấp gói hoặc thay đổi phiên bản Minecraft, vì vậy việc nâng cấp luôn có thể hoàn nguyên.
- **trước khôi phục**: được thực hiện tự động ngay trước khi khôi phục hoặc đặt lại thế giới, như một biện pháp an toàn trong trường hợp việc khôi phục không như bạn mong muốn.

## Lưu giữ

Việc lưu giữ được giới hạn **cho mỗi máy chủ, cho mỗi lý do**: các bản sao lưu mới nhất trong mỗi nhóm sẽ được giữ lại, các bản cũ hơn sẽ tự động bị xóa sau mỗi lần sao lưu thành công:

| Lý do           | Giữ lại theo mặc định |
| --------------- | --------------------- |
| theo lịch trình | 10                    |
| trước cập nhật  | 10                    |
| thủ công        | 20                    |
| trước khôi phục | 5                     |

`trước khôi phục` (được gọi là bản sao lưu an toàn trong bảng điều khiển) có một bộ đệm nhỏ riêng chính xác để bản sao lưu an toàn tự động không bao giờ có thể ghi đè lên bản sao lưu `thủ công` mà bạn cố tình giữ lại.

Hai giới hạn tùy chọn áp dụng trên số lượng cho mỗi lý do, cả hai đều tắt theo mặc định: **tuổi tối đa** (các bản sao lưu cũ hơn N ngày sẽ bị xóa, bất kể lý do của chúng) và **tổng kích thước tối đa** cho mỗi máy chủ (các bản sao lưu cũ nhất sẽ bị xóa cho đến khi tổng kích thước phù hợp: bản sao lưu an toàn trước, sau đó là bản sao lưu theo lịch trình, sau đó là phần còn lại). Bản sao lưu mới nhất của máy chủ không bao giờ bị xóa bởi bất kỳ giới hạn nào.

### Thay đổi

Quản trị viên đặt chính sách toàn bảng điều khiển trong thẻ **Lưu giữ Bản sao lưu** trên trang **Cài đặt** (**Điền vào Mục có sẵn** sẽ đưa các giá trị mặc định ở trên trở lại biểu mẫu, sẵn sàng để lưu). Máy chủ có thể khác nhau về bất kỳ giá trị nào trong sáu giá trị: mở tab **Sao lưu** của nó và mở rộng **Lưu giữ cho Máy chủ này**. Mỗi trường ở đó sẽ trống trừ khi máy chủ đó đặt nó, và một trường trống sẽ tuân theo giá trị toàn bảng điều khiển (hiển thị bên trong nó). Vì vậy, một máy chủ có thể, ví dụ, giữ 3 bản sao lưu theo lịch trình và sử dụng các giá trị toàn bảng điều khiển cho mọi thứ khác; xóa một trường sẽ đưa nó trở lại giá trị toàn bảng điều khiển.

![Thẻ Lưu giữ Bản sao lưu trong Cài đặt](/docs/images/settings-retention.png)

![Lưu giữ cho Máy chủ này trên tab Sao lưu của máy chủ](/docs/images/server-retention.png)

Lưu không bao giờ xóa bất cứ thứ gì một mình. Nếu các giới hạn mới sẽ khiến các bản sao lưu hiện có vượt quá giới hạn, bảng điều khiển sẽ liệt kê, cho mỗi máy chủ, có bao nhiêu bản sao lưu của mỗi loại sẽ bị xóa, bao nhiêu dung lượng được giải phóng và bản sao lưu cũ nhất bao nhiêu tuổi. Nó cũng cho biết khi nào một máy chủ đã vượt quá giới hạn của nó trước thay đổi này (ví dụ: sau một lần **Từ Bản sao lưu tiếp theo** trước đó), vì áp dụng ngay bây giờ sẽ cắt bớt mọi thứ vượt quá giới hạn, không chỉ những gì chỉnh sửa này thêm vào. Sau đó, nó hỏi cách áp dụng chúng:

- **Xóa ngay** xóa chính xác các bản sao lưu mà nó vừa liệt kê, không hơn: bản sao lưu được tạo trong thời gian chờ đợi lần cắt tiếp theo. Từ trang Cài đặt, một máy chủ đang trong quá trình khôi phục, sao lưu hoặc hành động tương tự sẽ bị bỏ qua và cắt sau lần sao lưu tiếp theo; trên tab Sao lưu của máy chủ, bạn sẽ được yêu cầu thử lại sau khi hành động đó hoàn tất. Trong khi các bản sao lưu cũ của máy chủ đang bị xóa (thường là vài giây), các hành động khác trên máy chủ đó phải chờ đợi: bản sao lưu theo lịch trình hoặc khởi động xảy ra vào thời điểm đó sẽ thử lại mỗi phút cho đến khi nó có thể (trong tối đa 30 phút), máy chủ bị lỗi sẽ được khởi động lại trong khoảng 20 giây sau khi hoàn thành (trong tối đa 30 phút), và việc khởi động lại hoặc dừng theo lịch trình trùng với nó sẽ bị bỏ qua cho đến thời điểm tiếp theo.
- **Từ Bản sao lưu tiếp theo** giữ chúng cho đến bây giờ; mỗi máy chủ sẽ cắt các bản sao lưu của nó vào lần tiếp theo nó tạo ra một bản sao lưu, như nó vẫn luôn làm.

![Hộp thoại liệt kê những gì giới hạn mới sẽ xóa](/docs/images/retention-preview.png)

Bản sao lưu đang được khôi phục sẽ không bao giờ bị xóa trong khi quá trình khôi phục đang chạy: việc lưu giữ sẽ bỏ qua nó (và không xóa các bản sao lưu khác để tạo chỗ cho nó), và việc xóa thủ công sẽ bị từ chối cho đến khi quá trình khôi phục hoàn tất.

Các cài đặt tương tự có sẵn cho tập lệnh dưới dạng các điểm cuối API quản trị: `GET`/`POST /api/backups/retention` và `/api/servers/:id/backups/retention`. Các giá trị toàn bảng điều khiển không thể là `null`. Đối với máy chủ, giá trị `null` (hoặc `""`) sẽ xóa khóa đó, vì vậy nó sẽ tuân theo giá trị toàn bảng điều khiển một lần nữa, và `{ "reset": true }` sẽ xóa tất cả chúng. Dưới mỗi trong hai đường dẫn đó, `POST …/preview` báo cáo những gì một thay đổi sẽ xóa mà không xóa nó (`backups`, `bytes`, `servers`, `ids` và `byServer` chi tiết cho mỗi máy chủ), và `POST …/apply` áp dụng chính sách đã lưu ngay bây giờ và trả lời `{ deleted, skipped }` toàn bảng điều khiển (`skipped` đếm các máy chủ bận) hoặc `{ deleted }` cho một máy chủ. Gửi `POST` của bản xem trước `{ "token": "..." }` (giữ trong 10 phút) hoặc `{ "ids": [...] }` để chỉ xóa những mục đó; nếu không có gì, mọi thứ vượt quá giới hạn sẽ bị xóa. Việc áp dụng cho từng máy chủ trên một máy chủ bận sẽ trả về 409.

Các bản sao lưu có thể được **đổi tên** từ danh sách bản sao lưu (nút đổi tên trên mỗi hàng). Kho lưu trữ trên đĩa và bản ghi của bảng điều khiển di chuyển cùng nhau, vì vậy tải xuống, khôi phục và lưu giữ tiếp tục hoạt động với tên mới.

![Đổi tên bản sao lưu](/docs/images/backup-rename.png)

> Việc lưu giữ được giới hạn tự động, nhưng các kho lưu trữ lớn đã sửa đổi vẫn được tính vào [hạn ngạch lưu trữ](/docs/storage/) của máy chủ, vì vậy hãy chú ý đến tổng dung lượng cho các gói lớn.

## Khôi phục

Khôi phục bản sao lưu sẽ dừng máy chủ (xác minh container thực sự đã dừng trước khi chạm vào bất kỳ tệp nào), tạo một bản sao lưu an toàn `trước khôi phục`, thay thế **toàn bộ thư mục máy chủ** bằng bản ghi nhanh và để nó ở trạng thái dừng để bạn khởi động lại. Kho lưu trữ được giải nén sang một bên trước và chỉ được hoán đổi vào khi nó đã giải nén hoàn toàn, vì vậy việc khôi phục bị lỗi giữa chừng sẽ để lại các tệp hiện tại không bị ảnh hưởng. Bởi vì các bản nâng cấp gói luôn tạo bản sao lưu `trước cập nhật` trước, bạn luôn có thể hoàn nguyên một bản nâng cấp bị lỗi.

## Cơ sở dữ liệu của bảng điều khiển

Bản sao lưu máy chủ chỉ bao gồm thư mục của từng máy chủ. Cơ sở dữ liệu của bảng điều khiển (`panel.db`, chứa người dùng, vai trò, bí mật 2FA, lịch trình, ghim gói và lịch sử) được chụp nhanh riêng biệt theo bộ hẹn giờ bảo trì hàng ngày:

- `VACUUM INTO` ghi một bản sao nhất quán, không phân mảnh vào `backups/_panel/` trong thư mục dữ liệu; **14** bản mới nhất được giữ lại.
- Khi khởi động, bảng điều khiển chạy `PRAGMA integrity_check` và ghi nhật ký lớn nếu nó thất bại, chỉ cho bạn đến `backups/_panel` để lấy bản sao tốt mới nhất.

Sao lưu toàn bộ thư mục dữ liệu (nó cũng chứa `.secret-key`, khóa mã hóa khi nghỉ) và bạn đã sao lưu mọi thứ.
