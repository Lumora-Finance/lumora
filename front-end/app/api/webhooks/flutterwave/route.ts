import { NextRequest, NextResponse } from "next/server";

/**
 * Flutterwave webhook handler.
 * 
 * Flutterwave sends webhooks for:
 * - Successful payments (funding)
 * - Successful transfers (withdrawals)
 * - Failed transfers
 * 
 * See: https://developer.flutterwave.com/reference/webhooks
 * 
 * IMPORTANT: In production, verify the webhook signature:
 *   const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
 *   const signature = request.headers.get("verif-hash");
 *   if (signature !== secretHash) return NextResponse.json({}, { status: 401 });
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify webhook signature (production)
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    const signature = request.headers.get("verif-hash");

    if (secretHash && signature !== secretHash) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = body.event;

    if (event === "charge.completed") {
      // Payment successful — credit wallet
    } else if (event === "transfer.completed") {
      // Transfer (withdrawal) completed
    } else if (event === "transfer.failed") {
      // Transfer failed — reverse the deduction
    }

    return NextResponse.json({ status: "success" });
  } catch {
    return NextResponse.json({ status: "success" });
  }
}
