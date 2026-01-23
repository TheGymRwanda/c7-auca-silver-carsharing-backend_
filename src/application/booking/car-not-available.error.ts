import { CustomError } from 'ts-custom-error'

import { type CarID } from '../car'

export class CarNotAvailableError extends CustomError {
  public readonly carId: CarID
  public readonly startDate: Date
  public readonly endDate: Date

  public constructor(carId: CarID, startDate: Date, endDate: Date) {
    super(`Car ${carId} is not available from ${startDate.toISOString()} to ${endDate.toISOString()}`)
    this.carId = carId
    this.startDate = startDate
    this.endDate = endDate
  }
}