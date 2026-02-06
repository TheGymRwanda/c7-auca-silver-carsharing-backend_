/* eslint-disable @typescript-eslint/naming-convention */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate'

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('bookings', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    car_id: {
      type: 'integer',
      references: 'cars',
      onDelete: 'CASCADE',
    },
    renter_id: {
      type: 'integer',
      references: 'users',
      onDelete: 'CASCADE',
    },
    state: {
      type: 'text',
    },
    start_date: {
      type: 'timestamptz',
    },
    end_date: {
      type: 'timestamptz',
    },
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('bookings')
}
