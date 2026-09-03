import { z } from 'zod'
import {
  admissionQueueIntakeResponseSchema,
  bookingAssistanceBodySchema,
  bookingDetailSchema,
  bookingSearchItemSchema,
  businessDateSchema,
  groupJaminanMapSchema,
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
  payloadDirectRegisterRajalWalkInSchema,
  payloadDirectRegisterRajalByBookingSchema,
  payloadSetDataEligibilitySchema,
  registrationPrintDataSchema,
  type AdmissionQueueIntakeResponse,
  type BookingAssistanceBody,
  type BookingDetail,
  type BookingSearchItem,
  type BusinessDate,
  type GroupJaminanMap,
  type JadwalItem,
  type KarcisItem,
  type PasienSearchItem,
  type PatientContextSearchResponse,
  type Polis,
  type RegistrationPrintData,
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
  deepSearchResultSchema,
  type DeepSearchResult,
} from '@aq/shared-types'
import type { AdmissionQueueClient } from './http'

const bookingSearchArraySchema = z.array(bookingSearchItemSchema)
const polisArraySchema = z.array(polisSchema)
const pasienArraySchema = z.array(pasienSearchItemSchema)
const nullableGroupJaminanSchema = groupJaminanMapSchema.nullable()
const regGetResponseSchema = z.object({
  regId: z.string(),
  noAntrian: z.number(),
  pasien: z.object({
    pasienId: z.string(),
    pasienName: z.string(),
    tglLahir: z.string(),
  }),
  tipeJaminan: z.object({
    tipeJaminanId: z.string(),
    tipeJaminanName: z.string(),
  }),
  sjpNo: z.string(),
  layanan: z.object({
    layananId: z.string(),
    layananName: z.string(),
  }),
  dokter: z.object({
    ppaId: z.string(),
    ppaName: z.string(),
  }),
})

/**
 * HIS registration endpoints. Service-catalog paths and /direct payloads are
 * assumed shapes (ADR-006 / ADR-002 open items) — confirm against the HIS API.
 */
export function createHisApi(client: AdmissionQueueClient) {
  return {
    getBusinessDate(): Promise<BusinessDate> {
      return client.getPublicJson('system/business-date', businessDateSchema)
    },

    getRegistrationPrintData(regId: string): Promise<RegistrationPrintData> {
      return client
        .getJson(`Reg/${encodeURIComponent(regId)}`, regGetResponseSchema)
        .then((data) =>
          registrationPrintDataSchema.parse({
            regId: data.regId,
            noAntrian: data.noAntrian,
            pasienName: data.pasien.pasienName,
            pasienId: data.pasien.pasienId,
            tglLahir: data.pasien.tglLahir,
            tipeJaminanName: data.tipeJaminan.tipeJaminanName,
            noSep: data.sjpNo || undefined,
            serviceName: data.layanan.layananName,
            dokterName: data.dokter.ppaName,
          }),
        )
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
      return client
        .getJson(
          'Layanan/2/list',
          z.array(
            z.object({
              layananId: z.string(),
              layananName: z.string(),
              isAktif: z.boolean(),
              instalasiId: z.string(),
              instalasiName: z.string(),
              poliBpjsId: z.string().nullable().optional(),
              poliBpjsName: z.string().nullable().optional(),
            }),
          ),
        )
        .then((list) =>
          list
            .filter((item) => item.isAktif)
            .map((item) => ({ id: item.layananId, name: item.layananName })),
        )
    },

    listDokter(poliId: string): Promise<ServiceItem[]> {
      return client
        .getJson(
          `JadwalPraktek/layanan/${encodeURIComponent(poliId)}`,
          z.array(
            z.object({
              dokterId: z.string(),
              dokterName: z.string(),
              layananId: z.string(),
              layananName: z.string(),
              ruangId: z.string(),
              ruangName: z.string(),
              listHari: z.array(
                z.object({
                  jadwalPraktekId: z.string(),
                  hari: z.string(),
                  jamMulai: z.string(),
                  jamSelesai: z.string(),
                  maxPasien: z.number(),
                }),
              ),
            }),
          ),
        )
        .then((list) => {
          const dayIndex = new Date().getDay()
          const ENGLISH_DAYS = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
          ]
          const todayName = ENGLISH_DAYS[dayIndex].toLowerCase()

          return list.map((item) => {
            const isPraktekHariIni = item.listHari.some(
              (h) => h.hari.trim().toLowerCase() === todayName,
            )
            return {
              id: item.dokterId,
              name: item.dokterName,
              isPraktekHariIni,
            }
          })
        })
    },

    listJadwal(businessDate: string, ppaId: string): Promise<JadwalItem[]> {
      return client
        .postJson(
          'PraktekDokter/dokter',
          {
            tglYmdAwal: businessDate,
            tglYmdAkhir: businessDate,
            dokterId: ppaId,
          },
          z.array(
            z.object({
              tanggal: z.string(),
              dokter: z.object({
                ppaId: z.string(),
                ppaName: z.string(),
                isDefault: z.boolean().nullable().optional(),
              }),
              layanan: z.object({
                layananId: z.string(),
                layananName: z.string(),
              }),
              jamMulaiPraktek: z.string(),
              jamSelesaiPraktek: z.string(),
              jumlahPasien: z.number(),
              maxPasien: z.number(),
            }),
          ),
        )
        .then((list) =>
          list.map((item) => ({
            jadwalId: `${item.dokter.ppaId}-${item.tanggal}-${item.jamMulaiPraktek}`,
            ppaId: item.dokter.ppaId,
            jamPraktek: `${item.jamMulaiPraktek} - ${item.jamSelesaiPraktek}`,
            sisaKuota: Math.max(0, item.maxPasien - item.jumlahPasien),
          })),
        )
    },

    listKarcis(layananId: string): Promise<KarcisItem[]> {
      return client
        .getJson(
          `Karcis/${encodeURIComponent(layananId)}/list`,
          z.array(
            z.object({
              karcisId: z.string(),
              karcisName: z.string(),
              layanan: z.object({ layananId: z.string(), layananName: z.string() }).optional(),
              defaultTarif: z.object({ tarifId: z.string(), tarifName: z.string() }).optional(),
              nilai: z.number().optional(),
            }),
          ),
        )
        .then((list) => list.map((item) => ({ id: item.karcisId, name: item.karcisName })))
    },

    registerByBookingDirect(
      body: z.input<typeof payloadDirectRegisterRajalByBookingSchema>,
    ): Promise<ReturnCreateWalkIn> {
      const parsed = payloadDirectRegisterRajalByBookingSchema.parse(body)
      return client.postJson('Reg/rajalByBooking/direct', parsed, returnCreateWalkInSchema)
    },

    registerWalkInDirect(
      body: z.input<typeof payloadDirectRegisterRajalWalkInSchema>,
    ): Promise<ReturnCreateWalkIn> {
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

    deepSearchPasien(keyword: string): Promise<DeepSearchResult[]> {
      return client.getJson(
        `pasien/search/${encodeURIComponent(keyword)}`,
        z.array(deepSearchResultSchema),
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
