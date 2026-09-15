// Lead Status
export type LeadStatus =
  | "New"
  | "Contacted"
  | "Booking Requested"
  | "Booked"
  | "Completed"
  | "Lost"
  | "Follow-up Sent";

// Application Lead (used across UI components)
export interface Lead {
  id: string;             // reference_id for display (e.g. "SGS-001")
  dbId?: string;          // Supabase UUID primary key
  referenceId?: string;    // "SGS-001"
  name: string;
  phone: string;
  service: string;
  regularPrice?: number;
  offerPrice?: number;
  discountAmount?: number;
  preferredDate: string;  // safe formatted or YYYY-MM-DD
  preferredTime: string;  // e.g. "11:00 AM"
  source: string;         // UTM source, e.g. "Instagram" — defaults to "Direct"
  medium: string;         // UTM medium, e.g. "Reel"
  campaign: string;       // UTM campaign, e.g. "Hair Spa Offer"
  status: LeadStatus;
  createdAt: string;      // ISO string
  actualVisitDate?: string;
  billAmount?: number;      // actual amount collected at salon counter in Rs.
  followUpSentAt?: string;
}

// Raw Database Record in Supabase public.leads
export interface DbLead {
  id: string;
  reference_id: string;
  name: string;
  phone: string;
  service: string;
  regular_price: number | null;
  offer_price: number | null;
  discount_amount: number | null;
  preferred_date: string | null;
  preferred_time: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  status: LeadStatus;
  actual_visit_date: string | null;
  bill_amount: number | null;
  follow_up_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// Service
export interface Service {
  name: string;
  price: number;
  offerPrice?: number;
  discountAmount?: number;
  badge?: string;
  bonusOffer?: string;
  icon: string;
  subtitle?: string; // short descriptor shown below the service name in the booking card
  isSpecial?: boolean;
}
