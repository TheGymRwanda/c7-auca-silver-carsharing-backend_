import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
  BookingAccessDeniedError,
  InvalidBookingStateTransitionError,
  CarNotFoundError,
  BookingNotFoundError,
} from '../../application'
import { AuthenticationGuard } from '../authentication.guard'
import { CurrentUser } from '../current-user.decorator'

import { BookingValidationPipe } from './booking-validation.pipe'
import { BookingDTO, CreateBookingDTO, PatchBookingDTO } from './booking.dto'

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
      throw new ConflictException(error.message)
    }
    if (error instanceof InvalidBookingStateTransitionError) {
      throw new BadRequestException(error.message)
    }
    if (error instanceof BookingAccessDeniedError) {
      throw new ForbiddenException(error.message)
    }
    if (error instanceof CarNotFoundError) {
      throw new NotFoundException(error.message)
    }
    if (error instanceof BookingNotFoundError) {
      throw new NotFoundException(error.message)
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
  @ApiUnauthorizedResponse({
    description:
      'Access denied. You can only view bookings where you are the renter or car owner.',
  })
  @Get(':id')
  public async getOne(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: BookingID,
  ): Promise<BookingDTO> {
    try {
      const booking = await this.bookingService.get(id, user.id)
      return BookingDTO.fromModel(booking)
    } catch (error) {
      this.handleBookingErrors(error)
    }
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
      'The request was malformed, e.g. missing or invalid parameter or property in the request body, or the car is not available in the requested time slot.',
  })
  @ApiNotFoundResponse({
    description: 'No car with the given id was found.',
  })
  @Post()
  public async create(
    @CurrentUser() user: User,
    @Body(new (BookingValidationPipe as any)()) data: CreateBookingDTO,
  ): Promise<BookingDTO> {
    try {
      // Ensure compatibility for direct method calls (tests) by converting ISO strings
const start = new Date(data.startDate as any)
      const end = new Date(data.endDate as any)

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestException('startDate or endDate is not a valid date')
      }

      const booking = await this.bookingService.create({
        carId: data.carId,
        renterId: user.id,
        startDate: start,
        endDate: end,
        state: BookingState.PENDING,
      })

      return BookingDTO.fromModel(booking)
    } catch (error) {
      this.handleBookingErrors(error)
    }
  }

  @ApiOperation({
    summary: 'Update an existing booking.',
  })
  @ApiOkResponse({
    description: 'The booking was updated.',
    type: BookingDTO,
  })
  @ApiBadRequestResponse({
    description:
      'The request was malformed, e.g. missing or invalid parameter or property in the request body, the car is not available in the requested time slot, or the booking state transition is invalid.',
  })
  @ApiNotFoundResponse({
    description: 'No booking with the given id was found.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Access denied. You can only update bookings where you are the renter or car owner.',
  })
  @Patch(':id')
  public async patch(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: BookingID,
    @Body(new (BookingValidationPipe as any)({ isPatch: true })) data: PatchBookingDTO,
  ): Promise<BookingDTO> {
    try {
      const updates: any = { state: data.state }

      if (data.startDate) {
        const start = new Date(data.startDate as any)
        if (isNaN(start.getTime())) {
          throw new BadRequestException('startDate is not a valid date')
        }
        updates.startDate = start
      }

      if (data.endDate) {
        const end = new Date(data.endDate as any)
        if (isNaN(end.getTime())) {
          throw new BadRequestException('endDate is not a valid date')
        }
        updates.endDate = end
      }

      if (
        updates.startDate &&
        updates.endDate &&
        updates.startDate >= updates.endDate
      ) {
        throw new BadRequestException('endDate must be after startDate')
      }

      const booking = await this.bookingService.update(id, updates, user.id)

      return BookingDTO.fromModel(booking)
    } catch (error) {
      this.handleBookingErrors(error)
    }
  }
}
