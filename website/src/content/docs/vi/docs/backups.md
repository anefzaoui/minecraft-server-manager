---
title: 'Sao lưu'
description: 'Trang Sao lưu hiển thị mọi ảnh chụp nhanh trên toàn bộ hệ thống của bạn, kèm theo kích thước, lý do và thời gian.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Sao lưu** hiển thị mọi bản chụp nhanh trên toàn bộ hệ thống của bạn, kèm theo kích thước, lý do và tuổi đời.

![Sao lưu](/docs/images/backups.png)

## Tạo bản sao lưu

Từ tab **Sao lưu** của một máy chủ (hoặc thông qua [lịch trình](/docs/schedules/)), bạn có thể chụp nhanh toàn bộ thư mục máy chủ chỉ bằng một cú nhấp chuột. Bảng điều khiển sẽ làm ổn định thế giới trước (`save-off` → `save-all`), nén dữ liệu, sau đó bật lại việc lưu (`save-on`), vì vậy các bản sao lưu nhất quán ngay cả trên một máy chủ đang chạy. Quá trình nén chạy trong một luồng worker nền để không làm chậm bảng điều khiển. Mỗi bản sao lưu có thể kèm theo một ghi chú.

Mọi kho lưu trữ đều được **kiểm tra tính toàn vẹn** ngay khi nó được ghi: bảng điều khiển mở lại tệp zip và đọc thư mục của nó. Một kho lưu trữ bị hỏng hoặc không thể mở sẽ bị xóa và lệnh sao lưu sẽ thất bại ngay lập tức, thay vì vấn đề nổi lên sau nhiều tháng khi việc khôi phục là thứ duy nhất ngăn cách bạn với việc mất dữ liệu. Một kho lưu trữ không có mục nào (một máy chủ chưa bao giờ khởi động) được phép nhưng sẽ được đánh dấu trong sự kiện.

Chọn **"Cũng thu nhỏ thế giới sau đó"** (trên tab Sao lưu hoặc trong lịch trình sao lưu) để xóa các chunk hiếm khi được truy cập sau khi kho lưu trữ đã được ghi an toàn (xem **[Thu nhỏ thế giới](/docs/world-shrink/)**). Việc thu nhỏ chỉ chạy khi máy chủ đã dừng; trên một máy chủ đang chạy, bản sao lưu vẫn diễn ra và việc thu nhỏ bị bỏ qua.

![Sao lưu máy chủ](/docs/images/server-backups.png)

## Lý do sao lưu

Các bản sao lưu được gắn thẻ theo lý do chúng được tạo:

- **thủ công** - bạn đã nhấp vào nút.
- **theo lịch trình** - được tạo bởi [lịch trình](/docs/schedules/). Mọi máy chủ mới cũng được cung cấp một bản sao lưu theo lịch trình hàng ngày tự động (phân bổ giữa 02:00 và 05:59), vì vậy máy chủ có phạm vi bảo hiểm tự động ngay từ ngày đầu, không chỉ trước các bản cập nhật.
- **trước cập nhật** - được tạo tự động trước khi nâng cấp gói, vì vậy việc nâng cấp luôn có thể hoàn nguyên.
- **trước khôi phục** - được tạo tự động ngay trước khi khôi phục hoặc đặt lại thế giới, như một biện pháp an toàn trong trường hợp việc khôi phục không như bạn mong muốn.

## Lưu giữ

Việc lưu giữ được giới hạn **cho mỗi máy chủ, cho mỗi lý do**: các bản mới nhất trong mỗi nhóm sẽ được giữ lại, các bản cũ hơn sẽ tự động bị xóa sau mỗi lần sao lưu thành công:

| Lý do           | Số lượng giữ lại |
| --------------- | ---------------- |
| theo lịch trình | 10               |
| trước cập nhật  | 10               |
| thủ công        | 20               |
| trước khôi phục | 5                |

`trước khôi phục` có một bộ đệm nhỏ riêng chính xác để một bản sao lưu an toàn tự động không bao giờ có thể ghi đè lên bản sao lưu `thủ công` mà bạn đã cố tình giữ lại.

Hai giới hạn tùy chọn áp dụng trên số lượng cho mỗi lý do, cả hai đều bị tắt theo mặc định: **tuổi tối đa** (các bản sao lưu cũ hơn N ngày sẽ bị xóa, bất kể lý do của chúng) và **tổng kích thước tối đa** cho mỗi máy chủ (các bản sao lưu cũ nhất sẽ bị xóa cho đến khi tổng dung lượng phù hợp, ưu tiên các bản `trước khôi phục` trước). Bản sao lưu mới nhất của máy chủ không bao giờ bị xóa bởi bất kỳ giới hạn nào. Tất cả những điều này có thể được thay đổi trên toàn cầu trên trang Cài đặt và được ghi đè cho từng máy chủ trên tab Sao lưu của nó.

Các bản sao lưu có thể được **đổi tên** từ danh sách sao lưu (nút đổi tên trên mỗi hàng). Kho lưu trữ trên đĩa và bản ghi của bảng điều khiển di chuyển cùng nhau, vì vậy việc tải xuống, khôi phục và lưu giữ tiếp tục hoạt động với tên mới.

![Đổi tên bản sao lưu](/docs/images/backup-rename.png)

> Việc lưu giữ được giới hạn tự động, nhưng các kho lưu trữ mod lớn vẫn được tính vào [hạn ngạch đĩa](/docs/storage/) của máy chủ, vì vậy hãy chú ý đến tổng dung lượng cho các gói lớn.

## Khôi phục

Việc khôi phục một bản sao lưu sẽ dừng máy chủ (xác minh rằng container thực sự đã dừng trước khi chạm vào bất kỳ tệp nào), tạo một bản sao lưu an toàn `trước khôi phục`, thay thế **toàn bộ thư mục máy chủ** bằng ảnh chụp nhanh, và để nó ở trạng thái dừng để bạn khởi động lại. Vì các bản nâng cấp gói luôn tạo bản sao lưu `trước cập nhật` trước, bạn luôn có thể hoàn nguyên một bản nâng cấp bị lỗi.

## Cơ sở dữ liệu của bảng điều khiển

Các bản sao lưu máy chủ chỉ bao gồm các thư mục thế giới của từng máy chủ. Cơ sở dữ liệu của bảng điều khiển (`panel.db`, chứa người dùng, vai trò, bí mật 2FA, lịch trình, ghim gói và lịch sử) được chụp nhanh riêng biệt theo bộ hẹn giờ bảo trì hàng ngày:

- `VACUUM INTO` ghi một bản sao nhất quán, không phân mảnh vào `data/backups/_panel/`; **14** bản mới nhất sẽ được giữ lại.
- Khi khởi động, bảng điều khiển sẽ chạy `PRAGMA integrity_check` và ghi nhật ký lớn nếu nó thất bại, chỉ cho bạn đến `data/backups/_panel` để lấy bản sao tốt mới nhất.

Sao lưu toàn bộ cây `data/` (nó cũng chứa `.secret-key`, khóa mã hóa khi lưu trữ) và bạn đã sao lưu mọi thứ.
