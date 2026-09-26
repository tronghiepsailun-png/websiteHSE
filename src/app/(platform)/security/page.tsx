import { redirect } from "next/navigation";

// No overview content of its own — the sidebar's "Quản lý bảo an" entry needs a real page at
// this exact URL to link to, so it just lands on the first tab.
export default function EmployeeSecurityIndexPage() {
  redirect("/security/attendance");
}
