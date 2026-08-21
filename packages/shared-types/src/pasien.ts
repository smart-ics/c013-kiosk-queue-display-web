import { z } from 'zod'

export const deepSearchResultSchema = z.object({
  pasienId: z.string(),
  isActive: z.boolean(),
  person: z.object({
    personName: z.string(),
    tglLahir: z.string(),
    gender: z.enum(['L', 'P']),
    alamat: z.object({
      alamat: z.array(z.string()),
      kota: z.string(),
      kodePos: z.string(),
    }),
    contact: z.object({
      jenisContact: z.number(),
      contactDetail: z.string(),
    }),
    identity: z.object({
      jenisId: z.string(),
      nomorId: z.string(),
    }),
  }),
})

export type DeepSearchResult = z.infer<typeof deepSearchResultSchema>
