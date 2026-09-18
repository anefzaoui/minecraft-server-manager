---
title: 'Lưu trữ'
description: 'Trang Lưu trữ hiển thị dung lượng ổ đĩa của bạn đang được sử dụng như thế nào: mức sử dụng theo từng máy chủ và xu hướng của nó theo thời gian.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Lưu trữ** hiển thị dung lượng ổ đĩa của bạn đang được sử dụng như thế nào: mức sử dụng theo từng máy chủ và xu hướng của nó theo thời gian.

![Lưu trữ](/docs/images/storage.png)

## Hạn ngạch đĩa được thực thi bởi bảng điều khiển

Docker không thể giới hạn việc sử dụng đĩa của một bind mount, vì vậy bảng điều khiển sẽ làm điều đó. Một công cụ lập chỉ mục kích thước chạy nền sẽ quét thư mục dữ liệu, lưu trữ dấu chân của từng máy chủ và thực thi hạn ngạch đĩa bạn đặt cho mỗi máy chủ. Khi dữ liệu của máy chủ (thế giới + bản sao lưu + mọi thứ khác) gần đạt đến hạn ngạch của nó, bảng điều khiển sẽ ngăn chặn sự phát triển mất kiểm soát thay vì để một máy chủ lấp đầy máy chủ của bạn.

Đặt hạn ngạch của máy chủ trong [cài đặt](/docs/servers/) của nó. Các máy chủ đã cài đặt mod và [bản sao lưu](/docs/backups/) của chúng có thể rất lớn, vì vậy hãy cho chúng đủ không gian.

## Dọn dẹp

Chế độ xem Lưu trữ giúp bạn tìm những gì cần cắt tỉa (bản sao lưu cũ, thế giới không sử dụng hoặc một máy chủ đã phát triển vượt xa mong đợi) trước khi hết dung lượng.
