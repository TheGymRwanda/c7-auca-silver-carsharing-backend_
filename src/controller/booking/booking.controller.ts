import {
  Body,
  Controller,
  Post,
  UseGuards,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import {
  Booking,
  BookingState,
  IBookingService,
  type User,
  CarNotFoundError,
  CarNotAvailableError,
  InvalidBookingDatesError,
} from '../../application'
import { AuthenticationGuard } from '../authentication.guard'
import { CurrentUser } from '../current-user.decorator'

import { BookingDTO, CreateBookingDTO } from './booking.dto'

@ApiTags(Booking.name)
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description:
    'The request was not authorized because the JWT was missing, expired or otherwise invalid.',
})
@ApiForbiddenResponse({
  description:
    'The request was denied because the user given in the JWT is no longer valid.',
})
@ApiInternalServerErrorResponse({
  description: 'An internal server error occurred.',
})
@UseGuards(AuthenticationGuard)
@Controller('/bookings')
export class BookingController {
  private readonly bookingService: IBookingService

  public constructor(bookingService: IBookingService) {
    this.bookingService = bookingService
  }

  private handleBookingErrors(error: unknown): never {
    if (error instanceof InvalidBookingDatesError) {
      throw new BadRequestException(error.message)
    }
    if (error instanceof CarNotFoundError) {
      throw new NotFoundException('Car not found')
    }
    if (error instanceof CarNotAvailableError) {
      throw new ConflictException(
        'The car is not available in the requested time slot',
      )
    }
    throw error
  }

  @ApiOperation({
    summary: 'Create a new booking.',
  })
  @ApiCreatedResponse({
    description: 'A new booking was created.',
    type: BookingDTO,
  })
  @ApiBadRequestResponse({
    description:
      'The request was malformed, e.g. missing or invalid parameter or property in the request body.',
  })
  @ApiNotFoundResponse({
    description: 'No car with the given id was found.',
  })
  @ApiConflictResponse({
    description: 'The car is not available in the requested time slot.',
  })
  @Post()
  public async create(
    @CurrentUser() user: User,
    @Body() data: CreateBookingDTO,
  ): Promise<BookingDTO> {
    try {
      const booking = await this.bookingService.create({
        carId: data.carId,
        renterId: user.id,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        state: BookingState.PENDING,
      })

      return BookingDTO.fromModel(booking)
    } catch (error) {
      this.handleBookingErrors(error)
    }
  }
}
