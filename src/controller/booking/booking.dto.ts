import { ApiProperty, PickType } from '@nestjs/swagger'
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsDefined,
  IsPositive,
} from 'class-validator'
import { type Writable } from 'type-fest'

import {
  type Booking,
  type BookingID,
  BookingState,
  type CarID,
  type UserID,
} from '../../application'
import { StrictPartialType, validate } from '../../util'

export class BookingDTO {
  @ApiProperty({
    description: 'The id of the booking.',
    type: 'integer',
    minimum: 1,
    example: 7,
    readOnly: true,
  })
  @IsInt()
  @IsPositive()
  public readonly id!: BookingID

  @ApiProperty({
    description: 'The id of the car being booked.',
    type: 'integer',
    minimum: 1,
    example: 13,
  })
  @IsDefined()
  @IsInt()
  @IsPositive()
  public readonly carId!: CarID

  @ApiProperty({
    description: 'The current state of the booking.',
    enum: BookingState,
    example: BookingState.PENDING,
  })
  @IsEnum(BookingState)
  public readonly state!: BookingState

  @ApiProperty({
    description: 'The id of the user who made this booking.',
    type: 'integer',
    minimum: 1,
    example: 42,
  })
  @IsInt()
  @IsPositive()
  public readonly renterId!: UserID

  @ApiProperty({
    description: 'The start date and time of the booking.',
    type: 'string',
    format: 'date-time',
    example: '2023-08-08T14:07:27.828Z',
  })
  @IsDefined()
  @IsDateString()
  public readonly startDate!: string

  @ApiProperty({
    description: 'The end date and time of the booking.',
    type: 'string',
    format: 'date-time',
    example: '2023-08-09T07:20:56.959Z',
  })
  @IsDefined()
  @IsDateString()
  public readonly endDate!: string

  public static create(data: {
    id: BookingID
    carId: CarID
    state: BookingState
    renterId: UserID
    startDate: string
    endDate: string
  }): BookingDTO {
    const instance = new BookingDTO() as Writable<BookingDTO>

    instance.id = data.id
    instance.carId = data.carId
    instance.state = data.state
    instance.renterId = data.renterId
    instance.startDate = data.startDate
    instance.endDate = data.endDate

    return validate(instance)
  }

  public static fromModel(booking: Booking): BookingDTO {
    return BookingDTO.create({
      id: booking.id,
      carId: booking.carId,
      state: booking.state,
      renterId: booking.renterId,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
    })
  }
}

export class CreateBookingDTO extends PickType(BookingDTO, [
  'carId',
  'startDate',
  'endDate',
] as const) {}

export class PatchBookingDTO extends StrictPartialType(
  PickType(BookingDTO, ['state', 'startDate', 'endDate'] as const),
) {}
