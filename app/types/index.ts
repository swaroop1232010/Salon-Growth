// Lead Status
export type LeadStatus =
  | "New"
  | "Contacted"
  | "Booking Requested"
  | "Booked"
  | "Completed"
  | "Lost"
  | "Follow-up Sent";

// Lead
export interface Lead {
  id: string;
  name: string;
  phone: string;
  service: string;
  preferredDate: string;  // stored as "15 Sep 2026" — no ambiguous ISO parsing
  preferredTime: string;  // e.g. "11:00 AM"
  source: string;         // UTM source, e.g. "Instagram" — defaults to "Direct"
  medium: string;         // UTM medium, e.g. "Reel"
  campaign: string;       // UTM campaign, e.g. "Hair Spa Offer"
  status: LeadStatus;
  createdAt: string;      // ISO string — for sorting only, not displayed raw
  actualVisitDate?: string; // stored as "15 Sep 2026"
  billAmount?: number;      // actual amount collected at salon counter in Rs.
}

// Service
export interface Service {
  name: string;
  price: number;
  icon: string;
}
