import { describe, expect, it, vi } from 'vitest'
import { createServiceCatalog } from '../serviceCatalog'

describe('createServiceCatalog', () => {
  it('passes the active business date to each query', async () => {
    const listPoli = vi.fn(async () => [{ id: 'PO1', name: 'Poli Jantung' }])
    const listDokter = vi.fn(async () => [{ id: 'DP1', name: 'Dr. X' }])
    const listJadwal = vi.fn(async () => [
      { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    ])
    const catalog = createServiceCatalog({
      getBusinessDate: async () => '2026-08-03',
      listPoli,
      listDokter,
      listJadwal,
    })

    expect(await catalog.listPoli()).toHaveLength(1)
    expect(await catalog.listDokter('PO1')).toHaveLength(1)
    expect(await catalog.listJadwal('DP1')).toHaveLength(1)

    expect(listPoli).toHaveBeenCalledWith('2026-08-03')
    expect(listDokter).toHaveBeenCalledWith('2026-08-03', 'PO1')
    expect(listJadwal).toHaveBeenCalledWith('2026-08-03', 'DP1')
  })
})
