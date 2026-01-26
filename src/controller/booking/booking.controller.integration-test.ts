import { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import request from 'supertest'

import { MainModule } from '../../main.module'
import { type CarID } from '../../application/car'
import { type UserID } from '../../application/user'
import { BookingState } from '../../application/booking'
import {
  IDatabaseConnection,
  type Transaction,
} from '../../persistence/database-connection.interface'

describe('BookingController (Integration)', () => {
  let app: INestApplication
  let container: StartedPostgreSqlContainer
  let jwtService: JwtService
  let databaseConnection: IDatabaseConnection

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .start()

    // Override environment variables BEFORE creating the module
    const originalEnv = { ...process.env }
    process.env.DATABASE_HOST = container.getHost()
    process.env.DATABASE_PORT = container.getPort().toString()
    process.env.DATABASE_NAME = container.getDatabase()
    process.env.DATABASE_USERNAME = container.getUsername()
    process.env.DATABASE_PASSWORD = container.getPassword()
    process.env.JWT_SECRET = 'test-secret-key-for-integration-tests'

    const moduleRef = await Test.createTestingModule({
      imports: [MainModule],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()

    jwtService = moduleRef.get<JwtService>(JwtService)
    databaseConnection = moduleRef.get<IDatabaseConnection>(IDatabaseConnection)

    await runMigrations()
    await seedTestData()

    // Restore original environment (optional, for cleanup)
    Object.assign(process.env, originalEnv)
  }, 60000)

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    if (container) {
      await container.stop()
    }
  })

  beforeEach(async () => {
    await cleanupBookings()
  })

  async function runMigrations(): Promise<void> {
    await databaseConnection.transactional(async (tx: Transaction) => {
      await tx.none(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE,
          password TEXT
        )
      `)

      await tx.none(`
        CREATE TABLE IF NOT EXISTS car_types (
          id SERIAL PRIMARY KEY,
          name TEXT,
          image_url TEXT
        )
      `)

      await tx.none(`
        CREATE TABLE IF NOT EXISTS cars (
          id SERIAL PRIMARY KEY,
          car_type_id INTEGER REFERENCES car_types(id),
          owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          state TEXT,
          name TEXT,
          fuel_type TEXT,
          horsepower INTEGER,
          license_plate TEXT UNIQUE,
          info TEXT
        )
      `)

      await tx.none(`
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          car_id INTEGER REFERENCES cars(id) ON DELETE CASCADE,
          renter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          state TEXT,
          start_date TIMESTAMPTZ,
          end_date TIMESTAMPTZ
        )
      `)
    })
  }

  async function seedTestData(): Promise<void> {
    await databaseConnection.transactional(async (tx: Transaction) => {
      await tx.none(`
        INSERT INTO users (id, name, password) VALUES 
        (1, 'testuser', 'hashedpassword'),
        (2, 'otheruser', 'hashedpassword')
        ON CONFLICT (id) DO NOTHING
      `)

      await tx.none(`
        INSERT INTO car_types (id, name) VALUES 
        (1, 'Sedan')
        ON CONFLICT (id) DO NOTHING
      `)

      await tx.none(`
        INSERT INTO cars (id, car_type_id, owner_id, state, name, fuel_type, horsepower) VALUES 
        (1, 1, 2, 'AVAILABLE', 'Test Car', 'GASOLINE', 150),
        (2, 1, 2, 'AVAILABLE', 'Another Car', 'ELECTRIC', 200)
        ON CONFLICT (id) DO NOTHING
      `)
    })
  }

  async function cleanupBookings(): Promise<void> {
    await databaseConnection.transactional(async (tx: Transaction) => {
      await tx.none('DELETE FROM bookings')
    })
  }

  function generateJwtToken(userId: UserID): string {
    return jwtService.sign({ sub: userId, username: 'testuser' })
  }

  function getFutureDate(hoursFromNow: number): string {
    return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString()
  }

  describe('POST /bookings', () => {
    const validBookingData = {
      carId: 1,
      startDate: getFutureDate(24),
      endDate: getFutureDate(48),
    }

    describe('Successful booking creation (201)', () => {
      it('should create booking and return 201 with BookingDTO', async () => {
        const token = generateJwtToken(1 as UserID)

        const response = await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(validBookingData)
          .expect(201)

        expect(response.body).toMatchObject({
          id: expect.any(Number),
          carId: validBookingData.carId,
          state: BookingState.PENDING,
          renterId: 1,
          startDate: validBookingData.startDate,
          endDate: validBookingData.endDate,
        })
      })

      it('should save booking to database', async () => {
        const token = generateJwtToken(1 as UserID)

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(validBookingData)
          .expect(201)

        const booking = await databaseConnection.transactional(
          async (tx: Transaction) => {
            return tx.oneOrNone('SELECT * FROM bookings WHERE car_id = $1', [
              validBookingData.carId,
            ])
          },
        )

        expect(booking).toBeTruthy()
        expect(booking.state).toBe(BookingState.PENDING)
        expect(booking.renter_id).toBe(1)
      })
    })

    describe('Authentication errors (401/403)', () => {
      it('should return 401 when no JWT token provided', async () => {
        await request(app.getHttpServer())
          .post('/bookings')
          .send(validBookingData)
          .expect(401)
      })

      it('should return 401 when invalid JWT token provided', async () => {
        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', 'Bearer invalid-token')
          .send(validBookingData)
          .expect(401)
      })

      it('should return 401 when expired JWT token provided', async () => {
        const expiredToken = jwtService.sign(
          { sub: 1, username: 'testuser' },
          { expiresIn: '-1h' },
        )

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${expiredToken}`)
          .send(validBookingData)
          .expect(401)
      })
    })

    describe('Validation errors (400)', () => {
      it('should return 400 when carId is missing', async () => {
        const token = generateJwtToken(1 as UserID)
        const invalidData: Partial<typeof validBookingData> = {
          ...validBookingData,
        }
        delete invalidData.carId

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(invalidData)
          .expect(400)
      })

      it('should return 400 when startDate is missing', async () => {
        const token = generateJwtToken(1 as UserID)
        const invalidData: Partial<typeof validBookingData> = {
          ...validBookingData,
        }
        delete invalidData.startDate

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(invalidData)
          .expect(400)
      })

      it('should return 400 when endDate is missing', async () => {
        const token = generateJwtToken(1 as UserID)
        const invalidData: Partial<typeof validBookingData> = {
          ...validBookingData,
        }
        delete invalidData.endDate

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(invalidData)
          .expect(400)
      })

      it('should return 400 when date format is invalid', async () => {
        const token = generateJwtToken(1 as UserID)
        const invalidData = {
          ...validBookingData,
          startDate: 'invalid-date',
        }

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(invalidData)
          .expect(400)
      })

      it('should return 400 when end date is before start date', async () => {
        const token = generateJwtToken(1 as UserID)
        const invalidData = {
          carId: 1,
          startDate: getFutureDate(48),
          endDate: getFutureDate(24),
        }

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(invalidData)
          .expect(400)
      })

      it('should return 400 when start date is in the past', async () => {
        const token = generateJwtToken(1 as UserID)
        const invalidData = {
          carId: 1,
          startDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          endDate: getFutureDate(24),
        }

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(invalidData)
          .expect(400)
      })
    })

    describe('Business logic errors', () => {
      it('should return 404 when car does not exist', async () => {
        const token = generateJwtToken(1 as UserID)
        const invalidData = {
          ...validBookingData,
          carId: 999,
        }

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(invalidData)
          .expect(404)
      })

      it('should return 409 when car is already booked (overlapping dates)', async () => {
        const token = generateJwtToken(1 as UserID)

        // Create first booking
        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(validBookingData)
          .expect(201)

        // Try to create overlapping booking
        const overlappingData = {
          carId: 1,
          startDate: getFutureDate(30), // Overlaps with existing booking
          endDate: getFutureDate(54),
        }

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(overlappingData)
          .expect(409)
      })
    })

    describe('Edge cases', () => {
      it('should allow adjacent bookings (no overlap)', async () => {
        const token = generateJwtToken(1 as UserID)

        // Create first booking
        const firstBooking = {
          carId: 1,
          startDate: getFutureDate(24),
          endDate: getFutureDate(48),
        }

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(firstBooking)
          .expect(201)

        // Create adjacent booking (starts when first ends)
        const adjacentBooking = {
          carId: 1,
          startDate: getFutureDate(48),
          endDate: getFutureDate(72),
        }

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(adjacentBooking)
          .expect(201)
      })

      it('should allow same user to book different cars at same time', async () => {
        const token = generateJwtToken(1 as UserID)

        // Book first car
        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...validBookingData, carId: 1 })
          .expect(201)

        // Book second car at same time
        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...validBookingData, carId: 2 })
          .expect(201)
      })

      it('should allow different users to book same car at different times', async () => {
        const token1 = generateJwtToken(1 as UserID)
        const token2 = generateJwtToken(2 as UserID)

        // User 1 books car
        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token1}`)
          .send(validBookingData)
          .expect(201)

        // User 2 books same car at different time
        const laterBooking = {
          carId: 1,
          startDate: getFutureDate(72),
          endDate: getFutureDate(96),
        }

        await request(app.getHttpServer())
          .post('/bookings')
          .set('Authorization', `Bearer ${token2}`)
          .send(laterBooking)
          .expect(201)
      })
    })
  })

  describe('GET /bookings/:id', () => {
    let bookingId: number

    beforeEach(async () => {
      await databaseConnection.transactional(async (tx: Transaction) => {
        const result = await tx.one(
          `INSERT INTO bookings (car_id, renter_id, state, start_date, end_date) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING id`,
          [1, 1, BookingState.PENDING, getFutureDate(24), getFutureDate(48)],
        )
        bookingId = result.id
      })
    })

    describe('Authorization (200/403)', () => {
      it('should return 200 when user is the renter', async () => {
        const token = generateJwtToken(1 as UserID)

        const response = await request(app.getHttpServer())
          .get(`/bookings/${bookingId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200)

        expect(response.body).toMatchObject({
          id: bookingId,
          carId: 1,
          renterId: 1,
          state: BookingState.PENDING,
        })
      })

      it('should return 200 when user is the car owner', async () => {
        const token = generateJwtToken(2 as UserID)

        const response = await request(app.getHttpServer())
          .get(`/bookings/${bookingId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200)

        expect(response.body).toMatchObject({
          id: bookingId,
          carId: 1,
          renterId: 1,
          state: BookingState.PENDING,
        })
      })

      it('should return 403 when user is neither renter nor car owner', async () => {
        await databaseConnection.transactional(async (tx: Transaction) => {
          await tx.none(
            'INSERT INTO users (id, name, password) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
            [3, 'thirduser', 'hashedpassword'],
          )
        })

        const token = generateJwtToken(3 as UserID)

        await request(app.getHttpServer())
          .get(`/bookings/${bookingId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(403)
      })
    })

    describe('Not found (404)', () => {
      it('should return 404 when booking does not exist', async () => {
        const token = generateJwtToken(1 as UserID)

        await request(app.getHttpServer())
          .get('/bookings/999')
          .set('Authorization', `Bearer ${token}`)
          .expect(404)
      })
    })

    describe('Authentication (401)', () => {
      it('should return 401 when no JWT token provided', async () => {
        await request(app.getHttpServer())
          .get(`/bookings/${bookingId}`)
          .expect(401)
      })

      it('should return 401 when invalid JWT token provided', async () => {
        await request(app.getHttpServer())
          .get(`/bookings/${bookingId}`)
          .set('Authorization', 'Bearer invalid-token')
          .expect(401)
      })
    })
  })
})
