import { pool } from '../../config/database.js';

const BOOKING_SELECT = `
  SELECT
    b.id,
    b.trip_type,
    b.email,
    b.phone,
    b.total_price,
    b.booking_status,
    b.created_at,
    b.cancelled_at,
    b.cancellation_reason,
    df.id AS departure_flight_id,
    df.flight_number AS departure_flight_number,
    df.departure_time AS departure_time,
    df.arrival_time AS departure_arrival_time,
    df.date AS departure_date,
    da.airline_name AS departure_airline,
    da.logo AS departure_airline_logo,
    dfrom.code AS from_code,
    dfrom.city AS from_city,
    dto.code AS to_code,
    dto.city AS to_city,
    rf.id AS return_flight_id,
    rf.flight_number AS return_flight_number,
    rf.departure_time AS return_departure_time,
    rf.date AS return_date
  FROM bookings b
  JOIN flights df ON df.id = b.departure_flight_id
  JOIN airlines da ON da.id = df.airline_id
  JOIN airports dfrom ON dfrom.code = df.from_airport
  JOIN airports dto ON dto.code = df.to_airport
  LEFT JOIN flights rf ON rf.id = b.return_flight_id
`;

// Load passengers for a set of bookings in one query and group them by booking.
const attachPassengers = async (bookings) => {
  if (!bookings.length) return [];

  const bookingIds = bookings.map((booking) => booking.id);

  const [rows] = await pool.query(
    `SELECT id, booking_id, first_name, last_name, gender, age
     FROM passengers
     WHERE booking_id IN (?)
     ORDER BY booking_id, id`,
    [bookingIds]
  );

  const passengersByBooking = rows.reduce((acc, passenger) => {
    if (!acc[passenger.booking_id]) {
      acc[passenger.booking_id] = [];
    }
    acc[passenger.booking_id].push(passenger);
    return acc;
  }, {});

  return bookings.map((booking) => ({
    ...booking,
    passengers: passengersByBooking[booking.id] || []
  }));
};

export const createBookingService = async ({
  userId,
  tripType,
  departureFlightId,
  returnFlightId,
  email,
  phone,
  totalPrice,
  passengers
}) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [bookingResult] = await connection.query(
      `INSERT INTO bookings
       (user_id, trip_type, departure_flight_id, return_flight_id, email, phone, total_price, booking_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', NOW())`,
      [userId, tripType, departureFlightId, returnFlightId, email, phone, totalPrice]
    );

    const bookingId = bookingResult.insertId;

    if (passengers.length) {
      const passengerRows = passengers.map((traveller) => [
        bookingId,
        traveller.firstName,
        traveller.lastName || null,
        traveller.gender || null,
        traveller.age || null
      ]);

      await connection.query(
        `INSERT INTO passengers
         (booking_id, first_name, last_name, gender, age)
         VALUES ?`,
        [passengerRows]
      );
    }

    await connection.commit();
    return bookingId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getUserBookingsService = async (userId, { status } = {}) => {
  const conditions = ['b.user_id = ?'];
  const params = [userId];

  if (status) {
    conditions.push('b.booking_status = ?');
    params.push(status);
  }

  const [rows] = await pool.query(
    `${BOOKING_SELECT}
     WHERE ${conditions.join(' AND ')}
     ORDER BY b.created_at DESC`,
    params
  );

  return attachPassengers(rows);
};

export const getBookingByIdService = async (userId, bookingId) => {
  const [rows] = await pool.query(
    `${BOOKING_SELECT}
     WHERE b.user_id = ? AND b.id = ?
     LIMIT 1`,
    [userId, bookingId]
  );

  if (!rows.length) {
    return null;
  }

  const [booking] = await attachPassengers(rows);
  return booking;
};

export const cancelBookingService = async (userId, bookingId, reason) => {
  const [result] = await pool.query(
    `UPDATE bookings
     SET booking_status = 'cancelled',
         cancelled_at = NOW(),
         cancellation_reason = ?
     WHERE id = ? AND user_id = ? AND booking_status = 'confirmed'`,
    [reason || null, bookingId, userId]
  );

  // No row updated means the booking is missing, owned by someone else,
  // or already cancelled.
  if (result.affectedRows === 0) {
    return null;
  }

  return getBookingByIdService(userId, bookingId);
};
