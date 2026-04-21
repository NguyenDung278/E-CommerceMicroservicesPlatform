# Documentation Index

Thư mục `docs/` bây giờ chỉ giữ ba tài liệu tổng hợp để tránh trùng lặp và lệch source.

| File | Dùng khi nào |
| --- | --- |
| `docs/learning/README.md` | Muốn học repo theo góc nhìn Golang backend, best practice, pitfall và backlog nên làm tiếp. |
| `docs/deep-dive/README.md` | Muốn hiểu runtime, boundary giữa service, DB, queue và các luồng dữ liệu chính. |
| `docs/annotated/README.md` | Muốn map feature sang file hoặc hàm cụ thể trong source để đọc code nhanh. |

## Tài liệu ngoài `docs/` vẫn nên đọc

- `README.md`: runtime local, lệnh chính, vai trò `client/` và `frontend/`.
- `feature_tracker.md`: feature gap và những phần còn mở giữa backend với UI.
- `API_TESTING_GUIDE.md`: playbook test HTTP API qua `api-gateway`.

## Quy ước mới

- Không tạo lại doc nhỏ theo từng service nếu nội dung chỉ lặp lại source map hoặc flow đã có trong ba file trên.
- Khi cần thêm kiến thức mới, ưu tiên gộp vào đúng file tổng hợp thay vì đẻ thêm file.
- Nếu docs và source mâu thuẫn, tin source thật trong `deployments/docker/` và `services/*/internal/`.
