import { type BookingID } from './booking'
import { BookingState } from './booking-state'
import { InvalidBookingStateTransitionError } from './errors/invalid-booking-state-transition.error'

type UserRole = 'OWNER' | 'RENTER'

interface StateTransition {
  from: BookingState
  to: BookingState
  allowedRoles: UserRole[]
}

export class BookingStateTransitionValidator {
  private static readonly TRANSITIONS: StateTransition[] = [
    {
      from: BookingState.PENDING,
      to: BookingState.CONFIRMED,
      allowedRoles: ['OWNER'],
    },
    {
      from: BookingState.PENDING,
      to: BookingState.CANCELED,
      allowedRoles: ['OWNER'],
    },
    {
      from: BookingState.CONFIRMED,
      to: BookingState.PICKED_UP,
      allowedRoles: ['RENTER'],
    },
    {
      from: BookingState.PICKED_UP,
      to: BookingState.RETURNED,
      allowedRoles: ['RENTER'],
    },
  ]

  public static validate(
    currentState: BookingState,
    newState: BookingState,
    userRole: UserRole,
    bookingId: BookingID,
  ): void {
    if (currentState === newState) {
      return
    }

    const transition = this.TRANSITIONS.find(
      stateTransition =>
        stateTransition.from === currentState &&
        stateTransition.to === newState,
    )

    if (!transition || !transition.allowedRoles.includes(userRole)) {
      throw new InvalidBookingStateTransitionError(
        bookingId,
        currentState,
        newState,
      )
    }
  }
}
