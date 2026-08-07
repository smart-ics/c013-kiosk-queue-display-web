import type { JadwalItem, ServiceItem } from '@aq/shared-types'

export type ServiceCatalog = {
  listPoli: () => Promise<ServiceItem[]>
  listDokter: (poliId: string) => Promise<ServiceItem[]>
  listJadwal: (ppaId: string) => Promise<JadwalItem[]>
}

export function createServiceCatalog(queries: {
  getBusinessDate: () => Promise<string>
  listPoli: (businessDate: string) => Promise<ServiceItem[]>
  listDokter: (businessDate: string, poliId: string) => Promise<ServiceItem[]>
  listJadwal: (businessDate: string, ppaId: string) => Promise<JadwalItem[]>
}): ServiceCatalog {
  return {
    listPoli: async () => queries.listPoli(await queries.getBusinessDate()),
    listDokter: async (poliId) => queries.listDokter(await queries.getBusinessDate(), poliId),
    listJadwal: async (ppaId) => queries.listJadwal(await queries.getBusinessDate(), ppaId),
  }
}
