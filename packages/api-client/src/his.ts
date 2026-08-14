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
  responseCreateSepUnionSchema,
  responseFingerprintSchema,
  responseSepByNoPesertaSchema,
  responseSepByRegSchema,
  responseUploadSepUnionSchema,
  returnCreateWalkInSchema,
  rujukanSkpdResponseSchema,
  sepCreateBodySchema,
  sepUploadBodySchema,
  serviceItemSchema,
  payloadDirectRegisterRajalWalkInSchema,
  payloadDirectRegisterRajalByBookingSchema,
  payloadSetDataEligibilitySchema,
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
  type ResponseCreateSep,
  type ResponseFingerprint,
  type ResponseSepByNoPeserta,
  type ResponseSepByReg,
  type ResponseUploadSep,
  type ReturnCreateWalkIn,
  type RujukanSkpdResponse,
  type SepCreateBody,
  type SepUploadBody,
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
      return client.getPublicJson('system/business-date', businessDateSchema)
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

    listPoli(): Promise<ServiceItem[]> {
      return client.getJson('layanan', serviceItemsSchema)
    },

    listDokter(poliId: string): Promise<ServiceItem[]> {
      return client.getJson(`ppa/dokter/${encodeURIComponent(poliId)}`, serviceItemsSchema)
    },

    listJadwal(businessDate: string, ppaId: string): Promise<JadwalItem[]> {
      return client.getJson('Dokter/jadwal', jadwalItemsSchema, {
        tglBerobat: businessDate,
        ppaId,
      })
    },

    registerByBookingDirect(body: z.input<typeof payloadDirectRegisterRajalByBookingSchema>): Promise<ReturnCreateWalkIn> {
      const parsed = payloadDirectRegisterRajalByBookingSchema.parse(body)
      return client.postJson('Reg/rajalByBooking/direct', parsed, returnCreateWalkInSchema)
    },

    registerWalkInDirect(body: z.input<typeof payloadDirectRegisterRajalWalkInSchema>): Promise<ReturnCreateWalkIn> {
      const parsed = payloadDirectRegisterRajalWalkInSchema.parse(body)
      return client.postJson('Reg/rajalWalkIn/direct', parsed, returnCreateWalkInSchema)
    },

    setDataEligibility(body: z.input<typeof payloadSetDataEligibilitySchema>): Promise<string> {
      const parsed = payloadSetDataEligibilitySchema.parse(body)
      return client.patchJson('Reg/setDataEligibility', parsed, z.string())
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
        'v1/admisi-rajal/patient-context-search',
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

    getSepByNoPeserta(noPeserta: string): Promise<ResponseSepByNoPeserta> {
      return client.getJson(
        `Sep/peserta/${encodeURIComponent(noPeserta)}`,
        responseSepByNoPesertaSchema,
      )
    },

    getSepByReg(regId: string): Promise<ResponseSepByReg> {
      return client.getJson(`Sep/reg/${encodeURIComponent(regId)}`, responseSepByRegSchema)
    },

    getFingerprintStatus(noPeserta: string): Promise<ResponseFingerprint> {
      return client.getJson(
        `Sep/finger/peserta/${encodeURIComponent(noPeserta)}`,
        responseFingerprintSchema,
      )
    },

    getRujukanSkpd(noPeserta: string): Promise<RujukanSkpdResponse> {
      return client.getJson(
        `Sep/rujukan/${encodeURIComponent(noPeserta)}/peserta`,
        rujukanSkpdResponseSchema,
      )
    },

    createSep(body: SepCreateBody): Promise<ResponseCreateSep> {
      const parsed = sepCreateBodySchema.parse(body)
      return client.postJson('Sep', parsed, responseCreateSepUnionSchema)
    },

    uploadSep(body: SepUploadBody): Promise<ResponseUploadSep> {
      const parsed = sepUploadBodySchema.parse(body)
      return client.patchJson('Sep/upload', parsed, responseUploadSepUnionSchema)
    },
  }
}

export type HisApi = ReturnType<typeof createHisApi>
export type JetliApi = ReturnType<typeof createJetliApi>
