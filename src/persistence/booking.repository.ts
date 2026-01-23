import { Injectable } from '@nestjs/common'
import { type Except } from 'type-fest'

import { type CarID } from '../application'

import { type Transaction } from './database-connection.interface'
import {
  Booking,
  type BookingID,
  type BookingProperties,
  BookingState,
  type IBookingRepository,
  BookingNotFoundError,
} from '../application/booking'
import { type UserID } from '../application'

type Row = {
  id: number
  car_id: number
  renter_id: number
  state: string
  start_date: string
  end_date: string
}

function rowToDomain(row: Row): Booking {
  return new Booking({
    id: row.id as BookingID,
    carId: row.car_id as CarID,
    renterId: row.renter_id as UserID,
    state: row.state as BookingState,
    startDate: new Date(row.start_date),
    endDate: new Date(row.end_date),
  })
}

@Injectable()
export class BookingRepository implements IBookingRepository {
  private async ensureBookingExists(
    tx: Transaction,
    id: BookingID,
  ): Promise<Booking> {
    const booking = await this.find(tx, id)

    if (!booking) {
      throw new BookingNotFoundError(id)
    }

    return booking
  }

  public async find(tx: Transaction, id: BookingID): Promise<Booking | null> {
    const row = await tx.oneOrNone<Row>(
      'SELECT * FROM bookings WHERE id = $(id)',
      {
        id,
      },
    )

    return row ? rowToDomain(row) : null
  }

  public async get(tx: Transaction, id: BookingID): Promise<Booking> {
    return this.ensureBookingExists(tx, id)
  }

  public async getAll(tx: Transaction): Promise<Booking[]> {
    const rows = await tx.any<Row>(
      'SELECT * FROM bookings ORDER BY start_date DESC',
    )

    return rows.map(row => rowToDomain(row))
  }

  public async findOverlappingBookings(
    tx: Transaction,
    carId: CarID,
    startDate: Date,
    endDate: Date,
    excludeBookingId?: BookingID,
  ): Promise<Booking[]> {
    const excludeClause = excludeBookingId
      ? 'AND id != $(excludeBookingId)'
      : ''

    const rows = await tx.any<Row>(
      `
      SELECT * FROM bookings 
      WHERE car_id = $(carId)
        AND state != 'CANCELED'
        AND start_date < $(endDate)
        AND end_date > $(startDate)
        ${excludeClause}
      ORDER BY start_date
      `,
      {
        carId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        excludeBookingId,
      },
    )

    return rows.map(row => rowToDomain(row))
  }

  public async insert(
    tx: Transaction,
    properties: Except<BookingProperties, 'id'>,
  ): Promise<Booking> {
    const row = await tx.one<Row>(
      `
      INSERT INTO bookings (
        car_id,
        renter_id,
        state,
        start_date,
        end_date
      ) VALUES (
        $(carId),
        $(renterId),
        $(state),
        $(startDate),
        $(endDate)
      ) RETURNING *
      `,
      {
        carId: properties.carId,
        renterId: properties.renterId,
        state: properties.state,
        startDate: properties.startDate.toISOString(),
        endDate: properties.endDate.toISOString(),
      },
    )

    return rowToDomain(row)
  }

  public async update(tx: Transaction, booking: Booking): Promise<Booking> {
    await this.ensureBookingExists(tx, booking.id)

    const row = await tx.one<Row>(
      `
      UPDATE bookings SET
        state = $(state),
        start_date = $(startDate),
        end_date = $(endDate)
      WHERE
        id = $(id)
      RETURNING *
      `,
      {
        id: booking.id,
        state: booking.state,
        startDate: booking.startDate.toISOString(),
        endDate: booking.endDate.toISOString(),
      },
    )

    return rowToDomain(row)
  }
}
