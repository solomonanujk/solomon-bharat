import { privateSuppliersRepository } from './private-suppliers.repository'
import { AppError } from '@/utils/errors'

class PrivateSuppliersService {
  list() {
    return privateSuppliersRepository.list()
  }

  async findOrCreate(name: string) {
    const trimmed = name.trim()
    if (!trimmed) throw AppError.badRequest('Supplier name is required')
    const existing = await privateSuppliersRepository.findByName(trimmed)
    if (existing) return existing
    return privateSuppliersRepository.create(trimmed)
  }

  async assertExists(id: string) {
    const s = await privateSuppliersRepository.findById(id)
    if (!s) throw AppError.notFound('Private supplier not found')
    return s
  }
}

export const privateSuppliersService = new PrivateSuppliersService()
