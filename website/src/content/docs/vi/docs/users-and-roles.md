---
title: 'Người dùng & vai trò'
description: 'Bảng điều khiển hỗ trợ đa người dùng.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Bảng điều khiển hỗ trợ đa người dùng. Quản lý tài khoản trong mục **Cài đặt → Người dùng**.

![Người dùng](/docs/images/settings-users.png)

## Ba vai trò

| Vai trò           | Có thể làm gì                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **quản trị viên** | Mọi thứ: quản lý người dùng, khóa API, tệp toàn cục, ghi đè Docker nâng cao và mọi hành động của máy chủ.                                                         |
| **vận hành viên** | Chạy và cấu hình máy chủ (khởi động/dừng, bảng điều khiển, sao lưu, thế giới, mod, hầu hết cài đặt), nhưng không truy cập các khu vực chỉ dành cho quản trị viên. |
| **người xem**     | Chỉ đọc. Xem máy chủ và trạng thái của chúng, nhưng không thực hiện thay đổi nào.                                                                                 |

Mọi người dùng, kể cả người xem, đều có thể quản lý [xác thực hai yếu tố](/docs/two-factor-authentication/) của riêng mình, vì việc bảo vệ đăng nhập của bạn không phải là hành động quản lý máy chủ.

## Chỉ dành cho quản trị viên và lý do

Một số thứ được giới hạn cho quản trị viên một cách có chủ đích:

- **Quản lý người dùng, khóa API và tệp toàn cục.**
- **[API công khai](/docs/public-api/)** - bật `/api/v1` và tạo, giới hạn phạm vi hoặc thu hồi các token Bearer chỉ đọc của nó.
- **Ghi đè Docker nâng cao** - tên vùng chứa tùy chỉnh, cổng bổ sung và mount bind. Mount bind có thể ánh xạ bất kỳ đường dẫn máy chủ nào vào vùng chứa và kết hợp với quyền truy cập Docker của bảng điều khiển, điều này có hiệu quả tương đương với quyền root trên máy chủ. Các trường này chỉ hiển thị cho quản trị viên.

Tên vùng chứa tùy chỉnh cũng không thể nằm trong không gian tên `msm-` của bảng điều khiển, vì vậy một vùng chứa được đặt tên thủ công sẽ không bao giờ có thể ghi đè một máy chủ khác và chuyển hướng lệnh dừng hoặc lệnh đến sai phiên bản.

## Quản lý tài khoản

![Ảnh đại diện](/docs/images/profile-picture.png)

Quản trị viên có thể tạo người dùng, thay đổi vai trò, đặt lại mật khẩu và xóa tài khoản từ bảng Người dùng. Cột **2FA** hiển thị liệu mỗi người dùng đã bật xác thực hai yếu tố hay chưa; quản trị viên có thể **đặt lại** 2FA của người dùng khác (trong trường hợp mất điện thoại và mã dự phòng), nhưng không bao giờ có thể tắt 2FA của chính họ mà không có mật khẩu, điều này được xử lý bởi quy trình tự phục vụ.

Các lần đăng nhập thất bại được giới hạn tốc độ cho mỗi tài khoản (cả bộ đếm theo IP và bộ đếm toàn cục của tài khoản) để làm chậm các nỗ lực tấn công brute-force, và giới hạn tương tự cũng áp dụng cho bước mã 2FA để mật khẩu đúng không thể đặt lại bộ đếm trước khi đoán mã. Phía trước đó là bộ giới hạn yêu cầu thô hơn theo IP của máy khách trên các điểm cuối đăng nhập / 2FA / thiết lập, có thể điều chỉnh thông qua `RATE_LIMIT_AUTH_PER_15MIN` (mặc định là 100; phía sau một reverse proxy, hãy đặt `TRUST_PROXY` để nó dựa trên IP thực của máy khách).
