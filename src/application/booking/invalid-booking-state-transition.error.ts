import { CustomError } from 'ts-custom-error'

import { type BookingID } from './booking'
import { type BookingState } from './booking-state'

export class InvalidBookingStateTransitionError extends CustomError {
  public readonly bookingId: BookingID
  public readonly fromState: BookingState
  public readonly toState: BookingState

  public constructor(
    bookingId: BookingID,
    fromState: BookingState,
    toState: BookingState,
  ) {
    super(
      `Invalid booking state transition from ${fromState} to ${toState} for booking ${bookingId}`,
    )
    this.bookingId = bookingId
    this.fromState = fromState
    this.toState = toState
  }
}
