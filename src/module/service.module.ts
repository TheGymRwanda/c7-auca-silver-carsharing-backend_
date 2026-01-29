import { Module } from '@nestjs/common'

import { AuthenticationService } from '../application/authentication/authentication.service'
import { IAuthenticationService } from '../application/authentication/authentication.service.interface'
import { BookingService } from '../application/booking/booking.service'
import { IBookingService } from '../application/booking/booking.service.interface'
import { CarService } from '../application/car/car.service'
import { ICarService } from '../application/car/car.service.interface'
import { CarTypeService } from '../application/car-type/car-type.service'
import { ICarTypeService } from '../application/car-type/car-type.service.interface'
import { UserService } from '../application/user/user.service'
import { IUserService } from '../application/user/user.service.interface'

import { DatabaseModule } from './database.module'
import { RepositoryModule } from './repository.module'

@Module({
  imports: [DatabaseModule, RepositoryModule],
  providers: [
    {
      provide: IAuthenticationService,
      useClass: AuthenticationService,
    },
    {
      provide: IBookingService,
      useClass: BookingService,
    },
    {
      provide: ICarService,
      useClass: CarService,
    },
    {
      provide: ICarTypeService,
      useClass: CarTypeService,
    },
    {
      provide: IUserService,
      useClass: UserService,
    },
  ],
  exports: [
    IAuthenticationService,
    IBookingService,
    ICarService,
    ICarTypeService,
    IUserService,
  ],
})
export class ServiceModule {}
