import { BookingPage } from "@/components/bookings/booking-page";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingPage bookingId={id} />;
}
