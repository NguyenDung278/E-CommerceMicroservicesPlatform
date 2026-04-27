import { AdminConsoleLayout } from "@/components/admin/admin-layout";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminConsoleLayout>{children}</AdminConsoleLayout>;
}
