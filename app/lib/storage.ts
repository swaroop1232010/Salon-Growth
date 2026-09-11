import { Lead, LeadStatus } from "../types";

const STORAGE_KEY = "sgs_leads";

// Generate a unique lead ID like SGS-001, SGS-002 ...
export function generateLeadId(): string {
  const leads = getLeads();
  const nextNum = leads.length + 1;
  return `SGS-${String(nextNum).padStart(3, "0")}`;
}

// Get all leads from LocalStorage
export function getLeads(): Lead[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Lead[];
  } catch {
    return [];
  }
}

// Save a single new lead
export function saveLead(lead: Lead): void {
  const leads = getLeads();
  leads.unshift(lead); // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

// Update the status of an existing lead
export function updateLeadStatus(id: string, status: LeadStatus): void {
  const leads = getLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx !== -1) {
    leads[idx].status = status;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }
}

// Mark a lead as Completed with actual visit date and final collected bill amount
export function completeLead(id: string, actualVisitDate: string, billAmount: number): void {
  const leads = getLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx !== -1) {
    leads[idx].status = "Completed";
    leads[idx].actualVisitDate = actualVisitDate;
    leads[idx].billAmount = billAmount;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }
}
