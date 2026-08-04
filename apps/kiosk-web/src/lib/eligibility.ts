import type { BookingDetail, GroupJaminanMap, Polis } from '@aq/shared-types'

export const UMAT_TIPE_JAMINAN_ID = '00000'

export type JaminanStatus = {
  tipeJaminanId: string
  tipeJaminanName: string
  noPeserta: string | null
}

const UMAT: JaminanStatus = {
  tipeJaminanId: UMAT_TIPE_JAMINAN_ID,
  tipeJaminanName: 'Umum',
  noPeserta: null,
}

export function computeNeedsEligibility(
  tipeJaminanId: string,
  groupJaminan: Pick<GroupJaminanMap, 'groupJaminanId'> | null,
): boolean {
  return tipeJaminanId !== UMAT_TIPE_JAMINAN_ID && groupJaminan !== null
}

export function deriveBookingJaminan(detail: BookingDetail, polisList: Polis[]): JaminanStatus {
  const noPeserta = detail.coverageInfo.noPeserta
  if (!noPeserta) return UMAT
  const match = polisList.find((p) => p.noPolis === noPeserta || p.polisId === noPeserta)
  if (!match) return UMAT
  return {
    tipeJaminanId: match.tipeJaminan.tipeJaminanId,
    tipeJaminanName: match.tipeJaminan.tipeJaminanName,
    noPeserta,
  }
}

export function deriveWalkinJaminan(polisList: Polis[]): JaminanStatus {
  const first = polisList[0]
  if (!first) return UMAT
  return {
    tipeJaminanId: first.tipeJaminan.tipeJaminanId,
    tipeJaminanName: first.tipeJaminan.tipeJaminanName,
    noPeserta: first.noPolis,
  }
}
