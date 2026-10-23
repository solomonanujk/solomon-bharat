import { PrismaClient, PrivateSupplier } from '@prisma/client'
import { prisma } from '../../config/prisma'

class PrivateSuppliersRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  list(): Promise<PrivateSupplier[]> {
    return this.db.privateSupplier.findMany({ orderBy: { name: 'asc' } })
  }

  findById(id: string): Promise<PrivateSupplier | null> {
    return this.db.privateSupplier.findUnique({ where: { id } })
  }

  findByName(name: string): Promise<PrivateSupplier | null> {
    return this.db.privateSupplier.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })
  }

  create(name: string): Promise<PrivateSupplier> {
    return this.db.privateSupplier.create({ data: { name: name.trim() } })
  }
}

export const privateSuppliersRepository = new PrivateSuppliersRepository()
