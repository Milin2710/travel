import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardNavbar from "../components/DashboardNavbar";
import { getCurrentUser } from "../utils/auth";
import { FaPlane, FaBus, FaHotel, FaCheckCircle, FaTimesCircle, FaClock } from "react-icons/fa";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { API_ENDPOINTS, getAuthHeaders } from "../utils/api";
import "../styles/DashboardPage.css";

// Flight bookings are the only ones the API stores, so hotels and buses stay at zero.
const summariseBookings = (bookings) => {
  const summary = {
    total: bookings.length,
    successful: 0,
    failed: 0,
    cancelled: 0,
    totalAmount: 0,
    successAmount: 0
  };

  bookings.forEach((booking) => {
    const amount = Number(booking.total_price) || 0;
    summary.totalAmount += amount;

    if (booking.booking_status === "cancelled") {
      summary.cancelled += 1;
    } else {
      summary.successful += 1;
      summary.successAmount += amount;
    }
  });

  return summary;
};

// Count bookings per month so the chart reflects actual activity.
const buildMonthlySeries = (bookings) => {
  const counts = new Map();

  bookings.forEach((booking) => {
    const created = new Date(booking.created_at);
    if (Number.isNaN(created.getTime())) return;

    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    const entry = counts.get(key) || {
      key,
      month: created.toLocaleDateString("en-US", { month: "short" }),
      flights: 0,
      hotels: 0,
      buses: 0
    };

    entry.flights += 1;
    counts.set(key, entry);
  });

  return [...counts.values()].sort((a, b) => a.key.localeCompare(b.key));
};

const toActivityRow = (booking) => {
  const [lead] = booking.passengers || [];
  const travelDate = booking.departure_date ? new Date(booking.departure_date) : null;
  const isUpcoming = travelDate && !Number.isNaN(travelDate.getTime()) && travelDate >= new Date();

  let status = "Completed";
  if (booking.booking_status === "cancelled") {
    status = "Cancelled";
  } else if (booking.can_cancel) {
    status = "Confirmed";
  }

  return {
    id: `BK-${String(booking.id).padStart(6, "0")}`,
    service: "Flight",
    passenger: lead ? [lead.first_name, lead.last_name].filter(Boolean).join(" ") : booking.email,
    totalPassengers: (booking.passengers || []).length,
    amount: `\u20b9${Number(booking.total_price || 0).toLocaleString("en-IN")}`,
    status,
    date: new Date(booking.created_at).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }),
    icon: FaPlane
  };
};


function DashboardPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  
  const [stats, setStats] = useState({
    flightBookings: { total: 0, successful: 0, failed: 0, cancelled: 0, totalAmount: 0, successAmount: 0 },
    hotelBookings: { total: 0, successful: 0, failed: 0, cancelled: 0, totalAmount: 0, successAmount: 0 },
    busBookings: { total: 0, successful: 0, failed: 0, cancelled: 0, totalAmount: 0, successAmount: 0 }
  });
  const [chartData, setChartData] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  // Build the dashboard from the user's real bookings.
  useEffect(() => {
    let isActive = true;

    const loadDashboard = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.BOOKINGS, {
          headers: getAuthHeaders()
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.message || "Failed to load dashboard");
        }

        const bookings = body?.data?.bookings || [];
        if (!isActive) return;

        setStats((previous) => ({
          ...previous,
          flightBookings: summariseBookings(bookings)
        }));
        setChartData(buildMonthlySeries(bookings));
        setRecentBookings(bookings.slice(0, 8).map(toActivityRow));
      } catch (error) {
        console.error("Dashboard load error:", error);
      }
    };

    loadDashboard();
    return () => {
      isActive = false;
    };
  }, []);

  const getTotalStats = () => {
    const totalBookings = stats.flightBookings.total + stats.hotelBookings.total + stats.busBookings.total;
    const totalSuccessful = stats.flightBookings.successful + stats.hotelBookings.successful + stats.busBookings.successful;
    const totalFailed = stats.flightBookings.failed + stats.hotelBookings.failed + stats.busBookings.failed;
    const totalCancelled = stats.flightBookings.cancelled + stats.hotelBookings.cancelled + stats.busBookings.cancelled;
    const totalAmount = stats.flightBookings.totalAmount + stats.hotelBookings.totalAmount + stats.busBookings.totalAmount;
    const totalSuccessAmount = stats.flightBookings.successAmount + stats.hotelBookings.successAmount + stats.busBookings.successAmount;

    return { totalBookings, totalSuccessful, totalFailed, totalCancelled, totalAmount, totalSuccessAmount };
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'Completed':
      case 'Confirmed':
        return 'status-completed';
      case 'Pending':
        return 'status-pending';
      case 'In Progress':
        return 'status-in-progress';
      case 'Cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Completed':
      case 'Confirmed':
        return <FaCheckCircle />;
      case 'Pending':
        return <FaClock />;
      case 'In Progress':
        return <FaClock />;
      case 'Cancelled':
        return <FaTimesCircle />;
      default:
        return null;
    }
  };

  const totals = getTotalStats();
  const successRate = totals.totalBookings
    ? ((totals.totalSuccessful / totals.totalBookings) * 100).toFixed(1)
    : "0.0";
  const failureRate = ((totals.totalFailed / totals.totalBookings) * 100).toFixed(1);
  const cancelledRate = ((totals.totalCancelled / totals.totalBookings) * 100).toFixed(1);

  return (
    <div className="dashboard-page">
      <DashboardNavbar />
      <div className="dashboard-content">
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-greeting">
            <div className="header-blob header-blob-1"></div>
            <div className="header-blob header-blob-2"></div>
            <div className="header-blob header-blob-3"></div>
            <div className="header-text">
              <div className="header-badge">✈ Travel Dashboard</div>
              <h1>Good morning, {currentUser?.name?.split(' ')[0] || 'User'} 👋</h1>
              <p>Stay on top of your tasks, monitor progress, and track status.</p>
              <div className="header-tags">
                <span className="header-tag">📊 Analytics</span>
                <span className="header-tag">🏨 Bookings</span>
                <span className="header-tag">🚀 Insights</span>
              </div>
            </div>
            <div className="header-image-wrap">
              <img src="/offers/dash1.png" alt="Dashboard" className="header-dash-img" />
            </div>
          </div>
        </div>

        {/* Main Stats Row */}
        <div className="stats-container">
          {/* Total Bookings Card */}
          <div className="stat-card large">
            <div className="card-background"></div>
            <div className="card-content">
              <div className="card-header">
                <h3>Total Bookings</h3>
                <span className="stat-percentage profit">↑ 8%</span>
              </div>
              <div className="stat-value">{totals.totalBookings}</div>
              <p className="stat-subtext">across all services</p>
            </div>
          </div>

          {/* Total Amount Card */}
          <div className="stat-card large">
            <div className="card-background"></div>
            <div className="card-content">
              <div className="card-header">
                <h3>Total Amount</h3>
                <span className="stat-percentage">↓ 5%</span>
              </div>
              <div className="stat-value">₹{(totals.totalAmount / 1000).toFixed(1)}K</div>
              <p className="stat-subtext">This month</p>
            </div>
          </div>

          {/* Successful Bookings Card */}
          <div className="stat-card success-card">
            <div className="card-background success-bg"></div>
            <div className="card-content">
              <div className="card-header">
                <h3>Successful</h3>
                <FaCheckCircle className="status-icon" />
              </div>
              <div className="stat-value">{totals.totalSuccessful}</div>
              <p className="stat-amount">₹{(totals.totalSuccessAmount / 1000).toFixed(1)}K</p>
            </div>
          </div>

          {/* Failed Bookings Card */}
          <div className="stat-card failed-card">
            <div className="card-background failed-bg"></div>
            <div className="card-content">
              <div className="card-header">
                <h3>Failed</h3>
                <FaTimesCircle className="status-icon" />
              </div>
              <div className="stat-value">{totals.totalFailed}</div>
              <p className="stat-subtext">{failureRate}% of total</p>
            </div>
          </div>

          {/* Cancelled Bookings Card */}
          <div className="stat-card cancelled-card">
            <div className="card-background cancelled-bg"></div>
            <div className="card-content">
              <div className="card-header">
                <h3>Cancelled</h3>
                <FaClock className="status-icon" />
              </div>
              <div className="stat-value">{totals.totalCancelled}</div>
              <p className="stat-subtext">{cancelledRate}% of total</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          {/* All Bookings Chart */}
          <div className="chart-card full-width">
            <h3 className="chart-title">Booking Trends - All Services</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <defs>
                  <linearGradient id="colorFlights" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e74c3c" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#e74c3c" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorHotels" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3498db" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3498db" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBuses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f39c12" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f39c12" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="month" stroke="#999" />
                <YAxis stroke="#999" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e74c3c', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="flights" stroke="#e74c3c" strokeWidth={3} dot={{ fill: '#e74c3c', r: 5 }} activeDot={{ r: 7 }} />
                <Line type="monotone" dataKey="hotels" stroke="#3498db" strokeWidth={3} dot={{ fill: '#3498db', r: 5 }} activeDot={{ r: 7 }} />
                <Line type="monotone" dataKey="buses" stroke="#f39c12" strokeWidth={3} dot={{ fill: '#f39c12', r: 5 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Service Stats Detail Cards */}
        <div className="service-stats-detail-container">
          <div className="service-stat-card">
            <div className="service-header flights">
              <FaPlane />
              <h3>Flights</h3>
            </div>
            <div className="service-stats">
              <div className="stat-item">
                <span className="stat-label">Total Bookings</span>
                <span className="stat-number">{stats.flightBookings.total}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Successful</span>
                <span className="stat-number success">{stats.flightBookings.successful}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Failed</span>
                <span className="stat-number failed">{stats.flightBookings.failed}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Cancelled</span>
                <span className="stat-number cancelled">{stats.flightBookings.cancelled}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Amount</span>
                <span className="stat-number">₹{stats.flightBookings.totalAmount}</span>
              </div>
            </div>
          </div>

          <div className="service-stat-card">
            <div className="service-header hotels">
              <FaHotel />
              <h3>Hotels</h3>
            </div>
            <div className="service-stats">
              <div className="stat-item">
                <span className="stat-label">Total Bookings</span>
                <span className="stat-number">{stats.hotelBookings.total}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Successful</span>
                <span className="stat-number success">{stats.hotelBookings.successful}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Failed</span>
                <span className="stat-number failed">{stats.hotelBookings.failed}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Cancelled</span>
                <span className="stat-number cancelled">{stats.hotelBookings.cancelled}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Amount</span>
                <span className="stat-number">₹{stats.hotelBookings.totalAmount}</span>
              </div>
            </div>
          </div>

          <div className="service-stat-card">
            <div className="service-header buses">
              <FaBus />
              <h3>Buses</h3>
            </div>
            <div className="service-stats">
              <div className="stat-item">
                <span className="stat-label">Total Bookings</span>
                <span className="stat-number">{stats.busBookings.total}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Successful</span>
                <span className="stat-number success">{stats.busBookings.successful}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Failed</span>
                <span className="stat-number failed">{stats.busBookings.failed}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Cancelled</span>
                <span className="stat-number cancelled">{stats.busBookings.cancelled}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Amount</span>
                <span className="stat-number">₹{stats.busBookings.totalAmount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="recent-activities-section">
          <div className="section-header">
            <h2>Recent Bookings</h2>
            <div className="header-actions">
              <input type="text" placeholder="Search" className="search-input" />
              <button className="filter-btn">Filter</button>
            </div>
          </div>

          <div className="activities-table">
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Activity</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((booking, index) => (
                  <tr key={index}>
                    <td><span className="booking-id">{booking.id}</span></td>
                    <td>
                      <div className="activity-name">
                        <booking.icon className="activity-icon" />
                        <span className="activity-text">
                          {booking.service} 
                          <span className="passenger-info">
                            {booking.passenger}
                            <sup>+{booking.totalPassengers}</sup>
                          </span>
                        </span>
                      </div>
                    </td>
                    <td><span className="amount">{booking.amount}</span></td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(booking.status)}`}>
                        {getStatusIcon(booking.status)}
                        {booking.status}
                      </span>
                    </td>
                    <td><span className="date">{booking.date}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
