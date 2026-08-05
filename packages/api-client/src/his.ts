import { z } from 'zod'
import {
  admissionQueueIntakeResponseSchema,
  bookingAssistanceBodySchema,
  bookingDetailSchema,
  bookingSearchItemSchema,
  businessDateSchema,
  groupJaminanMapSchema,
  jadwalItemSchema,
  pasienSearchItemSchema,
  patientContextSearchRequestSchema,
  patientContextSearchResponseSchema,
  polisSchema,
  returnCreateWalkInSchema,
  serviceItemSchema,
  type AdmissionQueueIntakeResponse,
  type BookingAssistanceBody,
  type BookingDetail,
  type BookingSearchItem,
  type BusinessDate,
  type GroupJaminanMap,
  type JadwalItem,
  type PasienSearchItem,
  type PatientContextSearchResponse,
  type Polis,
  type ReturnCreateWalkIn,
  type ServiceItem,
} from '@aq/shared-types'
import type { AdmissionQueueClient } from './http'

const bookingSearchArraySchema = z.array(bookingSearchItemSchema)
const polisArraySchema = z.array(polisSchema)
const pasienArraySchema = z.array(pasienSearchItemSchema)
const serviceItemsSchema = z.array(serviceItemSchema)
const jadwalItemsSchema = z.array(jadwalItemSchema)
const nullableGroupJaminanSchema = groupJaminanMapSchema.nullable()

/**
 * HIS registration endpoints. Service-catalog paths and /direct payloads are
 * assumed shapes (ADR-006 / ADR-002 open items) — confirm against the HIS API.
 */
export function createHisApi(client: AdmissionQueueClient) {
  return {
    getBusinessDate(): Promise<BusinessDate> {
      return client.getJson('system/business-date', businessDateSchema)
    },

    searchBooking(tglBerobat: string, keyword: string): Promise<BookingSearchItem[]> {
      return client.getJson(
        `Booking/search/${encodeURIComponent(tglBerobat)}/${encodeURIComponent(keyword)}`,
        bookingSearchArraySchema,
      )
    },

    getBookingDetail(bookingId: string): Promise<BookingDetail> {
      return client.getJson(`Booking/${encodeURIComponent(bookingId)}`, bookingDetailSchema)
    },

    listPolis(pasienId: string): Promise<Polis[]> {
      return client.getJson(`polis/list/${encodeURIComponent(pasienId)}`, polisArraySchema)
    },

    searchPasien(keyword: string): Promise<PasienSearchItem[]> {
      return client.getJson(`Pasien/search/${encodeURIComponent(keyword)}`, pasienArraySchema)
    },

    listPoli(businessDate: string): Promise<ServiceItem[]> {
      return client.getJson('Poli', serviceItemsSchema, { tglBerobat: businessDate })
    },

    listDokter(businessDate: string, poliId: string): Promise<ServiceItem[]> {
      return client.getJson('Poli/dokter', serviceItemsSchema, {
        tglBerobat: businessDate,
        poliId,
      })
    },

    listJadwal(businessDate: string, ppaId: string): Promise<JadwalItem[]> {
      return client.getJson('Dokter/jadwal', jadwalItemsSchema, {
        tglBerobat: businessDate,
        ppaId,
      })
    },

    registerByBookingDirect(body: Record<string, unknown>): Promise<ReturnCreateWalkIn> {
      return client.postJson('Reg/rajalByBooking/direct', body, returnCreateWalkInSchema)
    },

    registerWalkInDirect(body: Record<string, unknown>): Promise<ReturnCreateWalkIn> {
      return client.postJson('Reg/rajalWalkIn/direct', body, returnCreateWalkInSchema)
    },

    bookingAssistance(body: BookingAssistanceBody): Promise<AdmissionQueueIntakeResponse> {
      const parsed = bookingAssistanceBodySchema.parse(body)
      return client.postJson(
        'v1/admission-queue/booking-assistance',
        parsed,
        admissionQueueIntakeResponseSchema,
      )
    },

    patientContextSearch(
      body: z.input<typeof patientContextSearchRequestSchema>,
    ): Promise<PatientContextSearchResponse> {
      const parsed = patientContextSearchRequestSchema.parse(body)
      return client.postJson(
        'api/v1/admisi-rajal/patient-context-search',
        parsed,
        patientContextSearchResponseSchema,
      )
    },
  }
}

export function createJetliApi(client: AdmissionQueueClient) {
  return {
    getGroupJaminanMap(tipeJaminanId: string): Promise<GroupJaminanMap | null> {
      return client.getJson('grupJaminan/map', nullableGroupJaminanSchema, { tipeJaminanId })
    },
  }
}

export type HisApi = ReturnType<typeof createHisApi>
export type JetliApi = ReturnType<typeof createJetliApi>
