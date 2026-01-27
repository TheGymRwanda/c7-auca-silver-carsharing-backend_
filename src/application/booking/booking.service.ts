import { Injectable, Logger } from '@nestjs/common'
import { type Except } from 'type-fest'

import { IDatabaseConnection } from '../../persistence/database-connection.interface'
import { type Transaction } from '../../persistence/database-connection.interface'
import { type CarID, ICarRepository } from '../car'
import { type UserID } from '../user'

import {
  Booking,
  type BookingID,
  type BookingProperties,
  BookingState,
  IBookingRepository,
  BookingAccessDeniedError,
  CarNotAvailableError,
  InvalidBookingDatesError,
} from './index'
import { type IBookingService } from './booking.service.interface'

@Injectable()
export class BookingService implements IBookingService {
  private readonly bookingRepository: IBookingRepository
  private readonly carRepository: ICarRepository
  private readonly databaseConnection: IDatabaseConnection
  private readonly logger: Logger

  public constructor(
    bookingRepository: IBookingRepository,
    carRepository: ICarRepository,
    databaseConnection: IDatabaseConnection,
  ) {
    this.bookingRepository = bookingRepository
    this.carRepository = carRepository
    this.databaseConnection = databaseConnection
    this.logger = new Logger(BookingService.name)
  }

  private validateBookingDates(startDate: Date, endDate: Date): void {
    const now = new Date()

    if (startDate >= endDate) {
      throw new InvalidBookingDatesError(
        startDate,
        endDate,
        'End date must be after start date',
      )
    }

    if (startDate <= now) {
      throw new InvalidBookingDatesError(
        startDate,
        endDate,
        'Start date must be in the future',
      )
    }
  }

  private async validateCarAvailability(
    tx: Transaction,
    carId: CarID,
    startDate: Date,
    endDate: Date,
    excludeBookingId?: BookingID,
  ): Promise<void> {
    await this.carRepository.get(tx, carId)

    const overlappingBookings =
      await this.bookingRepository.findOverlappingBookings(
        tx,
        carId,
        startDate,
        endDate,
        excludeBookingId,
      )

    if (overlappingBookings.length > 0) {
      throw new CarNotAvailableError(carId, startDate, endDate)
    }
  }

  public async create(data: Except<BookingProperties, 'id'>): Promise<Booking> {
    this.logger.log(
      `Creating booking for car ${data.carId} from ${data.startDate.toISOString()} to ${data.endDate.toISOString()}`,
    )

    return this.databaseConnection.transactional(async tx => {
      this.validateBookingDates(data.startDate, data.endDate)

      await this.validateCarAvailability(
        tx,
        data.carId,
        data.startDate,
        data.endDate,
      )

      const bookingData = {
        ...data,
        state: BookingState.PENDING,
      }

      const booking = await this.bookingRepository.insert(tx, bookingData)

      this.logger.log(
        `Successfully created booking ${booking.id} for car ${booking.carId}`,
      )

      return booking
    })
  }

  public async get(id: BookingID, userId: UserID): Promise<Booking> {
    return this.databaseConnection.transactional(async tx => {
      const booking = await this.bookingRepository.get(tx, id)

      const car = await this.carRepository.get(tx, booking.carId)

      const isRenter = booking.renterId === userId
      const isOwner = car.ownerId === userId

      if (!isRenter && !isOwner) {
        throw new BookingAccessDeniedError(id)
      }

      return booking
    })
  }

  public async getAll(): Promise<Booking[]> {
    return this.databaseConnection.transactional(async tx => {
      return this.bookingRepository.getAll(tx)
    })
  }

  public async update(
    id: BookingID,
    updates: Partial<Except<BookingProperties, 'id' | 'carId' | 'renterId'>>,
    userId: UserID,
  ): Promise<Booking> {
    return this.databaseConnection.transactional(async tx => {
      const booking = await this.bookingRepository.get(tx, id)
      const car = await this.carRepository.get(tx, booking.carId)

      const isRenter = booking.renterId === userId
      const isOwner = car.ownerId === userId

      if (!isRenter && !isOwner) {
        throw new BookingAccessDeniedError(id)
      }

      if (updates.startDate || updates.endDate) {
        const startDate = updates.startDate || booking.startDate
        const endDate = updates.endDate || booking.endDate

        this.validateBookingDates(startDate, endDate)
        await this.validateCarAvailability(
          tx,
          booking.carId,
          startDate,
          endDate,
          id,
        )
      }

      const updatedBooking = new Booking({
        ...booking,
        ...updates,
        id,
      })

      return this.bookingRepository.update(tx, updatedBooking)
    })
  }
}
