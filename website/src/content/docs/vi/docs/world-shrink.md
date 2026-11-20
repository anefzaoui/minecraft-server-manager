---
title: 'Thu nhỏ thế giới'
description: 'Thu nhỏ thế giới Minecraft bằng cách xóa các chunk ít được truy cập, để lấy lại dung lượng đĩa và tăng tốc sao lưu.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Theo thời gian, thế giới sẽ mở rộng ra: mọi nơi người chơi từng đi bộ, bay hoặc
bị ngọc Ender dịch chuyển đều để lại các chunk đã tạo trên đĩa, ngay cả khi không
ai quay lại. **Thu nhỏ thế giới** sẽ xóa các chunk mà hầu như không ai dành thời
gian ở đó, do đó thế giới sẽ chiếm ít dung lượng hơn. Minecraft sẽ xây dựng lại
khu vực đã xóa từ hạt giống thế giới ngay khi ai đó di chuyển đến đó một lần nữa,
vì vậy điều này an toàn cho vùng đất mà không ai sử dụng, nhưng bất cứ thứ gì người
chơi _đã xây dựng_ ở một vị trí mà họ chỉ đứng thoáng qua cũng sẽ bị mất, đó là
lý do tại sao bạn nên sao lưu trước (bản sao lưu chính là thao tác hoàn tác).

## Điều gì được coi là "ít được truy cập"

Mỗi chunk ghi lại thời gian người chơi đã đứng trong đó (Minecraft gọi đây là
`InhabitedTime`). Thu nhỏ thế giới sẽ xóa bất kỳ chunk nào có tổng thời gian người
chơi dưới **30 giây** theo mặc định; hộp thoại thu nhỏ cho phép bạn thay đổi ngưỡng
đó (từ 1 giây đến 1 giờ) và số lượng chunk xung quanh điểm hồi sinh cần giữ lại
(mặc định là 8, `0` sẽ tắt bảo vệ điểm hồi sinh).

Những gì luôn được giữ lại:

- Khu vực xung quanh **điểm hồi sinh** của thế giới (đọc từ `level.dat`) trong
  thế giới chính (overworld). Nether, End và các chiều không gian tùy chỉnh không
  có khu vực hồi sinh.
- Bất kỳ chunk nào có thời gian truy cập không thể đọc được, ví dụ: một thế giới
  được lưu với định dạng nén mà bảng điều khiển không giải mã được (LZ4). Bản xem
  trước và kết quả sẽ cho bạn biết có bao nhiêu chunk như vậy đã bị bỏ qua.

Mọi chiều không gian của thế giới đều được xử lý: các thư mục con kiểu Bukkit
(`world_nether`, `world_the_end`) cũng như bố cục vanilla và Forge/Fabric
(`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`).
Khi một chunk bị xóa, các thực thể và điểm quan tâm của dân làng cũng sẽ bị xóa
theo, vì vậy một chunk được tạo lại sẽ không kế thừa các mob cũ, xe mỏ hoặc địa
điểm làm việc.

## Thực hiện từ tab Thế giới

1. Sao lưu từ tab **Sao lưu**. Thu nhỏ từ tab Thế giới không tự động sao lưu cho
   bạn.
2. Mở **Thế giới → Thế giới**, tìm thế giới và nhấp vào biểu tượng thu nhỏ.
3. Nhấp vào **Xem trước** để xem ước tính số lượng chunk (và số megabyte) sẽ bị
   xóa. Chưa có gì thay đổi; bản xem trước hoạt động khi máy chủ đang chạy.
4. Nhấp vào **Thu nhỏ thế giới**. Thao tác thu nhỏ chỉnh sửa trực tiếp các tệp thế
   giới, vì vậy máy chủ phải được dừng: hãy dừng trước hoặc chọn tùy chọn để dừng,
   thu nhỏ và khởi động lại trong một lần (máy chủ sẽ được khởi động lại ngay cả
   khi thao tác thu nhỏ thất bại). Tiến trình sẽ hiển thị trong khay tác vụ.

![Thu nhỏ thế giới](/docs/images/world-shrink.png)

## Thực hiện như một phần của bản sao lưu

Trên tab **Sao lưu**, chọn **"Cũng thu nhỏ thế giới sau đó"** trước khi nhấp vào
**Sao lưu ngay**. Lưu trữ sao lưu được ghi trước (lưu trữ đó là bản hoàn tác của
bạn), sau đó thế giới sẽ được thu nhỏ, nhưng chỉ khi máy chủ đã dừng. Nếu máy chủ
đang chạy, bản sao lưu vẫn chạy và thao tác thu nhỏ sẽ bị bỏ qua với một ghi chú.

Các bản sao lưu theo lịch trình có tùy chọn tương tự: trong trình chỉnh sửa lịch
trình, chọn tác vụ **Sao lưu** và chọn **"Thu nhỏ thế giới sau mỗi lần sao lưu"**.
Kết hợp nó với lịch trình **Dừng máy chủ** vài phút trước đó nếu bạn muốn nó chạy
mà không cần giám sát.
