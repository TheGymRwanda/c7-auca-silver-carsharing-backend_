import {
  Injectable,
  Logger,
} from '@nestjs/common'
import { type Except } from 'type-fest'

import { IDatabaseConnection } from '../../persistence/database-connection.interface'
import { type Transaction } from '../../persistence/database-connection.interface'
import { type UserID } from '../user'

import { Car, type CarID, type CarProperties } from './car'
import { ICarRepository } from './car.repository.interface'
import { type ICarService } from './car.service.interface'
import { CarAccessDeniedError, DuplicateLicensePlateError } from './error'

@Injectable()
export class CarService implements ICarService {
  private readonly carRepository: ICarRepository
  private readonly databaseConnection: IDatabaseConnection
  private readonly logger: Logger

  public constructor(
    carRepository: ICarRepository,
    databaseConnection: IDatabaseConnection,
  ) {
    this.carRepository = carRepository
    this.databaseConnection = databaseConnection
    this.logger = new Logger(CarService.name)
  }

  // Please remove the next line when implementing this file.
  /* eslint-disable @typescript-eslint/require-await */

  private async validateLicensePlateUniqueness(
    tx: Transaction,
    licensePlate: string,
    excludeCarId?: CarID,
  ): Promise<void> {
    const existingCar = await this.carRepository.findByLicensePlate(
      tx,
      licensePlate,
    )

    if (existingCar && existingCar.id !== excludeCarId) {
      throw new DuplicateLicensePlateError(licensePlate)
    }
  }

  public async create(data: Except<CarProperties, 'id'>): Promise<Car> {
    return this.databaseConnection.transactional(async tx => {
      if (data.licensePlate) {
        await this.validateLicensePlateUniqueness(tx, data.licensePlate)
      }
      return this.carRepository.insert(tx, data)
    })
  }

  public async getAll(): Promise<Car[]> {
    return this.databaseConnection.transactional(async tx => {
      return this.carRepository.getAll(tx)
    })
  }

  public async get(id: CarID): Promise<Car> {
    return this.databaseConnection.transactional(async tx => {
      return this.carRepository.get(tx, id)
    })
  }

  public async update(
    carId: CarID,
    updates: Partial<Except<CarProperties, 'id'>>,
    currentUserId: UserID,
  ): Promise<Car> {
    return this.databaseConnection.transactional(async tx => {
      const car = await this.carRepository.get(tx, carId)

      if (car.ownerId !== currentUserId) {
        throw new CarAccessDeniedError(carId)
      }

      if (updates.licensePlate && updates.licensePlate !== car.licensePlate) {
        await this.validateLicensePlateUniqueness(tx, updates.licensePlate, carId)
      }

      const updatedCar = new Car({
        ...car,
        ...updates,
        id: carId,
      })

      return this.carRepository.update(tx, updatedCar)
    })
  }
}
