import { type Except } from 'type-fest'

import { type Booking, type BookingID, type BookingProperties } from './booking'
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

  public async get(id: BookingID): Promise<Booking> {
    const booking = this.bookings.find(b => b.id === id)
    if (!booking) {
      throw new Error(`Booking with id ${id} not found`)
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
