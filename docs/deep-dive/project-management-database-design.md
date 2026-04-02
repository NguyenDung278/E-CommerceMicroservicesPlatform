# Thiết Kế Cơ Sở Dữ Liệu Cho Hệ Thống Quản Lý Dự Án

## 1. Mục tiêu và phạm vi

Tài liệu này mô tả một thiết kế cơ sở dữ liệu quan hệ cho hệ thống quản lý dự án dùng trong nhóm nhỏ đến trung bình. Mục tiêu là hỗ trợ các chức năng cốt lõi: tạo dự án, thêm thành viên, giao nhiệm vụ, theo dõi trạng thái công việc, ghi nhận lịch sử thay đổi và đo tiến độ thực hiện.

Phạm vi của thiết kế tập trung vào phần vận hành công việc hằng ngày, không đi sâu vào các mô-đun mở rộng như chấm công, quản lý ngân sách, lưu trữ tệp lớn, chat thời gian thực hay báo cáo BI phức tạp. Cách tiếp cận này giúp mô hình dữ liệu gọn, dễ hiểu với người mới bắt đầu nhưng vẫn đủ chắc chắn để nhà phát triển trung cấp triển khai thực tế.

Trong tài liệu, ví dụ SQL được viết theo cú pháp PostgreSQL vì đây là hệ quản trị phổ biến, hỗ trợ ràng buộc dữ liệu tốt, chỉ mục mạnh và dễ mở rộng. Nếu cần, cùng một mô hình vẫn có thể chuyển sang MySQL hoặc SQL Server với vài điều chỉnh nhỏ ở kiểu dữ liệu và cú pháp chỉ mục.

## 2. Mô hình ER tổng thể

Hệ thống gồm bảy bảng chính:

- `users`: lưu người dùng của hệ thống.
- `projects`: lưu thông tin dự án.
- `project_members`: bảng trung gian thể hiện quan hệ nhiều-nhiều giữa người dùng và dự án.
- `tasks`: lưu nhiệm vụ thuộc từng dự án.
- `task_dependencies`: lưu quan hệ phụ thuộc giữa các nhiệm vụ.
- `task_status_history`: lưu lịch sử đổi trạng thái để audit và báo cáo.
- `task_comments`: lưu trao đổi ngắn gắn với nhiệm vụ.

Mô tả sơ đồ ER bằng văn bản để có thể vẽ lại:

1. Một `user` có thể sở hữu nhiều `project` qua cột `projects.owner_user_id`.
2. Một `project` có nhiều `user`, và một `user` có thể tham gia nhiều `project`; quan hệ này đi qua bảng `project_members`.
3. Một `project` có nhiều `task`.
4. Một `task` có thể có một `parent_task`, từ đó tạo cây công việc cha-con.
5. Một `task` có thể được giao cho một `user` qua `assignee_user_id`, và được tạo bởi một `user` qua `reporter_user_id`.
6. Một `task` có thể phụ thuộc nhiều `task` khác, và một `task` cũng có thể là điều kiện của nhiều `task`; quan hệ này đi qua `task_dependencies`.
7. Một `task` có nhiều bản ghi trong `task_status_history`.
8. Một `task` có nhiều `task_comments`, và mỗi bình luận do một `user` tạo.

## 3. Danh sách bảng và trường dữ liệu

### 3.1. Bảng `users`

| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `user_id` | `BIGSERIAL` | PK | Mã người dùng |
| `full_name` | `VARCHAR(150)` | `NOT NULL` | Họ tên |
| `email` | `VARCHAR(255)` | `NOT NULL`, `UNIQUE` | Email đăng nhập |
| `password_hash` | `VARCHAR(255)` | `NULL` | Mật khẩu băm, có thể rỗng nếu dùng SSO |
| `job_title` | `VARCHAR(100)` | `NULL` | Chức danh |
| `is_active` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Cờ kích hoạt tài khoản |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Thời điểm cập nhật |

### 3.2. Bảng `projects`

| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `project_id` | `BIGSERIAL` | PK | Mã dự án |
| `project_code` | `VARCHAR(30)` | `NOT NULL`, `UNIQUE` | Mã ngắn như PRJ-001 |
| `project_name` | `VARCHAR(200)` | `NOT NULL` | Tên dự án |
| `description` | `TEXT` | `NULL` | Mô tả tổng quan |
| `owner_user_id` | `BIGINT` | FK -> `users.user_id` | Người chịu trách nhiệm chính |
| `start_date` | `DATE` | `NULL` | Ngày bắt đầu |
| `due_date` | `DATE` | `NULL` | Hạn hoàn thành |
| `status` | `VARCHAR(20)` | `NOT NULL` | `planned`, `active`, `on_hold`, `completed`, `cancelled` |
| `priority` | `SMALLINT` | `NOT NULL`, `DEFAULT 3` | Mức ưu tiên 1 đến 5 |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Thời điểm cập nhật |

### 3.3. Bảng `project_members`

| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `project_id` | `BIGINT` | PK, FK -> `projects.project_id` | Dự án |
| `user_id` | `BIGINT` | PK, FK -> `users.user_id` | Thành viên |
| `role_in_project` | `VARCHAR(30)` | `NOT NULL` | `owner`, `manager`, `member`, `viewer` |
| `joined_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Ngày tham gia |

Khóa chính ghép (`project_id`, `user_id`) giúp ngăn một người bị thêm trùng trong cùng dự án.

### 3.4. Bảng `tasks`

| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `task_id` | `BIGSERIAL` | PK | Mã nhiệm vụ |
| `project_id` | `BIGINT` | FK -> `projects.project_id` | Dự án chứa nhiệm vụ |
| `parent_task_id` | `BIGINT` | FK -> `tasks.task_id`, `NULL` | Nhiệm vụ cha |
| `title` | `VARCHAR(200)` | `NOT NULL` | Tiêu đề nhiệm vụ |
| `description` | `TEXT` | `NULL` | Nội dung chi tiết |
| `status` | `VARCHAR(20)` | `NOT NULL` | `todo`, `in_progress`, `blocked`, `done` |
| `priority` | `SMALLINT` | `NOT NULL`, `DEFAULT 3` | Mức ưu tiên 1 đến 5 |
| `assignee_user_id` | `BIGINT` | FK -> `users.user_id`, `NULL` | Người được giao |
| `reporter_user_id` | `BIGINT` | FK -> `users.user_id` | Người tạo nhiệm vụ |
| `estimated_hours` | `NUMERIC(6,2)` | `NULL` | Số giờ ước tính |
| `actual_hours` | `NUMERIC(6,2)` | `NULL` | Số giờ thực tế |
| `start_date` | `DATE` | `NULL` | Ngày bắt đầu |
| `due_date` | `DATE` | `NULL` | Hạn xử lý |
| `completed_at` | `TIMESTAMPTZ` | `NULL` | Thời điểm hoàn tất |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Thời điểm cập nhật |

### 3.5. Bảng `task_dependencies`

| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `task_id` | `BIGINT` | PK, FK -> `tasks.task_id` | Nhiệm vụ hiện tại |
| `depends_on_task_id` | `BIGINT` | PK, FK -> `tasks.task_id` | Nhiệm vụ phải hoàn thành trước |
| `dependency_type` | `VARCHAR(20)` | `NOT NULL`, `DEFAULT 'finish_to_start'` | Kiểu phụ thuộc |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Thời điểm tạo liên kết |

### 3.6. Bảng `task_status_history`

| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `history_id` | `BIGSERIAL` | PK | Mã lịch sử |
| `task_id` | `BIGINT` | FK -> `tasks.task_id` | Nhiệm vụ thay đổi |
| `old_status` | `VARCHAR(20)` | `NULL` | Trạng thái cũ |
| `new_status` | `VARCHAR(20)` | `NOT NULL` | Trạng thái mới |
| `changed_by` | `BIGINT` | FK -> `users.user_id` | Người thao tác |
| `changed_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Thời điểm đổi trạng thái |
| `note` | `TEXT` | `NULL` | Ghi chú ngắn |

### 3.7. Bảng `task_comments`

| Trường | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `comment_id` | `BIGSERIAL` | PK | Mã bình luận |
| `task_id` | `BIGINT` | FK -> `tasks.task_id` | Nhiệm vụ được bình luận |
| `user_id` | `BIGINT` | FK -> `users.user_id` | Người viết bình luận |
| `content` | `TEXT` | `NOT NULL` | Nội dung |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Thời điểm tạo |

## 4. Vì sao chọn thiết kế này

Thiết kế trên bám khá sát chuẩn hoá mức 3NF. Thông tin người dùng chỉ nằm ở `users`, thông tin dự án chỉ nằm ở `projects`, và quan hệ thành viên được tách riêng sang `project_members`. Nhờ vậy, khi một người đổi email hoặc chức danh, hệ thống chỉ cập nhật ở một chỗ, tránh lặp dữ liệu và tránh lỗi không đồng nhất.

Với nhiệm vụ, thay vì nhồi lịch sử trạng thái hoặc bình luận vào một cột JSON lớn trong `tasks`, tài liệu tách thành `task_status_history` và `task_comments`. Cách làm này dễ truy vấn hơn, rõ trách nhiệm dữ liệu hơn và hợp với báo cáo theo thời gian. Bảng `task_dependencies` cũng được tách riêng để biểu diễn quan hệ nhiều-nhiều giữa các nhiệm vụ, thay vì lưu một chuỗi ID trong một cột văn bản, vốn khó kiểm tra và khó đánh chỉ mục.

Về hiệu suất, các truy vấn thường gặp nhất của hệ thống quản lý dự án là: liệt kê dự án theo trạng thái, liệt kê nhiệm vụ của một dự án, xem nhiệm vụ theo người phụ trách, kiểm tra việc quá hạn, và tính tiến độ dự án. Vì vậy thiết kế tập trung hỗ trợ các điều kiện lọc này bằng khóa ngoại rõ ràng và các chỉ mục ghép hợp lý. Ví dụ, chỉ mục trên `tasks(project_id, status)` hỗ trợ cả màn hình backlog lẫn báo cáo tiến độ; chỉ mục trên `tasks(assignee_user_id, status)` giúp tạo dashboard cá nhân.

Về khả năng mở rộng, dùng `BIGSERIAL` cho khóa chính cho phép tăng số lượng bản ghi trong thời gian dài mà ít lo tràn số. Các bảng nóng như `task_status_history` và `task_comments` được tách khỏi `tasks`, nên khi lượng lịch sử tăng mạnh, bảng nhiệm vụ chính vẫn gọn và nhanh. Sau này, nếu hệ thống lớn hơn, có thể cân nhắc phân vùng dữ liệu lịch sử theo tháng hoặc theo dự án mà không phải phá vỡ mô hình gốc.

Về tính toàn vẹn dữ liệu, khóa ngoại là phần rất quan trọng. Một nhiệm vụ không thể trỏ đến dự án không tồn tại. Một bình luận không thể thuộc về nhiệm vụ đã bị xóa nếu hệ thống không cho phép. Các `CHECK` constraint giúp kiểm soát trạng thái hợp lệ và phạm vi ưu tiên. Đây là lớp bảo vệ ở ngay trong cơ sở dữ liệu, giúp giảm rủi ro ngay cả khi ứng dụng có lỗi validation ở tầng code.

Một quyết định đáng chú ý là không lưu trực tiếp cột `project_progress` trong bảng `projects`. Tiến độ được tính từ số nhiệm vụ hoàn thành trên tổng số nhiệm vụ. Cách này tránh việc dữ liệu bị lệch khi có người cập nhật nhiệm vụ mà quên đồng bộ phần trăm dự án. Nếu sau này cần tối ưu cho dashboard rất lớn, có thể thêm materialized view hoặc bảng tổng hợp cập nhật định kỳ.

## 5. SQL DDL tạo bảng và chỉ số đề xuất

```sql
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    job_title VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
    project_id BIGSERIAL PRIMARY KEY,
    project_code VARCHAR(30) NOT NULL UNIQUE,
    project_name VARCHAR(200) NOT NULL,
    description TEXT,
    owner_user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    start_date DATE,
    due_date DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
    priority SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date)
);

CREATE TABLE project_members (
    project_id BIGINT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_in_project VARCHAR(30) NOT NULL CHECK (role_in_project IN ('owner', 'manager', 'member', 'viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE tasks (
    task_id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    parent_task_id BIGINT REFERENCES tasks(task_id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
    priority SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    assignee_user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    reporter_user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    estimated_hours NUMERIC(6,2) CHECK (estimated_hours >= 0),
    actual_hours NUMERIC(6,2) CHECK (actual_hours >= 0),
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date)
);

CREATE TABLE task_dependencies (
    task_id BIGINT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    depends_on_task_id BIGINT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) NOT NULL DEFAULT 'finish_to_start',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, depends_on_task_id),
    CHECK (task_id <> depends_on_task_id)
);

CREATE TABLE task_status_history (
    history_id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL CHECK (new_status IN ('todo', 'in_progress', 'blocked', 'done')),
    changed_by BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT
);

CREATE TABLE task_comments (
    comment_id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_owner_status ON projects(owner_user_id, status);
CREATE INDEX idx_projects_due_date ON projects(due_date);
CREATE INDEX idx_project_members_user ON project_members(user_id, project_id);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status, due_date);
CREATE INDEX idx_tasks_assignee_status ON tasks(assignee_user_id, status, due_date);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
CREATE INDEX idx_task_status_history_task_changed_at ON task_status_history(task_id, changed_at DESC);
CREATE INDEX idx_task_comments_task_created_at ON task_comments(task_id, created_at DESC);
```

## 6. Ví dụ truy vấn thường dùng

### 6.1. Lấy danh sách dự án kèm tiến độ

```sql
SELECT
    p.project_id,
    p.project_code,
    p.project_name,
    p.status,
    u.full_name AS owner_name,
    COUNT(t.task_id) AS total_tasks,
    COUNT(*) FILTER (WHERE t.status = 'done') AS done_tasks,
    CASE
        WHEN COUNT(t.task_id) = 0 THEN 0
        ELSE ROUND(COUNT(*) FILTER (WHERE t.status = 'done') * 100.0 / COUNT(t.task_id), 2)
    END AS progress_percent
FROM projects p
JOIN users u ON u.user_id = p.owner_user_id
LEFT JOIN tasks t ON t.project_id = p.project_id
GROUP BY p.project_id, p.project_code, p.project_name, p.status, u.full_name
ORDER BY p.created_at DESC;
```

### 6.2. Lấy danh sách nhiệm vụ của một dự án

```sql
SELECT
    t.task_id,
    t.title,
    t.status,
    t.priority,
    t.due_date,
    assignee.full_name AS assignee_name,
    reporter.full_name AS reporter_name
FROM tasks t
LEFT JOIN users assignee ON assignee.user_id = t.assignee_user_id
JOIN users reporter ON reporter.user_id = t.reporter_user_id
WHERE t.project_id = $1
ORDER BY t.priority ASC, t.due_date NULLS LAST, t.created_at ASC;
```

### 6.3. Lấy tiến độ theo từng người phụ trách trong một dự án

```sql
SELECT
    COALESCE(u.full_name, 'Chưa phân công') AS assignee_name,
    COUNT(t.task_id) AS total_tasks,
    COUNT(*) FILTER (WHERE t.status = 'done') AS done_tasks,
    COUNT(*) FILTER (WHERE t.status = 'blocked') AS blocked_tasks
FROM tasks t
LEFT JOIN users u ON u.user_id = t.assignee_user_id
WHERE t.project_id = $1
GROUP BY COALESCE(u.full_name, 'Chưa phân công')
ORDER BY assignee_name;
```

## 7. Lời khuyên về bảo trì và tối ưu hóa

- Dùng migration có version rõ ràng thay vì sửa schema trực tiếp trên môi trường chạy thật.
- Kiểm tra kế hoạch thực thi bằng `EXPLAIN ANALYZE` trước khi thêm chỉ mục mới; không phải chỉ mục nào cũng có lợi.
- Theo dõi các truy vấn lọc theo `project_id`, `assignee_user_id`, `status` và `due_date` vì đây thường là hot path.
- Với bảng `task_status_history` và `task_comments`, nên có chiến lược lưu trữ dài hạn như archive hoặc partition nếu dữ liệu tăng rất nhanh.
- Chỉ lưu dữ liệu phát sinh thật sự cần thiết. Các giá trị tổng hợp như tiến độ nên tính từ bảng nguồn trước, chỉ materialize khi có số liệu chứng minh cần tối ưu.
- Thiết lập backup định kỳ và kiểm tra khả năng restore. Backup mà chưa từng restore thử thì chưa đủ tin cậy.
- Khi tạo dự án mới, nên dùng transaction để vừa chèn `projects` vừa chèn bản ghi `project_members` cho người sở hữu, tránh lệch dữ liệu giữa chủ dự án và danh sách thành viên.
- Đồng bộ validation giữa ứng dụng và cơ sở dữ liệu. Ứng dụng giúp trải nghiệm người dùng tốt hơn, còn ràng buộc DB bảo vệ dữ liệu khỏi sai lệch lâu dài.

## 8. Kết luận

Thiết kế này ưu tiên sự cân bằng giữa dễ hiểu và đủ mạnh để vận hành thật. Mô hình đã chuẩn hoá tốt, có khóa ngoại để bảo vệ toàn vẹn dữ liệu, có chỉ mục cho các truy vấn quan trọng và chừa không gian để mở rộng sau này. Với người mới bắt đầu, đây là một nền tảng tốt để học cách biến yêu cầu nghiệp vụ thành schema quan hệ. Với nhà phát triển trung cấp, mô hình này đủ sạch để tiếp tục phát triển thêm phân quyền chi tiết, file đính kèm, thông báo hoặc báo cáo nâng cao mà không phải đập đi làm lại từ đầu.
