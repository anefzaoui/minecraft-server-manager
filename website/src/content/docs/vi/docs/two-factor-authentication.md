---
title: 'Xác thực hai yếu tố'
description: 'Xác thực hai yếu tố (2FA) thêm một bước thứ hai khi đăng nhập: sau mật khẩu của bạn, bạn nhập một mã ngắn từ ứng dụng xác thực trên điện thoại của mình.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Xác thực hai yếu tố (2FA) thêm một bước thứ hai vào quá trình đăng nhập: sau mật khẩu của bạn, bạn nhập một mã gồm sáu chữ số từ ứng dụng xác thực trên điện thoại của mình. Ngay cả khi ai đó biết mật khẩu của bạn, họ cũng không thể truy cập mà không có thiết bị của bạn.

Nó hoạt động với bất kỳ ứng dụng xác thực TOTP tiêu chuẩn nào (Google Authenticator, Authy, 1Password, Microsoft Authenticator, v.v.) và có sẵn cho **mọi** tài khoản, không chỉ quản trị viên. Bảo vệ thông tin đăng nhập của riêng bạn không phải là hành động quản lý máy chủ, vì vậy người xem và người vận hành cũng có thể bật nó.

## Bật 2FA

Mở menu tài khoản (ảnh đại diện hoặc ảnh hồ sơ của bạn, phía trên bên phải) và chọn **2FA**.

![Menu tài khoản](/docs/images/2fa-user-menu.png)

Bạn sẽ thấy một hộp thoại đăng ký:

![Đăng ký](/docs/images/2fa-enroll.png)

1. **Quét mã QR** bằng ứng dụng xác thực của bạn hoặc nhấn **Sao chép** và nhập khóa thủ công bằng tay.
2. Nhập **mã gồm 6 chữ số** mà ứng dụng của bạn hiển thị.
3. **Xác nhận mật khẩu của bạn.** Bật 2FA sẽ kiểm tra lại mật khẩu của bạn, vì vậy một phiên mở không mong muốn không thể bật nó bằng thiết bị của người khác.
4. Nhấp vào **Bật**.

### Lưu mã sao lưu của bạn

Ngay khi 2FA được bật, bảng điều khiển sẽ hiển thị một bộ **mã sao lưu** dùng một lần.

![Mã sao lưu](/docs/images/2fa-backup-codes.png)

Mỗi mã chỉ hoạt động **một lần**, để đăng nhập nếu bạn mất quyền truy cập vào ứng dụng xác thực của mình. Lưu chúng ở một nơi an toàn (trình quản lý mật khẩu là lý tưởng) vì chúng sẽ không được hiển thị lại. Bạn có thể tạo lại một bộ mã mới bất kỳ lúc nào (điều này sẽ vô hiệu hóa các mã cũ).

## Đăng nhập bằng 2FA

Sau đó, quá trình đăng nhập sẽ có bước thứ hai. Sau tên người dùng và mật khẩu của bạn, bảng điều khiển sẽ yêu cầu mã của bạn:

![Đăng nhập 2FA](/docs/images/2fa-login-challenge.png)

Nhập mã gồm 6 chữ số hiện tại từ ứng dụng của bạn (hoặc một trong các mã sao lưu của bạn) và bạn đã đăng nhập. Cho đến khi bạn hoàn thành bước này, phiên đó **chưa** đăng nhập: nó không thể truy cập bất kỳ trang hoặc API nào.

## Quản lý hoặc tắt 2FA

Mở mục **2FA** tương tự trong menu tài khoản khi nó đã được bật. Sau khi xác nhận mật khẩu của bạn, bạn có thể:

- **Tạo lại Mã sao lưu** sẽ cấp một bộ mã mới và thu hồi bộ mã cũ.
- **Tắt 2FA** sẽ xóa nó khỏi tài khoản của bạn.

Cả hai hành động này đều kiểm tra lại mật khẩu hiện tại của bạn trước.

## Mất điện thoại _và_ mã sao lưu?

Một **quản trị viên** có thể đặt lại 2FA của người dùng khác từ **Cài đặt → Người dùng** (**Đặt lại 2FA** trong menu hành động của người dùng đó). Thao tác này sẽ xóa 2FA cho tài khoản để người dùng có thể đăng nhập chỉ bằng mật khẩu của họ và thiết lập lại. Quản trị viên không thể đặt lại 2FA của _chính họ_ mà không cần mật khẩu. Họ thực hiện quy trình tắt thông thường được bảo vệ bằng mật khẩu, vì vậy một phiên quản trị bị xâm phạm không thể gỡ bỏ yếu tố thứ hai của chính nó.

## Thông tin hữu ích

- Mã dựa trên thời gian và luân phiên sau mỗi 30 giây; bảng điều khiển chấp nhận một độ lệch đồng hồ nhỏ và tự động phục hồi nếu đồng hồ của máy chủ sau đó được sửa chữa.
- Một mã không thể được phát lại: một khi mã đó được sử dụng để đăng nhập, mã đó sẽ không hoạt động lại trong khoảng thời gian của nó.
- Các mã sai bị giới hạn tốc độ. Bộ giới hạn này được **chia sẻ** với bước mật khẩu (khóa tài khoản và bộ giới hạn `RATE_LIMIT_AUTH_PER_15MIN` theo IP), vì vậy việc nhập mật khẩu đúng không thể đặt lại bộ đếm ngay trước khi đoán mã gồm 6 chữ số.
- Các thay đổi 2FA (bật, tắt, đặt lại, sử dụng mã sao lưu) đều được ghi lại trong [Nhật ký hoạt động](/docs/activity/).
