import { Service } from "../types";

export const STANDARD_SERVICES: Service[] = [
  { name: "Advanced Haircut",              price: 899,  offerPrice: 699,  discountAmount: 200, icon: "scissors", subtitle: "incl. Hairwash"    },
  { name: "Fruit Facial + Face D-Tan",     price: 1299, offerPrice: 1099, discountAmount: 200, icon: "facial",   subtitle: "Glow combo"        },
  { name: "Basic Pedi + Mani",             price: 999,  offerPrice: 799,  discountAmount: 200, icon: "nails",    subtitle: "Hands & Feet care" },
  { name: "Full Hands + Half Legs Waxing", price: 899,  offerPrice: 699,  discountAmount: 200, icon: "waxing",   subtitle: "Smooth finish"    },
];

export const STUDENT_OFFER: Service = {
  name: "Students flat 40% + 10% review on all services",
  price: 1000,
  offerPrice: 500,
  discountAmount: 500,
  icon: "student",
  subtitle: "Flat 40% with Student ID + Extra 10% on Google Review",
  badge: "Flat 40% + 10% OFF",
  bonusOffer: "+10% on Google Review",
  isSpecial: true,
};

export const SERVICES: Service[] = [
  ...STANDARD_SERVICES,
  STUDENT_OFFER,
];

export const DISCOUNT = 200;