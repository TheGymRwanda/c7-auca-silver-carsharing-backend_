import { CarAccessDeniedError } from './error'
import {
  type CarRepositoryMock,
  type DatabaseConnectionMock,
  mockCarRepository,
  mockDatabaseConnection,
} from '../../mocks'
import { UserBuilder } from '../user/user.builder'

import { CarBuilder } from './car.builder'
import { CarService } from './car.service'

describe('CarService', () => {
  let carService: CarService
  let carRepositoryMock: CarRepositoryMock
  let databaseConnectionMock: DatabaseConnectionMock

  beforeEach(() => {
    carRepositoryMock = mockCarRepository()
    databaseConnectionMock = mockDatabaseConnection()

    carService = new CarService(carRepositoryMock, databaseConnectionMock)
  })

  describe('update', () => {
    it('should update a car when user is the owner', async () => {
      const owner = new UserBuilder().build()
      const car = new CarBuilder().withOwner(owner).withHorsepower(50).build()
      const updatedCar = CarBuilder.from(car).withHorsepower(555).build()

      carRepositoryMock.get.mockResolvedValue(car)
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
      // Don't mock update - it shouldn't be called

      await expect(
        carService.update(car.id, { name: 'New Name' }, otherUser.id),
      ).rejects.toThrow(CarAccessDeniedError)

      expect(carRepositoryMock.update).not.toHaveBeenCalled()
    })
  })
})
