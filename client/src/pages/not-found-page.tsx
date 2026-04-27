import { Link } from "react-router-dom";
import { EmptyView } from "../components/status-view";

export function NotFoundPage() {
  return (
    <EmptyView title="Không tìm thấy trang">
      <Link to="/">Quay lại trang chủ</Link>
    </EmptyView>
  );
}
