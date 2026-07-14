# Documentation Index

Thư mục `docs/` giữ các tài liệu tổng hợp để tránh trùng lặp và lệch source.

| File | Dùng khi nào |
| --- | --- |
| `docs/learning/README.md` | Muốn học repo theo góc nhìn Golang backend, best practice, pitfall và backlog nên làm tiếp. |
| `docs/deep-dive/README.md` | Muốn hiểu runtime, boundary giữa service, DB, queue và các luồng dữ liệu chính. |
| `docs/annotated/README.md` | Muốn map feature sang file hoặc hàm cụ thể trong source để đọc code nhanh. |
| `docs/PROMPT_TOI_UU_PROJECT.md` | Muốn giao cho AI agent một lượt tối ưu codebase — prompt nền + module theo phạm vi + backlog nợ kỹ thuật đã biết. |
| `docs/huong_dan_dang_nhap_database.md` | Cần vào thẳng PostgreSQL/Redis trong container để xem dữ liệu. |

## Tài liệu ngoài `docs/` vẫn nên đọc

- `HUONG_DAN_CHAY.md`: chạy toàn bộ hệ thống từ đầu (backend compose + frontend dev + test).
- `README.md`: kiến trúc tổng quan, lệnh chính, bảng "Hot Path Khi Audit Issue".
- `API_TESTING_GUIDE.md`: playbook test HTTP API qua `api-gateway`.
- `AGENTS.md`: bộ rule kiến trúc/code bắt buộc trước khi sửa backend.
- `FRONTEND_GUIDELINES.md`: quy ước và capability backend cho `client/`.

## Quy ước

- Không tạo lại doc nhỏ theo từng service nếu nội dung chỉ lặp lại source map hoặc flow đã có trong các file tổng hợp.
- Khi cần thêm kiến thức mới, ưu tiên gộp vào đúng file tổng hợp thay vì đẻ thêm file.
- Nếu docs và source mâu thuẫn, tin source thật trong `deployments/docker/` và `services/*/internal/`.
