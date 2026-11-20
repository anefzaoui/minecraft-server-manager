---
title: 'Chatbot Minecraft cho từng máy chủ'
description: 'Bảng điều khiển cung cấp một chatbot được quản trị viên cấu hình cho mỗi máy chủ Minecraft được quản lý, được thiết lập trên tab Cài đặt → Chatbot của máy chủ.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Bảng điều khiển cung cấp một chatbot được cấu hình bởi quản trị viên cho mỗi máy chủ Minecraft được quản lý, được thiết lập trên tab **Cài đặt → Chatbot** của máy chủ. Nó kết nối với một điểm cuối OpenAI-compatible chat-completions, bao gồm cả Ollama trên một máy chủ LAN khác. Mỗi máy chủ có điểm cuối, mô hình, tên lệnh gọi, vai trò, chính sách bản ghi, tin nhắn tiếp cận và chính sách quyền lực riêng. Lệnh gọi mặc định là `@wizard`, và vai trò mặc định thể hiện một pháp sư cổ xưa, vui tươi trong thế giới trò chơi; cả hai đều có thể chỉnh sửa.

![Cài đặt Chatbot](/docs/images/integrations-chatbot.png)

## Trải nghiệm người chơi

- Bất kỳ người chơi nào cũng có thể sử dụng `@wizard <tin nhắn>` (hoặc tên lệnh gọi đã cấu hình) để trò chuyện và nhận trợ giúp công thức vanilla xác định, có nhận biết phiên bản Minecraft.
- Lời chào khi tham gia và một lần kiểm tra phiên chơi có thể cấu hình nhắc nhở người chơi rằng chatbot có sẵn. `@wizard chat` mở một cửa sổ trò chuyện ngắn tùy chọn tham gia; `@wizard bye` đóng nó.
- **Người dùng cơ bản** có thể sử dụng các quyền tự thân/thế giới đã bật. **Người điều khiển quyền** có thể thực hiện các hành động được xác thực riêng biệt ảnh hưởng đến người chơi trực tuyến khác. Người chơi không thuộc nhóm nào sẽ chỉ trò chuyện.
- Việc tự tặng vật phẩm của người dùng cơ bản sử dụng danh sách cho phép vật phẩm. Người điều khiển có thể tặng người chơi khác bất kỳ vật phẩm vanilla hoặc modded hợp lệ nào có tên không gian tên, tùy thuộc vào giới hạn số lượng và các biện pháp bảo vệ quyền lực khác.

![Bản ghi Chatbot](/docs/images/chatbot-transcripts.png)

## Thiết kế và bảo mật

Cấu hình và bản ghi chỉ dành cho quản trị viên. Mô hình không bao giờ nhận RCON thô hoặc thực thi lệnh tùy ý. Một tin nhắn chỉ hiển thị một công cụ cố định duy nhất khớp với ý định rõ ràng của nó; mã máy chủ xác thực ủy quyền, đối số, cờ, số lượng, thời gian chờ và tên người chơi trực tuyến chính xác trước khi thực thi một hoạt động dịch vụ hiện có. Các bộ chọn Minecraft bị từ chối, các hành động giữa người chơi không thể nhắm mục tiêu người gọi, quyền lực bắt đầu ở chế độ chạy thử và mọi quyền lực được thử đều được kiểm toán. Các mô hình gọi công cụ không được hỗ trợ sẽ quay về chế độ trò chuyện.

Phản hồi được giới hạn cho trò chuyện Minecraft. Các công thức vanilla đã biết đến từ dữ liệu công thức được phiên bản đóng gói và hiển thị dưới dạng các hàng 2x2/3x3 ổn định; LLM không được tin cậy để tạo bố cục công thức. Các công thức không xác định hoặc modded sẽ hướng người chơi đến JEI/REI thay vì bịa đặt câu trả lời.

## Các tệp triển khai chính

- `src/services/wizard.js`: cấu hình cho mỗi máy chủ, yêu cầu OpenAI-compatible, xử lý trò chuyện, tiếp cận, lưu giữ bản ghi và giới hạn phản hồi.
- `src/services/wizardPowers.js`: kiểm tra vai trò, lược đồ công cụ theo ý định, xác thực, thực thi, thời gian chờ và kiểm toán quyền lực.
- `src/services/wizardRecipes.js`: tra cứu công thức theo phiên bản xác định và định dạng lưới. Dữ liệu công thức và vật phẩm đến từ gói [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) đóng gói. (Một bản nháp trước đó của tài liệu này đã chỉ vào thư mục `src/data/recipes/` chưa bao giờ được cam kết; không có thư mục nào như vậy, và dữ liệu nằm trong gói. Xem "Dấu chân phụ thuộc".)
- `src/analytics/ingest.js`: chuyển tiếp các lượt tham gia, rời đi và trò chuyện của người chơi đã phân tích cú pháp đến chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, và `views/partials/server/integrations.hbs` (thông qua `chatbot.hbs`): API quản trị và tab Cài đặt → Chatbot cho mỗi máy chủ.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js`, và `019_wizard_power_controllers.js`: lược đồ bền vững.
- `test/wizard.test.js`: kiểm tra ủy quyền, giới hạn công cụ, lưu giữ, tiếp cận và hành vi trò chuyện.

Các tên tuyến/mô-đun/bảng `wizard` nội bộ được giữ nguyên để tương thích nâng cấp và API; "chatbot" là thuật ngữ sản phẩm hướng tới người dùng. Tương tự, trường `power_testers_json` được lưu trữ ánh xạ tới nhóm **Người dùng cơ bản** trên giao diện người dùng.

## Dấu chân phụ thuộc (`minecraft-data`)

Trợ giúp công thức sử dụng gói `minecraft-data`. Nó chiếm dung lượng lớn trên đĩa (khoảng 429 MB khi cài đặt) và nó được vận chuyển bên trong ảnh sản xuất vì nó là một phụ thuộc thời gian chạy, không phải phụ thuộc phát triển. Chúng tôi giữ nó lại có chủ đích để trợ giúp công thức hoạt động ngoại tuyến cho mọi phiên bản Minecraft mà không cần gọi mạng.

Ghi chú cho bất kỳ ai xem điều này tiếp theo (con người hoặc AI), để kích thước không gây bất ngờ:

- Hiện tại chỉ sử dụng dữ liệu Java (`pc`). `wizardRecipes.js` đọc `minecraftData.versions.pc` và các bảng `recipes`, `items`, và `blocks` theo từng phiên bản. Các tệp mà nó thực sự chạm tới cộng lại khoảng 15 MB trên mọi phiên bản pc.
- Khoảng 330 MB của gói là `data/bedrock`, và không có gì ở đây đọc nó. Chúng tôi cố tình để nó ở đó. Nếu bảng điều khiển sau này hỗ trợ Minecraft Bedrock, dữ liệu công thức và vật phẩm Bedrock đã có sẵn, vì vậy tính năng công thức có thể phát triển để bao gồm Bedrock mà không cần thêm phụ thuộc mới. Bắt đầu từ `minecraftData.versions.bedrock` và làm theo cùng một hình dạng như đường dẫn pc.
- Nếu kích thước cần giảm trước khi hỗ trợ Bedrock được triển khai, đã có một mẫu cho việc đó trong kho lưu trữ này. `src/services/itemRegistry.js` lấy các tệp `minecraft-data` từ CDN jsDelivr khi cần và lưu trữ chúng trong `api_cache`. Hoặc cách tiếp cận đó, hoặc một tập hợp con nhỏ được chọn thủ công `src/data/recipes/` bao gồm một vài phiên bản phổ biến, sẽ giảm đáng kể kích thước ảnh.

## Lưu trữ cục bộ và kiểm tra thủ công

Tất cả cài đặt và bản ghi được lưu giữ đều nằm trong cơ sở dữ liệu SQLite của bảng điều khiển tại `/data/panel.db` bên trong vùng chứa bảng điều khiển. Với mount Compose tiêu chuẩn, đường dẫn máy chủ là `${DATA_DIR_HOST}/panel.db` (ví dụ: `/opt/msm/data/panel.db`). Các bảng liên quan là `wizard_configs`, `wizard_transcripts`, và `wizard_outreach`; kiểm toán quyền lực là các hàng trong bảng `events` với loại `wizard-power`. Khóa API LLM tùy chọn được mã hóa AES-256-GCM bằng khóa tại chỗ của bảng điều khiển, `.secret-key` trong thư mục dữ liệu (tách biệt với `SESSION_SECRET`).

Sao lưu cơ sở dữ liệu và dừng bảng điều khiển trước khi chỉnh sửa SQLite trực tiếp để WAL của nó được xử lý an toàn. Sử dụng giao diện người dùng/API quản trị được ưu tiên vì nó áp dụng xác thực và mã hóa. Giữ các tệp `panel.db`, `panel.db-wal`, và `panel.db-shm` cùng nhau khi sao chép cơ sở dữ liệu đang hoạt động.
