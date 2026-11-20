---
title: 'Kiến trúc'
description: 'Minecraft Server Manager là một ứng dụng Node.js, render trên máy chủ, chạy đơn tiến trình.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Minecraft Server Manager là một ứng dụng Node.js render phía máy chủ, đơn tiến trình. Nó quản lý
các máy chủ Minecraft chạy dưới dạng container Docker bằng cách sử dụng image
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), giao tiếp với Docker
daemon thông qua API của nó (không bao giờ gọi lệnh `docker` qua shell).

## Cấu trúc Runtime

- **Express + Handlebars** render trang phía máy chủ. Không có SPA; JavaScript trong `public/js/`
  là cải tiến lũy tiến được viết thủ công. Một bước esbuild (`pnpm run build:js`) đóng gói và
  thu nhỏ nó vào `public/dist/js/`; ứng dụng phục vụ gói đó khi nó có sẵn và mã nguồn gốc nếu không,
  vì vậy việc chạy ở chế độ phát triển mà không cần build vẫn hoạt động.
- **`node:sqlite`** (tích hợp sẵn trong Node; bảng điều khiển yêu cầu Node ≥ 24) là cơ sở dữ liệu -
  đồng bộ, không có module gốc, chế độ WAL. Một trình chạy di chuyển phiên bản nhỏ áp dụng `src/db/migrations/*`
  khi khởi động. Các câu lệnh chuẩn bị được lưu trong bộ nhớ đệm tại `src/db/index.js` với khóa là văn bản SQL.
- **`ws`** truyền tải các luồng console và thống kê trực tiếp. Cả hai đều được **môi giới**: một luồng
  upstream `docker logs --follow` (hoặc `docker stats`) cho mỗi máy chủ, được phân tách một lần và
  phân phối cho mọi tab đã kết nối, thay vì một luồng upstream cho mỗi người xem. Bộ môi giới console
  giữ một bộ đệm phát lại nhỏ cho các tab tham gia muộn và loại bỏ một thuê bao có socket bị tụt hậu
  quá xa thay vì làm chậm luồng chia sẻ.
- **dockerode** là cách duy nhất ứng dụng giao tiếp với Docker. Điểm cuối được tự động phát hiện
  theo nền tảng (pipe đặt tên trên Windows so với socket Unix).
- **Tất cả trạng thái bền vững nằm trong một thư mục** (`$DATA_DIR`, mặc định là `./data`). Sao chép
  thư mục đó sẽ di chuyển toàn bộ bảng điều khiển.

## Phân lớp

Các phụ thuộc chảy theo một hướng:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   phân tích & xác thực đầu vào, định hình phản hồi
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

- **`web/routes/`** - một bộ định tuyến cho mỗi miền (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` gắn các bộ định tuyến cấp cao nhất (`api.js`, API JSON phiên cũng chứa các bộ định tuyến máy chủ cốt lõi và gắn các bộ định tuyến miền cho từng máy chủ; `index.js`, các trang; `auth`, `account`,
  `tasks`, …). Các bộ định tuyến xác thực bằng zod, gọi một dịch vụ và trả về JSON
  hoặc render một view. Logic nghiệp vụ không thuộc về đây. Hai bộ định tuyến được gắn trong **khu vực công cộng**,
  trước `requireAuth`: `routes/status.js` (các trang trạng thái cho từng máy chủ tùy chọn) và
  `routes/apiV1.js` (`/api/v1`, một API JSON chỉ đọc được xác thực bằng token Bearer do quản trị viên cấp từ
  `services/apiTokens.js`, tắt trừ khi được bật trong Cài đặt; xem `docs/public-api.md`).
- **`services/`** - trái tim của ứng dụng. Mỗi dịch vụ sở hữu một miền và có thể phụ thuộc vào
  cơ sở hạ tầng và các dịch vụ khác.
- **`docker/`** - các trình bao bọc dockerode: `connect` (phát hiện điểm cuối + sức khỏe daemon), `containers`
  (tạo/khởi động/dừng/tạo lại với bind mount, giới hạn bộ nhớ/CPU và nhãn), `logs`, `stats`,
  `images`, `networks` (khám phá mạng host), `hostPath` (gốc lại các đường dẫn bind dưới
  `DATA_DIR_HOST`), và một `watcher` biến các sự kiện Docker thành lịch sử + phát hiện sự cố.
- **`db/`** - trình bao bọc SQLite và trình chạy di chuyển.
- **`storage/`** - khởi tạo `./data`, **bộ bảo vệ đường dẫn** (`safeJoin`, xương sống an toàn tệp),
  và bộ lập chỉ mục kích thước nền + thực thi hạn ngạch.

Các vấn đề xuyên suốt:

- **`config/`** - cấu hình môi trường cộng với **bộ danh mục trường**: nguồn chân lý duy nhất cho
  cài đặt máy chủ. Mọi biến môi trường itzg đều được liệt kê (nhãn, trợ giúp, loại, đơn vị, mặc định,
  xác thực, phần, cờ nguy hiểm). Trình hướng dẫn, biểu mẫu cài đặt và xác thực zod đều được lấy từ đó,
  vì vậy việc hiển thị một cài đặt mới là thay đổi dữ liệu, không phải là hệ thống ống nước UI mới.
- **`events/`** - `recordEvent()` là điểm vào duy nhất cho nhật ký lịch sử; các sự kiện vòng đời cũng
  ghi lại các đoạn trích nhật ký container vào `data/logs/<id>/events/`.
- **`ws/`** - WebSockets console + thống kê được xác thực (cookie phiên được xác minh khi nâng cấp, `Origin`
  được kiểm tra để chặn tấn công chéo trang), được môi giới cho mỗi máy chủ (xem "Cấu trúc Runtime").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` trả về một trình ghi nhật ký
  [Pino](https://getpino.io) cho mỗi module; cấp độ từ `LOG_LEVEL`, `makeFailureThrottle()` giữ một vòng lặp nền
  bị lỗi liên tục chỉ với một dòng nhật ký cộng với một dòng "đã phục hồi".
  `src/utils/logSanitize.js` loại bỏ các khóa có hình dạng thông tin đăng nhập và token webhook khỏi siêu dữ liệu có cấu trúc;
  `src/config/logLevel.js` là danh sách cho phép cấp độ được chia sẻ (được giữ riêng biệt để tránh chu kỳ yêu cầu với `config`).
  `src/instrument.js` là một điểm nối Sentry không hoạt động, được tải đầu tiên trong `src/server.js`.
  `src/web/middleware/requestLog.js` ghi một dòng nhật ký truy cập cho mỗi yêu cầu (bỏ qua `/healthz` và tài sản tĩnh).
  ESLint thực thi `no-console` dưới `src/**`, với `preflight.js`, `instrument.js`, và `config/index.js` được miễn trừ (chúng chạy trước khi trình ghi nhật ký tồn tại).
- **Giới hạn tốc độ** - `src/web/middleware/rateLimit.js` đặt `express-rate-limit` trước `/api`
  (`RATE_LIMIT_API_PER_MIN`, mặc định 1200) và các POST đăng nhập / 2FA / thiết lập
  (`RATE_LIMIT_AUTH_PER_15MIN`, mặc định 100); `0` vô hiệu hóa bộ giới hạn. Nó khóa theo `req.ip`, vì vậy
  `TRUST_PROXY` quan trọng phía sau proxy. `/api/v1` có bộ giới hạn riêng: giới hạn trên mỗi IP khách hàng
  (gấp năm lần ngân sách trên mỗi token) chạy trước khi token được xác minh, sau đó là ngân sách trên mỗi token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, mặc định 120) khóa theo ID token đã xác minh. Một bộ đếm mềm riêng trên mỗi tài khoản trong
  `src/web/middleware/auth.js` xử lý khóa đăng nhập (trên mỗi IP và toàn cục cho tài khoản, suy giảm dần).
- **Ủy quyền**: hai lớp. Vai trò toàn cục (`requireAuth` → `requireRole` / `requireWrite` trong
  `src/web/middleware/auth.js`) kiểm soát các hành động trên toàn bảng điều khiển và là mặc định trên mọi máy chủ.
  Quyền trên mỗi máy chủ (`src/services/permissions.js`, chín khả năng được lưu trữ dưới dạng danh sách JSON cho mỗi
  `(user, server)` trong `user_server_permissions`) tinh chỉnh mặc định đó cho một máy chủ; mọi
  tuyến đường `/api/servers/:id`, gắn bộ định tuyến con, trang, WebSocket và danh sách toàn bộ hạm đội đều đi qua
  `src/web/middleware/serverAccess.js` (`serverScope`, gắn trên tiền tố `/servers/:id` của cả API và bộ định tuyến trang,
  ẩn máy chủ mà không có `view` dưới dạng 404; `requireCap(cap)` đặt tên cho khả năng mà một tuyến đường yêu cầu).
  Các thao tác ghi đặt tên máy chủ của chúng trong phần thân (lịch trình, trích xuất và cài đặt thế giới, xuất bản vẽ)
  được mở cho người xem bởi `requireWrite` chỉ cho máy chủ đó, và mỗi tuyến đường như vậy tự kiểm tra khả năng.
  `test/permissions-routes.test.js` duyệt qua các ngăn xếp bộ định tuyến trực tiếp và thất bại nếu một tuyến đường ghi,
  gắn kết hoặc trang có phạm vi máy chủ không có cổng bảo vệ.

## Hành vi miền chính

- **Modpack luôn được ghim.** Image tự động nâng cấp các gói không được ghim trên mỗi lần khởi động lại, vì vậy
  bảng điều khiển phân giải "latest" thành một ID phiên bản cụ thể tại thời điểm cài đặt và ghim nó. Nâng cấp là một
  luồng điều phối rõ ràng (`updates/`): xem trước → sao lưu trước khi cập nhật → dừng nhẹ nhàng → ghim lại →
  tạo lại → giám sát sức khỏe → hoàn nguyên bằng một cú nhấp chuột.
- **Lớp phủ mod tùy chỉnh** được quản lý bởi bảng điều khiển: các mod do người dùng thêm vào thư viện được loại bỏ trùng lặp
  và được liên kết cứng vào máy chủ để chúng tồn tại sau các bản cập nhật gói. Vô hiệu hóa là nhận biết lớp. Bởi vì
  thư viện giữ lại mọi bản dựng đã tải xuống, một bản cập nhật ghi lại bản dựng mà nó đã thay thế
  (`server_content.previous_*`) và có thể được hoàn nguyên chỉ từ các tệp cục bộ. Vô hiệu hóa mod của gói
  sẽ ghi biến môi trường loại trừ của gói thay thế; `packs.applyPack` mang theo biến đó và phần còn lại của
  cấu hình gói (`PACK_TUNING_KEYS`) qua một thay đổi phiên bản của cùng một gói, và loại bỏ nó khi gói thay đổi.
- **Nâng cấp phiên bản Minecraft phải được "kiếm".** `services/compat.js` quét các mod của máy chủ -
  được phân giải từ các hàng đã cài đặt trên bảng điều khiển, sau đó là manifest gói CurseForge, sau đó theo
  hash nội dung so với Modrinth/CurseForge - và xây dựng một ma trận hỗ trợ (loader, phiên bản Minecraft) cho mỗi dự án
  từ `latestFilesIndexes` của CurseForge (200 dự án mỗi yêu cầu) và danh sách phiên bản trên mỗi dự án của Modrinth
  (một yêu cầu cho mỗi dự án, đây là điều giữ cho loader và phiên bản được ghép nối). Trình kiểm tra cập nhật chỉ cung cấp phiên bản mới nhất mà MỌI mod hỗ trợ, và không cung cấp gì cả khi câu trả lời không thể xác định: không quét, quét cho phiên bản hoặc loader khác, một lần quét chưa bao giờ hoàn thành, hoặc một jar mà cả hai registry đều không nhận ra. Quét chỉ thực hiện thủ công, và tiến trình cũng như kết quả một phần của chúng nằm trong `version_compat` (không phải trong `services/tasks.js` trong bộ nhớ), vì vậy việc làm mới hoặc khởi động lại bảng điều khiển sẽ tiếp tục thay vì bị kẹt trên vòng quay; `reconcileScans()` đánh dấu các lần quét bị bỏ rơi do tắt máy khi khởi động lại.
- **Phiên bản mod loader là một ghim, giống như mọi thứ khác.** `services/loaderPin.js` đọc bản dựng đã cài đặt từ manifest cài đặt của chính image (`.forge-manifest.json` và các tệp tương tự) và ghi ghim: biến itzg của loader trên một máy chủ thuần túy (`FORGE_VERSION`, …), hoặc
  `CF_MOD_LOADER_VERSION` trên gói CurseForge Forge hoặc Fabric, ghi đè phiên bản mà gói khai báo. Trình cài đặt CurseForge của image bỏ qua ghi đè đó cho NeoForge, và các gói Modrinth và FTB không có, vì vậy loader của chúng tuân theo gói. `packs.applyPack` xóa mọi biến `CF_` khi cập nhật hoặc hoàn nguyên gói, điều này loại bỏ một ghi đè cùng với phần còn lại. Một bản dựng được gõ sẽ được kiểm tra trước với danh sách đầy đủ của registry (`services/loaderVersions.js`; của Forge đến từ siêu dữ liệu maven của nó, bỏ qua các số; một lần bỏ lỡ sẽ được kiểm tra lại một lần so với chính registry), sau đó thay đổi sẽ là sao lưu → ghim (ghi đè env như nó vốn có sau sao lưu) → xây dựng lại.
- **Cổng** được phân bổ từ một lược đồ cơ sở (trò chơi từ `PORT_GAME_START` trở lên, RCON = trò chơi +
  `PORT_RCON_OFFSET`, Bedrock từ `PORT_BEDROCK_START`), được thăm dò tính khả dụng và được đặt trước trong
  Cơ sở dữ liệu. "Đã chiếm" là hợp của tất cả các yêu cầu của mọi máy chủ (cổng trực tiếp, cộng với một cặp đang chờ xử lý bên dưới),
  mọi cổng host mà bất kỳ container Docker nào xuất bản (`containers.publishedHostPorts`: các ràng buộc trực tiếp của container đang chạy cộng với các ràng buộc được cấu hình của mỗi container đã dừng, vì một thăm dò ràng buộc của hệ điều hành từ bên trong container của bảng điều khiển chỉ thấy không gian tên mạng của container đó), và thăm dò của hệ điều hành. Phần Docker được lưu trong bộ nhớ đệm trong 3 giây và giới hạn: một danh sách không phản hồi trong 2,5 giây chỉ loại bỏ phần Docker, và một lần kiểm tra chậm chỉ tốn cổng của container đó. Việc tạo máy chủ và `servers.changeGamePort` chọn cổng thông qua một chuỗi tuần tự hóa chỉ bao gồm việc chọn và yêu cầu của nó (ghi hàng cho việc tạo, đặt trước trong bộ nhớ cho thay đổi cổng);
  bộ chọn cổng của BlueMap và các ghi đè cổng bổ sung không có trong đó và không
  tham khảo Docker. Thay đổi cổng trên máy chủ hiện có (`servers.changeGamePort`, dưới khóa op của máy chủ)
  được áp dụng ngay lập tức, vì Docker sửa các ràng buộc cổng khi tạo container: cặp mới (RCON luôn là trò chơi + `PORT_RCON_OFFSET`)
  được kiểm tra và đặt trước trong bộ nhớ (`ports.reserve`, cả cặp cũ và mới, được tôn trọng bởi mọi lựa chọn khác) dưới khóa cổng. Nó bị từ chối (409 `PENDING_CHANGES`) trong khi các cài đặt khác đang chờ xây dựng lại, vì vậy nó chỉ xây dựng lại một container đã chạy, trên một cổng mới; và một máy chủ đang chạy chỉ được thay đổi khi yêu cầu nói `restart: true` (nếu không thì 409 `NEEDS_CONFIRM`). Image được kéo và tên container tùy chỉnh được kiểm tra trước khi bất kỳ thứ gì được chạm vào. Máy chủ đang chạy bị dừng; sau đó cặp mới được ghi với `pending_recreate = 1` (vì vậy một sự cố bảng điều khiển từ đó sẽ để lại một "xây dựng lại đang chờ xử lý" trung thực), container bị xóa, xây dựng lại trên cặp mới và khởi động. Nếu bất kỳ bước nào sau khi dừng thất bại, `putBackOnOldPort` sẽ ghi lại cặp cũ, xây dựng lại (và khởi động lại, nếu nó đang chạy) trên đó và ghi lại bước nào đã thất bại; lịch sử và cảnh báo cho biết liệu ngay cả điều đó cũng thất bại, điều này khiến máy chủ bị dừng cho đến khi ai đó khởi động nó. Khả năng `settings` là đủ, bao gồm cả máy chủ đang chạy. Người dùng không phải quản trị viên chỉ có thể chọn từ `PORT_GAME_START` trở lên.
  (Các cột `port_*_pending` từ di chuyển 029 thuộc về một thiết kế trước đó, chưa phát hành và không được sử dụng; 031 xóa chúng.) Một va chạm khóa trả về 409 với `code: 'BUSY'`, mà những người gọi thử lại bên dưới kiểm tra thay vì nội dung. Tự động khởi động lại khi gặp sự cố
  (`watcher.restartAfterCrash`) và một bản sao lưu hoặc khởi động theo lịch trình (`scheduler.runTaskWithRetry`)
  tìm thấy máy chủ bận với hành động khác sẽ thử lại sau mỗi 20 giây / 60 giây trong tối đa 30 phút, và cập nhật hoặc hoàn nguyên gói sẽ thử lại các bước bị khóa theo cách tương tự (`opLock.retryWhileBusy`);
  một lần khởi động lại do sự cố hoặc một lần khởi động theo lịch trình đang chờ xử lý sẽ từ bỏ một khi ai đó đã dừng, giết hoặc khởi động máy chủ kể từ đó (`events.lifecycleActionSince`), và lần khởi động lại do sự cố cũng vậy khi tự động khởi động lại bị tắt hoặc máy chủ đã biến mất. Các lần khởi động lại, dừng và lệnh theo lịch trình không được thử lại, và một lịch trình có lần chạy cuối cùng vẫn đang chờ xử lý sẽ bỏ qua lần kích hoạt tiếp theo của nó.
- **Hạn ngạch đĩa** được thực thi bởi bảng điều khiển vì Docker không thể giới hạn việc sử dụng bind-mount: bộ lập chỉ mục lưu trữ kích thước theo thư mục và các hoạt động tăng dung lượng đĩa được giới hạn dựa trên chúng.
- **Bí mật** (mật khẩu RCON, khóa API, bí mật TOTP, URL webhook Discord) được mã hóa khi lưu trữ bằng AES-256-GCM bằng một khóa ngẫu nhiên chuyên dụng tại `$DATA_DIR/.secret-key` (chế độ `0600`, tự động tạo). Nó độc lập với `SESSION_SECRET`; một khóa có nguồn gốc từ `SESSION_SECRET` được giữ làm phương án dự phòng chỉ giải mã cho các giá trị được ghi trước khi khóa chuyên dụng tồn tại, và
  `src/services/secretsMigration.js` mã hóa lại chúng dưới khóa chuyên dụng một lần khi khởi động.
  Một tệp `.secret-key` tồn tại nhưng không thể phân tích cú pháp là một lỗi khởi động nghiêm trọng (nó không bao giờ được tạo lại một cách im lặng).
  Blueprints loại bỏ tất cả các bí mật khi xuất.
- **`server.properties` thuộc sở hữu của bảng điều khiển nhưng bị che bởi biến môi trường.** Image itzg
  khẳng định lại mọi thuộc tính được hỗ trợ bởi biến môi trường trên mỗi lần khởi động (`OVERRIDE_SERVER_PROPERTIES` mặc định là true), vì vậy một giá trị mà bảng điều khiển chỉnh sửa trực tiếp - PvP/độ khó của Điều khiển Thế giới, công tắc whitelist, trình chỉnh sửa Tệp - sẽ bị hoàn nguyên một cách im lặng vào lần khởi động tiếp theo trừ khi biến môi trường tương ứng bị xóa và container được tạo lại. Mọi thao tác ghi thuộc tính trực tiếp đều đi qua `writeServerProperties()` (toàn bộ tệp) hoặc `setServerProperty()` (một khóa) trong `src/services/servers.js`, cái nào ghi lại tệp một cách nguyên tử, bỏ chọn biến môi trường phía sau mỗi khóa đã thay đổi (thông qua thuộc tính `prop:` trên các trường danh mục, được kiểm tra trong các bài kiểm tra so với định nghĩa thuộc tính của chính image) và đánh dấu
  `pending_recreate`. Độ khó được ghi vào tệp cũng như gửi qua RCON, vì một máy chủ chuyên dụng áp dụng lại thuộc tính `difficulty` trên mỗi lần khởi động. Bản thân Minecraft ghi lại `server.properties` từ các giá trị thời điểm khởi động của nó khi `whitelist on/off`, điều này sẽ hoàn tác các chỉnh sửa được thực hiện khi máy chủ đang chạy, vì vậy công tắc whitelist đang chạy sẽ chụp nhanh tệp trước và ghi lại nó với chỉ `white-list` được thay đổi. Biến môi trường
  vẫn hoàn toàn có thể cấu hình khi tạo (trình hướng dẫn hiển thị chúng và chúng áp dụng một lần); chúng chỉ
  bỏ ghim lần đầu tiên bảng điều khiển chỉnh sửa thuộc tính cơ bản. MOTD có cùng hợp đồng: một chỉnh sửa tệp `motd` trực tiếp sẽ bỏ chọn nó, vì vậy lần ghi cuối cùng sẽ thắng.

## Định dạng dữ liệu & truyền tải

- **`data/panel.db`** - cơ sở dữ liệu SQLite. Được chụp nhanh hàng ngày thông qua `VACUUM INTO` tới
  `data/backups/_panel/` (giữ lại 14 bản mới nhất); `PRAGMA integrity_check` chạy khi khởi động.
- **`data/.session-secret`** - bí mật ký cookie được tạo tự động, được tạo khi chạy lần đầu nếu
  `SESSION_SECRET` chưa được đặt. Xóa nó sẽ xoay bí mật (điều này làm mất hiệu lực các phiên).
- **`data/.secret-key`** - khóa mã hóa khi lưu trữ 32 byte chuyên dụng (chế độ `0600`), tự động tạo
  khi chạy lần đầu. Độc lập với `SESSION_SECRET`; xóa nó sẽ làm cho mọi thông tin xác thực được lưu trữ không thể giải mã được, vì vậy nó thuộc về các bản sao lưu của bạn.
- **Blueprints (`.mcserver.zip`)** - một tệp zip với `manifest.json` mô tả cấu hình, tài nguyên, tham chiếu gói được ghim, manifest lớp phủ (URL nguồn + sha256), các tệp cấu hình đã chọn và tùy chọn một thế giới. Nhập lại tải xuống và xác minh hash từng mod và gán cổng mới.
- **Container Docker** được tạo bởi bảng điều khiển được đặt tên và gắn nhãn để trình xem có thể tìm thấy chúng;
  bảng điều khiển sở hữu toàn bộ vòng đời của chúng.

## Trình tự khởi động

1. `require('./instrument')` (điểm nối Sentry) trước bất kỳ thứ gì khác, sau đó là `require('./preflight')`
   để báo lỗi rõ ràng trên phiên bản Node không được hỗ trợ.
2. Tải cấu hình; đảm bảo/tạo `.session-secret` **và** `.secret-key`.
3. `ensureDataRoot()` - tạo bố cục `./data`, xóa `tmp/`.
4. Chạy di chuyển DB, sau đó `PRAGMA integrity_check` (ghi nhật ký lớn, chỉ vào `data/backups/_panel`
   khi thất bại).
5. Mã hóa lại bất kỳ bí mật cũ nào được khóa bằng `SESSION_SECRET` dưới `.secret-key` (`secretsMigration`).
6. Nhập khóa API từ môi trường một lần (`apiKeys.importFromEnvOnce()`), ghim bất kỳ máy chủ nào vẫn còn
   chứa bộ chọn mod không được ghim (`packPins.pinUnpinnedServers()`), đánh dấu các lần quét tương thích phiên bản
   bị bỏ dở bởi quy trình trước đó là bị gián đoạn
   (`compat.reconcileScans()`), sau đó gieo các bản vẽ khởi động (được bảo vệ).
7. Khởi động máy chủ HTTP + WS. Trên một cổng bind được phơi bày, in mã PIN `/setup` lần đầu tiên.
8. Cài đặt bộ bảo vệ runtime sau khi khởi động (bắt các lỗi không được bắt; `MSM_EXIT_ON_FATAL=1` làm cho nó thoát cứng cho các triển khai được giám sát).
9. Khởi động các dịch vụ nền: bộ môi giới WS, bộ lập chỉ mục lưu trữ, trình xem sự cố + kiểm kê, bộ lập lịch,
   cầu nối sự kiện Discord, trình xem liên hệ chatbot và **bộ hẹn giờ bảo trì hàng ngày** (xóa các hàng phân tích cũ,
   bản ghi trò chuyện, lịch sử sự kiện (365 ngày) và các hàng bộ nhớ đệm API, sau đó chụp nhanh
   `panel.db`).
10. Khởi tạo Docker **trong nền**. Giao diện người dùng hoàn toàn có thể sử dụng được ngay cả khi daemon bị lỗi;
    các tính năng Docker sẽ sáng lên khi nó trở nên có thể truy cập được. Sau khi kết nối, `refreshStatuses({ boot })`
    sẽ đối chiếu các trạng thái được lưu trong bộ nhớ đệm, phát ra sự kiện `offline-after-restart` một lần cho máy chủ
    đã hoạt động trước khi bảng điều khiển khởi động lại và sẽ không được khôi phục, và vòng lặp khởi động sẽ bắt đầu
    máy chủ `auto_start` cộng với khôi phục các máy chủ `auto_restart` bị gặp sự cố trong thời gian ngừng hoạt động
    (tôn trọng thời gian chờ đợi vòng lặp sự cố).

> Thứ tự instrument-trước-preflight là một sự đánh đổi có chủ ý: nó cho phép một dây nối Sentry trong tương lai
> vá runtime trước, với chi phí là một thông báo thân thiện hơn một chút trên Node thực sự cũ.

## Đường ống xây dựng

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM với phân tách mã). `postinstall` chỉ chạy **CSS**. `public/css/app.css`
và `public/dist/` là các tạo phẩm build được gitignore; giai đoạn build của Dockerfile chạy toàn bộ
`pnpm run build` và sao chép `public/` vào image runtime. Tài sản tĩnh được phục vụ
`immutable`/cache dài cho các tệp có dấu vân tay, cache ngắn cho CSS/JS và `no-cache` cho HTML và
`/api`.
