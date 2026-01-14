import { ConflictException, Injectable, Logger } from '@nestjs/common'
import { type Except } from 'type-fest'

import { IDatabaseConnection } from '../../persistence/database-connection.interface'
import { type UserID } from '../user'

import { type Car, type CarID, type CarProperties } from './car'
import { ICarRepository } from './car.repository.interface'
import { type ICarService } from './car.service.interface'

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

  public async create(data: Except<CarProperties, 'id'>): Promise<Car> {
    try {
      return await this.databaseConnection.transactional(tx =>
        this.carRepository.insert(tx, data),
      )
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes('cars_license_plate_key')
      ) {
        throw new ConflictException(
          'A car with the given license plate already exists',
        )
      }
      throw error
    }
  }

  public async getAll(): Promise<Car[]> {
    throw new Error('Not implemented')
  }

  public async get(_id: CarID): Promise<Car> {
    throw new Error('Not implemented')
  }

  public async update(
    _carId: CarID,
    _updates: Partial<Except<CarProperties, 'id'>>,
    _currentUserId: UserID,
  ): Promise<Car> {
    throw new Error('Not implemented')
  }
}
