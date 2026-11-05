import { NextRequest, NextResponse } from "next/server";

/**
 * Fund wallet via Flutterwave.
 * 
 * In production this creates a Flutterwave payment link or charge.
 * For now it returns a success response that the client uses to update the UI.
 * 
 * Flutterwave API: https://developer.flutterwave.com/reference/endpoints/payments/standard-payment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, method } = body;

    if (!amount || amount < 100) {
      return NextResponse.json({ error: "Minimum funding amount is ₦100" }, { status: 400 });
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;

    if (!secretKey) {
      // Demo mode — no real payment, just acknowledge
      return NextResponse.json({
        success: true,
        message: "Funding successful (demo mode)",
        amount,
        method,
        ref: "FLW-DEMO-" + Date.now(),
      });
    }

    // Production: Create a Flutterwave payment
    // See: https://developer.flutterwave.com/reference/endpoints/payments/standard-payment
    const txRef = "LUMORA-FUND-" + Date.now();

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: amount.toString(),
        currency: "NGN",
        redirect_url: process.env.FLUTTERWAVE_REDIRECT_URL || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/wallet`,
        customer: {
          email: body.email || "user@lumora.app",
        },
        customizations: {
          title: "Lumora Wallet Funding",
          description: `Add ₦${amount.toLocaleString()} to your Lumora wallet`,
          logo: `${process.env.NEXT_PUBLIC_SITE_URL}/brand/lumora-mark.png`,
        },
        payment_options: method === "card" ? "card" : "banktransfer",
      }),
    });

    const data = await response.json();

    if (data.status !== "success") {
      return NextResponse.json({ error: data.message || "Payment initiation failed" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Payment link created",
      paymentLink: data.data.link,
      ref: txRef,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
