import { Module } from '@nestjs/common'

import { IBookingRepository } from '../application/booking/booking.repository.interface'
import { ICarRepository } from '../application/car/car.repository.interface'
import { ICarTypeRepository } from '../application/car-type/car-type.repository.interface'
import { IUserRepository } from '../application/user/user.repository.interface'
import {
  BookingRepository,
  CarRepository,
  CarTypeRepository,
  UserRepository,
} from '../persistence'

@Module({
  providers: [
    {
      provide: IBookingRepository,
      useClass: BookingRepository,
    },
    {
      provide: ICarRepository,
      useClass: CarRepository,
    },
    {
      provide: ICarTypeRepository,
      useClass: CarTypeRepository,
    },
    {
      provide: IUserRepository,
      useClass: UserRepository,
    },
  ],
  exports: [
    IBookingRepository,
    ICarRepository,
    ICarTypeRepository,
    IUserRepository,
  ],
})
export class RepositoryModule {}
