import { ForbiddenException } from '@nestjs/common'

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

    it('should throw ForbiddenException when user is not the owner', async () => {
      const owner = new UserBuilder().build()
      const otherUser = new UserBuilder().build()
      const car = new CarBuilder().withOwner(owner).build()

      carRepositoryMock.get.mockResolvedValue(car)

      await expect(
        carService.update(car.id, { name: 'New Name' }, otherUser.id),
      ).rejects.toThrow(
        new ForbiddenException('You can only update cars that you own'),
      )

      expect(carRepositoryMock.update).not.toHaveBeenCalled()
    })
  })
})
