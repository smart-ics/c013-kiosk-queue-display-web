import type { JadwalItem, ServiceItem } from '@aq/shared-types'

export type ServiceCatalog = {
  listPoli: () => Promise<ServiceItem[]>
  listDokter: (poliId: string) => Promise<ServiceItem[]>
  listJadwal: (ppaId: string) => Promise<JadwalItem[]>
}

export function createServiceCatalog(queries: {
  getBusinessDate: () => Promise<string>
  listPoli: () => Promise<ServiceItem[]>
  listDokter: (poliId: string) => Promise<ServiceItem[]>
  listJadwal: (businessDate: string, ppaId: string) => Promise<JadwalItem[]>
}): ServiceCatalog {
  return {
    listPoli: async () => queries.listPoli(),
    listDokter: async (poliId) => queries.listDokter(poliId),
    listJadwal: async (ppaId) => queries.listJadwal(await queries.getBusinessDate(), ppaId),
  }
}
