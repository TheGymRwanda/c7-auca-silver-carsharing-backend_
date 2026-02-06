import { Logger } from '@nestjs/common'

import {
  type IDatabaseConnection,
  type Transaction,
} from '../../persistence/database-connection.interface'
import { type CarID, type ICarRepository } from '../car'
import { CarNotFoundError } from '../car'
import { type UserID } from '../user'

import { Booking } from './booking'
import { BookingState } from './booking-state'
import { BookingStateTransitionValidator } from './booking-state-transition.validator'
import { BookingBuilder } from './booking.builder'
import { type IBookingRepository } from './booking.repository.interface'
import { BookingService } from './booking.service'
import { BookingAccessDeniedError } from './errors/booking-access-denied.error'
import { CarNotAvailableError } from './errors/car-not-available.error'
import { InvalidBookingDatesError } from './errors/invalid-booking-dates.error'
import { InvalidBookingStateTransitionError } from './errors/invalid-booking-state-transition.error'

describe('BookingService', () => {
  let bookingService: BookingService
  let mockBookingRepository: jest.Mocked<IBookingRepository>
  let mockCarRepository: jest.Mocked<ICarRepository>
  let mockDatabaseConnection: jest.Mocked<IDatabaseConnection>
  let mockTransaction: jest.Mocked<Transaction>

  beforeEach(() => {
    mockBookingRepository = {
      insert: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      findOverlappingBookings: jest.fn(),
      update: jest.fn(),
    }

    mockCarRepository = {
      get: jest.fn(),
      getAll: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      findByLicensePlate: jest.fn(),
    }

    mockTransaction = {} as jest.Mocked<Transaction>

    mockDatabaseConnection = {
      transactional: jest.fn().mockImplementation(async callback => {
        return callback(mockTransaction)
      }),
    }

    bookingService = new BookingService(
      mockBookingRepository,
      mockCarRepository,
      mockDatabaseConnection,
    )

    jest.spyOn(Logger.prototype, 'log').mockImplementation()
  })

  describe('create', () => {
    const validBookingData = {
      carId: 1 as CarID,
      renterId: 42 as UserID,
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
      state: BookingState.CONFIRMED,
    }

    it('should create booking with PENDING state', async () => {
      const expectedBooking = new BookingBuilder()
        .withCarId(validBookingData.carId)
        .withRenterId(validBookingData.renterId)
        .withStartDate(validBookingData.startDate)
        .withEndDate(validBookingData.endDate)
        .withState(BookingState.PENDING)
        .build()

      mockCarRepository.get.mockResolvedValue({} as any)
      mockBookingRepository.findOverlappingBookings.mockResolvedValue([])
      mockBookingRepository.insert.mockResolvedValue(expectedBooking)

      const result = await bookingService.create(validBookingData)

      expect(result).toBe(expectedBooking)
      expect(mockBookingRepository.insert).toHaveBeenCalledWith(
        mockTransaction,
        {
          ...validBookingData,
          state: BookingState.PENDING,
        },
      )
    })

    it('should override input state with PENDING', async () => {
      mockCarRepository.get.mockResolvedValue({} as any)
      mockBookingRepository.findOverlappingBookings.mockResolvedValue([])
      mockBookingRepository.insert.mockResolvedValue({} as any)

      await bookingService.create({
        ...validBookingData,
        state: BookingState.CONFIRMED,
      })

      expect(mockBookingRepository.insert).toHaveBeenCalledWith(
        mockTransaction,
        expect.objectContaining({
          state: BookingState.PENDING,
        }),
      )
    })

    it('should throw InvalidBookingDatesError when end date is before start date', async () => {
      const invalidData = {
        ...validBookingData,
        startDate: new Date('2024-12-25T18:00:00.000Z'),
        endDate: new Date('2024-12-25T10:00:00.000Z'),
      }

      await expect(bookingService.create(invalidData)).rejects.toThrow(
        InvalidBookingDatesError,
      )
      expect(mockCarRepository.get).not.toHaveBeenCalled()
      expect(mockBookingRepository.insert).not.toHaveBeenCalled()
    })

    it('should throw InvalidBookingDatesError when end date equals start date', async () => {
      const invalidData = {
        ...validBookingData,
        startDate: new Date('2024-12-25T10:00:00.000Z'),
        endDate: new Date('2024-12-25T10:00:00.000Z'),
      }

      await expect(bookingService.create(invalidData)).rejects.toThrow(
        InvalidBookingDatesError,
      )
    })

    it('should throw InvalidBookingDatesError when start date is in the past', async () => {
      const pastDate = new Date(Date.now() - 1000)
      const invalidData = {
        ...validBookingData,
        startDate: pastDate,
        endDate: new Date(Date.now() + 3_600_000),
      }

      await expect(bookingService.create(invalidData)).rejects.toThrow(
        InvalidBookingDatesError,
      )
    })

    it('should throw CarNotFoundError when car does not exist', async () => {
      const carNotFoundError = new CarNotFoundError(validBookingData.carId)
      mockCarRepository.get.mockRejectedValue(carNotFoundError)

      await expect(bookingService.create(validBookingData)).rejects.toThrow(
        CarNotFoundError,
      )
      expect(
        mockBookingRepository.findOverlappingBookings,
      ).not.toHaveBeenCalled()
      expect(mockBookingRepository.insert).not.toHaveBeenCalled()
    })

    it('should throw CarNotAvailableError when car has overlapping bookings', async () => {
      const overlappingBooking = new BookingBuilder()
        .withCarId(validBookingData.carId)
        .withStartDate(new Date(Date.now() + 30 * 60 * 60 * 1000))
        .withEndDate(new Date(Date.now() + 36 * 60 * 60 * 1000))
        .build()

      mockCarRepository.get.mockResolvedValue({} as any)
      mockBookingRepository.findOverlappingBookings.mockResolvedValue([
        overlappingBooking,
      ])

      await expect(bookingService.create(validBookingData)).rejects.toThrow(
        CarNotAvailableError,
      )
      expect(mockBookingRepository.insert).not.toHaveBeenCalled()
    })

    it('should call findOverlappingBookings with correct parameters', async () => {
      mockCarRepository.get.mockResolvedValue({} as any)
      mockBookingRepository.findOverlappingBookings.mockResolvedValue([])
      mockBookingRepository.insert.mockResolvedValue({} as any)

      await bookingService.create(validBookingData)

      expect(
        mockBookingRepository.findOverlappingBookings,
      ).toHaveBeenCalledWith(
        mockTransaction,
        validBookingData.carId,
        validBookingData.startDate,
        validBookingData.endDate,
        undefined,
      )
    })

    it('should use database transaction', async () => {
      mockCarRepository.get.mockResolvedValue({} as any)
      mockBookingRepository.findOverlappingBookings.mockResolvedValue([])
      mockBookingRepository.insert.mockResolvedValue({} as any)

      await bookingService.create(validBookingData)

      expect(mockDatabaseConnection.transactional).toHaveBeenCalledWith(
        expect.any(Function),
      )
    })

    it('should log booking creation start and success', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log')
      const expectedBooking = new BookingBuilder().withId(123 as any).build()

      mockCarRepository.get.mockResolvedValue({} as any)
      mockBookingRepository.findOverlappingBookings.mockResolvedValue([])
      mockBookingRepository.insert.mockResolvedValue(expectedBooking)

      await bookingService.create(validBookingData)

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Creating booking for car'),
      )
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully created booking 123'),
      )
    })
  })

  describe('get', () => {
    it('should return booking when user is the renter', async () => {
      const renterId = 42 as UserID
      const carId = 10 as CarID
      const bookingId = 123 as any
      const expectedBooking = new BookingBuilder()
        .withId(bookingId)
        .withCarId(carId)
        .withRenterId(renterId)
        .build()

      mockBookingRepository.get.mockResolvedValue(expectedBooking)
      mockCarRepository.get.mockResolvedValue({
        ownerId: 999 as UserID,
      } as any)

      const result = await bookingService.get(bookingId, renterId)

      expect(result).toBe(expectedBooking)
      expect(mockBookingRepository.get).toHaveBeenCalledWith(
        mockTransaction,
        bookingId,
      )
      expect(mockCarRepository.get).toHaveBeenCalledWith(mockTransaction, carId)
    })

    it('should return booking when user is the car owner', async () => {
      const ownerId = 99 as UserID
      const carId = 10 as CarID
      const bookingId = 123 as any
      const expectedBooking = new BookingBuilder()
        .withId(bookingId)
        .withCarId(carId)
        .withRenterId(42 as UserID)
        .build()

      mockBookingRepository.get.mockResolvedValue(expectedBooking)
      mockCarRepository.get.mockResolvedValue({
        ownerId: ownerId,
      } as any)

      const result = await bookingService.get(bookingId, ownerId)

      expect(result).toBe(expectedBooking)
      expect(mockBookingRepository.get).toHaveBeenCalledWith(
        mockTransaction,
        bookingId,
      )
      expect(mockCarRepository.get).toHaveBeenCalledWith(mockTransaction, carId)
    })

    it('should throw BookingAccessDeniedError when user is neither renter nor owner', async () => {
      const unauthorizedUserId = 777 as UserID
      const carId = 10 as CarID
      const bookingId = 123 as any
      const expectedBooking = new BookingBuilder()
        .withId(bookingId)
        .withCarId(carId)
        .withRenterId(42 as UserID)
        .build()

      mockBookingRepository.get.mockResolvedValue(expectedBooking)
      mockCarRepository.get.mockResolvedValue({
        ownerId: 99 as UserID,
      } as any)

      await expect(
        bookingService.get(bookingId, unauthorizedUserId),
      ).rejects.toThrow(BookingAccessDeniedError)
      expect(mockBookingRepository.get).toHaveBeenCalledWith(
        mockTransaction,
        bookingId,
      )
      expect(mockCarRepository.get).toHaveBeenCalledWith(mockTransaction, carId)
    })

    it('should use database transaction', async () => {
      const bookingId = 123 as any
      const userId = 42 as UserID
      const carId = 10 as CarID
      mockBookingRepository.get.mockResolvedValue(
        new BookingBuilder()
          .withId(bookingId)
          .withCarId(carId)
          .withRenterId(userId)
          .build(),
      )
      mockCarRepository.get.mockResolvedValue({
        ownerId: 999 as UserID,
      } as any)

      await bookingService.get(bookingId, userId)

      expect(mockDatabaseConnection.transactional).toHaveBeenCalledWith(
        expect.any(Function),
      )
    })
  })

  describe('getAll', () => {
    it('should return all bookings from repository', async () => {
      const expectedBookings = [
        new BookingBuilder().withId(1 as any).build(),
        new BookingBuilder().withId(2 as any).build(),
      ]

      mockBookingRepository.getAll.mockResolvedValue(expectedBookings)

      const result = await bookingService.getAll()

      expect(result).toBe(expectedBookings)
      expect(mockBookingRepository.getAll).toHaveBeenCalledWith(mockTransaction)
    })

    it('should use database transaction', async () => {
      mockBookingRepository.getAll.mockResolvedValue([])

      await bookingService.getAll()

      expect(mockDatabaseConnection.transactional).toHaveBeenCalledWith(
        expect.any(Function),
      )
    })
  })

  describe('update', () => {
    const bookingId = 123 as any
    const renterId = 42 as UserID
    const ownerId = 99 as UserID
    const carId = 10 as CarID

    const existingBooking = new BookingBuilder()
      .withId(bookingId)
      .withCarId(carId)
      .withRenterId(renterId)
      .withState(BookingState.PENDING)
      .withStartDate(new Date('2026-02-01T10:00:00Z'))
      .withEndDate(new Date('2026-02-05T10:00:00Z'))
      .build()

    beforeEach(() => {
      mockBookingRepository.get.mockResolvedValue(existingBooking)
      mockCarRepository.get.mockResolvedValue({ ownerId } as any)
    })

    it('should update booking state when user is renter', async () => {
      const confirmedBooking = new BookingBuilder()
        .withId(bookingId)
        .withCarId(carId)
        .withRenterId(renterId)
        .withState(BookingState.CONFIRMED)
        .withStartDate(new Date('2026-02-01T10:00:00Z'))
        .withEndDate(new Date('2026-02-05T10:00:00Z'))
        .build()

      mockBookingRepository.get.mockResolvedValue(confirmedBooking)

      const updatedBooking = new BookingBuilder()
        .withId(bookingId)
        .withState(BookingState.PICKED_UP)
        .build()

      mockBookingRepository.update.mockResolvedValue(updatedBooking)

      const result = await bookingService.update(
        bookingId,
        { state: BookingState.PICKED_UP },
        renterId,
      )

      expect(result).toBe(updatedBooking)
      expect(mockBookingRepository.update).toHaveBeenCalledWith(
        mockTransaction,
        expect.objectContaining({ state: BookingState.PICKED_UP }),
      )
    })

    it('should update booking state when user is car owner', async () => {
      const updatedBooking = new BookingBuilder()
        .withId(bookingId)
        .withState(BookingState.CONFIRMED)
        .build()

      mockBookingRepository.update.mockResolvedValue(updatedBooking)

      const result = await bookingService.update(
        bookingId,
        { state: BookingState.CONFIRMED },
        ownerId,
      )

      expect(result).toBe(updatedBooking)
      expect(mockBookingRepository.update).toHaveBeenCalledWith(
        mockTransaction,
        expect.objectContaining({ state: BookingState.CONFIRMED }),
      )
    })

    it('should throw BookingAccessDeniedError when user is neither renter nor owner', async () => {
      const unauthorizedUserId = 777 as UserID

      await expect(
        bookingService.update(
          bookingId,
          { state: BookingState.CONFIRMED },
          unauthorizedUserId,
        ),
      ).rejects.toThrow(BookingAccessDeniedError)

      expect(mockBookingRepository.update).not.toHaveBeenCalled()
    })

    it('should validate and update dates when provided', async () => {
      const newStartDate = new Date('2026-03-01T10:00:00Z')
      const newEndDate = new Date('2026-03-05T10:00:00Z')
      const updatedBooking = new BookingBuilder()
        .withId(bookingId)
        .withStartDate(newStartDate)
        .withEndDate(newEndDate)
        .build()

      mockBookingRepository.findOverlappingBookings.mockResolvedValue([])
      mockBookingRepository.update.mockResolvedValue(updatedBooking)

      const result = await bookingService.update(
        bookingId,
        { startDate: newStartDate, endDate: newEndDate },
        renterId,
      )

      expect(result).toBe(updatedBooking)
      expect(
        mockBookingRepository.findOverlappingBookings,
      ).toHaveBeenCalledWith(
        mockTransaction,
        carId,
        newStartDate,
        newEndDate,
        bookingId,
      )
    })

    it('should throw InvalidBookingDatesError when dates are invalid', async () => {
      const invalidStartDate = new Date('2026-03-05T10:00:00Z')
      const invalidEndDate = new Date('2026-03-01T10:00:00Z')

      await expect(
        bookingService.update(
          bookingId,
          { startDate: invalidStartDate, endDate: invalidEndDate },
          renterId,
        ),
      ).rejects.toThrow(InvalidBookingDatesError)

      expect(mockBookingRepository.update).not.toHaveBeenCalled()
    })

    it('should throw CarNotAvailableError when car is not available for new dates', async () => {
      const newStartDate = new Date('2026-03-01T10:00:00Z')
      const newEndDate = new Date('2026-03-05T10:00:00Z')
      const overlappingBooking = new BookingBuilder().withId(456 as any).build()

      mockBookingRepository.findOverlappingBookings.mockResolvedValue([
        overlappingBooking,
      ])

      await expect(
        bookingService.update(
          bookingId,
          { startDate: newStartDate, endDate: newEndDate },
          renterId,
        ),
      ).rejects.toThrow(CarNotAvailableError)

      expect(mockBookingRepository.update).not.toHaveBeenCalled()
    })

    it('should throw InvalidBookingStateTransitionError when state transition is invalid', async () => {
      jest
        .spyOn(BookingStateTransitionValidator, 'validate')
        .mockImplementation(() => {
          throw new InvalidBookingStateTransitionError(
            bookingId,
            BookingState.PENDING,
            BookingState.PICKED_UP,
          )
        })

      await expect(
        bookingService.update(
          bookingId,
          { state: BookingState.PICKED_UP },
          renterId,
        ),
      ).rejects.toThrow(InvalidBookingStateTransitionError)

      expect(mockBookingRepository.update).not.toHaveBeenCalled()
    })

    it('should allow valid state transitions', async () => {
      jest
        .spyOn(BookingStateTransitionValidator, 'validate')
        .mockImplementation(() => {})

      const updatedBooking = new BookingBuilder()
        .withId(bookingId)
        .withState(BookingState.CONFIRMED)
        .build()

      mockBookingRepository.update.mockResolvedValue(updatedBooking)

      const result = await bookingService.update(
        bookingId,
        { state: BookingState.CONFIRMED },
        ownerId,
      )

      expect(result).toBe(updatedBooking)
      expect(BookingStateTransitionValidator.validate).toHaveBeenCalledWith(
        BookingState.PENDING,
        BookingState.CONFIRMED,
        'OWNER',
        bookingId,
      )
    })
  })
})
