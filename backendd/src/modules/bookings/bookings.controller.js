import {
  createBookingService,
  getUserBookingsService,
  getBookingByIdService,
  cancelBookingService
} from './bookings.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export const createBooking = async (req, res) => {
  try {
    const { tripType, departureFlightId, returnFlightId, email, phone, totalPrice, passengers } = req.body;

    if (!tripType || !departureFlightId || !email || !phone || !totalPrice) {
      return errorResponse(res, 400, 'Required booking details are missing');
    }

    const bookingId = await createBookingService({
      userId: req.user.userId,
      tripType,
      departureFlightId,
      returnFlightId: returnFlightId || null,
      email,
      phone,
      totalPrice,
      passengers: Array.isArray(passengers) ? passengers : []
    });

    return successResponse(res, 201, 'Booking saved successfully', { bookingId });
  } catch (error) {
    console.error('Create booking error:', error);
    return errorResponse(res, 500, 'Failed to save booking');
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const { status } = req.query;
    const bookings = await getUserBookingsService(req.user.userId, { status });
    return successResponse(res, 200, 'Bookings fetched successfully', { bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    return errorResponse(res, 500, 'Failed to fetch bookings');
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await getBookingByIdService(req.user.userId, req.params.id);

    if (!booking) {
      return errorResponse(res, 404, 'Booking not found');
    }

    return successResponse(res, 200, 'Booking fetched successfully', { booking });
  } catch (error) {
    console.error('Get booking error:', error);
    return errorResponse(res, 500, 'Failed to fetch booking');
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const booking = await cancelBookingService(req.user.userId, req.params.id, reason);

    if (!booking) {
      return errorResponse(res, 404, 'Booking not found or already cancelled');
    }

    return successResponse(res, 200, 'Booking cancelled successfully', { booking });
  } catch (error) {
    console.error('Cancel booking error:', error);
    return errorResponse(res, 500, 'Failed to cancel booking');
  }
};
