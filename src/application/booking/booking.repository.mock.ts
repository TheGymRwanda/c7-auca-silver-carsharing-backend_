import { type IBookingRepository } from './booking.repository.interface'

export type BookingRepositoryMock = jest.Mocked<IBookingRepository>

export function mockBookingRepository(): BookingRepositoryMock {
  return {
    insert: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    findOverlappingBookings: jest.fn(),
    update: jest.fn(),
  }
}
