import { type Except } from 'type-fest'

import { type Transaction } from '../../persistence/database-connection.interface'
import { type CarID } from '../car'

import { type Booking, type BookingID, type BookingProperties } from './booking'
import { BookingBuilder } from './booking.builder'
import { type IBookingRepository } from './booking.repository.interface'

export class BookingRepositoryMock implements IBookingRepository {
  private bookings: Booking[] = []
  private nextId = 1

  public async insert(
    tx: Transaction,
    data: Except<BookingProperties, 'id'>,
  ): Promise<Booking> {
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

  public async get(tx: Transaction, id: BookingID): Promise<Booking> {
    const booking = this.bookings.find(b => b.id === id)
    if (!booking) {
      throw new Error(`Booking with id ${id} not found`)
    }
    return booking
  }

  public async getAll(tx: Transaction): Promise<Booking[]> {
    return [...this.bookings]
  }

  public async findOverlappingBookings(
    tx: Transaction,
    carId: CarID,
    startDate: Date,
    endDate: Date,
    excludeBookingId?: BookingID,
  ): Promise<Booking[]> {
    return this.bookings.filter(booking => {
      if (booking.id === excludeBookingId) return false
      if (booking.carId !== carId) return false
      if (booking.state === 'CANCELED') return false

      return startDate < booking.endDate && booking.startDate < endDate
    })
  }

  public async update(tx: Transaction, booking: Booking): Promise<Booking> {
    const index = this.bookings.findIndex(b => b.id === booking.id)
    if (index === -1) {
      throw new Error(`Booking with id ${booking.id} not found`)
    }
    this.bookings[index] = booking
    return booking
  }

  public reset(): void {
    this.bookings = []
    this.nextId = 1
  }

  public addBooking(booking: Booking): void {
    this.bookings.push(booking)
  }
}
