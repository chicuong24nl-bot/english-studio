# HRIS Study Studio — setup

## Tính năng

- 7 chương HRIS được dựng từ file HTML mẫu; 6 bài đọc tiếng Anh không liên quan đã được bỏ qua.
- Cổng sinh viên đăng nhập bằng mã riêng Admin cấp.
- Cổng Teacher/Admin đăng nhập bằng Supabase Auth; database riêng xác định quyền Admin.
- Study, Practice, flashcard, câu hỏi tự chấm kèm giải thích và ôn câu sai.
- Tiến độ học được đồng bộ lên Supabase.
- Thông tin MSSV, tên sinh viên và email Admin không được nhúng vào source public. Admin tạo hồ sơ sinh viên sau khi đăng nhập; database kiểm soát quyền truy cập.

## A. Chạy website trên máy

1. Cài Node.js LTS.
2. Mở PowerShell tại thư mục dự án.
3. Chạy `npm run dev`.
4. Mở `http://localhost:4173`.
5. Dừng server bằng `Ctrl+C`.

Không cần chạy `npm install`.

## B. Cấu hình Supabase

1. Mở Supabase project của bạn.
2. Vào **SQL Editor → New query**, dán toàn bộ `supabase/schema.sql` và nhấn **Run**.
3. Vào **Authentication → Providers → Email** và tắt **Allow new users to sign up**.
4. Vào **Authentication → Users → Add user** để tạo tài khoản Admin; đặt mật khẩu riêng trong Supabase.
5. Trong danh sách Users, sao chép **UUID** của tài khoản vừa tạo.
6. Chạy lệnh này trong SQL Editor, thay giá trị mẫu bằng UUID đó:

   ```sql
   insert into public.hris_admins (user_id)
   values ('PASTE-ADMIN-USER-UUID-HERE');
   ```

   Bảng quyền Admin bị khóa với trình duyệt. Chỉ SQL Editor/service role mới có thể cấp quyền.
7. Kiểm tra `supabase-config.js` có Project URL và anon/public key. Chỉ dùng anon/public key ở website; tuyệt đối không đưa `service_role` key vào mã nguồn.

## C. Tạo roster và cấp mã

1. Mở website, chọn **Teacher / Admin** và đăng nhập bằng tài khoản đã cấp quyền ở bước B.
2. Vào **Quản lý lớp học → Quản lý sinh viên**.
3. Nhập MSSV và họ tên của từng sinh viên rồi bấm **Thêm vào lớp**. Thực hiện cho 5 sinh viên.
4. Bấm **Cấp mã** bên cạnh từng hồ sơ. Mã chỉ hiện một lần; gửi riêng mã đó cho đúng sinh viên.
5. Nếu mã bị lộ, bấm **Đổi mã** để thu hồi mã cũ và tạo mã mới.
6. Sinh viên chọn **Cổng sinh viên**, nhập mã để đăng nhập.

Database lưu hash của mã truy cập, không lưu mã gốc. Phiên đăng nhập và tiến độ được gắn với hồ sơ sinh viên.

## D. Deploy public trên Vercel

1. Import GitHub repository trong Vercel bằng **Add New → Project**.
2. Chọn Framework Preset **Other**.
3. Repo đã có `vercel.json` để dùng Framework Preset **Other**, bỏ Build Command và phục vụ thư mục gốc (Output Directory `.`). Nếu project có Root Directory tùy chỉnh, đặt lại thành `.` trong Project Settings.
4. Deploy; không cần build step. Vercel phục vụ file tĩnh, còn Auth/database/RPC chạy trên Supabase.
5. Mở domain Vercel và hoàn tất các bước trong phần B và C.

## Bảo mật và giới hạn

- Tắt public sign-up; chỉ cấp quyền Admin bằng UUID trong bảng `hris_admins`.
- RLS ngăn người chưa xác thực xem roster. RPC kiểm tra quyền Admin trước khi tạo hồ sơ hoặc cấp mã.
- Mã sinh viên là thông tin đăng nhập cá nhân; gửi riêng và đổi ngay khi bị lộ.
- Bài tập là dạng tự ôn nên đáp án được trả ngay sau khi chọn. Không dùng như bài thi cần giữ bí mật đáp án.
- File HRIS gốc chứa nội dung học tập trong HTML. SQL chỉ lưu tài khoản lớp, session và tiến độ.
