import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MyTripsNavbar from "../components/MyTripsNavbar";
import Footer from "../components/Footer";
import { FaPlane, FaBus, FaHotel, FaChevronRight } from "react-icons/fa";
import { API_ENDPOINTS, getAuthHeaders } from "../utils/api";
import "../styles/MyTrips.css";

const DATE_FORMAT = { day: "2-digit", month: "short", year: "numeric" };

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-GB", DATE_FORMAT);
};

const formatTime = (value) => {
  if (!value) return "";
  // Flight times arrive as "HH:MM:SS", booking timestamps as full dates.
  const date = /^\d{2}:\d{2}/.test(String(value))
    ? new Date(`1970-01-01T${value}`)
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

// "Upcoming" means a confirmed booking whose travel date has not passed yet.
const resolveStatus = (booking) => {
  if (booking.booking_status === "cancelled") return "CANCELLED";

  const travelDate = booking.departure_date ? new Date(booking.departure_date) : null;
  const isUpcoming = travelDate && !Number.isNaN(travelDate.getTime()) && travelDate >= new Date();

  return isUpcoming ? "INITIATE" : "SUCCESS";
};

// Map an API booking onto the row shape the trips table renders.
const toTripRow = (booking) => {
  const [lead] = booking.passengers || [];
  const leadName = lead
    ? [lead.first_name, lead.last_name].filter(Boolean).join(" ")
    : booking.email;

  return {
    id: booking.id,
    bookingId: booking.id,
    date: formatDate(booking.created_at),
    time: formatTime(booking.created_at),
    txnId: `TX${String(booking.id).padStart(6, "0")}`,
    passengerName: leadName,
    additionalPassengers: Math.max(0, (booking.passengers || []).length - 1),
    passengers: booking.passengers || [],
    mobile: booking.phone,
    email: booking.email,
    status: resolveStatus(booking),
    travelDate: formatDate(booking.departure_date),
    travelTime: formatTime(booking.departure_time),
    origin: booking.from_city,
    destination: booking.to_city,
    airline: booking.departure_airline,
    flightNumber: booking.departure_flight_number,
    tripType: booking.trip_type,
    amount: `\u20b9 ${Number(booking.total_price || 0).toLocaleString("en-IN")}`,
    service: "Flights"
  };
};


function MyTrips() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeService, setActiveService] = useState("Flights");
  const [currentImg, setCurrentImg] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Search filter states
  const [searchFromDate, setSearchFromDate] = useState("");
  const [searchToDate, setSearchToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const ITEMS_PER_PAGE = 10;

  // List of background images from mytrips folder
  const images = [
    
   
    "/mytrips/trip6.jpg"
   
  ];

  // Sample booking data with different statuses
  // Bookings come from the API for the logged-in user.
  const [bookingData, setBookingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let isActive = true;

    const loadBookings = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(API_ENDPOINTS.BOOKINGS, {
          headers: getAuthHeaders()
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.message || "Failed to load bookings");
        }

        if (isActive) {
          setBookingData((body?.data?.bookings || []).map(toTripRow));
        }
      } catch (error) {
        if (isActive) {
          setLoadError(error.message);
          setBookingData([]);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadBookings();
    return () => {
      isActive = false;
    };
  }, []);


  // Filter data based on active filter and activeService
  const getFilteredData = () => {
    // Show data for selected service
    let filtered = bookingData.filter(
      booking => booking.service === activeService &&
        (
          activeFilter === "All" ||
          (activeFilter === "Confirmed" && booking.status === "SUCCESS") ||
          (activeFilter === "Upcoming" && booking.status === "INITIATE") ||
          (activeFilter === "Cancelled" && booking.status === "CANCELLED") ||
          (activeFilter === "Failed" && booking.status === "FAILED")
        )
    );

    // Apply search filters
    if (searchFromDate) {
      filtered = filtered.filter(booking => {
        // Parse the date directly (format: "02 Jan 2026")
        const bookingDate = new Date(booking.date);
        const fromDate = new Date(searchFromDate);
        fromDate.setHours(0, 0, 0, 0);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate >= fromDate;
      });
    }

    if (searchToDate) {
      filtered = filtered.filter(booking => {
        // Parse the date directly (format: "02 Jan 2026")
        const bookingDate = new Date(booking.date);
        const toDate = new Date(searchToDate);
        toDate.setHours(23, 59, 59, 999);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate <= toDate;
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(booking => 
        booking.txnId?.toLowerCase().includes(query) ||
        booking.mobile?.includes(query) ||
        booking.email?.toLowerCase().includes(query) ||
        booking.ticketNo?.toLowerCase().includes(query) ||
        booking.hotelName?.toLowerCase().includes(query) ||
        booking.passengerName?.toLowerCase().includes(query) ||
        booking.guestName?.toLowerCase().includes(query)
      );
    }

    // Sort by status: Upcoming -> Confirmed -> Cancelled -> Failed
    const statusOrder = {
      'INITIATE': 1,
      'SUCCESS': 2,
      'CANCELLED': 3,
      'FAILED': 4
    };

    filtered.sort((a, b) => {
      return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
    });

    return filtered;
  };

  const filteredData = getFilteredData();
  
  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedData = filteredData.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, activeService, searchFromDate, searchToDate, searchQuery]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImg((prev) => (prev + 1) % images.length);
    }, 5000); // Change image every 5 seconds
    return () => clearInterval(timer);
  }, [images.length]);
  
  const handlePrevPage = (e) => {
    e.preventDefault();
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const handleNextPage = (e) => {
    e.preventDefault();
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <MyTripsNavbar />
      
      <div className="mytrips-page">
        {/* Background Slideshow */}
        <div className="mytrips-background">
          {images.map((img, index) => (
            <div
              key={index}
              className={`mytrips-bg-image ${index === currentImg ? "active" : ""}`}
              style={{ backgroundImage: `url(${img})` }}
            />
          ))}
        </div>

        <div className="mytrips-container">
          {/* Breadcrumb + Filter Row */}
          <div className="breadcrumb-filter-row">
            <div className="breadcrumb">
              <span className="breadcrumb-link" onClick={() => navigate('/')}>Home</span>
              <FaChevronRight className="breadcrumb-arrow" />
              <span className="breadcrumb-current">My Trips</span>
            </div>
            
            <div className="filter-pills">
              {["All", "Upcoming", "Completed", "Cancelled", "Failed"].map((filter) => (
                <button
                  key={filter}
                  className={`filter-pill ${activeFilter === filter ? "active" : ""}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Combined Service Strip and Search Filter Section */}
          <div className="combined-section">
            {/* Service Strip */}
            <div className="service-strip">
              <div
                className={`service-option ${activeService === "Flights" ? "active" : ""}`}
                onClick={() => setActiveService("Flights")}
              >
                <FaPlane className="service-icon" />
                <span>Flights</span>
              </div>
              <div
                className={`service-option ${activeService === "Buses" ? "active" : ""}`}
                onClick={() => setActiveService("Buses")}
              >
                <FaBus className="service-icon" />
                <span>Buses</span>
              </div>
              <div
                className={`service-option ${activeService === "Hotels" ? "active" : ""}`}
                onClick={() => setActiveService("Hotels")}
              >
                <FaHotel className="service-icon" />
                <span>Hotels</span>
              </div>
            </div>

            {/* Search Filter Section */}
            <div className="search-filter-section">
              <div className="search-filter-group">
                <label className="search-filter-label">From Date</label>
                <input 
                  type="date" 
                  className="search-filter-input"
                  placeholder="YYYY-MM-DD"
                  value={searchFromDate}
                  onChange={(e) => setSearchFromDate(e.target.value)}
                />
              </div>
              <div className="search-filter-group">
                <label className="search-filter-label">To Date</label>
                <input 
                  type="date" 
                  className="search-filter-input"
                  placeholder="YYYY-MM-DD"
                  value={searchToDate}
                  onChange={(e) => setSearchToDate(e.target.value)}
                />
              </div>
              <div className="search-filter-group search-filter-wide">
                <label className="search-filter-label">Search</label>
                <input 
                  type="text" 
                  className="search-filter-input"
                  placeholder="Booking ID, Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Booking Cards Container - Table Format */}
          <div className="booking-cards-container">
            <table className="bookings-table">
              <thead>
                {activeService === "Hotels" ? (
                  <tr>
                    <th>Date</th>
                    <th>Booking Ref.</th>
                    <th>Guest Details</th>
                    <th>Hotel Details</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                ) : (activeService === "Flights" || activeService === "Buses") ? (
                  <tr>
                    <th>Date</th>
                    <th>Booking Ref.</th>
                    <th>Passenger Details</th>
                    <th>Travelling Details</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                ) : (
                  <tr>
                    <th>DATE</th>
                    <th>TXN ID</th>
                    <th>TRAVEL DETAILS</th>
                    <th>OTHER DETAILS</th>
                    <th>AMOUNT</th>
                    <th>ACTION</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-bookings">
                      {loading
                        ? "Loading your bookings..."
                        : loadError || "No bookings found"}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((booking) => (
                    <tr key={booking.id}>
                      {activeService === "Hotels" ? (
                        <>
                          <td className="date-column">
                            <div className="booking-date">{booking.date}</div>
                            <div className="booking-time">{booking.time}</div>
                          </td>
                          <td className="booking-ref-column">{booking.txnId}</td>
                          <td className="guest-details-column">
                            <div className="guest-name">
                              {booking.guestName}
                              {booking.additionalGuests > 0 && (
                                <span className="additional-passengers">
                                  {" "}+{booking.additionalGuests}
                                </span>
                              )}
                            </div>
                            <div className="guest-mobile">Mob No. - {booking.mobile}</div>
                            <div className="guest-email">E-Mail- {booking.email}</div>
                          </td>
                          <td className="hotel-details-column">
                            <div className="hotel-name">{booking.hotelName}, {booking.city}</div>
                            <div>Rooms - {booking.rooms}, {booking.roomType}</div>
                            <div>Check-In - {booking.checkIn}</div>
                            <div>Check-Out - {booking.checkOut}</div>
                            <div>{booking.days === 1 ? 'Day' : 'Days'} - {booking.days}</div>
                          </td>
                          <td className="amount-column">
                            <div className="amount-value">{booking.amount}</div>
                          </td>
                          <td className="status-column">
                            <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                              <span className="status-dot"></span>
                              {booking.status === "INITIATE" ? "Upcoming" : booking.status === "SUCCESS" ? "Completed" : booking.status}
                            </span>
                          </td>
                          <td className="action-column">
                            {(booking.status === "SUCCESS" || booking.status === "INITIATE") && (
                              <div className="action-buttons-group">
                                <button className="action-btn-styled action-btn-print-styled">Print</button>
                                <button 
                                  className="action-btn-styled action-btn-cancel-styled"
                                  onClick={() => navigate('/cancel', { state: { booking, service: activeService } })}
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                            {(booking.status === "CANCELLED" || booking.status === "FAILED") && (
                              <button className="action-btn-styled action-btn-refund-styled">Refund Status</button>
                            )}
                          </td>
                        </>
                      ) : (activeService === "Flights" || activeService === "Buses") ? (
                        <>
                          <td className="date-column">
                            <div className="booking-date">{booking.date}</div>
                            <div className="booking-time">{booking.time}</div>
                          </td>
                          <td className="booking-ref-column">{booking.txnId}</td>
                          <td className="passenger-details-column">
                            <div className="passenger-name">
                              {booking.passengerName}
                              {booking.additionalPassengers > 0 && (
                                <span className="additional-passengers">
                                  {" "}+{booking.additionalPassengers}
                                </span>
                              )}
                            </div>
                            <div className="passenger-mobile">Mob No. - {booking.mobile}</div>
                            <div className="passenger-email">E-Mail- {booking.email}</div>
                          </td>
                          <td className="travelling-details-column">
                            <div className="travel-date">{booking.travelDate}</div>
                            <div className="travel-time">{booking.travelTime}</div>
                            <div>Origin- {booking.origin}</div>
                            <div>Destination- {booking.destination}</div>
                          </td>
                          <td className="amount-column">
                            <div className="amount-value">{booking.amount}</div>
                          </td>
                          <td className="status-column">
                            <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                              <span className="status-dot"></span>
                              {booking.status === "INITIATE" ? "Upcoming" : booking.status === "SUCCESS" ? "Completed" : booking.status}
                            </span>
                          </td>
                          <td className="action-column">
                            {(booking.status === "SUCCESS" || booking.status === "INITIATE") && (
                              <div className="action-buttons-group">
                                <button className="action-btn-styled action-btn-print-styled">Print</button>
                                <button 
                                  className="action-btn-styled action-btn-cancel-styled"
                                  onClick={() => navigate('/cancel', { state: { booking, service: activeService } })}
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                            {(booking.status === "CANCELLED" || booking.status === "FAILED") && (
                              <button className="action-btn-styled action-btn-refund-styled">Refund Status</button>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="date-column">
                            <div>{booking.date}</div>
                            {booking.date2 && <div>{booking.date2}</div>}
                          </td>
                          <td className="txn-column">{booking.txnId}</td>
                          <td className="travel-details-column">
                            {booking.mobile && <div>Mobile - {booking.mobile}</div>}
                            {booking.email && <div>Email - {booking.email}</div>}
                          </td>
                          <td className="other-details-column">
                            {booking.travelDate && <div>Travel Date : {booking.travelDate}</div>}
                            {booking.ticketNo && <div>Ticket No - {booking.ticketNo}</div>}
                          </td>
                          <td className="amount-column">
                            <div>Amount: {booking.amount}</div>
                            <div>Commission: {booking.commission}</div>
                          </td>
                          <td className="action-column">
                            {booking.status === "SUCCESS" && (
                              <button className="action-btn-print">Print Ticket</button>
                            )}
                            {booking.status === "INITIATE" && (
                              <>
                                <button 
                                  className="action-btn-cancel"
                                  onClick={() => navigate('/cancel', { state: { booking, service: activeService } })}
                                >
                                  Cancel Ticket
                                </button>
                                <span className="action-separator">|</span>
                                <button className="action-btn-print">Print Ticket</button>
                              </>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            {filteredData.length > 0 && (
              <div className="pagination-section">
                <div className="pagination-info">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} entries
                </div>
                <div className="pagination-controls">
                  <button 
                    className="pagination-btn prev-btn" 
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    type="button"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="pagination-btn active-page"
                  >
                    {currentPage}
                  </button>
                  <button 
                    className="pagination-btn next-btn"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    type="button"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default MyTrips;
