import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import {
  Booking,
  type BookingID,
  BookingState,
  IBookingService,
  type User,
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
    if (error instanceof CarNotAvailableError) {
      throw new ConflictException(
        'The car is not available in the requested time slot',
      )
    }
    throw error
  }

  @ApiOperation({
    summary: 'Retrieve all bookings.',
  })
  @ApiOkResponse({
    description: 'The request was successful.',
    type: [BookingDTO],
  })
  @Get()
  public async getAll(): Promise<BookingDTO[]> {
    const bookings = await this.bookingService.getAll()
    return bookings.map(booking => BookingDTO.fromModel(booking))
  }

  @ApiOperation({
    summary: 'Retrieve a booking by id.',
  })
  @ApiOkResponse({
    description: 'The request was successful.',
    type: BookingDTO,
  })
  @ApiBadRequestResponse({
    description: 'The booking id parameter is missing or invalid.',
  })
  @ApiNotFoundResponse({
    description: 'No booking with the given id was found.',
  })
  @ApiForbiddenResponse({
    description:
      'Access denied. You can only view bookings where you are the renter or car owner.',
  })
  @Get(':id')
  public async getOne(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: BookingID,
  ): Promise<BookingDTO> {
    const booking = await this.bookingService.get(id, user.id)
    return BookingDTO.fromModel(booking)
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
