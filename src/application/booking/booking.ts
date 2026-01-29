import { Opaque } from 'type-fest'
import { IsEnum, IsInt, IsPositive } from 'class-validator'

import { validate } from '../../util'
import { CarID } from '../car'
import { UserID } from '../user'

import { BookingState } from './booking-state'

export type BookingID = Opaque<number, 'booking-id'>

export type BookingProperties = {
  id: BookingID
  carId: CarID
  renterId: UserID
  state: BookingState
  startDate: Date
  endDate: Date
}

export class Booking {
  @IsInt()
  @IsPositive()
  public readonly id: BookingID

  @IsInt()
  @IsPositive()
  public readonly carId: CarID

  @IsInt()
  @IsPositive()
  public readonly renterId: UserID

  @IsEnum(BookingState)
  public readonly state: BookingState

  public readonly startDate: Date

  public readonly endDate: Date

  public constructor(data: BookingProperties) {
    this.id = data.id
    this.carId = data.carId
    this.renterId = data.renterId
    this.state = data.state
    this.startDate = data.startDate
    this.endDate = data.endDate

    validate(this)
  }
}
