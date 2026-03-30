# Learning Path

`learning/` là tầng tài liệu dành cho người mới vào repo hoặc người đang dùng dự án như một bộ case study để học backend/full-stack thực chiến.

## Thứ tự học khuyến nghị

1. [00-local-setup.md](./00-local-setup.md)
2. [02-project-technologies-explained.md](./02-project-technologies-explained.md)
3. [03-source-reading-roadmap.md](./03-source-reading-roadmap.md)
4. [05-first-contribution-walkthrough.md](./05-first-contribution-walkthrough.md)
5. [06-testing-and-verification.md](./06-testing-and-verification.md)
6. [10-guide-to-debugging.md](./10-guide-to-debugging.md)
7. [09-how-to-add-new-feature.md](./09-how-to-add-new-feature.md)
8. [11-senior-source-code-review-guide.md](./11-senior-source-code-review-guide.md)

## Bộ tài liệu này giúp bạn làm gì

- dựng local runtime đúng với compose hiện tại, không đoán mò theo docs cũ
- biết frontend nào là đường chính, backend nào là source of truth, dependency nào đang optional
- học cách đọc repo theo flow chứ không đọc rời từng file
- biết verify thay đổi theo đúng runtime hiện tại
- biết cách debug khi compose, env, gateway, DB hoặc frontend đang lệch nhau

## Khi nào chuyển sang `deep-dive/` và `annotated/`

- Khi đã chạy được local: sang `deep-dive/`
- Khi đã hiểu boundary của hệ thống: sang `annotated/`
- Nếu bạn đang sửa frontend sau refactor: đọc `deep-dive/frontend-architecture.md` rồi mới sang annotate frontend

## Tài liệu tổng hợp nên ưu tiên đọc

- [03-source-reading-roadmap.md](./03-source-reading-roadmap.md): biết phải mở file nào trước khi sửa code
- [06-testing-and-verification.md](./06-testing-and-verification.md): biết verify gì trước khi tin rằng mình đã sửa xong
- [11-senior-source-code-review-guide.md](./11-senior-source-code-review-guide.md): nhìn repo như một senior engineer thay vì chỉ như người học syntax
