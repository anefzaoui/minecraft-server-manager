---
title: 'API Công khai'
description: 'Một API HTTP nhỏ, chỉ đọc để lấy trạng thái máy chủ từ bên ngoài bảng điều khiển: bảng điều khiển trạng thái, trình theo dõi thời gian hoạt động, bot Discord, quy tắc tự động hóa gia đình.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Một API HTTP nhỏ, chỉ đọc để lấy trạng thái máy chủ từ bên ngoài bảng điều khiển: bảng điều khiển trạng thái, trình theo dõi thời gian hoạt động, bot Discord, quy tắc tự động hóa gia đình. Nó được phục vụ bởi chính bảng điều khiển và trả về dữ liệu trực tiếp giống như các trang của bảng điều khiển hiển thị (từ bộ nhớ đệm trong bộ nhớ), vì vậy việc truy vấn nó không bao giờ chạm vào Docker.

Nó **tắt cho đến khi quản trị viên sử dụng** và **được quản trị viên kiểm soát**. Không có gì được hiển thị cho đến khi có một mã thông báo.

## Bật nó

**Cài đặt → API Công khai → Khóa mới**. Đặt tên cho nó, chọn những gì nó có thể xem (tất cả máy chủ hoặc một tập hợp con cụ thể) và tùy chọn ngày hết hạn. Khóa đầy đủ (mã thông báo Bearer) được hiển thị **một lần**, trong một hộp thoại; hãy sao chép nó ngay bây giờ, vì sau đó chỉ một tiền tố ngắn được giữ lại để nhận dạng trong danh sách.

![Cài đặt API Công khai](/docs/images/settings-public-api.png)

Việc tạo khóa đầu tiên sẽ tự động bật API (công tắc **Cho phép ứng dụng bên ngoài đọc trạng thái** là một nút tạm dừng: tắt nó để ngừng phục vụ mà không hủy bất kỳ khóa nào). Hủy một khóa từ cùng một bảng bất kỳ lúc nào; các ứng dụng sử dụng nó sẽ mất quyền truy cập ngay lập tức.

Mã thông báo được lưu trữ dưới dạng hàm băm SHA-256 (không bao giờ ở dạng văn bản thuần), tồn tại sau khi bảng điều khiển khởi động lại và tồn tại lâu hơn các máy chủ mà chúng được giới hạn phạm vi (một máy chủ đã xóa đơn giản là bị loại bỏ khỏi kết quả của mã thông báo đó).

## Xác thực

Gửi mã thông báo dưới dạng thông tin xác thực Bearer:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Không có cookie và **không có CORS**: điều này dành cho các trình gọi máy chủ-máy chủ và CLI, không phải ứng dụng trình duyệt trên một nguồn gốc khác. Nếu bảng điều khiển nằm sau một proxy ngược, hãy đảm bảo proxy chuyển tiếp tiêu đề `Authorization`.

Các lỗi trả về `401` với `{ "ok": false, "error": "..." }`. Bất kỳ thứ gì khác ngoài `GET` (hoặc `HEAD`) sẽ trả về `405`. Các đường dẫn không xác định sẽ trả về `404`. Khi API bị vô hiệu hóa, mọi tuyến đường sẽ trả về `404`.

## Giới hạn tốc độ

Mỗi mã thông báo có ngân sách riêng, `RATE_LIMIT_PUBLIC_API_PER_MIN` (mặc định `120` yêu cầu/phút; `0` vô hiệu hóa bộ giới hạn). Vượt quá giới hạn sẽ trả về `429`. Mọi yêu cầu, trước khi mã thông báo của nó được kiểm tra, cũng sẽ được tính vào giới hạn trên mỗi IP khách hàng gấp năm lần con số đó, vì vậy việc thăm dò bằng các mã thông báo bị thiếu, sai định dạng, bị thu hồi hoặc hết hạn không thể bỏ qua ngân sách bằng cách xoay vòng chúng.

## Điểm cuối

### `GET /api/v1/servers`

Mọi máy chủ mà mã thông báo được giới hạn phạm vi.

```json
{
  "ok": true,
  "total": 1,
  "online": 1,
  "servers": [
    {
      "id": "srv_ab12cd34",
      "name": "SMP",
      "type": "PAPER",
      "state": "running",
      "cpuPct": 18.4,
      "memoryMb": 2048,
      "memoryLimitMb": 4096,
      "uptimeSeconds": 11722,
      "players": { "online": 3, "max": 20 }
    }
  ]
}
```

### `GET /api/v1/servers/:id`

Một máy chủ, đối tượng giống nhau dưới một khóa `server`. Trả về `404` cho một id không xác định **và** cho một máy chủ mà mã thông báo không được giới hạn phạm vi (không có oracle tồn tại), và `400` cho một id sai định dạng.

## Các trường phản hồi

| Trường          | Ý nghĩa                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `total`         | Số lượng máy chủ hiển thị cho mã thông báo này (sau bộ lọc phạm vi của nó).                                 |
| `online`        | Số lượng trong số đó ở trạng thái: `running`.                                                               |
| `id`            | Id máy chủ ổn định (`srv_...`).                                                                             |
| `name`          | Tên hiển thị.                                                                                               |
| `type`          | Loại máy chủ itzg (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                              |
| `state`         | `running`, `starting`, `stopped`, hoặc `crashed`: tóm tắt ổn định về trạng thái nội bộ của bảng điều khiển. |
| `cpuPct`        | Phần trăm CPU gần đây, hoặc `null` khi máy chủ không chạy.                                                  |
| `memoryMb`      | Bộ nhớ cư trú tính bằng MB, hoặc `null`.                                                                    |
| `memoryLimitMb` | Giới hạn bộ nhớ container được cấu hình tính bằng MB, hoặc `null`.                                          |
| `uptimeSeconds` | Giây kể từ khi container khởi động, hoặc `null`.                                                            |
| `players`       | `{ online, max }`, hoặc `null` cho đến khi máy chủ báo cáo danh sách người chơi.                            |

## Ví dụ

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
