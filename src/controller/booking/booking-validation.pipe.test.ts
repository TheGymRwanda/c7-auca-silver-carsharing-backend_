import { BadRequestException } from '@nestjs/common'

import { BookingState } from '../../application'

import { BookingValidationPipe } from './booking-validation.pipe'

describe('BookingValidationPipe', () => {
  describe('create (default)', () => {
    const pipe = new BookingValidationPipe()

    it('should pass valid payload and convert dates to Date objects', () => {
      const payload = {
        carId: 10,
        startDate: '2026-03-01T10:00:00Z',
        endDate: '2026-03-05T10:00:00Z',
      }

      const transformed = pipe.transform(payload)

      expect(transformed.carId).toBe(10)
      expect(transformed.startDate).toBeInstanceOf(Date)
      expect(transformed.endDate).toBeInstanceOf(Date)
      expect(transformed.startDate.toISOString()).toBe(
        new Date(payload.startDate).toISOString(),
      )
      expect(transformed.endDate.toISOString()).toBe(
        new Date(payload.endDate).toISOString(),
      )
    })

    it('should throw when carId is missing', () => {
      const payload = {
        startDate: '2026-03-01T10:00:00Z',
        endDate: '2026-03-05T10:00:00Z',
      }

      expect(() => pipe.transform(payload)).toThrow(BadRequestException)
    })

    it('should throw when dates are invalid or end <= start', () => {
      const payloadInvalidDate = {
        carId: 10,
        startDate: 'not-a-date',
        endDate: 'also-not-a-date',
      }

      expect(() => pipe.transform(payloadInvalidDate)).toThrow(
        BadRequestException,
      )

      const payloadEndBeforeStart = {
        carId: 10,
        startDate: '2026-03-05T10:00:00Z',
        endDate: '2026-03-01T10:00:00Z',
      }

      expect(() => pipe.transform(payloadEndBeforeStart)).toThrow(
        BadRequestException,
      )
    })
  })

  describe('patch (isPatch: true)', () => {
    const pipe = new BookingValidationPipe({ isPatch: true })

    it('should allow partial payloads and convert provided dates', () => {
      const payload = {
        startDate: '2026-04-01T10:00:00Z',
      }

      const transformed = pipe.transform(payload)

      expect(transformed.startDate).toBeInstanceOf(Date)
      expect(transformed.endDate).toBeUndefined()
    })

    it('should validate state when provided', () => {
      const payload = { state: BookingState.PENDING }
      expect(pipe.transform(payload)).toBeDefined()

      const badPayload = { state: 'NOT_A_STATE' }
      expect(() => pipe.transform(badPayload)).toThrow(BadRequestException)
    })
  })
})
