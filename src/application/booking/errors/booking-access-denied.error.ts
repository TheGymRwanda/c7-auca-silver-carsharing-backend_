import { AccessDeniedError } from '../../access-denied.error'

import { type BookingID } from '../booking'

export class BookingAccessDeniedError extends AccessDeniedError<BookingID> {
  public constructor(bookingId: BookingID) {
    super('You are not the renter or car owner of this booking', bookingId)
  }
}
