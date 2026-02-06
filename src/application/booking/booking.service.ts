import { Injectable, Logger } from '@nestjs/common'
import { type Except } from 'type-fest'

import { IDatabaseConnection } from '../../persistence/database-connection.interface'
import { type Transaction } from '../../persistence/database-connection.interface'
import { type CarID, type Car, ICarRepository } from '../car'
import { type UserID } from '../user'

import { type IBookingService } from './booking.service.interface'
import { UserBookingRole } from './user-booking-role'

import {
  Booking,
  type BookingID,
  type BookingProperties,
  BookingState,
  IBookingRepository,
  BookingAccessDeniedError,
  CarNotAvailableError,
  InvalidBookingDatesError,
  BookingStateTransitionValidator,
} from './index'

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

  /**
   * Validates that the specified car is available for the given date range.
   *
   * This check is used during both booking creation and updates:
   * - On create: Ensures the car is not already booked during the requested timeframe
   * - On update: Allows the renter to modify dates without conflicting with the current booking
   *   (via excludeBookingId parameter)
   *
   * @note Future enhancement: Consider validating that a user (renter) doesn't have
   *       overlapping bookings with different cars during the same time period.
   *
   * @param tx - Database transaction
   * @param carId - ID of the car to validate
   * @param startDate - Booking start date
   * @param endDate - Booking end date
   * @param excludeBookingId - Optional booking ID to exclude from overlap check (used during updates)
   * @throws CarNotAvailableError if the car has overlapping bookings
   */
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

  /**
   * Verifies that the given user has access to the specified booking.
   * A user can access a booking if they are either:
   * - The renter (person who made the booking), OR
   * - The car owner (person who owns the car being booked)
   *
   * @param booking - The booking to check access for
   * @param car - The car associated with the booking
   * @param userId - The ID of the user attempting to access the booking
   * @throws BookingAccessDeniedError if the user is neither the renter nor the car owner
   */
  private assertBookingAccess(
    booking: Booking,
    car: Car,
    userId: UserID,
  ): void {
    const isRenter = booking.renterId === userId
    const isOwner = car.ownerId === userId

    if (!isRenter && !isOwner) {
      throw new BookingAccessDeniedError(booking.id)
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

      this.assertBookingAccess(booking, car, userId)

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

      // Verify user has permission to modify this booking
      this.assertBookingAccess(booking, car, userId)

      // Determine the user's role in this booking for state transition validation
      const isOwner = car.ownerId === userId
      const userRole = isOwner ? UserBookingRole.OWNER : UserBookingRole.RENTER

      if (updates.state) {
        BookingStateTransitionValidator.validate(
          booking.state,
          updates.state,
          userRole,
          id,
        )
      }

      // Only validate dates and check car availability if dates are being updated
      // This prevents unnecessary validation when only state is being changed
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
