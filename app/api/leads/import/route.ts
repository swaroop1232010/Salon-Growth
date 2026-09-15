import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toPostgresDate } from "../../../lib/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

interface ImportLeadInput {
  name: string;
  phone: string;
  service?: string;
  regularPrice?: number;
  offerPrice?: number;
  discountAmount?: number;
  preferredDate?: string;
  preferredTime?: string;
  status?: string;
  source?: string;
  campaign?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leads } = body as { leads: ImportLeadInput[] };

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { success: false, error: "No leads array provided or array is empty" },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured on server" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let insertedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < leads.length; i++) {
      const item = leads[i];
      const cleanPhone = (item.phone || "").replace(/\D/g, "").slice(-10);
      if (!cleanPhone || cleanPhone.length !== 10) {
        skippedCount++;
        continue;
      }

      const refId = `SGS-${Date.now().toString().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
      const payload = {
        reference_id: refId,
        name: (item.name || "Guest").trim(),
        phone: cleanPhone,
        service: item.service || "Advanced Haircut",
        regular_price: item.regularPrice ?? 899,
        offer_price: item.offerPrice ?? 699,
        discount_amount: item.discountAmount ?? 200,
        preferred_date: toPostgresDate(item.preferredDate),
        preferred_time: item.preferredTime || "Flexible",
        source: item.source || "Imported",
        medium: "Dashboard Import",
        campaign: item.campaign || "imported-customers",
        status: item.status || "Booking Requested",
      };

      const { error } = await supabase.from("leads").insert([payload]);
      if (error) {
        skippedCount++;
      } else {
        insertedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      insertedCount,
      skippedCount,
      totalProcessed: leads.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
