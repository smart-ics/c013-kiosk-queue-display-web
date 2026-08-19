# Canonical Domain Knowledge: Kiosk-Web client

`kiosk-web` is a Vue 3 + TypeScript web client designed for hospital self-registration kiosk terminals. It connects to the HIS API (`bilregApi`) and BPJS/VClaim helper proxy (`jetliApi`) to allow patients to register for polyclinics, verify eligibility, and print registration or assistance tickets.

---

## 1. Registration Modes & Entry Points

### 1.1 Booking Flow (Search-First)
* **Trigger:** Patient inputs NIK, Medical Record (MR), or Kode Booking (from MJKN/QR code) on the Kiosk Home screen.
* **Backend Call:** `GET /api/Booking/search/{tglBerobat}/{keyword}` where `tglBerobat` is fetched from the HIS active business date.
* **Outcome:** If exactly 1 matching booking is found:
  * **Strict BPJS Check:** If the booking is BPJS-guaranteed (contains a participant number/`noPeserta`), the patient must have a matching BPJS policy in their hospital records (`polisList`). If no policy matching `"bpjs"` or `"jkn"` (case-insensitive) is found, the flow is blocked and redirects to the manual admission desk (`FAILURE` with code `BPJS_VALIDATION_FAILED`).
  * **Else:** Transitions directly to `BOOKING_CONFIRM`.

### 1.2 Walk-In / Go-Show Flow (Fallback)
* **Trigger:** No booking matches the keyword.
* **Cascade Fallback:** Kiosk automatically triggers a patient context lookup: `POST /api/v1/admisi-rajal/patient-context-search`.
* **Outcome:** If a patient record is found, the patient confirms their identity (`PATIENT_CONTEXT_CONFIRM`) and moves into the Walk-In setup.

---

## 2. Dynamic 5-Step Stepper Wizard

The kiosk client displays a 5-step progress stepper:
1. **Identifikasi**
2. **Jaminan**
3. **Layanan**
4. **Konfirmasi**
5. **Selesai**

Because Booking patients have pre-scheduled services, their stepper highlights differ from Walk-In patients:

| Step | Booking Mode Mappings | Walk-In Mode Mappings |
|---|---|---|
| **1. Identifikasi** | **Active:** `BOOKING_SEARCH`<br/>**Completed:** `BOOKING_CONFIRM`, `BIOMETRIC_VERIFY`, `REGISTRATION_SUCCESS` | **Active:** `PATIENT_CONTEXT_SEARCH`, `PATIENT_CONTEXT_CONFIRM`<br/>**Completed:** `WALKIN_SELECT_GUARANTEE`, `BIOMETRIC_VERIFY`, `WALKIN_SELECT_SERVICE`, `WALKIN_CONFIRM`, `REGISTRATION_SUCCESS` |
| **2. Jaminan** | **Active:** *Never* (Skipped)<br/>**Completed:** `BOOKING_CONFIRM` onwards | **Active:** `WALKIN_SELECT_GUARANTEE`, `BIOMETRIC_VERIFY`<br/>**Completed:** `WALKIN_SELECT_SERVICE` onwards |
| **3. Layanan** | **Active:** *Never* (Skipped)<br/>**Completed:** `BOOKING_CONFIRM` onwards | **Active:** `WALKIN_SELECT_SERVICE`<br/>**Completed:** `WALKIN_CONFIRM` onwards |
| **4. Konfirmasi** | **Active:** `BOOKING_CONFIRM`, `BIOMETRIC_VERIFY`<br/>**Completed:** `REGISTRATION_SUCCESS` | **Active:** `WALKIN_CONFIRM`<br/>**Completed:** `REGISTRATION_SUCCESS` |
| **5. Selesai** | **Active:** `REGISTRATION_SUCCESS`, `ASSISTANCE_QUEUE` | **Active:** `REGISTRATION_SUCCESS`, `ASSISTANCE_QUEUE` |

---

## 3. BPJS & Biometric Fingerprint Policies

### 3.1 Verification Order
* **Booking Flow (Late Biometrics):** Biometric verification and BPJS rujukan/SKDP verification are performed **late**, during the final confirmation step (`BOOKING_CONFIRM` -> `BIOMETRIC_VERIFY` -> `REGISTRATION_SUCCESS`).
* **Walk-In Flow (Early Biometrics):** To prevent patients wasting time selecting polyclinics, doctors, and schedules, biometric and rujukan/SKDP checks are performed **early**, immediately after choosing the guarantee (`WALKIN_SELECT_GUARANTEE` -> `BIOMETRIC_VERIFY` -> `WALKIN_SELECT_SERVICE`).

### 3.2 Age Exemption
* If the patient is **under 17 years old**, biometric fingerprint verification is automatically skipped for both flows.

### 3.3 Missing BPJS Policy Redirection
* **Walk-In Guarantee Step:** The policy selection screen filters active policies to only show entries matching `"bpjs"` or `"jkn"` (case-insensitive).
* **BPJS Kesehatan Fallback Option:** If the patient lacks a registered BPJS policy, a fallback button **"BPJS Kesehatan"** is displayed. Selecting it redirects the patient to manual admission with the message:
  > *“Data kartu BPJS Anda belum terdaftar di rumah sakit ini. Silakan menuju Loket Pendaftaran untuk pendaftaran pertama kali.”*

---

## 4. State Machine Transition Rules

Defined in `flow.ts`:
```typescript
export const FLOW_TRANSITIONS = {
  HOME: ['BOOKING_SEARCH', 'BOOKING_CONFIRM', 'PATIENT_CONTEXT_SEARCH', 'PATIENT_CONTEXT_CONFIRM', 'FAILURE'],
  BOOKING_SEARCH: ['BOOKING_CONFIRM', 'PATIENT_CONTEXT_SEARCH', 'PATIENT_CONTEXT_CONFIRM', 'FAILURE'],
  BOOKING_CONFIRM: ['BIOMETRIC_VERIFY', 'REGISTRATION_SUCCESS', 'FAILURE'],
  PATIENT_CONTEXT_SEARCH: ['PATIENT_CONTEXT_CONFIRM', 'FAILURE'],
  PATIENT_CONTEXT_CONFIRM: ['WALKIN_SELECT_GUARANTEE', 'FAILURE', 'HOME'],
  WALKIN_SELECT_GUARANTEE: ['WALKIN_SELECT_SERVICE', 'BIOMETRIC_VERIFY', 'FAILURE', 'HOME'],
  BIOMETRIC_VERIFY: ['REGISTRATION_SUCCESS', 'WALKIN_SELECT_SERVICE', 'FAILURE'],
  WALKIN_SELECT_SERVICE: ['WALKIN_CONFIRM', 'FAILURE'],
  WALKIN_CONFIRM: ['BIOMETRIC_VERIFY', 'REGISTRATION_SUCCESS', 'FAILURE'],
  REGISTRATION_SUCCESS: ['HOME'],
  FAILURE: ['ASSISTANCE_QUEUE'],
  ASSISTANCE_QUEUE: ['HOME'],
}
```

---

## 5. Hardware & Fallback Integrations

### 5.1 Local Printing/Biometric App Interface
* Interfaced using HTTP requests to localhost daemon services (`Local Biometric/Print Service`).
* Receipt printing issues (network down, paper jam) transition the client into the manual assistance queue.

### 5.2 Auto-Reset Idle Session Timer
* **Idle State:** Kiosk automatically resets to `HOME` after **60 seconds** of inactivity.
* **Success/Assistance State:** Kiosk resets to `HOME` after **10 seconds** on `REGISTRATION_SUCCESS` and **15 seconds** on `ASSISTANCE_QUEUE`.
* **State Purge:** Auto-reset clears all local reactive states (`selectedBooking`, `selectedPatient`, `walkinEligibility`, `biometricVerdict`, `errorContext`) to protect patient privacy.
