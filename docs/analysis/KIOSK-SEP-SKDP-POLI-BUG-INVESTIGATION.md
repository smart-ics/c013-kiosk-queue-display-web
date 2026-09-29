---
Title: SEP upload rejected with `Poli BPJS is invalid state` — destination poli not honoured
Code: KIOSK-SEP-SKDP
Artifact: BUG-INVESTIGATION
Version: 1.0
LastUpdated: 2026-09-28
Status: DRAFT
Type: BUG
Issue: KIOSK-SEP-SKDP-ISSUE-DEF-002
NextStage: ARCHITECTURE
---

# Context
Issue: `c013-kiosk-queue-display-web/docs/issues/KIOSK-SEP-SKDP-POLI-ISSUE.md`
(`KIOSK-SEP-SKDP-ISSUE-DEF-002`, Type BUG, Status OPEN).

Problem Summary:

On the walk-in BPJS self-registration path, `GET /api/Sep/rujukan/{noPeserta}/peserta`
returns the active BPJS reference together with its destination poli. The kiosk
discards that destination when building its own reference model, then asks the
patient to choose a layanan from the complete local service catalog without any
constraint derived from the reference. The chosen layanan becomes the destination
of the local registration, and `PATCH /api/Sep/upload` is reported to be rejected
with HTTP 400 `Poli BPJS is invalid state` when it does not agree with the
reference's destination.

This investigation is separate from DEF-001. DEF-001 concerned the `sepDate`
format on `POST /sep` and reached `Status: COMPLETED` on 2026-09-28. Its
IMPLEMENTATION-PLAN explicitly excluded this concern ("do not widen the SEP
policy for other reference-specific fields", TD-005 unchanged). The defect
recorded here is therefore not a regression of DEF-001 and must not reopen it.

# Current State

Observed and verified behaviour of the current kiosk implementation, all in
`c013-kiosk-queue-display-web`.

**The reference response declares a destination.**
- rujukan: `rujukan.tujuan.poliBpjsId` / `poliBpjsName`
  (`packages/shared-types/src/index.ts:555`)
- SKDP: `skdp.poliTujuan.layananId` / `layananName`, plus `skdp.poliPerujuk`
  (`:566-567`)

**The destination is dropped at the kiosk boundary.**
`fetchAndParseBpjsReferences` (`apps/kiosk-web/src/composables/useKioskRegistration.ts:700-736`)
projects the response into `BpjsReference` (`:177-187`). The projection carries
`type`, `id`, `date`, `diagnosaId`, `diagnosaName`, `kelasRawatId`, `tglLahir`,
and `faskesPerujukId`. It carries no destination poli. The destination survives
only inside the untyped `original` bag, which no flow logic reads. `poliBpjsId`
appears in this repository only in schema declarations and test fixtures, never
in production code.

**The destination is already in hand before the selection step is shown.**
This is the decisive ordering fact. In the walk-in BPJS branch,
`fetchAndParseBpjsReferences` is awaited at `:763`, and only afterwards does the
flow transition to `BPJS_SELECT_REFERENCE` or `WALKIN_SELECT_SERVICE` (`:768-777`).
The same ordering holds through the biometric branch (`:780-801`). The
destination is therefore available in memory before the patient reaches the
service step. This is not a case of the information arriving too late.

**The selection step is unconstrained.**
The poli list is obtained from `listPoli()` (`apps/kiosk-web/src/lib/serviceCatalog.ts`)
and rendered from the full result set in `WalkinServiceStep.vue` without
filtering against the selected reference. The reporter confirms the whole local
catalog is offered.

**The selection, unconstrained, becomes the registration destination.**
`registerWalkinCommit` sends `layananId: service.poli.id` (`:1078`), and resolves
and validates karcis against the same `service.poli.id` (`:1060-1067`). No
comparison against the reference's destination poli occurs anywhere on this path.

**No request in the SEP flow carries a destination.**
`sepCreateBodySchema` (`packages/shared-types/src/index.ts:618-645`) has no poli
or layanan attribute, and neither does the payload assembled by
`buildSepPayloadPolicy` (`useKioskRegistration.ts:204-241`).
`sepUploadBodySchema` (`:647-653`) carries only `sepId` and `regId`. The
destination can therefore only reach the service transitively, through the local
registration identified by `regId`.

**Consequence: the destination cannot be checked by the service before upload.**
Because neither request carries a destination, the service has no declared
destination to compare the local registration against at
`POST /Sep`. The earliest point at which it can observe a conflict is the
`PATCH /Sep/upload` call, by which point the patient has completed every
interactive step and the local registration already exists.

**The reported rejection is deterministic but is retried.**
SEP creation is explicitly never retried (TD-006, `useKioskRegistration.ts:929-932`).
SEP upload, by contrast, runs inside `withAttemptLimit` with
`MAX_POST_REGISTRATION_ATTEMPTS = 3` (`:258`, `:943-954`). A destination conflict
is not a transient condition, so a reported upload rejection is re-sent up to
three times before the flow gives up.

**The identifier spaces are not bridged.**
`poliBpjsId` / SKDP `poliTujuan.layananId` and the local `service.poli.id` are
distinct identifier spaces as declared in the shared contracts. No mapping
between them exists in the kiosk client.

# Problem Analysis

**F-01 — The reference is not the authority for the destination.**
`POST /Sep` conveys a reference number, a diagnosis, a class of care and an
appointment purpose, but no destination. The local registration, whose
destination is the kiosk-selected layanan, is consequently the only place the
destination is expressed anywhere in the kiosk-to-service exchange. The two
sources of truth for "where is this patient going" are the BPJS reference and
the local selection, and only the second reaches the service.

**F-02 — The conflict is structurally guaranteed to be undetectable early.**
Given F-01, no kiosk-side check can compare the two, because the kiosk does not
retain the first. Even a validation added at the registration boundary would
have nothing to validate against. This is the reason the mismatch cannot be
caught client-side today, rather than a gap in validation logic.

**F-03 — The destination information is available at the correct time.**
Per the ordering established above, the reference and its destination exist in
memory before the service step is presented. Any correction that requires the
destination at selection time has its input available. This removes what would
otherwise be the most likely reason to defer the correction, and it is the
finding that most directly addresses the reporter's premise.

**F-04 — The selection surface is unbounded with respect to the reference.**
Because the full catalog is offered, the flow permits selecting a destination
that no active reference supports. The reporter's premise — that the step is
unnecessary because the reference already determines the destination — is
consistent with the observed structure. This investigation does not conclude
that the step is unnecessary; it concludes that the step and the reference are
currently unreconciled, and that the reference's destination is discarded
entirely.

**F-05 — A deterministic rejection is treated as a transient one.**
The upload retry policy is inherited from the general post-registration
recovery design and does not distinguish a deterministic contract or state
rejection from a transient transport failure. For the reported condition this
costs three service calls and the attendant delay, and it delays the recovery
notice for the patient.

**F-06 — A root cause is NOT established, and the recorded evidence cuts both
ways.**
`Poli BPJS is invalid state` is a free-text service message; the service is not
known to emit it exclusively on a destination conflict. The reporter has now
supplied both values for the failing case: reference destination `URO` /
`UROLOGI`, selected local layanan `2RJ01`. These are **different identifiers in
different spaces** — `poliBpjsId` belongs to the BPJS reference contract,
`2RJ01` is a local `service.poli.id` registered as the walk-in `layananId`.

That is not yet the same as a destination conflict. It has not been shown what
local layanan `2RJ01` is called, nor whether the local catalog represents
UROLOGI as `2RJ01`. No mapping between the two spaces exists in the kiosk
client, so the identifiers cannot be compared by any available means, and a
repository-wide search for `2RJ01`, `URO` and `UROLOGI` returned no matches, so
the local catalog could not be inspected to resolve it.

The evidence therefore supports two readings, and it does not discriminate
between them:
- If `2RJ01` is not UROLOGI, the destination conflict is demonstrated and F-01
  to F-05 explain the reported rejection.
- If `2RJ01` **is** the local representation of UROLOGI, the kiosk registered to
  the destination its reference called for, the mismatch theory does not hold,
  and the rejection requires an explanation that this investigation has not
  found.

F-01 through F-05 remain valid findings of the implementation regardless of which
reading holds; what is unproven is only their causal connection to this specific
400. This is recorded as OQ-BI-07 and is the single question whose answer
determines whether the reported failure is explained.

**Relationship to DEF-001.** Independent. DEF-001 corrected the `sepDate` format
on `POST /Sep`. The correction now implemented makes that request well-formed
and lets it succeed, which means a request that previously failed at creation now
proceeds far enough to reach upload. It is plausible that this defect was masked
by DEF-001, because the flow never reached the upload call. This is a plausible
account of why the defect surfaced only now, and is not a DEF-001 regression.

# Affected Components

- `apps/kiosk-web` walk-in registration flow — the reference model, the service
  selection step, the walk-in registration commit, and post-registration SEP
  handling.
- `WalkinServiceStep.vue` — the destination selection surface.
- The shared request contracts for SEP creation and SEP upload, which jointly
  express no destination.
- The kiosk-to-service integration for the BPJS reference path, in which the
  destination is not part of the exchanged contract.
- The post-registration recovery path, which is entered after this failure with
  the registration already created.
- The local service catalog, whose coverage of the destination polis a BPJS
  reference can carry is not established.

# Impact Assessment

**Business.** The patient completes the entire interactive flow and reaches the
end believing registration succeeded. The local registration is created and its
`regId` is retained, but the SEP is not produced, so the patient leaves the kiosk
without an SEP document and must complete the matter at the registration desk.
The failure is discovered late, after the effort of the full kiosk flow, which is
the most costly point at which to discover it.

**Operational.** The reported rejection is re-sent up to three times per patient
before recovery, adding avoidable load on the SEP service and delaying the
notice. Where the destination is not represented in the local catalog, staff may
receive patients whose reference cannot be satisfied by any choice offered.

**Technical.** The kiosk retains no record of the destination its reference
declares, so the integration has no basis on which to detect or explain a
destination conflict. Diagnosis from client-side logs alone is not possible;
each occurrence presents to staff as a service-side failure with no indication
of its cause.

# Assumptions

- A-01: the reported 400 occurred on the walk-in path. The booking path was not
  exercised because no booking data was available, and is unverified rather than
  unaffected. It sources its destination from a different place
  (`detail.layanan.layananId`, `useKioskRegistration.ts:1025`).
- A-02: the reporter's account of the selection step — that the full catalog is
  offered — reflects current behaviour. This is consistent with the code read
  during this investigation but was not executed.
- A-03: the reporter holds the reference destination and the selected layanan
  for the failing case. Their transcription into the ISSUE is outstanding.
- A-04: the local service catalog and the BPJS destination polis are maintained
  independently. No evidence to the contrary was found.

# Open Questions

- OQ-BI-01: **RESOLVED.** The failing case's values are recorded in the ISSUE:
  reference destination `URO` / `UROLOGI`, selected local layanan `2RJ01`. See
  F-06 for what this does and does not establish.
- OQ-BI-07: **PIVOTAL, newly raised.** What local layanan is `2RJ01`, and does
  the local catalog represent UROLOGI at all — and if so under which identifier?
  This supersedes OQ-BI-03 as the question that most changes the outcome. Its two
  answers point in opposite directions: either the destination conflict is
  demonstrated and F-01 to F-05 explain the reported rejection, or the kiosk
  registered to the correct destination and the mismatch theory does not hold.
  Not answerable from the repository, which contains no occurrence of any of the
  three values; requires the local service catalog or the reporting party.
- OQ-BI-02: is `Poli BPJS is invalid state` emitted specifically on a
  destination conflict, or for other SEP state conditions? Not answerable from
  client-side evidence; requires the service or its log. Independent of OQ-BI-07
  and answerable in parallel with it.
- OQ-BI-03: does the local service catalog contain an entry corresponding to
  every destination poli a BPJS reference can carry? Retained. If some
  destination cannot be selected, the problem is not only that selection is
  unconstrained but that correct selection may be inexpressible, and the
  correction's shape changes. OQ-BI-07 is a specific instance of it.
- OQ-BI-04: should the destination be part of the SEP request contract itself, or
  should it govern only which destination the kiosk permits? These have
  different consequences for the integration boundary and cannot be decided at
  investigation level.
- OQ-BI-05: is the SKDP path affected on the same terms, given it declares
  `poliTujuan` and `poliPerunjuk` separately? Unexamined in this investigation.
- OQ-BI-06: should a deterministic upload rejection be retried at all, given
  that the retry policy does not presently distinguish it from a transient
  failure?

# Recommended Decision

Make the BPJS reference the authoritative source of the registration's
destination, and reconcile the kiosk destination selection with it. The
investigation recommends that architecture address three coupled concerns
together, because resolving any one of them alone leaves the reported failure
reachable:

1. The relationship between the reference's declared destination and the
   destination the patient actually registers to, expressed as a defined
   constraint rather than two unreconciled sources of truth.
2. The identifier gap between the BPJS destination poli and the local layanan,
   which must be resolved for any such constraint to be expressible.
3. The SEP request contract, whose silence on the destination is what currently
   forces detection to the latest possible point.

Separately, and independently of the above, the post-registration retry policy
should distinguish a deterministic rejection from a transient one.

The expression of the constraint — as a restriction on what the selection step
offers, as destination information carried in the request contract, or as both —
is an architecture decision and is deliberately not selected here.

# Decision
INV-DEC-01 (investigation): The defect is accepted as a real, independently
reportable condition. The reference's destination is discarded at the kiosk
boundary, the selection that determines the registration destination is
unconstrained by the reference, and the exchanged contract carries no
destination, so a conflict can only be detected at the latest possible point and
is then retried as though it were transient. This is recorded as a correction
requiring architecture definition, not as a defect to patch within the existing
SEP policy.

INV-DEC-02 (investigation): DEF-001 is not reopened. The correction now in
place made the SEP creation request well-formed, which allowed the flow to
progress to a stage where this defect became observable. That is the defect
surfacing, not a regression introduced by it.

INV-DEC-03 (investigation): the causal link between the destination mismatch and
the reported service message is **not** asserted, in either direction. The
recorded values (F-06) establish two identifiers in two spaces but do not
establish two different clinical destinations, and one available answer to
OQ-BI-07 would falsify the mismatch theory outright. The investigation records
the implementation findings as valid and the causal claim as open, and names
OQ-BI-07 as the single question that closes it.

INV-DEC-04 (investigation): the identifier-mapping gap is a first-class finding
regardless of how OQ-BI-07 resolves. The codebase already resolves a
cross-identifier relationship at runtime from deployment configuration —
`resolveDefaultKarcisId` matches a local `layananId` against
`AppConfig.mappingJmnLayananKarcis` and `AppConfig.mappingLayananKarcis`, with
explicit and wildcard forms (`useKioskRegistration.ts:146-169`). That is an
existing, proven precedent in this repository for carrying a cross-identifier
mapping in runtime configuration. It is recorded here as evidence that the
mapping gap has a familiar shape, not as a prescription: whether the poli
mapping follows that pattern, belongs in the HIS contract, or is avoided
entirely is a decision for architecture.

# Decision Rationale

**Why the defect is accepted rather than deferred.** The reference is fetched
before the selection step is shown (F-03). The correction therefore does not
require new data acquisition, a new integration, or a new external dependency.
What it requires is a decision the kiosk currently has not made about which
source governs the destination. Deferring leaves a reachable, patient-visible
failure in a flow that has just been corrected and is being brought into
operation.

**Why these three concerns are treated as one decision.** F-02 establishes that
client-side validation alone is not available, because the kiosk does not retain
the reference destination. F-01 establishes that the contract cannot carry it,
because neither SEP request declares a destination. A constraint expressed only
in the selection step would still be unenforceable at the service, and a
destination added to the contract alone would still leave the patient able to
select against it. ID-BI-04 is therefore the pivotal question and must be
answered before the constraint can be specified.

**Why the retry policy is separated.** It is not a dependency of the destination
decision, it is independently defensible, and it holds regardless of how the
destination question is resolved. Folding it into the destination decision
would make the architecture cycle contingent on a question that has not been
answered.

**Alternative considered and rejected — corrective validation only.** Adding a
client-side check at the registration boundary was considered and is not
available: per F-02 there is no retained value to validate against. It becomes
available only as a consequence of one of the accepted concerns, and is therefore
not an independent option.

**Alternative considered and rejected — correcting the message shown to the
patient.** The message is not the defect. The patient is not in a position to
act on "your destination poli does not match" without being told which
destination is correct, which requires the same missing knowledge as the
constraint itself.

**Trade-off.** Constraining the selection reduces patient discretion, and the
correctness of the reduction depends on OQ-BI-03. If the catalog does not cover
the reference's destination, a constrained selection that cannot be satisfied
would be worse than the present state, and that is why OQ-BI-03 is recorded as
capable of changing the shape of the correction rather than as a detail.

# Architecture Applicability

### Decision
ARCHITECTURE-REQUIRED

### Rationale
The correction crosses an integration boundary and changes a shared contract.
The destination is currently absent from the SEP request contracts, and whether
it must be added is a decision about what the kiosk-to-service exchange
declares (OQ-BI-04). A second unresolved decision, the mapping between the BPJS
destination poli and the local layanan (INV-DEC-01, concern 2), has no existing
resolution and no artifact owns it. Both are ownership and boundary questions
rather than implementation choices, and the correction also alters which
selections the patient may make, which changes the flow's behaviour rather than
its implementation.

Note on ownership: this investigation records ARCHITECTURE-REQUIRED as its
recommendation. The Architecture Applicability decision is the Architect's to
confirm.
