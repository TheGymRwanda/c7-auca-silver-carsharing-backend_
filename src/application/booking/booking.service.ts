import { Injectable, Logger } from '@nestjs/common'
import { type Except } from 'type-fest'

import { IDatabaseConnection } from '../../persistence/database-connection.interface'
import { type Transaction } from '../../persistence/database-connection.interface'
import { type CarID, ICarRepository } from '../car'

import {
  Booking,
  type BookingID,
  type BookingProperties,
  BookingState,
  IBookingRepository,
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
      throw new InvalidBookingDatesError(startDate, endDate, 'End date must be after start date')
    }

    if (startDate <= now) {
      throw new InvalidBookingDatesError(startDate, endDate, 'Start date must be in the future')
    }
  }

  private async validateCarAvailability(
    tx: Transaction,
    carId: CarID,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    // Throws CarNotFoundError (domain error) if car doesn't exist
    await this.carRepository.get(tx, carId)

    // Check for overlapping bookings
    const overlappingBookings = await this.bookingRepository.findOverlappingBookings(
      tx,
      carId,
      startDate,
      endDate,
    )

    if (overlappingBookings.length > 0) {
      throw new CarNotAvailableError(carId, startDate, endDate)
    }
  }

  public async create(data: Except<BookingProperties, 'id'>): Promise<Booking> {
    this.logger.log(`Creating booking for car ${data.carId} from ${data.startDate.toISOString()} to ${data.endDate.toISOString()}`)

    return this.databaseConnection.transactional(async tx => {
      // Throws InvalidBookingDatesError (domain error -> 400 in controller)
      this.validateBookingDates(data.startDate, data.endDate)
      
      // Throws CarNotFoundError (domain error -> 404) or CarNotAvailableError (domain error -> 409)
      await this.validateCarAvailability(tx, data.carId, data.startDate, data.endDate)

      // Create booking with PENDING state
      const bookingData = {
        ...data,
        state: BookingState.PENDING,
      }

      const booking = await this.bookingRepository.insert(tx, bookingData)
      
      this.logger.log(`Successfully created booking ${booking.id} for car ${booking.carId}`)
      
      return booking
    })
  }

  public async get(id: BookingID): Promise<Booking> {
    return this.databaseConnection.transactional(async tx => {
      return this.bookingRepository.get(tx, id)
    })
  }

  public async getAll(): Promise<Booking[]> {
    return this.databaseConnection.transactional(async tx => {
      return this.bookingRepository.getAll(tx)
    })
  }
}