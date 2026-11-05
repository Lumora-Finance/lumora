import { DeliveryForm } from "@/components/board/delivery-form";

export default async function RecordDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeliveryForm bookingId={id} />;
}
