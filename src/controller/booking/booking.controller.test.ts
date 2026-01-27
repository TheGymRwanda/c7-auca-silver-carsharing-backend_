import { BadRequestException, ConflictException } from '@nestjs/common'

import {
  type BookingID,
  BookingState,
  BookingAccessDeniedError,
  CarNotAvailableError,
  InvalidBookingDatesError,
  type CarID,
  type UserID,
} from '../../application'
import { BookingBuilder } from '../../application/booking/booking.builder'
import { type IBookingService } from '../../application/booking/booking.service.interface'
import { UserBuilder } from '../../application/user/user.builder'

import { BookingController } from './booking.controller'
import { BookingDTO } from './booking.dto'

describe('BookingController', () => {
  let bookingController: BookingController
  let bookingServiceMock: jest.Mocked<IBookingService>

  beforeEach(() => {
    bookingServiceMock = {
      create: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
    }
    bookingController = new BookingController(bookingServiceMock)
  })

  describe('getAll', () => {
    it('should return all bookings as DTOs', async () => {
      const booking1 = new BookingBuilder()
        .withId(1 as BookingID)
        .withCarId(10 as CarID)
        .withRenterId(20 as UserID)
        .withState(BookingState.CONFIRMED)
        .withStartDate(new Date('2026-02-01T10:00:00Z'))
        .withEndDate(new Date('2026-02-05T10:00:00Z'))
        .build()

      const booking2 = new BookingBuilder()
        .withId(2 as BookingID)
        .withCarId(11 as CarID)
        .withRenterId(21 as UserID)
        .withState(BookingState.PENDING)
        .withStartDate(new Date('2026-03-01T10:00:00Z'))
        .withEndDate(new Date('2026-03-10T10:00:00Z'))
        .build()

      bookingServiceMock.getAll.mockResolvedValue([booking1, booking2])

      const result = await bookingController.getAll()

      expect(result).toHaveLength(2)
      expect(result[0]).toBeInstanceOf(BookingDTO)
      expect(result[1]).toBeInstanceOf(BookingDTO)
      expect(result[0].id).toBe(1)
      expect(result[0].carId).toBe(10)
      expect(result[0].state).toBe(BookingState.CONFIRMED)
      expect(result[1].id).toBe(2)
      expect(bookingServiceMock.getAll).toHaveBeenCalledTimes(1)
    })

    it('should return empty array when no bookings exist', async () => {
      bookingServiceMock.getAll.mockResolvedValue([])

      const result = await bookingController.getAll()

      expect(result).toEqual([])
      expect(bookingServiceMock.getAll).toHaveBeenCalledTimes(1)
    })
  })

  describe('getOne', () => {
    const user = new UserBuilder().withId(42).build()

    it('should return a single booking as DTO', async () => {
      const booking = new BookingBuilder()
        .withId(1 as BookingID)
        .withCarId(10 as CarID)
        .withRenterId(20 as UserID)
        .withState(BookingState.CONFIRMED)
        .withStartDate(new Date('2026-02-01T10:00:00Z'))
        .withEndDate(new Date('2026-02-05T10:00:00Z'))
        .build()

      bookingServiceMock.get.mockResolvedValue(booking)

      const result = await bookingController.getOne(user, 1 as BookingID)

      expect(result).toBeInstanceOf(BookingDTO)
      expect(result.id).toBe(1)
      expect(result.carId).toBe(10)
      expect(result.renterId).toBe(20)
      expect(result.state).toBe(BookingState.CONFIRMED)
      expect(bookingServiceMock.get).toHaveBeenCalledWith(
        1 as BookingID,
        user.id,
      )
      expect(bookingServiceMock.get).toHaveBeenCalledTimes(1)
    })

    it('should convert Date objects to ISO strings in DTO', async () => {
      const startDate = new Date('2026-02-01T10:00:00Z')
      const endDate = new Date('2026-02-05T10:00:00Z')

      const booking = new BookingBuilder()
        .withId(1 as BookingID)
        .withCarId(10 as CarID)
        .withRenterId(user.id)
        .withState(BookingState.CONFIRMED)
        .withStartDate(startDate)
        .withEndDate(endDate)
        .build()

      bookingServiceMock.get.mockResolvedValue(booking)

      const result = await bookingController.getOne(user, 1 as BookingID)

      expect(result.startDate).toBe(startDate.toISOString())
      expect(result.endDate).toBe(endDate.toISOString())
    })

    it('should throw BookingAccessDeniedError when user is not authorized', async () => {
      bookingServiceMock.get.mockRejectedValue(
        new BookingAccessDeniedError(1 as BookingID),
      )

      await expect(
        bookingController.getOne(user, 1 as BookingID),
      ).rejects.toThrow(BookingAccessDeniedError)
      expect(bookingServiceMock.get).toHaveBeenCalledWith(
        1 as BookingID,
        user.id,
      )
    })
  })

  describe('create', () => {
    const user = new UserBuilder().withId(42).build()
    const createBookingDTO = {
      carId: 10 as CarID,
      startDate: '2026-02-01T10:00:00Z',
      endDate: '2026-02-05T10:00:00Z',
    }

    it('should create a new booking and return DTO', async () => {
      const createdBooking = new BookingBuilder()
        .withId(1 as BookingID)
        .withCarId(createBookingDTO.carId)
        .withRenterId(user.id)
        .withState(BookingState.PENDING)
        .withStartDate(new Date(createBookingDTO.startDate))
        .withEndDate(new Date(createBookingDTO.endDate))
        .build()

      bookingServiceMock.create.mockResolvedValue(createdBooking)

      const result = await bookingController.create(user, createBookingDTO)

      expect(result).toBeInstanceOf(BookingDTO)
      expect(result.id).toBe(1)
      expect(result.carId).toBe(10)
      expect(result.renterId).toBe(42)
      expect(result.state).toBe(BookingState.PENDING)
      expect(bookingServiceMock.create).toHaveBeenCalledWith({
        carId: createBookingDTO.carId,
        renterId: user.id,
        startDate: new Date(createBookingDTO.startDate),
        endDate: new Date(createBookingDTO.endDate),
        state: BookingState.PENDING,
      })
    })

    it('should use authenticated user id as renterId', async () => {
      const differentUser = new UserBuilder().withId(99).build()
      const mockBooking = new BookingBuilder()
        .withId(1 as BookingID)
        .withCarId(createBookingDTO.carId)
        .withRenterId(differentUser.id)
        .withState(BookingState.PENDING)
        .withStartDate(new Date(createBookingDTO.startDate))
        .withEndDate(new Date(createBookingDTO.endDate))
        .build()
      bookingServiceMock.create.mockResolvedValue(mockBooking)

      await bookingController.create(differentUser, createBookingDTO)

      expect(bookingServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          renterId: 99,
        }),
      )
    })

    it('should always set state to PENDING', async () => {
      const mockBooking = new BookingBuilder()
        .withId(1 as BookingID)
        .withCarId(createBookingDTO.carId)
        .withRenterId(user.id)
        .withState(BookingState.PENDING)
        .withStartDate(new Date(createBookingDTO.startDate))
        .withEndDate(new Date(createBookingDTO.endDate))
        .build()
      bookingServiceMock.create.mockResolvedValue(mockBooking)

      await bookingController.create(user, createBookingDTO)

      expect(bookingServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          state: BookingState.PENDING,
        }),
      )
    })

    it('should throw BadRequestException when dates are invalid', async () => {
      const startDate = new Date('2026-02-05T10:00:00Z')
      const endDate = new Date('2026-02-01T10:00:00Z')
      bookingServiceMock.create.mockRejectedValue(
        new InvalidBookingDatesError(
          startDate,
          endDate,
          'End date must be after start date',
        ),
      )

      await expect(
        bookingController.create(user, createBookingDTO),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw ConflictException when car is not available', async () => {
      bookingServiceMock.create.mockRejectedValue(
        new CarNotAvailableError(10 as CarID, new Date(), new Date()),
      )

      await expect(
        bookingController.create(user, createBookingDTO),
      ).rejects.toThrow(ConflictException)
      await expect(
        bookingController.create(user, createBookingDTO),
      ).rejects.toThrow('The car is not available in the requested time slot')
    })

    it('should rethrow unknown errors', async () => {
      const unknownError = new Error('Unknown database error')
      bookingServiceMock.create.mockRejectedValue(unknownError)

      await expect(
        bookingController.create(user, createBookingDTO),
      ).rejects.toThrow(unknownError)
    })

    it('should convert ISO string dates to Date objects', async () => {
      const mockBooking = new BookingBuilder()
        .withId(1 as BookingID)
        .withCarId(createBookingDTO.carId)
        .withRenterId(user.id)
        .withState(BookingState.PENDING)
        .withStartDate(new Date(createBookingDTO.startDate))
        .withEndDate(new Date(createBookingDTO.endDate))
        .build()
      bookingServiceMock.create.mockResolvedValue(mockBooking)

      await bookingController.create(user, createBookingDTO)

      expect(bookingServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: new Date('2026-02-01T10:00:00Z'),
          endDate: new Date('2026-02-05T10:00:00Z'),
        }),
      )
    })
  })
})
