import { type Except } from 'type-fest'

import { type CarID } from '../car'
import { type UserID } from '../user'

import {Booking, type BookingID, type BookingProperties} from './booking'
import { BookingState } from './booking-state'

export class BookingBuilder {
    private data: BookingProperties = {
        id: 1 as BookingID,
        carId: 1 as CarID,
        renterId: 1 as UserID,
        state: BookingState.PENDING,
        startDate: new Date('2023-08-08T14:07:27.828Z'),
        endDate: new Date('2023-08-09T07:20:56.959Z')
    }

    public withId(id: BookingID): this {
    this.data.id = id
    return this
  }

  public withCarId(carId: CarID): this {
    this.data.carId = carId
    return this
  }

  public withRenterId(renterId: UserID): this {
    this.data.renterId = renterId
    return this
  }

  public withState(state: BookingState): this {
    this.data.state = state
    return this
  }

  public withStartDate(startDate: Date): this {
    this.data.startDate = startDate
    return this
  }

  public withEndDate(endDate: Date): this {
    this.data.endDate = endDate
    return this
  }

  public build(): Booking {
    return new Booking(this.data)
  }

  public buildProperties(): BookingProperties {
    return { ...this.data }
  }

  public buildCreateData(): Except<BookingProperties, 'id'> {
    const { id, ...createData } = this.data
    return createData
  }
}