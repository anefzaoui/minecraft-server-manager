---
title: 'Kiến trúc'
description: 'Minecraft Server Manager là một ứng dụng Node.js, render trên máy chủ, chạy đơn tiến trình.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Minecraft Server Manager là một ứng dụng Node.js được render trên máy chủ, chạy một tiến trình duy nhất. Nó quản lý các máy chủ Minecraft chạy dưới dạng container Docker bằng cách sử dụng image [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), giao tiếp với Docker daemon thông qua API của nó (không bao giờ gọi lệnh `docker` qua shell).

## Cấu trúc Runtime

- **Express + Handlebars** render trang phía máy chủ. Không có SPA; JavaScript trong `public/js/` là sự tăng cường lũy tiến được viết thủ công. Một bước esbuild (`pnpm run build:js`) đóng gói và thu nhỏ nó vào `public/dist/js/`; ứng dụng phục vụ gói đó khi nó có sẵn và mã nguồn gốc nếu không, vì vậy việc chạy trong môi trường phát triển mà không cần build vẫn hoạt động.
- **`node:sqlite`** (tích hợp sẵn trong Node; bảng điều khiển yêu cầu Node ≥ 24) là cơ sở dữ liệu - đồng bộ, không có module gốc, chế độ WAL. Một trình chạy di chuyển phiên bản nhỏ áp dụng `src/db/migrations/*` khi khởi động. Các câu lệnh chuẩn bị được lưu trữ trong bộ nhớ đệm tại `src/db/index.js` với khóa là văn bản SQL.
- **`ws`** truyền tải các luồng console và thống kê trực tiếp. Cả hai đều được **môi giới**: một luồng upstream `docker logs --follow` (hoặc `docker stats`) cho mỗi máy chủ, được phân tách một lần và phân phối cho mọi tab được kết nối, thay vì một luồng upstream cho mỗi người xem. Trình môi giới console giữ một bộ đệm phát lại nhỏ cho các tab tham gia muộn và loại bỏ một thuê bao có socket bị tụt lại quá xa thay vì làm chậm luồng chia sẻ.
- **dockerode** là cách duy nhất ứng dụng giao tiếp với Docker. Điểm cuối được tự động phát hiện theo nền tảng (pipe đặt tên của Windows so với socket Unix).
- **Tất cả trạng thái bền vững nằm trong một thư mục** (`$DATA_DIR`, mặc định là `./data`). Sao chép thư mục đó sẽ di chuyển toàn bộ bảng điều khiển.

## Phân lớp

Các phụ thuộc chảy theo một hướng:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   phân tích & xác thực đầu vào, định dạng phản hồi
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   logic nghiệp vụ (các tính năng thực tế)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   cơ sở hạ tầng
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - một bộ định tuyến cho mỗi miền (`servers`, `players`, `worlds`, `crashes`, `blueprints`, `files`, …), được gắn trong `web/app.js`. Các bộ định tuyến xác thực bằng zod, gọi một dịch vụ và trả về JSON hoặc render một view. Logic nghiệp vụ không thuộc về đây. Hai bộ định tuyến được gắn trong **khu vực công cộng**, trước `requireAuth`: `routes/status.js` (các trang trạng thái HTML tùy chọn cho mỗi máy chủ) và `routes/apiV1.js` (`/api/v1`, một API JSON chỉ đọc được xác thực bằng token Bearer do quản trị viên cấp từ `services/apiTokens.js`, tắt trừ khi được bật trong Cài đặt; xem `docs/public-api.md`).
- **`services/`** - trái tim của ứng dụng. Mỗi dịch vụ sở hữu một miền và có thể phụ thuộc vào cơ sở hạ tầng và các dịch vụ khác.
- **`docker/`** - các trình bao bọc dockerode: `connect` (phát hiện điểm cuối + trạng thái daemon), `containers` (tạo/khởi động/dừng/tạo lại với bind mount, giới hạn bộ nhớ/CPU và nhãn), `logs`, `stats`, `images`, và một `watcher` biến các sự kiện Docker thành lịch sử + phát hiện sự cố.
- **`db/`** - trình bao bọc SQLite và trình chạy di chuyển.
- **`storage/`** - khởi tạo `./data`, **bộ bảo vệ đường dẫn** (`safeJoin`, xương sống bảo mật tệp), và bộ lập chỉ mục kích thước nền + thực thi hạn ngạch.

Các yếu tố xuyên suốt:

- **`config/`** - cấu hình môi trường cộng với **bộ danh mục trường**: nguồn chân lý duy nhất cho cài đặt máy chủ. Mọi biến môi trường itzg đều được liệt kê (nhãn, trợ giúp, loại, đơn vị, mặc định, xác thực, phần, cờ nguy hiểm). Trình hướng dẫn, biểu mẫu cài đặt và xác thực zod đều bắt nguồn từ đó, vì vậy việc hiển thị một cài đặt mới là một thay đổi dữ liệu, không phải là một đường ống UI mới.
- **`events/`** - `recordEvent()` là điểm vào duy nhất cho nhật ký lịch sử; các sự kiện vòng đời cũng ghi lại các đoạn trích nhật ký container vào `data/logs/<id>/events/`.
- **`ws/`** - WebSockets console + thống kê được xác thực (cookie phiên được xác minh khi nâng cấp, `Origin` được kiểm tra để chặn tấn công đánh cắp chéo trang), được môi giới cho mỗi máy chủ (xem "Cấu trúc Runtime").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` trả về một trình ghi nhật ký [Pino](https://getpino.io) cho mỗi module; cấp độ từ `LOG_LEVEL`, `makeFailureThrottle()` giữ một vòng lặp nền lỗi liên tục ở một dòng nhật ký cộng với một dòng "đã phục hồi". `src/utils/logSanitize.js` loại bỏ các khóa có định dạng thông tin đăng nhập và token webhook khỏi siêu dữ liệu có cấu trúc; `src/config/logLevel.js` là danh sách cho phép cấp độ chia sẻ (được giữ riêng để tránh chu kỳ yêu cầu với `config`). `src/instrument.js` là một điểm nối Sentry không hoạt động, được tải đầu tiên trong `src/server.js`. `src/web/middleware/requestLog.js` ghi một dòng nhật ký truy cập cho mỗi yêu cầu (bỏ qua `/healthz` và tài sản tĩnh). ESLint thực thi `no-console` dưới `src/**`, với `preflight.js`, `instrument.js`, và `config/index.js` được miễn trừ (chúng chạy trước khi trình ghi nhật ký tồn tại).
- **Giới hạn tốc độ** - `src/web/middleware/rateLimit.js` đặt `express-rate-limit` trước `/api` (`RATE_LIMIT_API_PER_MIN`, mặc định 1200) và các POST đăng nhập / 2FA / thiết lập (`RATE_LIMIT_AUTH_PER_15MIN`, mặc định 100); `0` vô hiệu hóa một bộ giới hạn. Nó khóa theo `req.ip`, vì vậy `TRUST_PROXY` quan trọng phía sau proxy. `/api/v1` có bộ giới hạn riêng cho mỗi token (`RATE_LIMIT_PUBLIC_API_PER_MIN`, mặc định 120), khóa theo một hàm băm của token Bearer với một phương án dự phòng IP. Một bộ đếm mềm riêng cho mỗi tài khoản trong `src/web/middleware/auth.js` xử lý khóa đăng nhập (theo IP và toàn cục cho tài khoản, suy giảm dần).

## Hành vi nghiệp vụ chính

- **Modpack luôn được ghim.** Image tự động nâng cấp các gói không được ghim sau mỗi lần khởi động lại, vì vậy bảng điều khiển phân giải "mới nhất" thành một ID phiên bản cụ thể tại thời điểm cài đặt và ghim nó. Nâng cấp là một luồng điều phối rõ ràng (`updates/`): xem trước → sao lưu trước khi cập nhật → dừng nhẹ nhàng → ghim lại → tạo lại → giám sát sức khỏe → hoàn tác bằng một cú nhấp chuột.
- **Lớp phủ mod tùy chỉnh** được quản lý bởi bảng điều khiển: các mod do người dùng thêm sẽ nằm trong thư viện được loại bỏ trùng lặp và được liên kết cứng vào máy chủ để chúng tồn tại sau các bản cập nhật gói. Vô hiệu hóa là nhận biết lớp.
- **Cổng** được phân bổ từ một lược đồ cơ sở (trò chơi từ `PORT_GAME_START` trở lên, RCON = trò chơi + `PORT_RCON_OFFSET`, Bedrock từ `PORT_BEDROCK_START`), được thăm dò tính khả dụng và được đặt trước trong DB.
- **Hạn ngạch đĩa** được bảng điều khiển thực thi vì Docker không thể giới hạn việc sử dụng bind-mount: bộ lập chỉ mục lưu trữ kích thước theo thư mục và các hoạt động tăng trưởng đĩa được giới hạn bởi chúng.
- **Bí mật** (mật khẩu RCON, khóa API, bí mật TOTP, URL webhook Discord) được mã hóa khi lưu trữ bằng AES-256-GCM bằng một khóa ngẫu nhiên chuyên dụng tại `$DATA_DIR/.secret-key` (chế độ `0600`, tự động tạo). Nó độc lập với `SESSION_SECRET`; một khóa bắt nguồn từ `SESSION_SECRET` được giữ làm phương án dự phòng chỉ giải mã cho các giá trị được ghi trước khi khóa chuyên dụng tồn tại, và `src/services/secretsMigration.js` mã hóa lại chúng dưới khóa chuyên dụng một lần khi khởi động. Một tệp `.secret-key` tồn tại nhưng không thể phân tích cú pháp là một lỗi khởi động nghiêm trọng (nó không bao giờ được tự động tạo lại một cách im lặng). Bản thiết kế loại bỏ tất cả bí mật khi xuất.

## Định dạng dữ liệu & truyền tải

- **`data/panel.db`** - cơ sở dữ liệu SQLite. Được chụp nhanh hàng ngày thông qua `VACUUM INTO` tới `data/backups/_panel/` (giữ lại 14 bản mới nhất); `PRAGMA integrity_check` chạy khi khởi động.
- **`data/.session-secret`** - bí mật ký cookie tự động tạo, được tạo khi chạy lần đầu nếu `SESSION_SECRET` không được đặt. Xóa nó sẽ xoay vòng bí mật (làm mất hiệu lực các phiên).
- **`data/.secret-key`** - khóa mã hóa khi lưu trữ chuyên dụng 32 byte (chế độ `0600`), tự động tạo khi chạy lần đầu. Độc lập với `SESSION_SECRET`; xóa nó sẽ làm cho mọi thông tin đăng nhập được lưu trữ không thể giải mã được, vì vậy nó thuộc về các bản sao lưu của bạn.
- **Bản thiết kế (`.mcserver.zip`)** - một tệp zip với `manifest.json` mô tả cấu hình, tài nguyên, tham chiếu gói được ghim, bản kê lớp phủ (URL nguồn + sha256), các tệp cấu hình đã chọn và tùy chọn một thế giới. Nhập lại tải xuống và xác minh hàm băm từng mod và gán lại cổng.
- **Container Docker** được tạo bởi bảng điều khiển được đặt tên và gắn nhãn để trình theo dõi có thể tìm thấy chúng; bảng điều khiển sở hữu toàn bộ vòng đời của chúng.

## Trình tự khởi động

1. `require('./instrument')` (điểm nối Sentry) trước bất kỳ điều gì khác, sau đó `require('./preflight')` để báo lỗi rõ ràng trên phiên bản Node không được hỗ trợ.
2. Tải cấu hình; đảm bảo/tạo `.session-secret` **và** `.secret-key`.
3. `ensureDataRoot()` - tạo bố cục `./data`, xóa `tmp/`.
4. Chạy di chuyển DB, sau đó `PRAGMA integrity_check` (ghi nhật ký lớn, chỉ vào `data/backups/_panel` khi lỗi).
5. Mã hóa lại bất kỳ bí mật nào dựa trên `SESSION_SECRET` cũ dưới `.secret-key` (`secretsMigration`).
6. Gieo các bản thiết kế khởi động (được bảo vệ).
7. Khởi động máy chủ HTTP + WS. Trên một cổng được phơi bày, in mã PIN `/setup` lần đầu tiên.
8. Cài đặt bộ bảo vệ runtime sau khi khởi động (bắt các lỗi không được bắt; `MSM_EXIT_ON_FATAL=1` làm cho nó thoát cứng cho các triển khai được giám sát).
9. Khởi động các dịch vụ nền: trình môi giới WS, bộ lập chỉ mục lưu trữ, trình theo dõi sự cố + kho, bộ lập lịch, cầu nối sự kiện Discord và **bộ hẹn giờ bảo trì hàng ngày** (dọn dẹp các hàng phân tích cũ + chụp nhanh `panel.db`).
10. Khởi tạo Docker **trong nền**. Giao diện người dùng hoàn toàn có thể sử dụng được trong khi daemon bị lỗi; các tính năng Docker sẽ sáng lên khi nó có thể truy cập được. Sau khi kết nối, `refreshStatuses({ boot })` sẽ đối chiếu các trạng thái được lưu trong bộ nhớ đệm, phát ra sự kiện `offline-after-restart` một lần cho một máy chủ đã hoạt động trước khi bảng điều khiển khởi động lại và sẽ không được khôi phục, và vòng lặp khởi động sẽ bắt đầu các máy chủ `auto_start` cộng với khôi phục các máy chủ `auto_restart` được tìm thấy bị lỗi trong thời gian ngừng hoạt động (tôn trọng thời gian chờ lỗi lặp).

> Thứ tự instrument-trước-preflight là một sự đánh đổi có chủ ý: nó cho phép một dây nối Sentry trong tương lai vá runtime trước, với chi phí là một thông báo thân thiện hơn một chút trên một phiên bản Node thực sự cũ.

## Quy trình xây dựng

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild → `public/dist/js/`, ESM với phân tách mã). `postinstall` chạy **chỉ CSS**. `public/css/app.css` và `public/dist/` là các tạo phẩm build được gitignore; giai đoạn build Dockerfile chạy toàn bộ `pnpm run build` và sao chép `public/` vào image runtime. Tài sản tĩnh được phục vụ với `immutable`/cache dài cho các tệp có dấu vân tay, cache ngắn cho CSS/JS và `no-cache` cho HTML và `/api`.
