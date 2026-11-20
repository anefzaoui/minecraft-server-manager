---
title: 'Cập nhật'
description: 'Theo dõi và áp dụng các bản cập nhật cho phiên bản Minecraft, modpack, mod và plugin trên mọi máy chủ, với chính sách cho từng máy chủ.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Quay lại mục lục tài liệu](/docs/)

Trang **Cập nhật** theo dõi những gì đã lỗi thời trên toàn bộ hệ thống của bạn ở một nơi:

- Phiên bản **Modpack** ([modpacks](/docs/modpacks/)) so với Modrinth / CurseForge / chỉ mục phát hành GTNH.
- **Nội dung tùy chỉnh** bạn tự thêm (mods, datapacks, resource packs, plugins), mỗi loại so với nguồn của nó: Modrinth, CurseForge, Hangar, SpigotMC (Spiget), hoặc GitHub Releases. Tra cứu GitHub sử dụng xác thực lại ETag, vì vậy các kiểm tra hàng ngày hầu như không chạm vào giới hạn tốc độ của nó.
- **Docker image** bị lỗi thời: ID image của mỗi container máy chủ so với một tag được kéo mới nhất (loại bỏ trùng lặp trên các máy chủ có cùng tag), được cung cấp dưới dạng nâng cấp chỉ cần xây dựng lại.
- **Ghim phiên bản độc lập**: đối với máy chủ không có gói được quản lý, một ghim `mc_version` rõ ràng so với manifest của Mojang, và một biến môi trường loader-build rõ ràng (`PAPER_BUILD`, `FORGE_VERSION`, v.v.) so với registry của loader. Các bản dựng Paper đến từ **API Fill v3** hiện tại của PaperMC (điểm cuối v2 cũ đã ngừng nhận các phiên bản Minecraft mới). Trên máy chủ có mods, phiên bản Minecraft mới hơn chỉ được cung cấp khi [kiểm tra phiên bản](#minecraft-version-compatibility) cho thấy mọi mod đã cài đặt đều có bản dựng cho nó. Máy chủ Forge được ghim sẽ được cung cấp bản dựng được đề xuất của Forge, không bao giờ là bản dựng cũ hơn bản dựng được ghim và máy chủ được ghim vào một bản phát hành sẽ không bao giờ được cung cấp bản phát hành thử nghiệm (bản đã ở bản beta có thể được cung cấp bản beta mới hơn hoặc bản phát hành). Áp dụng bản dựng loader sẽ sao lưu trước khi cập nhật. Di chuyển máy chủ Forge hoặc NeoForge sang phiên bản Minecraft mới sẽ xóa số bản dựng loader đã ghim của nó, vì một bản dựng được tạo cho một phiên bản Minecraft; một từ khóa như `latest` sẽ được giữ lại, vì nó tự theo dõi phiên bản. Để tự chọn một bản dựng cụ thể, xem [thay đổi phiên bản mod loader](#changing-the-mod-loader-version).

![Cập nhật](/docs/images/updates.png)

## Cách hoạt động

Bảng điều khiển kiểm tra các phiên bản đã ghim của mỗi máy chủ với nguồn upstream và liệt kê bất kỳ bản phát hành mới nào. Một số đếm khớp cũng xuất hiện trên ô "Cập nhật có sẵn" của [bảng điều khiển](/docs/dashboard/).

Các kiểm tra chạy hàng ngày theo [lịch trình](/docs/schedules/) mặc định và theo yêu cầu với **Kiểm tra tất cả ngay bây giờ**. **Bỏ qua** trên một hàng sẽ ngừng cung cấp phiên bản cụ thể đó; một phiên bản mới hơn sẽ được cung cấp lại. **Chính sách** cập nhật là trên mỗi máy chủ: bảng điều khiển để mọi thứ thủ công (mặc định, cũng giữ máy chủ khỏi trang này), chỉ thông báo cho bạn, hoặc tự áp dụng các bản cập nhật gói ([chính sách cập nhật](/docs/modpacks/#update-policy)).

## Khả năng tương thích phiên bản Minecraft

Phiên bản Minecraft mới hơn không phải là bản nâng cấp nếu các mod của bạn không thể đi cùng. Mỗi máy chủ có tab **Phiên bản** riêng (trong Mods) để trả lời câu hỏi đó:

- Phiên bản máy chủ đang chạy hiện tại và **phiên bản cao nhất mà mọi mod đã cài đặt đều có bản dựng**.
- Một hàng có thể gập lại cho mỗi phiên bản Minecraft trong tương lai, với số lượng mod đã sẵn sàng và số lượng chưa có gì được xuất bản. Mở một hàng để xem mod nào sẽ bị bỏ lại và mod nào ổn.

![Khả năng tương thích phiên bản](/docs/images/server-versions.png)

Nhấn **Kiểm tra phiên bản tương lai** để chạy. Không có gì tự quét: một lần kiểm tra đọc mọi jar trong thư mục mods của máy chủ và hỏi Modrinth và CurseForge về từng cái một, vì vậy nó chỉ xảy ra khi bạn yêu cầu. Tiến trình và kết quả từng phần được ghi lại trong khi chạy, vì vậy việc đóng trang hoặc làm mới sẽ không mất gì, và một lần kiểm tra bị cắt ngắn do khởi động lại bảng điều khiển sẽ cho biết và đề nghị chạy lại. Mọi thứ mà một lần kiểm tra bị gián đoạn đã làm việc ra đều được giữ lại, vì vậy việc chạy lại không làm lại công việc đó.

Một báo cáo chỉ mô tả máy chủ mà nó được tạo ra. Thay đổi phiên bản Minecraft, loader, hoặc chính các mod (thêm một, xóa một, cập nhật một) và báo cáo sẽ được đánh dấu là lỗi thời và ngừng sử dụng, cho đến khi bạn chạy lại kiểm tra.

Các mod được xác định từ danh sách tệp của modpack, nếu có, và nếu không thì bằng nội dung tệp, theo cách tương tự như trình khởi chạy nhận dạng một jar. Hai loại mod không thể trả lời và không có loại nào được đoán:

- **Không thể xác định**: một jar được xây dựng thủ công hoặc một bản dựng riêng tư mà không có registry nào nhận ra.
- **Không thể kiểm tra**: một mod từ GitHub Releases, Hangar hoặc SpigotMC, hoặc một mod có dự án đã bị gỡ bỏ. Chúng không xuất bản danh sách các phiên bản Minecraft mà mỗi bản dựng dành cho.

Trong khi một trong hai loại này được cài đặt, bảng điều khiển sẽ không cung cấp bản cập nhật phiên bản Minecraft một cú nhấp chuột nào cả, vì nó không thể nói một cách trung thực những gì sẽ bị hỏng. Áp dụng phiên bản cao hơn những gì mod hỗ trợ sẽ bị từ chối và nêu tên các mod chặn nó.

Các mod bạn đã **vô hiệu hóa** không tham gia: máy chủ không tải chúng, vì vậy việc tắt một mod là một cách thực sự để vượt qua một trình chặn. Bật hoặc tắt một mod sẽ đánh dấu báo cáo để kiểm tra lại.

Điều này bao gồm các máy chủ chạy mod: Fabric, Forge, NeoForge và Quilt. Máy chủ plugin kiểu Paper giữ nguyên hành vi phát hành mới nhất và không có tab Phiên bản, vì hai trong số các registry mà plugin đến từ không xuất bản bất cứ thứ gì mà một lần kiểm tra có thể đọc được.

![Một phiên bản được mở, hiển thị mod nào sẽ bị bỏ lại](/docs/images/server-versions-expanded.png)

Mở một phiên bản sẽ liệt kê các mod không có bản dựng cho nó trước (những mod quyết định câu trả lời) và giữ những mod đã sẵn sàng sau một cú nhấp chuột. Các gói lớn tải từng trang mod một, vì vậy máy chủ 300 mod mở nhanh như máy chủ năm mod.

## Thay đổi phiên bản mod loader

Tab **Phiên bản** cũng có một thẻ **Phiên bản Loader**. Nó hiển thị bản dựng Forge, NeoForge, Fabric hoặc Quilt nào máy chủ đã cài đặt và, nơi có thể thay đổi, một bộ chọn để chuyển sang bản dựng khác.

- **Máy chủ Forge, NeoForge, Fabric hoặc Quilt** có thể chạy bất kỳ bản dựng nào đã xuất bản. Bộ chọn liệt kê các bản dựng gần đây cho phiên bản Minecraft của máy chủ, với các bản dựng được đề xuất và mới nhất của Forge được gắn nhãn. **Bản dựng khác…** nhận bất kỳ bản dựng cũ hơn nào theo số của nó, và **Mặc định** quay lại để máy chủ tự chọn.
- **Modpack Forge, Fabric CurseForge** cài đặt phiên bản loader mà manifest của nó khai báo, vì vậy cách thông thường để thay đổi nó là cập nhật gói. Khi gói tự liệt kê phiên bản sai (một mod bên trong nó yêu cầu Forge mới hơn gói cài đặt), thẻ có thể ghi đè nó, và **Phiên bản của Modpack** xóa ghi đè một lần nữa. Cập nhật gói cũng xóa nó, vì phiên bản mới khai báo loader của riêng nó. Nếu phiên bản mới vẫn liệt kê phiên bản sai, hãy đặt lại ghi đè.
- **Modpack NeoForge CurseForge, hoặc Modpack Modrinth,** hiển thị loader của nó nhưng không thể ghi đè: image máy chủ chỉ áp dụng ghi đè cho các gói Forge và Fabric. Loader của nó theo phiên bản gói, vì vậy hãy cập nhật gói thay thế. Loader của gói FTB cũng không thể thay đổi ở đây. Thẻ của nó thường không xuất hiện, vì trình cài đặt của FTB tự giữ các bản ghi mà bảng điều khiển không đọc được.

Bảng điều khiển kiểm tra xem bản dựng có tồn tại trước khi hỏi bạn bất cứ điều gì. Bản dựng Forge hoặc NeoForge được tạo cho một phiên bản Minecraft, vì vậy trên máy chủ theo dõi bản phát hành mới nhất, việc ghim một bản dựng cũng giữ máy chủ ở phiên bản Minecraft hiện tại (xác nhận cho biết điều đó). Chọn **Mặc định** sau đó sẽ xóa ghim nhưng giữ nguyên phiên bản Minecraft đó. Máy chủ theo dõi bản phát hành mới nhất cũng có thể chuyển sang image Java khác khi nó được xây dựng lại, cái mà phiên bản đó cần. Máy chủ như vậy chưa bao giờ khởi động sẽ được yêu cầu khởi động một lần trước, để bảng điều khiển biết phiên bản đó. Forge bỏ qua số bản dựng (không có 47.4.14 giữa 47.4.13 và 47.4.15), vì vậy một mod "yêu cầu 47.4.14 trở lên" sẽ được đáp ứng bởi bản dựng tiếp theo, và việc từ chối sẽ nêu tên nó. Thay đổi sẽ sao lưu trước khi cập nhật, sau đó xây dựng lại máy chủ. Bản dựng mới sẽ được cài đặt vào lần khởi động máy chủ tiếp theo, và thẻ sẽ cho biết điều đó cho đến khi đó.

## Hoàn tác cập nhật mod

Mọi bản dựng mà một mod được cập nhật từ đó đều nằm trong thư viện chia sẻ, vì vậy một bản cập nhật làm hỏng thứ gì đó có thể hoàn tác được. Hàng của mod trên tab **Mods** có nút **Hoàn tác** để khôi phục bản dựng trước đó. Không có tải xuống, vì vậy nó hoạt động ngay cả khi dự án đã bị gỡ bỏ khỏi registry của nó. Bản dựng mà bạn đã hoàn tác sẽ ngừng được cung cấp cho đến khi một bản dựng mới hơn xuất hiện.

![Hoàn tác mod về bản dựng mà nó đã được cập nhật từ đó](/docs/images/mods-revert.png)

## Áp dụng cập nhật

Cập nhật không bao giờ là im lặng. Khi bạn chọn nâng cấp một gói (hoặc [chuyển nó sang phiên bản khác](/docs/modpacks/#changing-the-pack-version), bao gồm cả các phiên bản cũ hơn), bảng điều khiển:

1. Thực hiện **sao lưu trước khi cập nhật** (vì vậy có thể hoàn tác; mặc định giữ lại 10 bản sao lưu trước khi cập nhật cuối cùng cho mỗi máy chủ, xem [lưu giữ](/docs/backups/#retention)).
2. Gắn lại phiên bản mới chính xác.
3. Xây dựng lại máy chủ, giải quyết lại runtime Java nếu cần.
4. Giám sát lần khởi động đầu tiên, với ngân sách thời gian cho mỗi nền tảng.

Nếu nó không khởi động thành công, bạn sẽ quay lại bản sao lưu trước khi cập nhật. Máy chủ theo dõi bản phát hành ổn định sẽ không bao giờ được cung cấp bản beta, và liên kết nhật ký thay đổi sẽ trỏ đến sự khác biệt thực tế trên mỗi phiên bản mà nguồn cung cấp. Một bản cập nhật thất bại cũng sẽ kích hoạt cảnh báo Discord [cảnh báo](/docs/integrations/) nếu tích hợp được cấu hình.
