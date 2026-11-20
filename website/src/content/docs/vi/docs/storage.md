---
title: 'Lưu trữ'
description: 'Xem dung lượng ổ đĩa được sử dụng ở đâu, đặt giới hạn dung lượng cho từng thư mục máy chủ và dọn dẹp những gì bạn không còn cần nữa.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Lưu trữ** hiển thị dung lượng ổ đĩa của bạn đang được sử dụng: mức sử dụng theo danh mục, từng máy chủ so với hạn ngạch của nó, các tệp lớn nhất và xu hướng sử dụng tổng thể trong các lần quét gần đây. Trang này chỉ dành cho quản trị viên.

![Lưu trữ](/docs/images/storage.png)

## Hạn ngạch ổ đĩa được thực thi bởi bảng điều khiển

Docker không thể giới hạn việc sử dụng ổ đĩa của một bind mount, vì vậy bảng điều khiển sẽ làm điều đó. Một công cụ lập chỉ mục kích thước chạy nền sẽ quét thư mục dữ liệu (mười lăm phút một lần, sau các thay đổi, hoặc khi bạn nhấn **Quét lại ngay**), lưu trữ dấu chân của từng máy chủ và thực thi hạn ngạch ổ đĩa bạn đặt cho mỗi máy chủ. Một hành động sẽ khiến thư mục của máy chủ (thế giới, mod, cấu hình, nhật ký và mọi thứ khác trong đó) vượt quá hạn ngạch của nó, chẳng hạn như cài đặt một mod hoặc một thế giới hoặc tải tệp lên, sẽ bị chặn cho đến khi dung lượng được giải phóng hoặc hạn ngạch được tăng lên, thay vì để một máy chủ lấp đầy máy chủ của bạn.

Đặt hạn ngạch của máy chủ trong [cài đặt](/docs/servers/#server-settings) của nó. Bật tùy chọn **Dừng máy chủ khi vượt quá hạn ngạch** ở đó cũng sẽ dừng một máy chủ đang chạy khi thư mục của nó phát triển quá 10% so với hạn ngạch và ghi lại điều đó trong lịch sử của máy chủ. Các máy chủ đã cài đặt mod có thể rất lớn, vì vậy hãy cho chúng đủ dung lượng. [Sao lưu](/docs/backups/) được lưu trữ riêng và không tính vào hạn ngạch.

## Dọn dẹp

Thẻ **Dọn dẹp bằng một cú nhấp chuột** giải phóng dung lượng mà bảng điều khiển có thể thu hồi một cách an toàn: các tệp tạm thời cũ hơn một giờ, các tệp thư viện bị bỏ lại và các tệp nhật ký và báo cáo sự cố đã lưu trữ cũ hơn 30 ngày. Mỗi mục hiển thị lượng dung lượng được giải phóng và mở bản xem trước trước khi bất kỳ thứ gì bị xóa. Danh sách **Theo danh mục** và **Tệp lớn nhất** liên kết trực tiếp đến trình quản lý tệp, vì vậy bạn có thể tìm thấy những gì khác cần xóa trước khi hết dung lượng.
