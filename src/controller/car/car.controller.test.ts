import { ForbiddenException } from '@nestjs/common'

import { type CarID, CarState, type ICarService } from '../../application'
import { CarAccessDeniedError } from '../../application/car/error'
import { UserBuilder } from '../../application/user/user.builder'
import { CarBuilder } from '../../application/car/car.builder'

import { CarController } from './car.controller'
import { CarDTO } from './car.dto'

describe('CarController', () => {
  let carController: CarController
  let carServiceMock: jest.Mocked<ICarService>

  beforeEach(() => {
    carServiceMock = {
      create: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      update: jest.fn(),
    }
    carController = new CarController(carServiceMock)
  })

  describe('patch', () => {
    const user = new UserBuilder().withId(42).build()
    const carId = 1 as CarID

    it('should update car state when user is authorized renter', async () => {
      const updatedCar = new CarBuilder()
        .withId(carId)
        .withState(CarState.UNLOCKED)
        .build()

      carServiceMock.update.mockResolvedValue(updatedCar)

      const result = await carController.patch(user, carId, {
        state: CarState.UNLOCKED,
      })

      expect(result).toBeInstanceOf(CarDTO)
      expect(result.state).toBe(CarState.UNLOCKED)
      expect(carServiceMock.update).toHaveBeenCalledWith(
        carId,
        { state: CarState.UNLOCKED },
        user.id,
      )
    })

    it('should throw ForbiddenException when user is not authorized', async () => {
      carServiceMock.update.mockRejectedValue(new CarAccessDeniedError(carId))

      await expect(
        carController.patch(user, carId, { state: CarState.UNLOCKED }),
      ).rejects.toThrow(ForbiddenException)

      await expect(
        carController.patch(user, carId, { state: CarState.UNLOCKED }),
      ).rejects.toThrow(
        'You can only update cars that you own, or change the state of cars you are currently renting',
      )
    })
  })
})
