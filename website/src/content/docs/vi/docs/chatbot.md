---
title: 'Chatbot Minecraft cho từng máy chủ'
description: 'Phiên bản fork này bổ sung một chatbot được cấu hình bởi quản trị viên cho mỗi máy chủ Minecraft được quản lý.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Bản fork này bổ sung một chatbot do quản trị viên cấu hình cho mỗi máy chủ Minecraft được quản lý. Nó kết nối với một
điểm cuối OpenAI-compatible chat-completions, bao gồm cả Ollama trên một máy chủ LAN khác. Mỗi máy chủ có
điểm cuối, mô hình, tên lệnh gọi, vai trò, chính sách ghi lại cuộc trò chuyện, tin nhắn tiếp cận và chính sách quyền hạn riêng. Lệnh gọi mặc định là `@wizard`, và vai trò mặc định mô tả một pháp sư cổ xưa,
vui tươi trong thế giới game; cả hai đều có thể chỉnh sửa.

![Cài đặt Chatbot](/docs/images/integrations-chatbot.png)

## Trải nghiệm người chơi

- Bất kỳ người chơi nào cũng có thể sử dụng `@wizard <tin nhắn>` (hoặc tên lệnh gọi đã cấu hình) để trò chuyện và
  nhận trợ giúp về công thức chế tạo vanilla, có tính đến phiên bản Minecraft và mang tính xác định.
- Lời chào khi tham gia và một lần nhắc nhở người chơi về sự có sẵn của chatbot sẽ được cấu hình. `@wizard chat` mở một cửa sổ trò chuyện ngắn để đồng ý tham gia; `@wizard bye` đóng nó lại.
- **Người dùng cơ bản** có thể sử dụng các quyền hạn tự thân/thế giới đã bật. **Người kiểm soát quyền hạn** có thể sử dụng các hành động được xác thực riêng biệt ảnh hưởng đến người chơi trực tuyến khác. Người chơi không thuộc nhóm nào chỉ có thể trò chuyện.
- Tặng quà tự thân của người dùng cơ bản sử dụng danh sách cho phép vật phẩm. Người kiểm soát có thể tặng người chơi khác bất kỳ vật phẩm vanilla hoặc modded hợp lệ nào có tên miền, tùy thuộc vào giới hạn số lượng và các biện pháp bảo vệ quyền hạn khác.

![Bản ghi Chatbot](/docs/images/chatbot-transcripts.png)

## Thiết kế và bảo mật

Cấu hình và bản ghi chỉ dành cho quản trị viên. Mô hình không bao giờ nhận được RCON thô hoặc thực thi lệnh tùy ý. Một tin nhắn chỉ tiết lộ công cụ cố định duy nhất khớp với ý định rõ ràng của nó;
mã máy chủ xác thực quyền truy cập, đối số, cờ, số lượng, thời gian chờ và tên người chơi trực tuyến chính xác trước khi thực thi một hoạt động dịch vụ hiện có. Bộ chọn Minecraft bị từ chối, hành động giữa người chơi không thể nhắm mục tiêu người gọi, quyền hạn bắt đầu ở chế độ chạy thử và mọi quyền hạn được thử đều được kiểm toán. Các mô hình gọi công cụ không được hỗ trợ sẽ quay về chế độ trò chuyện.

Phản hồi bị giới hạn cho trò chuyện Minecraft. Các công thức vanilla đã biết đến từ dữ liệu công thức phiên bản được đóng gói và hiển thị dưới dạng hàng 2x2/3x3 ổn định; LLM không được tin cậy để tạo bố cục công thức. Các công thức không xác định hoặc modded sẽ hướng người chơi đến JEI/REI thay vì bịa đặt câu trả lời.

## Các tệp triển khai chính

- `src/services/wizard.js`: cấu hình cho mỗi máy chủ, yêu cầu tương thích OpenAI, xử lý trò chuyện,
  tiếp cận, lưu giữ bản ghi và giới hạn phản hồi.
- `src/services/wizardPowers.js`: kiểm tra vai trò, lược đồ công cụ theo ý định, xác thực, thực thi,
  thời gian chờ và kiểm toán quyền hạn.
- `src/services/wizardRecipes.js`: tra cứu công thức theo phiên bản xác định và định dạng lưới. Dữ liệu công thức và vật phẩm đến từ gói [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) được đóng gói. (Một bản nháp trước đó của tài liệu này đã chỉ vào một thư mục `src/data/recipes/` chưa bao giờ được cam kết; không có thư mục như vậy, và dữ liệu nằm trong gói. Xem "Dấu chân phụ thuộc".)
- `src/analytics/ingest.js`: chuyển tiếp các lượt tham gia, rời đi và trò chuyện của người chơi đã phân tích cú pháp tới chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, và
  `views/partials/server/integrations.hbs`: API quản trị và Giao diện người dùng Tích hợp cho mỗi máy chủ.
- `src/db/migrations/011_wizard_chat.js` đến `019_wizard_power_controllers.js`: lược đồ bền vững.
- `test/wizard.test.js`: các bài kiểm tra về ủy quyền, giới hạn công cụ, lưu giữ, tiếp cận và hành vi trò chuyện.

Các tên tuyến/mô-đun/bảng `wizard` nội bộ được giữ nguyên để tương thích nâng cấp và API;
“chatbot” là thuật ngữ sản phẩm hướng tới người dùng. Tương tự, trường `power_testers_json` được lưu trữ ánh xạ tới nhóm **Người dùng cơ bản** trên giao diện người dùng.

## Dấu chân phụ thuộc (`minecraft-data`)

Trợ giúp công thức sử dụng gói `minecraft-data`. Nó chiếm dung lượng lớn trên đĩa (khoảng 429 MB khi cài đặt), và nó
được vận chuyển bên trong ảnh sản xuất vì nó là một phụ thuộc thời gian chạy, không phải phụ thuộc phát triển. Chúng tôi giữ nó
có chủ đích để trợ giúp công thức hoạt động ngoại tuyến cho mọi phiên bản Minecraft mà không cần gọi mạng.

Ghi chú cho bất kỳ ai xem điều này tiếp theo (con người hoặc AI), để kích thước không gây bất ngờ:

- Hiện tại chỉ sử dụng dữ liệu Java (`pc`). `wizardRecipes.js` đọc `minecraftData.versions.pc`
  và các bảng `recipes`, `items`, và `blocks` theo từng phiên bản. Các tệp mà nó thực sự chạm tới cộng lại
  khoảng 15 MB trên mọi phiên bản pc.
- Khoảng 330 MB của gói là `data/bedrock`, và không có gì ở đây đọc nó. Chúng tôi để nó ở đó có chủ đích. Nếu bảng điều khiển sau này thêm hỗ trợ Bedrock Minecraft, dữ liệu công thức và vật phẩm Bedrock đã có sẵn ở đây, vì vậy tính năng công thức có thể phát triển để bao phủ máy chủ Bedrock mà không cần thêm phụ thuộc mới. Bắt đầu từ `minecraftData.versions.bedrock` và đi theo cùng cấu trúc như đường dẫn pc.
- Nếu kích thước cần giảm trước khi hỗ trợ Bedrock ra mắt, đã có một mẫu cho việc đó trong kho lưu trữ này. `src/services/itemRegistry.js` lấy các tệp `minecraft-data` từ CDN jsDelivr khi nó cần chúng và lưu vào bộ nhớ đệm trong `api_cache`. Hoặc cách tiếp cận đó, hoặc một tập hợp con nhỏ được chọn thủ công `src/data/recipes/` bao gồm một vài phiên bản phổ biến, sẽ giảm đáng kể kích thước ảnh.

## Lưu trữ cục bộ và kiểm tra thủ công

Tất cả cài đặt và bản ghi được lưu giữ đều nằm trong cơ sở dữ liệu SQLite của bảng điều khiển tại `/data/panel.db` bên trong vùng chứa bảng điều khiển. Với mount Compose tiêu chuẩn, đường dẫn máy chủ là
`${DATA_DIR_HOST}/panel.db` (ví dụ: `/opt/msm/data/panel.db`). Các bảng liên quan là
`wizard_configs`, `wizard_transcripts`, và `wizard_outreach`; kiểm toán quyền hạn là các hàng trong bảng `events` với loại `wizard-power`. Khóa API LLM tùy chọn được mã hóa AES-256-GCM bằng `SESSION_SECRET` của bảng điều khiển, thường được lưu trữ dưới dạng `${DATA_DIR_HOST}/.session-secret`.

Sao lưu cơ sở dữ liệu và dừng bảng điều khiển trước khi chỉnh sửa SQLite trực tiếp để WAL của nó được xử lý an toàn.
Sử dụng giao diện người dùng/API quản trị được ưu tiên vì nó áp dụng xác thực và mã hóa. Giữ các tệp
`panel.db`, `panel.db-wal`, và `panel.db-shm` cùng nhau khi sao chép cơ sở dữ liệu trực tiếp.
