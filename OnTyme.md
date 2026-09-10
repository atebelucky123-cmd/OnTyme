# OnTyme — Complete Architecture & Planning Scope

> **Document status:** Planning / V1 product specification  
> **Purpose:** Define the business model, product architecture, pricing logic, safety system, technical stack, workflows, and roadmap for OnTyme before implementation.

---

## 1. Executive Summary

**OnTyme** is a scheduled private transportation and booking system built around a professional independent driver.

It is **not intended to become an Uber/Bolt clone**.

The core idea is:

> **The driver provides the service. OnTyme provides the infrastructure that makes the service easier to book, price, manage, monitor, and grow.**

OnTyme should help the driver:

- receive planned bookings instead of relying entirely on random ride-hailing demand;
- give customers an estimated fare before they submit a booking;
- manage one-way, round-trip, and waiting/return journeys;
- verify and record bookings;
- improve passenger and driver safety through layered procedures;
- retain customer history;
- develop recurring/private customers;
- track daily revenue, expenses, and net earnings;
- eventually reduce dependence on third-party ride-hailing platforms.

The initial market is Lagos, with a focus on Mainland ↔ Island and other Lagos trips.

---

# 2. Business Context

## 2.1 Current driver situation

The driver:

- is an experienced professional driver;
- owns a 2005 Toyota Corolla;
- has previously used Bolt, Uber, and inDrive;
- currently uses inDrive for some demand;
- already has approximately five private customers;
- drives across Lagos, including Mainland ↔ Island;
- typically works long and variable hours;
- can earn approximately ₦40,000 gross/day in some periods, but fuel can consume approximately ₦30,000 on a good working day;
- has recurring vehicle maintenance costs;
- wants approximately **₦40,000/day after expenses** as a comfortable target.

These figures are planning inputs, not permanent assumptions. The system should make them configurable.

---

# 3. Core Business Objective

OnTyme should move the driver's business from:

**Random demand → trip → payment → repeat**

toward:

**Customer acquisition → verified customer → scheduled booking → reliable service → customer history → repeat/recurring booking**

The long-term goal is not necessarily to eliminate app-based driving.

Instead:

### Short term
Continue using available ride-hailing platforms for additional demand.

### Medium term
Increase direct/private bookings.

### Long term
Build a stable customer base that books directly through OnTyme.

---

# 4. Product Positioning

## 4.1 Core promise

**Safe. Scheduled. Reliable.**

Potential positioning:

> **Pre-planned transportation for people who value reliability.**

The product should emphasize:

- scheduled transportation;
- reliability;
- transparent estimates;
- professional service;
- safety procedures;
- direct customer relationships.

It should NOT claim:

- that every trip is guaranteed;
- that the system can detect kidnappers;
- that the driver is an executive chauffeur unless the service genuinely supports that positioning;
- that OnTyme provides absolute safety.

Safety is a **risk-reduction system**, not a guarantee.

---

# 5. Service Model

## 5.1 V1 services

### Scheduled one-way trip

Customer:

A → B

Customer chooses a date and pickup time.

---

### Scheduled round trip

Customer:

A → B → A

The system calculates both legs and includes the return journey in the estimate.

---

### Wait & return

Customer:

A → B → wait → C/A

This should account for:

- outbound journey;
- waiting period;
- return journey;
- additional destination/route if applicable.

Waiting beyond the included free period is chargeable.

---

### Airport transfer

A specialized booking category for:

- airport → destination;
- destination → airport.

Airport bookings should be scheduled in advance.

---

### Recurring booking

Future feature / high-priority after V1.

Examples:

- Monday–Friday commute;
- weekly appointments;
- recurring school/work transportation;
- recurring airport trips.

---

# 6. Explicit V1 Constraints

The current service rules are:

- maximum passengers: **4**;
- medium luggage is acceptable;
- child transport is currently not offered;
- early-morning trips are allowed;
- early-morning trips must be booked the day before;
- overnight trips are not offered;
- interstate trips are not offered;
- first 5 minutes of waiting are free;
- waiting after 5 minutes is chargeable;
- there is currently no fixed waiting-time maximum;
- unexpected passenger changes/stops must not silently become part of a booking;
- the driver may refuse/cancel a booking if he feels unsafe.

These should be configurable rather than hard-coded.

---

# 7. Customer Booking Flow

## 7.1 Customer journey

1. Customer opens OnTyme.
2. Selects **Request a Ride**.
3. Selects trip type.
4. Enters pickup location.
5. Enters destination.
6. Selects date.
7. Selects pickup time.
8. Selects passenger count.
9. Selects luggage information.
10. System calculates route.
11. System calculates estimated fare range.
12. Customer sees:
    - estimated distance;
    - estimated duration;
    - estimated fare range;
    - important booking conditions.
13. Customer submits booking request.
14. OnTyme generates a booking reference.
15. Driver reviews the request.
16. If necessary, driver contacts customer.
17. Driver accepts/rejects.
18. Customer receives confirmation.
19. Trip takes place.
20. Booking is completed.
21. Customer can book again.

---

# 8. Request vs Instant Booking

V1 should use:

> **Request a Ride**

rather than:

> **Book Now**

The booking is not automatically guaranteed.

Reasons:

- driver availability must be confirmed;
- unusual trips may require human review;
- safety screening may be necessary;
- pricing may require confirmation;
- the driver may already have another commitment.

The system therefore operates as:

**Request → Review → Confirm**

rather than:

**Click → Instant dispatch**

---

# 9. Booking Data Model

Each booking should store at minimum:

```text
Booking ID
Customer ID
Customer name
Customer phone
Pickup location
Destination
Trip type
Date
Pickup time
Passenger count
Luggage category
Estimated distance
Estimated duration
Estimated fare range
Final agreed fare
Waiting requirement
Additional stops
Booking status
Driver notes
Safety/risk flags
Created timestamp
Confirmed timestamp
Started timestamp
Completed timestamp
Cancelled timestamp
Cancellation reason
```

Sensitive information should only be stored when necessary.

---

# 10. Booking Statuses

Recommended state machine:

```text
DRAFT
  ↓
REQUESTED
  ↓
UNDER_REVIEW
  ↓
CONFIRMED
  ↓
DRIVER_EN_ROUTE
  ↓
PASSENGER_PICKED_UP
  ↓
IN_PROGRESS
  ↓
COMPLETED
```

Alternative branches:

```text
REQUESTED → DECLINED
REQUESTED → CANCELLED
CONFIRMED → CANCELLED
CONFIRMED → NO_SHOW
```

---

# 11. Booking ID

Every booking should receive a unique identifier.

Example:

```text
OT-260903-041
```

The Booking ID should be visible to both driver and customer.

It helps:

- match the correct customer;
- reference a trip;
- prevent confusion;
- maintain records;
- support safety procedures.

---

# 12. Pricing Engine

## 12.1 Pricing philosophy

The pricing system should imitate the **customer experience** of major ride-hailing platforms without blindly copying their pricing formulas.

Customer sees:

> **Estimated fare: ₦X – ₦Y**

The final fare is confirmed by the driver.

---

# 13. Pricing Inputs

The pricing engine should eventually consider:

```text
Base fare
+
Distance charge
+
Time charge
+
Traffic/time adjustment
+
Waiting charge
+
Tolls/parking
+
Special trip adjustment
+
Return/round-trip component
-
Any applicable discount
```

Subject to:

```text
Minimum acceptable fare
```

The exact coefficients are NOT yet finalized.

---

# 14. Google Routes Integration

The planned route engine is **Google Maps Platform Routes API / Compute Routes**.

The system should request:

- route distance;
- estimated travel duration;
- traffic-aware duration where available.

Conceptual architecture:

```text
Customer Browser
      ↓
OnTyme Backend
      ↓
Google Routes API
      ↓
Distance + Duration
      ↓
OnTyme Pricing Engine
      ↓
Estimated Fare Range
```

The Google API key should never be exposed directly in public frontend code.

The backend should control:

- API usage;
- quotas;
- validation;
- pricing calculations.

---

# 15. Fare Range

OnTyme should not initially promise a precise final fare.

Example:

```text
Estimated distance: 18.4 km
Estimated journey: 52–65 min

Estimated fare:
₦10,000 – ₦13,000

Final fare will be confirmed after review.
```

The range provides transparency while allowing for:

- traffic;
- route variation;
- tolls;
- unusual pickup conditions;
- waiting;
- driver-specific business rules.

---

# 16. Round-Trip Pricing

Round trips should eventually be automated.

Example:

```text
Outbound:
A → B

Waiting:
30 minutes

Return:
B → A
```

The system calculates:

```text
Outbound route cost
+
Waiting charge
+
Return route component
=
Estimated round-trip fare
```

The final amount is still confirmed by the driver.

---

# 17. Deadhead / Return-Home Logic

Important business observation:

The driver does not automatically return home empty.

After dropping a passenger, he may:

1. open the ride-hailing app;
2. set his destination toward home;
3. accept another passenger going that direction.

Therefore OnTyme should NOT automatically charge every customer for a theoretical empty return.

Instead:

### One-way
Customer pays for the booked journey.

### Round trip
Customer explicitly requires the driver to return, so the return leg is priced.

### Future optimization
OnTyme may eventually use driver's destination/availability information to optimize repositioning, but this should NOT be part of V1.

---

# 18. Daily Earnings Target

The driver's current comfortable target is approximately:

> **₦40,000 net/day after expenses**

This should be treated as a configurable business target.

A useful future dashboard:

```text
TODAY

Gross revenue:        ₦XX,XXX
Fuel estimate:        ₦XX,XXX
Other expenses:       ₦X,XXX
Estimated net:        ₦XX,XXX

Daily target:         ₦40,000
Target remaining:     ₦XX,XXX
```

This turns OnTyme into a business-management tool rather than only a booking site.

---

# 19. Expense Tracking

Future driver dashboard should allow:

- fuel expense;
- parking;
- tolls;
- car wash;
- maintenance;
- miscellaneous trip expenses.

Daily/weekly/monthly summaries can show:

```text
Revenue
− Expenses
= Estimated Net
```

This will eventually help determine whether OnTyme bookings are genuinely more profitable than platform rides.

---

# 20. Safety Architecture

Safety should follow four principles:

> **Verify → Record → Monitor → Escalate**

No automated system can guarantee that a passenger is safe or dangerous.

The objective is to reduce preventable risk and make it easier to react when something feels wrong.

---

# 21. Customer Verification

For first-time customers:

Collect only necessary information:

- full name;
- phone number;
- pickup;
- destination;
- date/time;
- passenger count;
- trip type.

Possible V1 verification:

### Level 1 — New customer

Booking request + phone/WhatsApp confirmation.

### Level 2 — Verified customer

Successfully completed at least one trip.

### Level 3 — Trusted customer

Multiple successful trips without issues.

### Review

Booking contains unusual characteristics and requires additional review.

---

# 22. First-Time Customer Policy

First-time bookings should preferably be:

> **Request → manual review → confirmation**

The driver can call or message the customer using normal WhatsApp/phone.

This does NOT require the WhatsApp Business API.

That is important because V1 should avoid dependence on Meta developer verification.

---

# 23. No Unexpected Stops

One of the driver's existing concerns is when a passenger says during a trip:

> "We will pick someone up here."

This should become an explicit OnTyme rule.

### Booking rule

Additional stops or destination changes must be:

1. requested by the customer;
2. recorded;
3. approved by the driver;
4. repriced if necessary.

The customer should not be able to silently change the nature of the trip.

---

# 24. Safety Risk Flags

Bookings can be flagged for review based on factors such as:

- very late/early time;
- unusual remote pickup;
- unusual destination;
- last-minute booking;
- first-time customer;
- inconsistent customer information;
- multiple unplanned stops;
- unusual route change;
- customer refusing normal confirmation;
- behavior that makes the driver uncomfortable.

A risk flag is NOT a kidnapping detector.

It simply means:

> **Pause and review before proceeding.**

---

# 25. High-Risk Areas / Times

Current driver-reported concerns include:

- Mushin at night;
- Ajah at night;
- Alagbole/Ajute at night.

These should NOT automatically mean:

> "Never accept trips here."

Instead:

```text
High-risk condition detected
        ↓
Additional review
        ↓
Driver decides
        ↓
Accept / decline
```

The driver retains final authority.

---

# 26. Family Monitoring

The driver already has:

- a family member who knows where he is;
- a Samsung A05s capable of live location sharing;
- a vehicle tracker that can be activated through SMS.

OnTyme should work **with these existing controls**, not attempt to replace them.

V1 can provide a simple trip information protocol:

```text
Booking ID
Customer
Pickup
Destination
Expected start
Expected completion
```

This information can be shared with the trusted family contact when appropriate.

---

# 27. Driver Check-In

Future V1/V1.5 feature:

When a trip begins:

> **Start Trip**

At expected completion:

> **Complete Trip**

If a trip goes substantially beyond its expected duration, OnTyme can prompt:

> **Trip appears delayed. Are you okay?**

Possible responses:

- I'm okay;
- Traffic/delay;
- Extend trip;
- I need assistance.

Important:

A delay should NOT automatically trigger an emergency response because Lagos traffic can be unpredictable.

---

# 28. Emergency Escalation

A future driver dashboard may contain:

### I'm uncomfortable
Creates a discreet internal alert.

### Need assistance
Notifies the predefined trusted contact.

### Emergency
Displays/initiates the driver's predetermined emergency procedure.

The system should not automatically contact law enforcement based solely on an algorithmic timer.

The emergency protocol must be designed around verified local emergency resources and the family's actual preferences.

---

# 29. Driver Safety Authority

A foundational OnTyme rule:

> **The driver can refuse or cancel a trip when he believes continuing would be unsafe.**

No rating, customer pressure, or automated system should override this.

---

# 30. Customer Safety / Trust

OnTyme should also protect legitimate customers.

Customers should know:

- who they are booking with;
- what vehicle/service they are booking;
- approximate fare before submitting;
- when the booking is confirmed;
- their Booking ID;
- what to expect during the trip;
- how waiting and extra stops work.

---

# 31. Privacy

Do not publicly display:

- driver's home address;
- personal home location;
- personal schedule;
- private customer information;
- customer booking history;
- family information.

The website should reveal only what customers need to book and trust the service.

---

# 32. Technology Architecture

Recommended V1 architecture:

```text
                    ┌───────────────────┐
                    │   Customer Web    │
                    │   App / Browser   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  OnTyme Backend   │
                    │                   │
                    │ Auth              │
                    │ Booking Logic     │
                    │ Pricing Engine    │
                    │ Safety Logic      │
                    │ Customer Records  │
                    └───────┬───────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌─────────────┐
       │ Database   │ │ Google     │ │ Notification│
       │            │ │ Routes API │ │ Services    │
       └────────────┘ └────────────┘ └─────────────┘
              │
              ▼
       ┌────────────────┐
       │ Driver/Admin   │
       │ Dashboard      │
       └────────────────┘
```

---

# 33. Suggested Technical Stack

The exact stack can change, but a sensible implementation is:

### Frontend

- Next.js / React
- TypeScript
- responsive design
- mobile-first booking interface

### Backend

- Next.js server routes or separate Node.js backend
- TypeScript

### Database

- PostgreSQL
- Supabase is a practical V1 option

### Maps / Routing

- Google Maps Platform Routes API

### Authentication

V1 can be simple.

Customer:

- phone number;
- verification;
- booking details.

Driver/admin:

- secure authenticated account.

### Deployment

- Vercel or equivalent
- managed PostgreSQL/Supabase

### Development

- GitHub
- AI-assisted coding using tools such as Claude/ChatGPT/Cursor

---

# 34. Why V1 Should Stay Simple

Do NOT build:

- real-time driver marketplace;
- multi-driver dispatch;
- complex driver matching;
- wallet;
- loyalty points;
- full native mobile apps;
- complicated AI safety detection;
- automated police/emergency dispatch;
- custom payment infrastructure;
- WhatsApp API dependency.

The first objective is to prove:

> **Can one professional driver successfully use OnTyme to receive and manage direct scheduled bookings?**

If yes, expand.

---

# 35. V1 Feature List

## Customer

- landing page;
- service information;
- request a ride;
- route input;
- date/time selection;
- passenger/luggage selection;
- trip type;
- fare estimate;
- booking request;
- Booking ID;
- booking confirmation;
- cancellation/contact process.

## Driver

- secure dashboard;
- pending bookings;
- booking details;
- accept/decline;
- customer information;
- route information;
- estimated fare;
- final fare;
- trip status;
- notes;
- completed trips;
- revenue tracking.

## Admin/business

- pricing configuration;
- service configuration;
- customer database;
- booking database;
- safety flags;
- expense records;
- daily earnings.

---

# 36. Customer Database

Each customer should have:

```text
Customer ID
Name
Phone
Email (optional)
First booking
Last booking
Completed trips
Cancelled trips
Trust status
Notes
```

Avoid collecting unnecessary personal information.

---

# 37. Customer Trust Levels

Recommended:

```text
NEW
↓
VERIFIED
↓
RETURNING
↓
TRUSTED
```

This allows the booking process to become easier for people who repeatedly use the service.

Example:

A first-time customer might require manual confirmation.

A customer who has completed 20 successful bookings may have a much faster process.

---

# 38. Recurring Customers

This is potentially one of the most valuable OnTyme features.

Instead of constantly acquiring new customers, OnTyme should eventually encourage:

> **"Book this trip again."**

Examples:

- Work commute;
- weekly appointment;
- airport transfer;
- regular Mainland ↔ Island trip.

Recurring customers can provide predictable demand.

---

# 39. Payments

V1 should not require online payment unless there is a clear business reason.

Possible initial model:

```text
Booking request
→ fare confirmation
→ customer pays using agreed method
→ trip completed
```

If online payments are later introduced, use a reputable payment provider rather than storing card/payment credentials directly.

---

# 40. Notifications

V1 can operate without sophisticated messaging integrations.

Possible channels:

- website confirmation;
- email;
- normal phone call;
- normal WhatsApp;
- WhatsApp Business quick replies.

Future:

- automated SMS;
- WhatsApp Business API;
- push notifications.

---

# 41. WhatsApp Strategy

Do not make OnTyme dependent on the Meta WhatsApp API for V1.

The system can simply generate a message for the driver/customer.

Example:

```text
Hello [Customer Name],

Your OnTyme booking request is:

Booking ID: OT-XXXXXX
Pickup: [location]
Destination: [location]
Date: [date]
Time: [time]
Estimated fare: ₦X–₦Y

Your booking is awaiting confirmation.
```

The driver can send this through normal WhatsApp.

---

# 42. Driver Dashboard

Recommended home screen:

```text
GOOD MORNING

Today's bookings: 4

Upcoming:
09:00 — Yaba → Victoria Island
12:30 — Ikeja → Lekki
17:00 — Lekki → Yaba

Today's earnings:
₦XX,XXX

Expenses:
₦XX,XXX

Estimated net:
₦XX,XXX

Daily target:
₦40,000 net
```

---

# 43. Pricing Configuration Dashboard

Dad should NOT need to edit code to change prices.

Eventually:

```text
Base fare:                 ₦____
Per km:                    ₦____
Per minute:                ₦____
Minimum fare:              ₦____
Free waiting:              5 min
Waiting rate:              ₦____
Round-trip adjustment:     ____%
Airport adjustment:        ₦____
```

All values should be configurable.

---

# 44. Pricing Calibration

Before finalizing the pricing formula, collect real trip data.

Target:

**10–20 real historical trips initially.**

For each:

```text
Origin
Destination
Actual fare
Approx distance
Approx time
Fuel consumed/estimated
One-way/round-trip
Waiting
Tolls/parking
Whether driver considered it worthwhile
```

Then compare:

```text
Actual historical fare
vs.
OnTyme calculated fare
```

Adjust until the model produces reasonable results.

---

# 45. Pricing Testing

Test at least:

### Short
Short Lagos trip.

### Medium
Medium-distance Mainland/Island trip.

### Long
Long Lagos trip.

### Heavy traffic
Same route at a high-traffic period.

### Round trip
A → B → A.

### Waiting
A → B + waiting + return.

### Airport
Airport transfer.

### Early morning
Scheduled early trip.

### Unusual destination
A route where the driver may need to reposition.

The pricing engine should never be considered finished after only one test.

---

# 46. Analytics

Important metrics:

## Business

- bookings requested;
- bookings accepted;
- bookings completed;
- cancellation rate;
- average booking value;
- revenue/day;
- net/day;
- repeat customer rate.

## Pricing

- estimated fare;
- final fare;
- estimate difference;
- average distance;
- average trip duration.

## Customer

- new customers;
- returning customers;
- trusted customers;
- recurring bookings.

## Safety

- flagged bookings;
- declined bookings;
- unexpected route changes;
- cancelled safety concerns;
- incidents.

---

# 47. Success Metrics for V1

The first success criteria should NOT be:

> "How many users signed up?"

Instead:

### Metric 1
Can Dad successfully receive a real booking?

### Metric 2
Can the system calculate a reasonable estimate?

### Metric 3
Can Dad confirm the booking without confusion?

### Metric 4
Can a customer book again?

### Metric 5
Does OnTyme save Dad time?

### Metric 6
Does it generate direct/private revenue?

### Metric 7
Does it improve record keeping and safety?

---

# 48. Development Roadmap

## Phase 0 — Discovery

- interview Dad;
- collect pricing information;
- collect real trip examples;
- define service rules;
- define safety procedures;
- define customer experience.

---

## Phase 1 — Prototype

Build:

- landing page;
- booking form;
- basic route calculation;
- basic estimated fare;
- booking request storage.

Goal:

> Submit a booking and have Dad receive it.

---

## Phase 2 — Driver Dashboard

Add:

- login;
- pending requests;
- booking details;
- accept/decline;
- status changes;
- customer records.

---

## Phase 3 — Pricing Engine

Add:

- distance;
- time;
- minimum fare;
- waiting;
- round trips;
- configurable pricing.

Calibrate using real trips.

---

## Phase 4 — Safety

Add:

- customer verification;
- Booking IDs;
- safety flags;
- trip status;
- driver check-in;
- emergency workflow;
- family notification procedure.

---

## Phase 5 — Business Management

Add:

- revenue;
- expenses;
- net earnings;
- daily target;
- customer history;
- repeat booking.

---

## Phase 6 — Growth

Potential features:

- recurring bookings;
- customer accounts;
- automated notifications;
- online payments;
- reviews;
- referral system;
- multiple drivers;
- corporate accounts.

Only build these after V1 proves demand.

---

# 49. Future Multi-Driver Architecture

If OnTyme eventually expands beyond Dad, the architecture can evolve:

```text
Customer
   ↓
Booking
   ↓
Dispatch Engine
   ↓
Available Drivers
   ↓
Driver Assignment
   ↓
Trip
```

But this is deliberately **out of V1 scope**.

The first driver is the pilot.

If the model works for him, it can later become a platform for other independent drivers.

---

# 50. Business Expansion Possibility

Potential future customers:

- professionals;
- frequent Mainland ↔ Island commuters;
- airport travelers;
- small businesses;
- corporate clients;
- families requiring scheduled transport;
- customers who value predictable service.

The strongest opportunity may be **recurring scheduled transportation**, rather than competing with ride-hailing apps for every random trip.

---

# 51. Security Architecture

Technical security should include:

- HTTPS;
- secure authentication;
- server-side API keys;
- database access controls;
- input validation;
- rate limiting;
- audit logs;
- minimal personal-data collection;
- backups;
- secure environment variables;
- protected driver/admin routes.

Never put private API keys in frontend JavaScript.

---

# 52. Operational Security

Technical security is not enough.

Operational rules matter:

1. First-time customers are reviewed.
2. Booking information is recorded.
3. Unexpected stops require approval.
4. Driver can refuse unsafe trips.
5. Family/trusted contact can receive trip information.
6. Vehicle tracker remains available.
7. Live location can be used.
8. Unusual trips receive additional scrutiny.
9. Personal home information stays private.
10. Emergency procedures are predefined.

---

# 53. V1 Out of Scope

The following should NOT delay launch:

- AI passenger risk prediction;
- facial recognition;
- identity-document collection;
- live multi-driver maps;
- sophisticated surge pricing;
- native iOS/Android apps;
- corporate invoicing;
- loyalty program;
- automated WhatsApp API;
- complex payment wallets;
- machine-learning safety detection.

These can be considered later if the business proves itself.

---

# 54. Core Design Principle

Every feature should answer at least one of these questions:

### Does it help Dad earn more?

### Does it save Dad time?

### Does it make the service safer?

### Does it make the customer more likely to return?

### Does it make the business easier to manage?

If a feature does none of these, it probably does not belong in V1.

---

# 55. Final Product Vision

OnTyme should eventually become:

> **A lightweight operating system for a professional independent driver.**

Not merely:

> "a website where people request rides."

It should connect:

```text
CUSTOMER
   ↓
BOOKING
   ↓
ROUTE
   ↓
PRICE
   ↓
SAFETY
   ↓
TRIP
   ↓
PAYMENT
   ↓
RECORD
   ↓
REPEAT CUSTOMER
```

And for Dad:

```text
TRIPS
   ↓
REVENUE
   ↓
EXPENSES
   ↓
NET INCOME
   ↓
DAILY TARGET
   ↓
BUSINESS DECISIONS
```

---

# 56. Questions Still to Ask Dad

These questions should be answered before the pricing engine and operational rules are considered final.

## Pricing

### 1. Waiting rate
After the first 5 free minutes, exactly how much should the customer pay?

Examples to discuss:

- ₦X per minute;
- ₦X per 15 minutes;
- ₦X per 30 minutes.

### 2. Minimum fare
What is the absolute minimum amount he would accept for a normal one-way trip?

He previously gave:

- Short: approximately ₦3,000
- Medium: approximately ₦7,000
- Long: approximately ₦13,000–₦15,000

Confirm whether these are still his preferred minimums.

### 3. Net target
Is **₦40,000 net/day** his actual target, or simply the amount he considers comfortable?

Ask:

> "If you make ₦35k net one day and ₦45k another day, is that okay, or do you want OnTyme to actively target ₦40k every day?"

### 4. Fuel economics
Ask:

> "Approximately how many kilometres or hours of driving does ₦30,000 of fuel normally give you?"

This is extremely useful for calibration.

### 5. Fuel price
Record the current fuel price he normally pays and how frequently it changes.

### 6. Air-conditioning
Does his normal fuel consumption change significantly when the AC is running?

### 7. Traffic
Does he believe long traffic delays should increase the fare, or should the distance-based price mostly cover them?

### 8. Tolls and parking
Should customers pay tolls and parking separately, or should they be included in the fare?

---

## Round Trips

### 9. Round-trip definition
How does he distinguish between:

- simple round trip;
- waiting and return;
- staying with a customer for several hours?

### 10. Maximum practical waiting
He said there is no formal maximum.

Ask:

> "Even if there is no hard limit, at what point would you personally want the system to require special approval?"

### 11. Long waiting
Would he prefer:

- per-minute pricing;
- blocks of time;
- hourly rate;
- negotiated pricing above a certain duration?

### 12. Round-trip discount
Would he ever give a customer a discount for booking the return leg?

---

## Service Rules

### 13. Advance booking
How much notice does he prefer for normal bookings?

For example:

- 1 hour;
- 3 hours;
- same day;
- day before.

### 14. Early morning
What is the earliest trip time he is willing to accept?

### 15. Late-night
What is the latest pickup time he is comfortable accepting?

### 16. Cancellation
When can a customer cancel for free?

### 17. No-show
What happens if Dad arrives and the customer does not show?

### 18. Passenger changes
What happens if the customer books for 2 people and arrives with 5?

### 19. Luggage
What exactly does "medium luggage" mean in practical terms?

### 20. Additional stops
Should extra stops always require a new fare calculation?

---

## Safety

### 21. First-time customer
Is he comfortable confirming every first-time customer by phone?

### 22. Customer information
What information does he genuinely need before accepting a new passenger?

### 23. Suspicious customer
What specific behaviours make him uncomfortable?

Get concrete examples.

### 24. High-risk trips
Which combinations of:

- location;
- time;
- booking notice;
- passenger behaviour

would make him decline immediately?

### 25. Family contact
Who should receive trip information when he wants someone monitoring the trip?

### 26. Check-in
How often would he realistically be willing to check in during a trip?

### 27. Emergency
If he feels genuinely threatened, what is his preferred sequence of actions?

This should be decided **before** building an emergency feature.

---

## Customer Experience

### 28. Payment
Does he prefer:

- cash;
- bank transfer;
- POS;
- online payment;
- a mixture?

### 29. Customer communication
Does he prefer communicating through:

- WhatsApp;
- normal calls;
- SMS;
- email?

### 30. Receipts
Does he want customers to receive a digital trip receipt?

### 31. Repeat booking
Would he like a customer to be able to click:

> **Book this trip again**

after completing a journey?

---

## Business

### 32. Private customers
Ask him to list the types of trips his existing five private customers usually book.

### 33. Best customers
Which customers/trips does he enjoy most?

### 34. Worst customers
Which types of trips cause the most stress or least profit?

### 35. Most profitable routes
What routes does he believe consistently make good money?

### 36. Least profitable routes
What routes are usually not worth it?

### 37. Preferred working hours
If he could choose his ideal working schedule rather than simply maximize driving hours, what would it be?

### 38. Monthly target
Instead of only ₦40k/day, what monthly net income would make him feel financially comfortable?

### 39. Business growth
Would he eventually want OnTyme to generate enough private bookings that he can reduce app-based driving?

### 40. Other drivers
If OnTyme works for him, would he ever be comfortable allowing other trusted drivers onto the platform?

---

# 57. Immediate Next Steps

Do NOT start by building every feature.

Recommended order:

```text
1. Finish Dad interview
        ↓
2. Collect 10–20 historical trips
        ↓
3. Design pricing model
        ↓
4. Build booking prototype
        ↓
5. Connect route API
        ↓
6. Test fare estimates
        ↓
7. Build driver dashboard
        ↓
8. Add safety workflow
        ↓
9. Pilot with the existing private customers
        ↓
10. Measure results
        ↓
11. Improve
```

**The existing five private customers should be the first OnTyme beta users.**

That lets the product be tested in the real world before trying to acquire strangers.

---

# 58. Definition of Done for OnTyme V1

V1 is successful when Dad can:

1. receive a scheduled booking request;
2. see the complete trip information;
3. see a calculated estimated fare range;
4. accept or decline the booking;
5. communicate with the customer;
6. generate/use a Booking ID;
7. follow the safety procedure;
8. mark the trip as completed;
9. record the final fare;
10. see his revenue;
11. record major expenses;
12. see his estimated net income;
13. have the customer book again.

If these work reliably, **OnTyme V1 is ready for real use.**

---

# 59. Guiding Principle

Build the smallest system that can make the driver's existing business **safer, more organized, more profitable, and less dependent on third-party platforms**.

Then let real bookings tell us what to build next.
