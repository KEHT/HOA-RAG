export interface QuickPrompt {
  id: string;
  category: 'bylaws' | 'minutes' | 'financials' | 'architectural' | 'rules';
  categoryLabel: string;
  icon: string;
  title: string;
  prompt: string;
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: 'qp-leasing',
    category: 'bylaws',
    categoryLabel: 'Bylaws & Governance',
    icon: 'Building',
    title: 'Short-term rentals & Airbnb policy',
    prompt: 'Can I rent out my home on Airbnb or as a short-term rental? What are the leasing restrictions, rental cap, and minimum lease duration?'
  },
  {
    id: 'qp-dues',
    category: 'financials',
    categoryLabel: 'Financials & Dues',
    icon: 'DollarSign',
    title: '2026 Dues, Late Fees & Reserve Health',
    prompt: 'What is our 2026 monthly assessment dues amount, when is it due, what is the late fee policy, and what is the current reserve fund percent funded?'
  },
  {
    id: 'qp-minutes',
    category: 'minutes',
    categoryLabel: 'Board Decisions',
    icon: 'FileText',
    title: 'Recent Board decisions & contracts',
    prompt: 'What contracts and vendor bids were approved in the recent 2026 board meetings? Specifically regarding the roof replacement and roadway slurry seal?'
  },
  {
    id: 'qp-paint',
    category: 'architectural',
    categoryLabel: 'ARC & Paint',
    icon: 'Palette',
    title: 'Approved Paint Colors & ARC Rules',
    prompt: 'What are the approved exterior paint color schemes from Sherwin-Williams, and what is the ARC application and approval timeline?'
  },
  {
    id: 'qp-pets',
    category: 'rules',
    categoryLabel: 'Rules & Regulations',
    icon: 'Dog',
    title: 'Pet rules, dog weight & leash rules',
    prompt: 'What is the pet policy regarding number of pets allowed, weight limits, leash requirements, and fines for not cleaning up waste?'
  },
  {
    id: 'qp-parking',
    category: 'rules',
    categoryLabel: 'Parking Policy',
    icon: 'Car',
    title: 'Overnight parking & garage rules',
    prompt: 'What are the rules for overnight street parking, guest parking stalls, and garage vehicle storage?'
  },
  {
    id: 'qp-solar',
    category: 'architectural',
    categoryLabel: 'Solar & EV Chargers',
    icon: 'Zap',
    title: 'Solar Panels & EV Charger installation',
    prompt: 'What are the requirements to install rooftop solar panels or a Level 2 EV charging station in the garage?'
  },
  {
    id: 'qp-dispute',
    category: 'bylaws',
    categoryLabel: 'Dispute Resolution',
    icon: 'Scale',
    title: 'Dispute resolution & fine hearings',
    prompt: 'What is the procedure for Internal Dispute Resolution (IDR) and disputing an HOA violation fine or notice?'
  }
];
