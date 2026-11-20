---
title: 'Người dùng & vai trò'
description: 'Tài khoản, các vai trò quản trị viên, người vận hành và người xem, cùng với quyền hạn cho từng máy chủ trong Minecraft Server Manager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Bảng điều khiển hỗ trợ đa người dùng. Quản lý tài khoản trong mục **Cài đặt → Người dùng**.

![Người dùng](/docs/images/settings-users.png)

## Ba vai trò

| Vai trò      | Mặc định trên mọi máy chủ                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **quản trị** | Toàn quyền: quản lý người dùng, khóa API, tệp toàn cục, ghi đè Docker nâng cao và mọi hành động của máy chủ.                        |
| **vận hành** | Chạy và cấu hình máy chủ (khởi động/dừng, bảng điều khiển, sao lưu, thế giới, mod, hầu hết cài đặt), nhưng không có quyền quản trị. |
| **xem**      | Chỉ đọc. Xem máy chủ và trạng thái của chúng, nhưng không thực hiện thay đổi nào.                                                   |

Mọi người dùng, kể cả người xem, đều có thể quản lý [xác thực hai yếu tố](/docs/two-factor-authentication/) của riêng mình, vì việc bảo vệ đăng nhập của bản thân không phải là hành động quản lý máy chủ.

Một vai trò là **mặc định** cho mọi máy chủ. Để cấp quyền khác cho ai đó trên một máy chủ, hãy sử dụng quyền theo máy chủ bên dưới.

## Quyền theo máy chủ

Trang **Quyền** (trong thanh bên, hoặc **Quyền máy chủ** trong **Cài đặt → Người dùng**) hiển thị một bảng: mọi người vận hành và người xem ở một bên, mọi máy chủ ở phía trên. Nhấp vào một ô để quyết định những gì người dùng đó có thể làm trên một máy chủ cụ thể. Quản trị viên không được liệt kê vì họ luôn có mọi thứ.

![Quyền](/docs/images/settings-permissions.png)

Mỗi ô là một tập hợp các quyền:

| Quyền               | Cho phép những gì trên máy chủ đó                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Xem**             | Xem máy chủ, trạng thái, đầu ra bảng điều khiển, người chơi, lịch sử và số liệu thống kê.                         |
| **Điều khiển**      | Khởi động, dừng, khởi động lại, tắt và xây dựng lại máy chủ.                                                      |
| **Bảng điều khiển** | Chạy lệnh bảng điều khiển và các hành động nhanh của thế giới, gửi tin nhắn và quản lý lệnh trò chuyện.           |
| **Người chơi**      | Đuổi, cấm, đưa vào danh sách trắng, cấp quyền op và chỉnh sửa ghi chú người chơi.                                 |
| **Nội dung**        | Cài đặt và gỡ bỏ mod, plugin, gói, thế giới, datapack và chỉnh sửa kho đồ.                                        |
| **Sao lưu**         | Tạo, khôi phục, tải xuống và xóa các bản sao lưu.                                                                 |
| **Tệp**             | Duyệt, chỉnh sửa, tải lên và tải xuống các tệp máy chủ, nhật ký đã lưu trữ và các gói nhật ký; xuất bản thiết kế. |
| **Cài đặt**         | Thay đổi cài đặt máy chủ, thuộc tính, tích hợp, biểu tượng và nâng cấp phiên bản.                                 |
| **Xóa**             | Xóa máy chủ.                                                                                                      |

![Trình chỉnh sửa quyền](/docs/images/permissions-editor.png)

Bên dưới bảng, **Mỗi quyền bao gồm những gì** mở rộng mỗi quyền thành những gì một người có thể làm, những gì không bao gồm và các tuyến đường bảng điều khiển chính xác mà nó mở ra. Danh sách cuối cùng đó được kiểm tra với mã nguồn đang chạy bởi bộ kiểm thử.

![Tham chiếu quyền](/docs/images/permissions-reference.png)

Trên điện thoại, bảng được xếp chồng thành một thẻ cho mỗi người dùng, với một hàng cho mỗi máy chủ.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Quyền trên điện thoại" width="180">
</p>

Các thành phần kết hợp với nhau như thế nào:

- **Vai trò là mặc định.** Một người vận hành bắt đầu với mọi quyền trên mọi máy chủ; một người xem bắt đầu chỉ với quyền Xem. Một ô có văn bản mờ (chú giải công cụ cho biết "Mặc định vai trò") chưa bao giờ được thay đổi.
- **Một ô ghi đè vai trò chỉ cho máy chủ đó.** Cấp cho người xem quyền Điều khiển và Bảng điều khiển trên một máy chủ và họ có thể chạy nó, trong khi mọi máy chủ khác vẫn chỉ đọc đối với họ. Thu hồi quyền Xóa khỏi người vận hành trên máy chủ chính của bạn và họ vẫn giữ mọi thứ khác ở đó.
- **Mọi quyền đều bao gồm Xem.** Bạn không thể hành động trên một máy chủ mà bạn không thể nhìn thấy.
- **Tắt mọi thứ để ẩn máy chủ.** Nó sẽ biến mất khỏi thanh bên, bảng điều khiển, bản sao lưu, lịch trình, hoạt động, cập nhật, gói mod, trạng thái trực tiếp, tác vụ đang chạy và bản thiết kế của người dùng đó, và thư viện thế giới sẽ ngừng đặt tên cho nó. Một liên kết trực tiếp, lệnh gọi API hoặc ổ cắm bảng điều khiển sẽ trả lời "không tìm thấy", giống như một máy chủ không tồn tại.
- **Các hành động toàn bảng điều khiển vẫn tuân theo vai trò.** Tạo máy chủ (bao gồm cả nhân bản), lưu trữ, người dùng, khóa API, cài đặt toàn cục và lịch trình toàn bảng điều khiển không phải là theo máy chủ, vì vậy người xem có quyền trên một số máy chủ vẫn không thể thực hiện bất kỳ điều nào trong số này. Người vận hành giữ quyền tạo máy chủ và lịch trình toàn bảng điều khiển; lưu trữ, người dùng, khóa API và cài đặt toàn cục chỉ dành cho quản trị viên.
- **Lịch trình đi theo máy chủ.** Một lịch trình khởi động lại, sao lưu hoặc lệnh trên máy chủ yêu cầu quyền tương ứng ở đó (Điều khiển, Sao lưu hoặc Bảng điều khiển), bất kể vai trò.
- **Bản thiết kế cũng đi theo máy chủ.** Xuất máy chủ dưới dạng bản thiết kế yêu cầu quyền Tệp ở đó, vì kho lưu trữ mang theo các tệp của nó. Một bản thiết kế được xuất từ một máy chủ mà ai đó không thể nhìn thấy cũng sẽ bị ẩn khỏi họ.
- **Các khu vực chỉ dành cho quản trị viên vẫn chỉ dành cho quản trị viên** trên mọi máy chủ: chatbot, lưu giữ bản sao lưu và ghi đè Docker nâng cao.

Mọi thay đổi đều được ghi vào nhật ký hoạt động với thông tin ai đã thay đổi gì; các mục đó chỉ hiển thị cho quản trị viên. Xóa người dùng sẽ xóa các hàng của họ. Gỡ bỏ máy chủ vẫn giữ nguyên, vì vậy máy chủ bị ẩn khỏi ai đó vẫn bị ẩn trong lịch sử và các bản sao lưu đã lưu của nó.

Các cài đặt hiện có vẫn hoạt động không thay đổi: cho đến khi quản trị viên chỉnh sửa một ô, mọi người dùng đều có chính xác những gì vai trò của họ đã cấp trước đó.

## Chỉ dành cho quản trị viên và lý do

Một số thứ được giới hạn cho quản trị viên một cách có chủ đích:

- **Quản lý người dùng, lưu trữ, cài đặt toàn cục, khóa API và tệp toàn cục.**
- **[API công khai](/docs/public-api/)**: bật `/api/v1` và tạo, giới hạn phạm vi hoặc thu hồi các token Bearer chỉ đọc của nó.
- **Ghi đè Docker nâng cao**: tên vùng chứa tùy chỉnh, xuất bản cổng bổ sung và gắn kết. Gắn kết có thể ánh xạ bất kỳ đường dẫn máy chủ nào vào vùng chứa, và kết hợp với quyền truy cập Docker của bảng điều khiển, điều đó tương đương với quyền root trên máy chủ. Các trường này chỉ xuất hiện cho quản trị viên.

Tên vùng chứa tùy chỉnh cũng không thể nằm trong không gian tên `msm-` của bảng điều khiển, vì vậy một vùng chứa được đặt tên thủ công không bao giờ có thể che khuất một phiên bản khác của máy chủ và chuyển hướng lệnh dừng hoặc lệnh đến sai phiên bản.

## Quản lý tài khoản

![Ảnh đại diện](/docs/images/profile-picture.png)

Quản trị viên có thể tạo người dùng, thay đổi vai trò, đặt lại mật khẩu và xóa tài khoản từ bảng Người dùng. Cột **2FA** hiển thị liệu người dùng có bật xác thực hai yếu tố hay không; quản trị viên có thể đặt lại 2FA của người dùng khác bằng **Đặt lại 2FA** trong menu hành động của người dùng đó (trong trường hợp mất điện thoại và mã dự phòng), nhưng không bao giờ có thể tắt 2FA của chính họ mà không có mật khẩu, điều mà quy trình tự phục vụ xử lý thay thế.

Các lần đăng nhập thất bại được giới hạn tốc độ cho mỗi tài khoản (cả bộ đếm theo IP và bộ đếm toàn cục cho tài khoản) để làm chậm các nỗ lực tấn công brute-force, và cùng một giới hạn này cũng áp dụng cho bước mã 2FA để mật khẩu đúng không thể đặt lại bộ đếm trước khi đoán mã. Phía trước đó là một bộ giới hạn yêu cầu thô hơn cho mỗi IP khách hàng trên các điểm cuối đăng nhập / 2FA / thiết lập, có thể điều chỉnh thông qua `RATE_LIMIT_AUTH_PER_15MIN` (mặc định là 100; phía sau một proxy ngược, đặt `TRUST_PROXY` để nó dựa trên IP khách hàng thực).
