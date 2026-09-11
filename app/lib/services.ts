import { Service } from "../types";

export const SERVICES: Service[] = [
  { name: "Haircut",        price: 499,  icon: "scissors" },
  { name: "Hair Spa",       price: 999,  icon: "spa"      },
  { name: "Facial",         price: 799,  icon: "face"     },
  { name: "Hair Color",     price: 1499, icon: "color"    },
  { name: "Beard Grooming", price: 299,  icon: "beard"    },
];

export const DISCOUNT = 200;
export const OFFER_TEXT = "Get Rs.200 OFF on your first visit";
export const CAMPAIGN = "First Visit Special";
export const SALON_NAME = "Swasthik Salon & Boutique";