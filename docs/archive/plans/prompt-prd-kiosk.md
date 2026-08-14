Act as a Principal AI Product Manager and Systems Architect specializing in healthcare IT and autonomous AI agent systems. 

Your goal is to convert the provided simple Kiosk SOP into a detailed, production-ready Product Requirement Document (PRD) tailored for an **Agentic AI Kiosk System**.

### Context & Vision
Unlike traditional step-by-step kiosk software, this kiosk operates using **Agentic AI**—meaning the system possesses context awareness, autonomous decision-making capabilities, proactive error-handling, local hardware trigger capabilities, and natural interaction handling (voice/touch/scan).

---

### Input SOP:
1. **Check-in / Pasien Booking**
   - Independent patient registration via booking code (manual typing or QR scan).
   - Confirmation of booking details.
   - Payer/Insurance validation:
     - BPJS: Perform biometric verification. Triggers a local hardware service to launch the BPJS biometric popup.
     - Non-BPJS: Skip biometric verification.
   - Registration completion & ticket/data printing.

2. **Go-Show (Walk-in Registration)**
   - Independent patient registration without a prior booking.
   - Search patient by: KTP (ID Card), Medical Record (MR) number, BPJS participant number, or Referral number.
   - Display search results & patient selection.
   - Service/Clinic selection.
   - Doctor selection.
   - Data confirmation.
   - Registration completion & printing.

3. **Failed Registration Handling**
   - If any step in Flow 1 or Flow 2 fails (e.g., system timeout, identity mismatch, BPJS server down, hardware failure):
     - Trigger fallback API endpoint for exception handling.
     - Automatically redirect to manual counter queue generation.
     - Print manual registration queue ticket.

4. **Manual Queue Ticket Pickup**
   - Display available Service Points.
   - User selects a target Service Point.
   - Display assigned queue ticket number on screen.
   - Print queue ticket.

---

### Output Requirements:
Please structure the PRD using the following comprehensive layout:

1. **Product Overview & High-Level Architecture**
   - System Vision & Goals.
   - Core AI Agents & Roles (e.g., *Greeting & Intent Agent*, *Identity & Biometric Agent*, *Integration & Fallback Agent*).

2. **User Personas & Primary Use Cases**
   - Primary user profiles (e.g., tech-savvy patients, elderly patients, patients with invalid BPJS data).

3. **Detailed Functional Requirements & Agentic Workflows**
   - **Flow 1: Booking Check-in** (Detailed state machine, triggers, local service integrations for BPJS biometric IPC/hardware calls).
   - **Flow 2: Go-Show Registration** (Patient lookup logic, search fallback rules, schedule & doctor availability mapping).
   - **Flow 3: Exception & Autonomous Fallback** (Error handling rules, failure detection mechanisms, automated rerouting to manual queue).
   - **Flow 4: Direct Manual Queue Request** (Service point selection logic).

4. **Agentic System Behaviors & Autonomy Rules**
   - Intent recognition & multimodal input handling (QR, Voice, Screen Touch, OCR for ID Cards).
   - Autonomous retry limits and threshold triggers before escalating to Flow 3.
   - Proactive UI/UX prompts (e.g., handling hesitant users or scan timeouts).

5. **Hardware & Integration Specifications**
   - Local Bridge / Local Service API specs (Printer integration, Biometric scanner trigger, Camera/Scanner).
   - External HIS / BPJS VClaim / Antrean Faskes API integrations.

6. **Non-Functional Requirements**
   - Latency, Security & HIPAA/Data Privacy compliance, Offline capability/Failover resilience, Accessibility (Voice guidance, large text).

7. **Success Metrics & Edge Cases Matrix**
   - Key KPIs (e.g., average check-in speed, drop-off rate, fallback rate).
   - Edge case handling table (e.g., BPJS server down, fingerprint scan fails 3x, printer out of paper).

Please produce the PRD in clear, professional English (or Indonesian, maintaining technical precision).