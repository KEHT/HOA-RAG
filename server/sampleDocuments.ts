export interface StoredDocument {
  id: string;
  name: string;
  category: 'bylaws' | 'minutes' | 'financials' | 'architectural' | 'rules' | 'general';
  mimeType: string;
  modifiedTime: string;
  content: string;
  summary: string;
}

export const SAMPLE_HOA_DOCUMENTS: StoredDocument[] = [
  {
    id: 'sample-bylaws-2024',
    name: 'Pinecrest Heights HOA - Master Declaration of CC&Rs and Bylaws (Amended 2024).pdf',
    category: 'bylaws',
    mimeType: 'application/pdf',
    modifiedTime: '2024-05-15T14:30:00Z',
    summary: 'Master Covenants, Conditions & Restrictions (CC&Rs) covering leasing restrictions, assessment powers, quorum requirements, dispute resolution, and member voting rights.',
    content: `PINECREST HEIGHTS HOMEOWNERS ASSOCIATION, INC.
AMENDED MASTER DECLARATION OF COVENANTS, CONDITIONS, AND RESTRICTIONS (CC&Rs) & BYLAWS
Recorded Date: May 15, 2024 | Document No. 2024-048291

ARTICLE I: RECITALS & DEFINITIONS
1.1 "Association" means Pinecrest Heights Homeowners Association, Inc., a non-profit mutual benefit corporation.
1.2 "Common Area" encompasses all community parcels, including the Clubhouse, Swimming Pool, Tennis & Pickleball Courts, Private Roads, Greenbelt Walkways, and Perimeter Fences.
1.3 "Owner" means the record holder of fee simple title to any Lot within the Community.

ARTICLE IV: ASSESSMENTS & COLLECTION REMEDIES
4.1 Annual General Assessments: The Board of Directors shall determine the annual regular assessment no later than November 30 for the ensuing fiscal year. Annual regular assessment increases exceeding twenty percent (20%) over the prior fiscal year require affirmative approval of a majority of a quorum of the Members (51%).
4.2 Due Dates & Delinquency: Assessments are due on the first (1st) day of each calendar month. Payments not received by the fifteenth (15th) day of the month are deemed delinquent and shall incur a late charge of $35.00 or 10% of the overdue balance (whichever is greater), plus interest accruing at 12% per annum.
4.3 Special Assessments: The Board may levy a special assessment for capital improvements or emergency repairs up to $2,500 per Lot in any single fiscal year without Member vote. Special assessments exceeding this amount require approval of 60% of voting Members present at a duly convened meeting.
4.4 Liens & Foreclosure: Delinquent assessments exceeding $1,800 or delinquent for more than 90 days may be secured by recording an Assessment Lien against the Lot. The Association may initiate non-judicial or judicial foreclosure proceedings after providing thirty (30) days certified written notice to the Owner.

ARTICLE VI: LEASING & RENTAL RESTRICTIONS
6.1 Rental Cap (20% Limit): No more than twenty percent (20%) of the total units (24 of 120 Lots) in the community may be leased or rented at any given time. An Owner must submit a written Application for Rental Authorization to the Management Company before entering into any lease agreement. A waiting list shall be maintained in strict chronological order.
6.2 Minimum Lease Term: All leases must be in writing and have an initial term of not less than twelve (12) consecutive months. Short-term rentals, including vacation rentals via platforms such as Airbnb, VRBO, or HomeAway, are STRICTLY PROHIBITED.
6.3 Single-Family Occupancy: Leased Lots must be occupied solely by a single family as a private residential dwelling. Subleasing or renting individual rooms within a Lot is expressly forbidden.
6.4 Landlord Liability & Fine Schedule: Owners remain strictly responsible for tenant compliance. Violations of community rules by tenants will result in fines assessed directly against the Lot Owner: 1st violation: Written Warning; 2nd violation: $100 fine; 3rd and subsequent violations: $250 per occurrence, plus suspension of Clubhouse and pool amenity privileges.

ARTICLE VIII: GOVERNANCE, MEETINGS & QUORUM
8.1 Board Composition: The Board of Directors shall consist of five (5) Members elected for staggered two (2) year terms at the Annual Meeting.
8.2 Quorum Requirements: The presence in person or by legitimate proxy of Members representing at least thirty-three and one-third percent (33.33%) of the total voting power (40 Lots) shall constitute a quorum for the transaction of business at any general Member meeting. If a quorum is not reached, the meeting may be adjourned and reconvened within 30 days where the quorum requirement reduces to twenty-five percent (25%).
8.3 Election of Officers: The Board shall elect a President, Vice President, Secretary, and Treasurer from among its members at the first regular organizational board meeting following the Annual Meeting.
8.4 Dispute Resolution (IDR & ADR): Before initiating litigation regarding governing document disputes, the parties must submit the dispute to Internal Dispute Resolution (IDR) at no cost to the Owner, or Alternative Dispute Resolution (ADR / mediation).`
  },
  {
    id: 'sample-financials-2026',
    name: 'Pinecrest Heights HOA - 2026 Annual Budget, Dues Schedule & Reserve Study.pdf',
    category: 'financials',
    mimeType: 'application/pdf',
    modifiedTime: '2025-12-01T09:15:00Z',
    summary: '2026 Fiscal Year Approved Operating Budget ($468,000 total revenue), Monthly assessment schedule ($325/mo per lot), Reserve fund balance ($612,450 at 78.4% funded), and 5-year capital replacement plan.',
    content: `PINECREST HEIGHTS HOMEOWNERS ASSOCIATION, INC.
ANNUAL OPERATING BUDGET & RESERVE ALLOCATION SCHEDULE
Fiscal Year: January 1, 2026 to December 31, 2026
Approved by Board of Directors: November 18, 2025 | Total Units: 120 Lots

1. ASSESSMENT SCHEDULE
- Monthly Regular Assessment per Lot: $325.00 (increased from $300.00 in 2025; an 8.33% increase)
- Total Annual Assessment per Lot: $3,900.00
- Total Annual Projected Dues Revenue: $468,000.00
- Payment Method: Due on 1st of each month via ACH Direct Debit, Resident Portal, or Check to First Community Management. $35 late fee after 15th.

2. OPERATING EXPENSE BREAKDOWN (Total Projected: $348,000)
A. Landscaping & Grounds Maintenance: $118,500 (34.0%)
   - Landscape contractor monthly service: $78,000 ($6,500/mo - GreenValley Landscaping)
   - Tree trimming and hazard mitigation: $18,500
   - Irrigation system repairs & water conservation upgrades: $12,000
   - Seasonal color flowers & mulch: $10,000
B. Utilities: $54,200 (15.6%)
   - Common Area Water & Sewer: $32,000
   - Common Area Electricity (Streetlights, Clubhouse, Pool Pumps): $18,200
   - Gas (Pool Heater & Clubhouse): $4,000
C. Facility & Amenity Maintenance: $66,300 (19.1%)
   - Pool & Spa service, chemicals & permit: $24,000 (AquaClear Pools)
   - Clubhouse janitorial and supplies: $14,400
   - Gate & Security access system maintenance: $12,500
   - Tennis & Pickleball court upkeep: $4,200
   - Pest control & wildlife management: $6,200
   - General handyman & repairs: $5,000
D. Administrative & Professional Fees: $72,000 (20.7%)
   - Professional Property Management: $38,400 ($3,200/mo - First Community Management)
   - Legal Counsel & Collections: $14,000
   - CPA Annual Audit & Tax Filing: $6,500
   - Reserve Study 3-Year On-Site Update: $4,100
   - Office, Postage & Software Portal: $9,000
E. Insurance: $37,000 (10.6%)
   - Commercial General Liability & Property ($5M coverage): $23,000
   - Directors & Officers (D&O) Liability ($2M coverage): $6,500
   - Fidelity Bond & Cyber Crime: $3,500
   - Umbrella Policy ($10M): $4,000

3. RESERVE FUND ALLOCATION & STUDY STATUS (Total Annual Transfer: $120,000)
- Beginning Reserve Fund Balance (as of Jan 1, 2026): $612,450.00
- 2026 Reserve Contribution: $120,000.00 ($10,000 transferred monthly)
- Reserve Account Current Percent Funded: 78.4% (Threshold benchmark: >70% is considered financially healthy and robust)
- Major Planned Reserve Projects for 2026-2027:
  1. Clubhouse Asphalt Shingle Roof Replacement: $48,000 (Scheduled Q3 2026)
  2. Main Roadway Slurry Seal & Restriping: $34,500 (Scheduled Q2 2026)
  3. Pool Deck Resurfacing & Coping Tile: $28,000 (Scheduled Q4 2026)
  4. Pickleball Court Lighting LED Conversion: $11,500 (Completed Feb 2026)

4. DELINQUENCY & FINANCIAL HEALTH SUMMARY
- Total Accounts Over 60 Days Past Due: 3 units ($4,250 total arrears, representing 0.9% of total annual assessment roll).
- No special assessments are scheduled or anticipated for the 2026 calendar year.`
  },
  {
    id: 'sample-minutes-june-2026',
    name: 'Pinecrest Heights HOA - Board of Directors Meeting Minutes (June 18, 2026).pdf',
    category: 'minutes',
    mimeType: 'application/pdf',
    modifiedTime: '2026-06-19T11:00:00Z',
    summary: 'Approved roadway slurry seal contract ($34,500 to Apex Paving), established pickleball court quiet hours (8:00 AM - 9:00 PM), reviewed EV charger installation guidelines, and addressed pool heating schedule.',
    content: `PINECREST HEIGHTS HOMEOWNERS ASSOCIATION, INC.
REGULAR MEETING OF THE BOARD OF DIRECTORS
Date: June 18, 2026 | Time: 7:00 PM | Location: Community Clubhouse & Zoom
Minutes Approved by Board: July 16, 2026

DIRECTORS PRESENT:
- Sarah Jenkins, President
- Marcus Thorne, Vice President
- Elena Rostova, Treasurer
- David Kim, Secretary
- Rachel Vance, Member at Large
OTHERS IN ATTENDANCE:
- Bradley Miller, First Community Management (Managing Agent)
- 14 Homeowners in person, 9 via video conference

1. CALL TO ORDER & APPROVAL OF MINUTES:
President Sarah Jenkins called the meeting to order at 7:02 PM. The minutes from the May 21, 2026 regular board meeting were reviewed. Upon motion made by David Kim and seconded by Elena Rostova, the minutes were UNANIMOUSLY APPROVED (5-0).

2. TREASURER'S FINANCIAL REPORT (Elena Rostova):
- Operating Account Balance as of May 31, 2026: $84,320.15
- Reserve Account Balance as of May 31, 2026: $642,880.90
- Year-to-date expenses are currently tracking 2.1% under budget, primarily due to lower than expected utility usage in spring.
- Three delinquent accounts have entered payment plans; total collection delinquency reduced from $4,250 to $2,100.

3. COMMITTEE REPORTS:
A. Architectural Review Committee (ARC):
   - ARC reviewed 11 homeowner applications in May/June: 6 paint repainting requests (all approved from palette), 3 rooftop solar installations (approved per state statute standards), and 2 patio cover extensions (1 approved, 1 requested revised dimension drawings).
B. Landscape Committee:
   - Irrigation audit completed; replaced 48 broken spray heads with drip lines along Ridgecrest Way, resulting in estimated 18% water savings.

4. UNFINISHED & NEW BUSINESS:
A. Roadway Slurry Seal & Restriping Contract (Reserve Project):
   - Board reviewed three competitive bids for community roadway maintenance:
     * Apex Paving Inc.: $34,500 (Includes 2-coat slurry seal, crack filling, and restriping with 3-year warranty)
     * Western Asphalt Pro: $38,900
     * Bayline Sealcoating: $36,200
   - MOTION by Elena Rostova, SECOND by Marcus Thorne: To award the roadway slurry seal contract to Apex Paving Inc. for an amount not to exceed $34,500 payable from the Reserve Fund. VOTE: UNANIMOUS (5-0). Work scheduled for August 10-14, 2026. Resident parking notices will be delivered 2 weeks in advance.

B. Pickleball Court Noise & Hours Regulation:
   - Discussion regarding neighbor noise complaints near Court #2.
   - MOTION by Rachel Vance, SECOND by David Kim: To establish official Pickleball Playing Hours from 8:00 AM to 9:00 PM Monday through Saturday, and 9:00 AM to 8:00 PM on Sundays. All paddles must be USAPA-approved "Quiet Sound Foam Core/Acoustic" rated. VOTE: APPROVED (4-1, Marcus Thorne dissenting due to preference for 8:30 PM cutoff).

C. Electric Vehicle (EV) Charging Station Installation Policy:
   - ARC submitted a standardized EV Charging Application packet conforming to Civil Code standards. Homeowners installing Level 2 EV chargers in their dedicated garages do not require full committee hearing, only standard architectural safety notification and licensed electrician certification.

5. OPEN HOMEOWNER FORUM:
- Resident at 412 Ridgecrest Way asked about heating the pool through October. Management confirmed pool heater is scheduled to operate at 82°F through October 31.

6. ADJOURNMENT:
The regular open session adjourned to executive session at 8:28 PM to discuss legal collections and vendor contract renewals.`
  },
  {
    id: 'sample-minutes-march-2026',
    name: 'Pinecrest Heights HOA - Board of Directors Meeting Minutes (March 19, 2026).pdf',
    category: 'minutes',
    mimeType: 'application/pdf',
    modifiedTime: '2026-03-20T10:00:00Z',
    summary: 'Approved Clubhouse roof replacement vendor ($48,000 to Summit Roofing), discussed annual tree trimming, review of security camera upgrades at clubhouse entrance.',
    content: `PINECREST HEIGHTS HOMEOWNERS ASSOCIATION, INC.
REGULAR MEETING OF THE BOARD OF DIRECTORS
Date: March 19, 2026 | Time: 7:00 PM | Location: Clubhouse

1. ATTENDANCE:
All 5 Directors present (Jenkins, Thorne, Rostova, Kim, Vance). Managing Agent Bradley Miller present.

2. MOTIONS AND ACTIONS TAKEN:
A. Clubhouse Roof Replacement Bid:
   - MOTION by Marcus Thorne, SECOND by Elena Rostova: To approve Summit Roofing Specialists for complete tear-off and replacement of Clubhouse asphalt shingle roof for $48,000 funded from the Reserve Account. VOTE: UNANIMOUS (5-0). Work slated for September 2026.
B. Security Camera Enhancement:
   - Approved $3,200 for 4 high-definition license plate and facial clarity cameras at the North and South vehicular gates to deter gate tailgating.
C. Annual Tree Trimming:
   - Approved GreenValley Landscaping annual eucalyptus and pine safety pruning for $14,200.`
  },
  {
    id: 'sample-arc-guidelines-2025',
    name: 'Pinecrest Heights HOA - Architectural Review Committee (ARC) Guidelines & Approved Paint Palette.pdf',
    category: 'architectural',
    mimeType: 'application/pdf',
    modifiedTime: '2025-08-10T16:00:00Z',
    summary: 'Architectural submission requirements, 30-day review period, pre-approved Sherwin-Williams paint schemes, solar panel rules, roofing materials (Class A fire rating), and fence height limits.',
    content: `PINECREST HEIGHTS HOMEOWNERS ASSOCIATION
ARCHITECTURAL REVIEW COMMITTEE (ARC) RULES, PROCEDURES & DESIGN GUIDELINES
Revised Edition: August 2025

SECTION 1: SUBMISSION AND APPROVAL PROCESS
1.1 Prior Written Approval Required: No building, fence, wall, patio cover, solar panel array, hardscaping, permanent sports equipment, or exterior paint modification shall be commenced or erected without prior written approval from the ARC.
1.2 Review Timeline: The ARC has thirty (30) calendar days from receipt of a complete application package (including plans, color chips, and contractor license) to render a written decision. If no written decision is transmitted within 30 days, the application is deemed automatically submitted for expedited Board review, not automatically approved.
1.3 ARC Application Fee: Standard architectural applications carry no fee. Major structural additions (e.g., accessory dwelling units or second-story balconies) require a $150 plan check deposit to cover independent architectural/engineering review.

SECTION 2: APPROVED EXTERIOR PAINT SCHEMES
All exterior repainting must use one of the four (4) pre-approved color schemes from the Sherwin-Williams "Desert Modern & Coastal Craftsman" HOA Collection:
- Scheme A (Warm Earth): Body: SW 7511 Bungalow Gold; Trim: SW 7506 Loggia; Accent/Front Door: SW 7593 Harvest Gold or SW 6006 Black Bean.
- Scheme B (Coastal Sand): Body: SW 7036 Accessible Beige; Trim: SW 7038 Tony Taupe; Accent/Front Door: SW 6244 Naval (Deep Navy Blue) or SW 7622 Hamburg Brown.
- Scheme C (Mountain Fog): Body: SW 7015 Repose Gray; Trim: SW 7019 Gauntlet Gray; Accent/Front Door: SW 7674 Peppercorn or SW 2838 Polished Slate.
- Scheme D (Desert Sage): Body: SW 6184 Austere Gray (Soft Sage); Trim: SW 6186 Bonsai Tint; Accent/Front Door: SW 6076 Turkish Coffee.
Note: If repainting the exact existing builder color with no modification, a simple notification form with photo is required, but full review is expedited within 5 business days.

SECTION 3: SOLAR ENERGY SYSTEMS (SOLAR PANELS) & EV CHARGERS
3.1 Solar Panels: Conforming to state solar rights law, solar energy systems are encouraged. Panels must be installed flush against the roofline with minimal visible conduit. Non-reflective black frames and monocrystalline black solar cells are strongly preferred to preserve roof aesthetic balance.
3.2 EV Charging Stations: Level 2 chargers inside resident garages are permitted without prior architectural hearing upon submitting an electrical permit notification. Exterior pedestal chargers in common carports require ARC approval for trenching and conduit painting to match stucco.

SECTION 4: ROOFING, FENCING & LANDSCAPING
4.1 Roofing: Must be Class A fire-rated concrete tile, slate, or architectural dimensional composition shingles (minimum 30-year rating) in charcoal, slate gray, or weathered wood brown. 3-tab flat asphalt shingles are NOT permitted.
4.2 Fencing: Rear and side yard perimeter fences must not exceed six (6) feet in height. Front yard fencing of any kind is strictly prohibited. Approved materials: Natural cedar, redwood with clear sealant, or approved vinyl in Sandstone/White. Chain link wire fencing is prohibited.
4.3 Drought-Tolerant Landscaping: At least 50% of the front yard landscaped area must consist of living plants/drought-tolerant shrubs. Artificial turf of high quality (minimum 70 oz face weight) is permitted with ARC approval.`
  },
  {
    id: 'sample-rules-regs-2025',
    name: 'Pinecrest Heights HOA - Rules & Regulations (Pool, Pets, Parking, Trash & Quiet Hours).pdf',
    category: 'rules',
    mimeType: 'application/pdf',
    modifiedTime: '2025-06-01T12:00:00Z',
    summary: 'Community rules covering pool hours (6 AM - 10 PM), pet limits (maximum 2 dogs/cats under 60 lbs each, leashed at all times), parking regulations (no overnight street parking, garage must park 2 cars), and noise/quiet hours (10 PM - 7 AM).',
    content: `PINECREST HEIGHTS HOMEOWNERS ASSOCIATION
COMMUNITY RULES AND REGULATIONS HANDBOOK
Effective Date: June 1, 2025

SECTION 1: SWIMMING POOL & SPA RULES
1.1 Hours of Operation: The Pool and Spa facility is open daily from 6:00 AM to 10:00 PM. Quiet hours apply from 8:00 PM to 10:00 PM.
1.2 Access & Keys: Keycard/electronic fob access is required. Maximum of four (4) guests per household are permitted and must be accompanied by an adult resident at all times.
1.3 Safety: NO LIFEGUARD ON DUTY. Swim at your own risk. Children under 14 must be supervised by an adult (18+).
1.4 Prohibitions: No glass containers or alcoholic beverages in original glass bottles within the fenced pool enclosure. No pets permitted inside pool gate (except registered service animals). No loud amplified sound systems without headphones.

SECTION 2: PET POLICIES & RESPONSIBILITIES
2.1 Pet Limit: No more than two (2) domesticated dogs or cats (or combination thereof) are permitted per household.
2.2 Weight & Leash Requirement: Dogs must not exceed sixty (60) pounds each (service animals exempted). Dogs must be kept on a handheld leash no longer than six (6) feet whenever on Common Areas.
2.3 Waste Disposal: Pet owners must immediately pick up and hygienically dispose of pet droppings in designated dog waste stations. Failure to clean up pet waste incurs a $50 fine per violation.
2.4 Excessive Barking & Nuisance: Continuous barking or howling exceeding 10 consecutive minutes or intermittent barking for more than 30 minutes is deemed an actionable nuisance subject to violation hearing.

SECTION 3: PARKING & VEHICLE RESTRICTIONS
3.1 Garage Use: Garages must be maintained primarily for vehicle parking and cannot be converted into living quarters or used solely for storage that prevents parking two (2) standard passenger vehicles.
3.2 Overnight Street Parking: Parking on community streets is PROHIBITED between the hours of 2:00 AM and 6:00 AM. Vehicles parked overnight on streets are subject to tow-away at vehicle owner's expense.
3.3 Commercial Vehicles, RVs & Boats: No commercial vehicles exceeding 2.5 tons, trailers, campers, motorhomes, or watercraft may be parked on driveways or streets for more than 48 consecutive hours (solely for loading/unloading).
3.4 Guest Parking: Designated guest parking stalls are restricted to visitors for a maximum of 72 consecutive hours. Residents are prohibited from parking personal vehicles in guest spaces.

SECTION 4: TRASH, RECYCLING & QUIET HOURS
4.1 Trash Bins: Receptacles may be placed at the curb no earlier than 6:00 PM the evening before scheduled collection (Tuesday) and must be returned to screened garage/side yard areas by 9:00 PM on collection day (Wednesday).
4.2 Quiet Hours: Community quiet hours are strictly enforced between 10:00 PM and 7:00 AM on weekdays, and 10:00 PM and 8:00 AM on weekends and federal holidays. Construction, landscaping machinery, or loud music is prohibited during quiet hours.`
  },
  {
    id: 'sample-img-meeting-nov2025',
    name: 'Pinecrest Heights HOA - Board Meeting Handwritten Minutes Photo (Nov 2025 Scan).jpg',
    category: 'minutes',
    mimeType: 'image/jpeg',
    modifiedTime: '2025-11-20T17:00:00Z',
    summary: 'Scanned handwritten and typed photo of November 2025 Executive Board Meeting. Covers clubhouse roof emergency repair vote ($14,200), tree trimming contract approval with ArborCare ($6,500), and speed bump installation review.',
    content: `# PINECREST HEIGHTS HOA - BOARD OF DIRECTORS SPECIAL MEETING
**Scanned Image Record (JPG) - Transcribed via Multimodal AI OCR**
**Date:** November 20, 2025 | **Location:** Clubhouse Meeting Room

## Attendance
- **President:** Sarah Jenkins (Present)
- **Vice President:** Marcus Vance (Present)
- **Treasurer:** David Kim (Present)
- **Secretary:** Elena Rodriguez (Present)
- **Member at Large:** Robert Taylor (Present)
- **Management Agent:** Lisa Miller, Keystone Community Mgmt

## Motions & Board Decisions
1. **Clubhouse Tile Roof Leak Repair (Motion #2025-11-A)**:
   - *Discussion:* Recent heavy rains caused attic moisture near the clubhouse kitchen.
   - *Motion:* Authorize bid from Apex Roofing in the amount of **$14,200** funded from the Reserve Account.
   - *Vote:* Approved unanimously (5-0). Work scheduled for Dec 8-12, 2025.

2. **Annual Tree Trimming & Hazard Mitigation (Motion #2025-11-B)**:
   - *Motion:* Approve contract with ArborCare Specialists for **$6,500** to trim 48 mature pine and eucalyptus trees along Pinecrest Boulevard and near units 14-22.
   - *Vote:* Approved 5-0.

3. **Traffic Calming / Speed Humps on Ridgeview Terrace**:
   - *Discussion:* Resident petitions noted speeding vehicles exceeding 25 mph. Board requested management solicit 3 engineering bids for rubberized removable speed humps before the January meeting.

## Financial Authorization Summary
| Item | Vendor | Approved Amount | Fund Source |
| :--- | :--- | :--- | :--- |
| Clubhouse Roof Leak Repair | Apex Roofing Co. | $14,200.00 | Reserve Fund |
| Tree Trimming (48 trees) | ArborCare Specialists | $6,500.00 | Operating Budget |
| Total Authorized | | **$20,700.00** | |

*Meeting Adjourned: 8:42 PM by President Sarah Jenkins.*`
  },
  {
    id: 'sample-img-financial-q4',
    name: 'Pinecrest Heights HOA - Q4 Financial Snapshot & Balance Sheet Photo.jpg',
    category: 'financials',
    mimeType: 'image/jpeg',
    modifiedTime: '2025-12-31T23:59:00Z',
    summary: 'Audited photographic record of Q4 ending balance sheet and reserve asset verification. Total cash & reserves: $612,450. Accounts receivable delinquency rate: 1.8%.',
    content: `# PINECREST HEIGHTS HOA - Q4 FINANCIAL SNAPSHOT & ASSET LEDGER
**Scanned Photographic Record (JPG) - Indexed via Multimodal Vision AI**
**Period Ended:** December 31, 2025 | **Prepared By:** Pacific CPA HOA Auditing Services

## Balance Sheet Summary

### Current Assets
| Asset Account | Balance as of 12/31/2025 | Notes / Institution |
| :--- | :--- | :--- |
| Operating Checking Account | $48,320.50 | First Republic / Chase Operating |
| Reserve Money Market Account | $314,130.00 | Morgan Stanley Wealth Mgmt (4.6% APY) |
| Reserve Certificates of Deposit (CDs) | $250,000.00 | Laddered CDs (Maturity 2026-2027) |
| Petty Cash & Prepaid Insurance | $4,850.00 | Travelers Property Policy Prepaid |
| **Total Cash & Liquid Assets** | **$617,300.50** | |

### Accounts Receivable & Delinquencies
| Category | Amount | Percentage of Units |
| :--- | :--- | :--- |
| Current (0-30 Days) | $3,900.00 | 1.6% |
| Past Due (31-60 Days) | $1,200.00 | 0.8% |
| Delinquent Over 90 Days (in collections) | $2,450.00 | 2 units under lien notice |
| **Total Accounts Receivable** | **$7,550.00** | Overall Delinquency Rate: 1.8% |

### Reserve Fund Health Status
- **Total Reserve Fund Balance:** $564,130.00
- **Recommended Reserve Balance (Reserve Study):** $719,500.00
- **Percent Funded:** **78.4%** (*Classified as "Healthy / Low Risk of Special Assessment"*)`
  }
];
