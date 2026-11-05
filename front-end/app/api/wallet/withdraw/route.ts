import { NextRequest, NextResponse } from "next/server";

/**
 * Withdraw funds from wallet to a Nigerian bank account via Flutterwave Transfer API.
 * 
 * Flutterwave Transfer API: https://developer.flutterwave.com/reference/endpoints/transfers
 * 
 * Flow:
 * 1. Resolve the bank account number to verify the account name
 * 2. Create a transfer to the verified account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, bankName, accountNumber, accountName } = body;

    // Validate
    if (!amount || amount < 500) {
      return NextResponse.json({ error: "Minimum withdrawal is ₦500" }, { status: 400 });
    }
    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: "All bank details are required" }, { status: 400 });
    }
    if (accountNumber.length !== 10) {
      return NextResponse.json({ error: "Account number must be 10 digits" }, { status: 400 });
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;

    if (!secretKey) {
      // Demo mode
      return NextResponse.json({
        success: true,
        message: "Withdrawal initiated (demo mode). Funds arrive within 24 hours.",
        amount,
        ref: "FLW-WDW-DEMO-" + Date.now(),
        status: "pending",
      });
    }

    // Step 1: Get bank code from Flutterwave banks list
    // See: https://developer.flutterwave.com/reference/endpoints/banks
    const banksRes = await fetch("https://api.flutterwave.com/v3/banks/NG", {
      headers: { "Authorization": `Bearer ${secretKey}` },
    });
    const banksData = await banksRes.json();
    const bank = banksData.data?.find((b: { name: string }) =>
      b.name.toLowerCase().includes(bankName.toLowerCase())
    );

    if (!bank) {
      return NextResponse.json({ error: "Bank not found. Please check the bank name." }, { status: 400 });
    }

    // Step 2: Resolve account number to verify name
    // See: https://developer.flutterwave.com/v3/resolve-account
    const resolveRes = await fetch(
      `https://api.flutterwave.com/v3/accounts/resolve?account_number=${accountNumber}&account_bank=${bank.code}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    const resolveData = await resolveRes.json();

    if (resolveData.status !== "success") {
      return NextResponse.json({ error: "Could not verify account number. Please check it and try again." }, { status: 400 });
    }

    const resolvedName = resolveData.data.account_name;

    // Optional: Verify resolved name matches provided name
    if (!resolvedName.toLowerCase().includes(accountName.toLowerCase().split(" ")[0])) {
      return NextResponse.json({ error: "Account name does not match. Please verify the account details." }, { status: 400 });
    }

    // Step 3: Create transfer
    // See: https://developer.flutterwave.com/v3/transfers
    const transferRef = "LUMORA-WDW-" + Date.now();
    const transferRes = await fetch("https://api.flutterwave.com/v3/transfers", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_bank: bank.code,
        account_number: accountNumber,
        amount: amount,
        narration: `Lumora wallet withdrawal to ${accountName}`,
        currency: "NGN",
        reference: transferRef,
        callback_url: process.env.FLUTTERWAVE_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/flutterwave`,
        beneficiary_name: accountName,
      }),
    });
    const transferData = await transferRes.json();

    if (transferData.status !== "success") {
      return NextResponse.json({ error: transferData.message || "Withdrawal failed. Please try again." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Withdrawal initiated. Funds arrive within 24 hours.",
      amount,
      ref: transferRef,
      status: transferData.data.status,
      transferId: transferData.data.id,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
