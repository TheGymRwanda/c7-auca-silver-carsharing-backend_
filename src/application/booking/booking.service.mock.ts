import { type Except } from 'type-fest'

import { type UserID } from '../user'

import { type Booking, type BookingID, type BookingProperties } from './booking'
import { BookingAccessDeniedError } from './booking-access-denied.error'
import { BookingBuilder } from './booking.builder'
import { type IBookingService } from './booking.service.interface'

export class BookingServiceMock implements IBookingService {
  private bookings: Booking[] = []
  private nextId = 1

  public async create(data: Except<BookingProperties, 'id'>): Promise<Booking> {
    const booking = new BookingBuilder()
      .withId(this.nextId++ as BookingID)
      .withCarId(data.carId)
      .withRenterId(data.renterId)
      .withState(data.state)
      .withStartDate(data.startDate)
      .withEndDate(data.endDate)
      .build()

    this.bookings.push(booking)
    return booking
  }

  public async get(id: BookingID, userId: UserID): Promise<Booking> {
    const booking = this.bookings.find(b => b.id === id)
    if (!booking) {
      throw new Error(`Booking with id ${id} not found`)
    }

    if (booking.renterId !== userId) {
      throw new BookingAccessDeniedError(id)
    }

    return booking
  }

  public async getAll(): Promise<Booking[]> {
    return [...this.bookings]
  }

  public reset(): void {
    this.bookings = []
    this.nextId = 1
  }
}
