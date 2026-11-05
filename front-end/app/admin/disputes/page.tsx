import { CodeReportQueue } from "@/components/admin/code-report-queue";
import { DisputeQueue } from "@/components/admin/dispute-queue";

export default function DisputesPage() {
  return (
    <>
      <CodeReportQueue />
      <DisputeQueue />
    </>
  );
}
