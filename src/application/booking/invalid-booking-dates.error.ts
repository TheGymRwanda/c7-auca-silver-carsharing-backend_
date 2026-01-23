import { CustomError } from 'ts-custom-error'

export class InvalidBookingDatesError extends CustomError {
  public readonly startDate: Date
  public readonly endDate: Date

  public constructor(startDate: Date, endDate: Date, reason: string) {
    super(`Invalid booking dates: ${reason}`)
    this.startDate = startDate
    this.endDate = endDate
  }
}