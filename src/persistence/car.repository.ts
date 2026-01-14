import { Injectable } from '@nestjs/common'
import { type Except } from 'type-fest'

import {
  type CarID,
  type CarProperties,
  type CarState,
  type CarTypeID,
  CarNotFoundError,
  type FuelType,
  type ICarRepository,
  type UserID,
} from '../application'
import { Car } from '../application/car'

import { type Transaction } from './database-connection.interface'

type Row = {
  id: number
  car_type_id: number
  owner_id: number
  name: string
  state: string
  fuel_type: string
  horsepower: number
  license_plate: string | null
  info: string | null
}

function rowToDomain(row: Row): Car {
  return new Car({
    id: row.id as CarID,
    carTypeId: row.car_type_id as CarTypeID,
    ownerId: row.owner_id as UserID,
    state: row.state as CarState,
    name: row.name,
    fuelType: row.fuel_type as FuelType,
    horsepower: row.horsepower,
    licensePlate: row.license_plate,
    info: row.info,
  })
}

@Injectable()
export class CarRepository implements ICarRepository {
  public async find(_tx: Transaction, _id: CarID): Promise<Car | null> {
    throw new Error('Not implemented')
  }

  public async get(_tx: Transaction, _id: CarID): Promise<Car> {
    throw new Error('Not implemented')
  }

  public async getAll(_tx: Transaction): Promise<Car[]> {
    throw new Error('Not implemented')
  }

  public async findByLicensePlate(
    _tx: Transaction,
    _licensePlate: string,
  ): Promise<Car | null> {
    throw new Error('Not implemented')
  }

  public async update(tx: Transaction, car: Car): Promise<Car> {
    const row = await tx.oneOrNone<Row>(
      `
      UPDATE cars SET
        name = $(name),
        state = $(state),
        license_plate = $(licensePlate),
        info = $(info)
      WHERE
        id = $(id)
      RETURNING *`,
      { ...car },
    )

    if (row === null) {
      throw new CarNotFoundError(car.id)
    }

    return rowToDomain(row)
  }

  public async insert(
    tx: Transaction,
    properties: Except<CarProperties, 'id'>,
  ): Promise<Car> {
    const row = await tx.one<Row>(
      `
      INSERT INTO cars (
        car_type_id,
        owner_id,
        name,
        state,
        fuel_type,
        horsepower,
        license_plate,
        info
      ) VALUES (
        $(carTypeId),
        $(ownerId),
        $(name),
        $(state),
        $(fuelType),
        $(horsepower),
        $(licensePlate),
        $(info)
      ) RETURNING *`,
      { ...properties },
    )

    return rowToDomain(row)
  }
}
