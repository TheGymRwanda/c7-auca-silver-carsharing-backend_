import {
  type CarRepositoryMock,
  type BookingRepositoryMock,
  type DatabaseConnectionMock,
  mockCarRepository,
  mockBookingRepository,
  mockDatabaseConnection,
} from '../../mocks'
import { BookingState } from '../booking'
import { BookingBuilder } from '../booking/booking.builder'
import { UserBuilder } from '../user/user.builder'

import { CarBuilder } from './car.builder'
import { CarState } from './car-state'
import { CarService } from './car.service'
import { CarAccessDeniedError } from './error'

describe('CarService', () => {
  let carService: CarService
  let carRepositoryMock: CarRepositoryMock
  let bookingRepositoryMock: BookingRepositoryMock
  let databaseConnectionMock: DatabaseConnectionMock

  beforeEach(() => {
    carRepositoryMock = mockCarRepository()
    bookingRepositoryMock = mockBookingRepository()
    databaseConnectionMock = mockDatabaseConnection()

    carService = new CarService(
      carRepositoryMock,
      bookingRepositoryMock,
      databaseConnectionMock,
    )
  })

  describe('update', () => {
    it('should update a car when user is the owner', async () => {
      const owner = new UserBuilder().build()
      const car = new CarBuilder().withOwner(owner).withHorsepower(50).build()
      const updatedCar = CarBuilder.from(car).withHorsepower(555).build()

      carRepositoryMock.get.mockResolvedValue(car)
      bookingRepositoryMock.getAll.mockResolvedValue([])
      carRepositoryMock.update.mockResolvedValue(updatedCar)

      await expect(
        carService.update(car.id, { horsepower: 555 }, owner.id),
      ).resolves.toEqual(updatedCar)

      expect(carRepositoryMock.get).toHaveBeenCalledWith(
        expect.anything(),
        car.id,
      )
      expect(carRepositoryMock.update).toHaveBeenCalled()
    })

    it('should throw CarAccessDeniedError when user is not the owner', async () => {
      const owner = new UserBuilder().withId(1).build()
      const otherUser = new UserBuilder().withId(2).build()
      const car = new CarBuilder().withOwner(owner).build()

      carRepositoryMock.get.mockResolvedValue(car)
      bookingRepositoryMock.getAll.mockResolvedValue([])

      await expect(
        carService.update(car.id, { name: 'New Name' }, otherUser.id),
      ).rejects.toThrow(CarAccessDeniedError)

      expect(carRepositoryMock.update).not.toHaveBeenCalled()
    })

    it('should allow renter to change car state when they have active booking', async () => {
      const owner = new UserBuilder().withId(1).build()
      const renter = new UserBuilder().withId(2).build()
      const car = new CarBuilder()
        .withOwner(owner)
        .withState(CarState.LOCKED)
        .build()
      const booking = new BookingBuilder()
        .withCarId(car.id)
        .withRenterId(renter.id)
        .withState(BookingState.PICKED_UP)
        .build()
      const updatedCar = CarBuilder.from(car)
        .withState(CarState.UNLOCKED)
        .build()

      carRepositoryMock.get.mockResolvedValue(car)
      bookingRepositoryMock.getAll.mockResolvedValue([booking])
      carRepositoryMock.update.mockResolvedValue(updatedCar)

      await expect(
        carService.update(car.id, { state: CarState.UNLOCKED }, renter.id),
      ).resolves.toEqual(updatedCar)

      expect(carRepositoryMock.update).toHaveBeenCalled()
    })

    it('should throw CarAccessDeniedError when renter tries to change non-state properties', async () => {
      const owner = new UserBuilder().withId(1).build()
      const renter = new UserBuilder().withId(2).build()
      const car = new CarBuilder().withOwner(owner).build()
      const booking = new BookingBuilder()
        .withCarId(car.id)
        .withRenterId(renter.id)
        .withState(BookingState.PICKED_UP)
        .build()

      carRepositoryMock.get.mockResolvedValue(car)
      bookingRepositoryMock.getAll.mockResolvedValue([booking])

      await expect(
        carService.update(car.id, { name: 'New Name' }, renter.id),
      ).rejects.toThrow(CarAccessDeniedError)

      expect(carRepositoryMock.update).not.toHaveBeenCalled()
    })

    it('should throw CarAccessDeniedError when renter has no active booking', async () => {
      const owner = new UserBuilder().withId(1).build()
      const renter = new UserBuilder().withId(2).build()
      const car = new CarBuilder().withOwner(owner).build()
      const booking = new BookingBuilder()
        .withCarId(car.id)
        .withRenterId(renter.id)
        .withState(BookingState.CONFIRMED)
        .build()

      carRepositoryMock.get.mockResolvedValue(car)
      bookingRepositoryMock.getAll.mockResolvedValue([booking])

      await expect(
        carService.update(car.id, { state: CarState.UNLOCKED }, renter.id),
      ).rejects.toThrow(CarAccessDeniedError)

      expect(carRepositoryMock.update).not.toHaveBeenCalled()
    })
  })
})
