import { AccessDeniedError } from '../../access-denied.error'

import { type BookingID } from '../booking' 

export class BookingAccessDeniedError extends AccessDeniedError<BookingID> {
  public constructor(bookingId: BookingID) {
    super('Booking', bookingId)
  }
}
