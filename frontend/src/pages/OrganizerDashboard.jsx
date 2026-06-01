import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Calendar, 
  MapPin, 
  Sparkles, 
  Loader2, 
  DollarSign, 
  Users, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Search, 
  Mail, 
  Download, 
  Printer 
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const OrganizerDashboard = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  
  // Attendee Modal States
  const [viewingAttendeesEvent, setViewingAttendeesEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeesSearchQuery, setAttendeesSearchQuery] = useState('');
  
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect non-organizers
  useEffect(() => {
    if (user && user.role !== 'organizer') {
      toast.error('Access denied. Attendee role is restricted from accessing the host panel.', {
        className: 'hot-toast-custom',
      });
      navigate('/');
    }
  }, [user, navigate]);

  const fetchMyEvents = async () => {
    try {
      const response = await api.get('/events/host/my-events');
      setEvents(response.data.data);
    } catch (error) {
      console.error('Failed to fetch organizer events:', error);
      toast.error('Failed to load your events list', {
        className: 'hot-toast-custom',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyEvents();
  }, []);

  // Fetch attendees on demand when a viewing event is set
  useEffect(() => {
    if (viewingAttendeesEvent) {
      const fetchAttendees = async () => {
        setLoadingAttendees(true);
        try {
          const response = await api.get(`/bookings/event/${viewingAttendeesEvent._id}`);
          setAttendees(response.data.data || []);
        } catch (error) {
          console.error('Failed to fetch event attendees:', error);
          toast.error('Failed to load registered attendee list.', {
            className: 'hot-toast-custom',
          });
          setViewingAttendeesEvent(null);
        } finally {
          setLoadingAttendees(false);
        }
      };
      fetchAttendees();
    } else {
      setAttendees([]);
      setAttendeesSearchQuery('');
    }
  }, [viewingAttendeesEvent]);

  // 🚨 Socket.io Live Organizer Notifications & Real-Time Auto Updates
  useEffect(() => {
    if (!user || user.role !== 'organizer') return;

    // Connect to Socket.io Server on port 5050
    const socket = io('http://localhost:5050', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log(`🔌 WebSockets connected: joining organizer room organizer:${user._id}`);
      socket.emit('join-organizer-room', user._id);
    });

    // 1. Listen for new ticket sales
    socket.on('new-booking', (data) => {
      console.log(`🔌 WebSocket alert: New Booking received!`, data);
      
      const formattedAmount = data.totalAmount === 0 ? 'Free' : `₹${data.totalAmount.toLocaleString('en-IN')}`;
      toast.success(
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-extrabold text-white text-sm">🎉 New Ticket Booking!</span>
          <span><strong>{data.attendeeName}</strong> booked <strong>{data.ticketCount} seat(s)</strong> for your event <strong>"{data.eventTitle}"</strong>!</span>
          <span className="text-[10px] text-emerald-400 font-bold mt-1">Paid: {formattedAmount}</span>
        </div>,
        {
          duration: 7000,
          position: 'top-right'
        }
      );

      // Auto refresh hosted events list & indicators
      fetchMyEvents();

      // If they currently have the attendee modal roster open, refresh its attendee array live too!
      if (viewingAttendeesEvent) {
        // Trigger a custom state refresh or force fetch by re-setting the same event
        setViewingAttendeesEvent(prev => prev ? { ...prev } : null);
      }
    });

    // 2. Listen for ticket cancellations
    socket.on('booking-cancelled', (data) => {
      console.log(`🔌 WebSocket alert: Ticket Cancelled!`, data);
      
      toast.error(
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-extrabold text-white text-sm">⚠️ Booking Cancelled</span>
          <span><strong>{data.attendeeName}</strong> cancelled <strong>{data.ticketCount} seat(s)</strong> for your event <strong>"{data.eventTitle}"</strong>.</span>
          <span className="text-[10px] text-red-400 font-bold mt-1">Seats released back to public capacity.</span>
        </div>,
        {
          duration: 7000,
          position: 'top-right'
        }
      );

      // Auto refresh hosted events list & indicators
      fetchMyEvents();

      // If they currently have the attendee modal roster open, refresh its attendee array live too!
      if (viewingAttendeesEvent) {
        setViewingAttendeesEvent(prev => prev ? { ...prev } : null);
      }
    });

    // Cleanup on unmount
    return () => {
      console.log(`🔌 Leaving organizer room organizer:${user._id}`);
      socket.emit('leave-organizer-room', user._id);
      socket.off('new-booking');
      socket.off('booking-cancelled');
      socket.disconnect();
    };
  }, [user, viewingAttendeesEvent]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/events/${id}`);
      toast.success('Event deleted successfully and media removed from CDN', {
        className: 'hot-toast-custom',
      });
      // Remove from state list dynamically
      setEvents(events.filter(e => e._id !== id));
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error(error.response?.data?.message || 'Delete operation failed', {
        className: 'hot-toast-custom',
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Calculate cumulative stats
  const totalRevenue = events.reduce((sum, e) => {
    const booked = Number(e.capacity) - Number(e.seatsRemaining);
    return sum + (booked * Number(e.price));
  }, 0);

  const totalBookings = events.reduce((sum, e) => {
    return sum + (Number(e.capacity) - Number(e.seatsRemaining));
  }, 0);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <span className="text-gray-400 font-medium">Fetching your host files...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkBg text-gray-100 flex flex-col relative overflow-hidden font-sans">
      {/* Premium Ambient Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-primary-600/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[35rem] h-[35rem] bg-violet-600/5 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Main Panel Navigation Container */}
      <header className="sticky top-0 z-50 bg-darkBg/80 backdrop-blur-lg border-b border-darkBorder/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div onClick={() => navigate('/')} className="flex items-center gap-2 cursor-pointer group">
            <div className="bg-primary-600 p-2 rounded-xl text-white group-hover:bg-primary-500 transition-colors shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-primary-400">
              Evently
            </span>
          </div>

          <button 
            onClick={() => navigate('/')}
            className="btn-secondary flex items-center gap-2 text-xs !py-2 px-4 border border-darkBorder hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Explore Events
          </button>
        </div>
      </header>

      {/* Core Dashboard Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 animate-fade-in">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 border-b border-darkBorder/40 pb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Host Control Panel</h1>
          <p className="text-gray-400 text-sm mt-1">Manage and track your active hosted events and earnings</p>
        </div>
        <button
          onClick={() => navigate('/organizer/create-event')}
          className="btn-primary flex items-center gap-2 self-start sm:self-center"
        >
          <Plus className="w-5 h-5" />
          Create Event
        </button>
      </div>

      {/* Stats Cards Row */}
      {events.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="glass-card p-6 flex items-center gap-4">
            <div className="bg-primary-500/10 p-3.5 rounded-2xl text-primary-400 border border-primary-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider block">Total Hosted</span>
              <span className="text-2xl font-extrabold text-white mt-1 block">{events.length} Events</span>
            </div>
          </div>

          <div className="glass-card p-6 flex items-center gap-4">
            <div className="bg-emerald-500/10 p-3.5 rounded-2xl text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider block">Total Revenue</span>
              <span className="text-2xl font-extrabold text-white mt-1 block">₹{totalRevenue.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="glass-card p-6 flex items-center gap-4">
            <div className="bg-indigo-500/10 p-3.5 rounded-2xl text-indigo-400 border border-indigo-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider block">Total Attendees Booked</span>
              <span className="text-2xl font-extrabold text-white mt-1 block">{totalBookings} Seats</span>
            </div>
          </div>
        </div>
      )}

      {/* Event Grid View */}
      {events.length === 0 ? (
        <div className="glass-card text-center p-12 max-w-xl mx-auto flex flex-col items-center justify-center mt-12 border-dashed border-2">
          <div className="bg-primary-500/10 p-4 rounded-3xl text-primary-400 border border-primary-500/20 mb-6">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-2">No Hosted Events Yet</h3>
          <p className="text-gray-400 text-sm max-w-xs leading-relaxed mb-8">
            Start organizing workshops, hackathons, concerts, or comedy nights and track live seat bookings instantly.
          </p>
          <button
            onClick={() => navigate('/organizer/create-event')}
            className="btn-primary flex items-center gap-2 py-3 px-8 shadow-xl"
          >
            Create Your First Event
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => {
            const bookedCount = Number(event.capacity) - Number(event.seatsRemaining);
            const revenue = bookedCount * Number(event.price);
            
            return (
              <div 
                key={event._id} 
                className="glass-card flex flex-col group overflow-hidden border border-darkBorder/60 hover:border-primary-500/20"
              >
                {/* Event Poster wrapper */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-900 border-b border-darkBorder/40">
                  <img 
                    src={event.image.url} 
                    alt={event.title}
                    className="object-cover w-full h-full"
                  />
                  <span className="absolute top-4 left-4 bg-primary-600/90 backdrop-blur-md text-white font-semibold text-xs px-3 py-1 rounded-full">
                    {event.category}
                  </span>
                  
                  {/* Status Ring */}
                  <span className="absolute bottom-4 right-4 bg-black/75 backdrop-blur-md text-gray-200 font-semibold text-xs px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${event.seatsRemaining === 0 ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                    {event.seatsRemaining} / {event.capacity} seats left
                  </span>
                </div>

                {/* Event Details */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2.5 line-clamp-1">
                      {event.title}
                    </h3>
                    
                    <div className="flex flex-col gap-2 text-gray-400 text-sm mb-5">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary-500" />
                        <span>{new Date(event.date).toLocaleDateString('en-US', { dateStyle: 'medium' })} • {event.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary-500" />
                        <span className="line-clamp-1">{event.location}</span>
                      </div>
                    </div>

                    {/* Stats strip */}
                    <div className="grid grid-cols-2 gap-4 p-3 bg-darkBg/60 rounded-xl border border-darkBorder/40 mb-6 text-xs text-gray-400">
                      <div>
                        <span>Tickets Booked:</span>
                        <span className="block text-sm font-bold text-white mt-0.5">{bookedCount} Seats</span>
                      </div>
                      <div>
                        <span>Event Revenue:</span>
                        <span className="block text-sm font-bold text-emerald-400 mt-0.5">₹{revenue.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* View Attendee Register Trigger */}
                  <button
                    onClick={() => setViewingAttendeesEvent(event)}
                    className="btn-outline w-full flex items-center justify-center gap-1.5 text-xs py-2.5 px-4 rounded-xl border border-primary-500/20 hover:bg-primary-500 hover:text-white mb-4 active:scale-[0.98] transition-all duration-150"
                  >
                    <Users className="w-4 h-4" />
                    View Attendee Register ({bookedCount})
                  </button>

                  {/* Actions strip */}
                  <div className="flex items-center gap-3 pt-4 border-t border-darkBorder/60">
                    <button
                      onClick={() => navigate(`/organizer/edit-event/${event._id}`)}
                      className="btn-secondary flex items-center justify-center gap-1.5 text-xs py-2.5 px-4 flex-1 border border-darkBorder/60"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Details
                    </button>
                    <button
                      onClick={() => {
                        setEventToDelete(event);
                        setShowDeleteModal(true);
                      }}
                      disabled={deletingId === event._id}
                      className="btn-secondary flex items-center justify-center gap-1.5 text-xs py-2.5 px-4 flex-1 border border-darkBorder/60 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                    >
                      {deletingId === event._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Custom Glassmorphism Double-Confirmation Deletion Modal */}
      {showDeleteModal && eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass-card p-6 sm:p-8 border-red-500/20 relative animate-slide-up">
            <div className="flex flex-col items-center text-center">
              {/* Animated Warning Icon */}
              <div className="bg-red-500/10 p-4 rounded-full text-red-500 border border-red-500/20 mb-6">
                <Trash2 className="w-8 h-8 animate-bounce" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">Delete Event?</h3>
              
              <p className="text-gray-400 text-sm leading-relaxed mb-8">
                Are you absolutely sure you want to delete <span className="text-white font-semibold">"{eventToDelete.title}"</span>? 
                This action is permanent and will instantly remove the listing from the platform and wipe the poster image from our Cloudinary CDN.
              </p>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setEventToDelete(null);
                  }}
                  className="btn-secondary py-3 px-5 flex-1 text-sm border border-darkBorder font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingId === eventToDelete._id}
                  onClick={async () => {
                    await handleDelete(eventToDelete._id);
                    setShowDeleteModal(false);
                    setEventToDelete(null);
                  }}
                  className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold py-3 px-5 rounded-xl shadow-lg shadow-red-500/10 flex items-center justify-center gap-2 flex-1 text-sm active:scale-[0.98] transition-all duration-200"
                >
                  {deletingId === eventToDelete._id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Event'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Glassmorphic Attendee Roster Modal */}
      {viewingAttendeesEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-4xl glass-card border border-darkBorder/80 max-h-[85vh] flex flex-col relative overflow-hidden animate-slide-up">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-darkBorder/60 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-white line-clamp-1">
                  Attendee Register: {viewingAttendeesEvent.title}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Review ticket purchases, transaction IDs, and register logs for this event.
                </p>
              </div>
              <button
                onClick={() => setViewingAttendeesEvent(null)}
                className="p-2 rounded-xl bg-darkCard/40 border border-darkBorder text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Controls Ribbon (Search + Mock Actions) */}
            <div className="p-4 bg-darkCard/20 border-b border-darkBorder/40 flex flex-col sm:flex-row items-center gap-3">
              {/* Search bar */}
              <div className="relative flex items-center flex-1 w-full">
                <Search className="absolute left-4 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search attendees by name, email, or Booking ID..."
                  value={attendeesSearchQuery}
                  onChange={(e) => setAttendeesSearchQuery(e.target.value)}
                  className="bg-darkBg/60 border border-darkBorder p-2.5 pl-11 rounded-xl text-xs focus:outline-none focus:border-primary-500/50 w-full text-white placeholder-gray-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => toast.success('Roster list exported to CSV successfully! (Mock)', { className: 'hot-toast-custom' })}
                  className="btn-secondary !py-2 px-4 text-xs font-bold border border-darkBorder flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="btn-secondary !py-2 px-4 text-xs font-bold border border-darkBorder flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print List
                </button>
              </div>
            </div>

            {/* Modal Body / Attendee List Table */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-darkBorder">
              {loadingAttendees ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                  <span className="text-xs text-gray-500 font-medium">Fetching registered attendees...</span>
                </div>
              ) : attendees.length === 0 ? (
                <div className="text-center py-16 max-w-sm mx-auto flex flex-col items-center">
                  <div className="bg-primary-500/10 p-3 rounded-2xl text-primary-400 mb-4">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="text-md font-bold mb-1">No Tickets Booked</h4>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    No tickets have been booked for this event yet. All registers will display here in real-time once sales begin!
                  </p>
                </div>
              ) : (
                /* Attendee Roster Grid/Table */
                <div className="overflow-x-auto border border-darkBorder/40 rounded-2xl bg-darkCard/20">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-darkBorder/60 bg-darkCard/40 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                        <th className="p-4">Attendee Details</th>
                        <th className="p-4">Monospace Booking ID</th>
                        <th className="p-4">Seats Reserved</th>
                        <th className="p-4">Revenue Contribution</th>
                        <th className="p-4">Admit Status</th>
                        <th className="p-4">Purchase Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-darkBorder/40">
                      {attendees
                        .filter(booking => {
                          const query = attendeesSearchQuery.toLowerCase();
                          const attendeeName = booking.userId?.name?.toLowerCase() || '';
                          const attendeeEmail = booking.userId?.email?.toLowerCase() || '';
                          const bookingId = booking.bookingId?.toLowerCase() || '';
                          return attendeeName.includes(query) || attendeeEmail.includes(query) || bookingId.includes(query);
                        })
                        .map((booking) => (
                          <tr key={booking._id} className="hover:bg-darkCard/30 transition-colors">
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-white text-sm">{booking.userId?.name || 'Unknown User'}</span>
                                <span className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-primary-400" />
                                  {booking.userId?.email || 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-[10px] tracking-wider text-gray-300">
                              {booking.bookingId}
                            </td>
                            <td className="p-4 font-semibold text-white">
                              {booking.ticketCount} Seat(s)
                            </td>
                            <td className="p-4 font-bold text-emerald-400">
                              {booking.totalAmount === 0 ? 'Free' : `₹${booking.totalAmount.toLocaleString('en-IN')}`}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                booking.status === 'confirmed'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : booking.status === 'cancelled'
                                  ? 'bg-red-500/10 text-red-400'
                                  : 'bg-yellow-500/10 text-yellow-400'
                              }`}>
                                {booking.status}
                              </span>
                            </td>
                            <td className="p-4 text-gray-400 text-[11px]">
                              {new Date(booking.createdAt).toLocaleDateString('en-US', {
                                dateStyle: 'medium'
                              })}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-darkCard/40 border-t border-darkBorder/60 flex items-center justify-between text-xs text-gray-500">
              <span>
                Total Sales Roster Count: <strong className="text-white">{attendees.length} Orders</strong>
              </span>
              <span>
                Event: <strong className="text-white">{viewingAttendeesEvent.title}</strong>
              </span>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

export default OrganizerDashboard;
