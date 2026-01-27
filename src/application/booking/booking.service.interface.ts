import { type Except } from 'type-fest'

import { type UserID } from '../user'

import { type Booking, type BookingID, type BookingProperties } from './booking'

export abstract class IBookingService {
  public abstract create(
    data: Except<BookingProperties, 'id'>,
  ): Promise<Booking>

  public abstract get(id: BookingID, userId: UserID): Promise<Booking>

  public abstract getAll(): Promise<Booking[]>

  public abstract update(
    id: BookingID,
    updates: Partial<Except<BookingProperties, 'id' | 'carId' | 'renterId'>>,
    userId: UserID,
  ): Promise<Booking>
}
