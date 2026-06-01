import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Calendar, 
  MapPin, 
  Sparkles, 
  Loader2, 
  User, 
  Key, 
  Mail, 
  BadgeInfo, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  Star, 
  ChevronRight, 
  Compass, 
  Clock 
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const UserDashboard = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  // Redirect if logged out or if organizer
  useEffect(() => {
    if (!user) {
      toast.error('Session required. Please sign in to view your dashboard.', {
        className: 'hot-toast-custom',
      });
      navigate('/login');
    } else if (user.role === 'organizer') {
      toast.error('Redirected: Organizers are routed to the Host Control Panel.', {
        className: 'hot-toast-custom',
      });
      navigate('/organizer/dashboard');
    }
  }, [user, navigate]);

  // Tab States
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'profile'
  const [bookingsTab, setBookingsTab] = useState('upcoming'); // 'upcoming' | 'past'
  
  // Data States
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);

  // Cancellation Modal States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);

  // Profile Edit States
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Sync profile details if user changes/loads
  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
    }
  }, [user]);

  const fetchMyBookings = async () => {
    setLoadingBookings(true);
    try {
      const response = await api.get('/bookings/my-bookings');
      setBookings(response.data.data || []);
    } catch (error) {
      console.error('Failed to load bookings:', error);
      toast.error('Failed to fetch your bookings database', {
        className: 'hot-toast-custom',
      });
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'attendee') {
      fetchMyBookings();
    }
  }, [user]);

  // 🚨 24-Hour Cancellation Lock Helper
  const canCancelBooking = (eventDateStr) => {
    const eventTime = new Date(eventDateStr);
    const now = new Date();
    const hoursDiff = (eventTime - now) / (1000 * 60 * 60);
    return hoursDiff >= 24;
  };

  const triggerCancelBooking = (booking) => {
    setBookingToCancel(booking);
    setShowCancelModal(true);
  };

  const executeCancelBooking = async () => {
    if (!bookingToCancel) return;
    
    setCancellingId(bookingToCancel._id);
    try {
      await api.put(`/bookings/${bookingToCancel._id}/cancel`);
      toast.success('Ticket cancelled successfully. Seats released and refund enqueued.', {
        className: 'hot-toast-custom',
      });
      setShowCancelModal(false);
      setBookingToCancel(null);
      // Refresh local booking list
      fetchMyBookings();
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      toast.error(error.response?.data?.message || 'Cancellation request rejected.', {
        className: 'hot-toast-custom',
      });
    } finally {
      setCancellingId(null);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    
    if (!profileName || !profileEmail) {
      return toast.error('Name and Email fields are required', {
        className: 'hot-toast-custom',
      });
    }

    if (showPasswordChange) {
      if (!currentPassword) {
        return toast.error('Please enter your current password to proceed', {
          className: 'hot-toast-custom',
        });
      }
      if (!newPassword || newPassword.length < 6) {
        return toast.error('New password must be at least 6 characters long', {
          className: 'hot-toast-custom',
        });
      }
      if (newPassword !== confirmPassword) {
        return toast.error('New password confirmations do not match', {
          className: 'hot-toast-custom',
        });
      }
    }

    setUpdatingProfile(true);
    try {
      const response = await api.put('/auth/profile', {
        name: profileName,
        email: profileEmail,
        currentPassword: showPasswordChange ? currentPassword : undefined,
        newPassword: showPasswordChange ? newPassword : undefined,
      });

      // Update global context user
      setUser(response.data.user);
      
      // Reset password states
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);

      toast.success('Your premium user profile was updated successfully!', {
        className: 'hot-toast-custom',
      });
    } catch (error) {
      console.error('Profile update failed:', error);
      toast.error(error.response?.data?.message || 'Failed to apply profile changes', {
        className: 'hot-toast-custom',
      });
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Separate bookings into upcoming vs past dynamically based on date
  const now = new Date();
  const upcomingBookings = bookings.filter(b => b.eventId && new Date(b.eventId.date) >= now);
  const pastBookings = bookings.filter(b => b.eventId && new Date(b.eventId.date) < now);

  // Loading state
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-darkBg text-gray-400">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  // Get initials for profile badge
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'US';

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

      {/* Core Dashboard Content grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Column: Premium Profile Capsule Card */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card p-6 border border-darkBorder/60 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full blur-xl pointer-events-none"></div>
            
            {/* User Avatar Circle */}
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-primary-500/10 mb-5 relative group">
              {initials}
              <div className="absolute inset-0 rounded-3xl border border-white/20 group-hover:scale-105 transition-transform duration-300"></div>
            </div>

            <h2 className="text-xl font-extrabold text-white line-clamp-1">{user.name}</h2>
            <span className="text-gray-400 text-sm font-medium mt-1 mb-4 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-primary-400" />
              {user.email}
            </span>

            {/* Role / Registration details tag */}
            <div className="flex flex-col gap-2.5 w-full pt-5 border-t border-darkBorder/40">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Account Type</span>
                <span className="bg-primary-600/20 text-primary-400 border border-primary-500/30 px-3 py-1 rounded-full font-bold uppercase tracking-wider scale-95">
                  {user.role}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Registered On</span>
                <span className="text-gray-300 font-semibold">
                  {new Date(user.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick tab controllers */}
          <div className="flex flex-col gap-2 p-2 bg-darkCard/40 border border-darkBorder/50 rounded-2xl">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex items-center justify-between p-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === 'bookings'
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-darkCard/60'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4" />
                My Ticket Bookings
              </span>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${activeTab === 'bookings' ? 'translate-x-0.5' : ''}`} />
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center justify-between p-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === 'profile'
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-darkCard/60'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <User className="w-4 h-4" />
                Profile & Security
              </span>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${activeTab === 'profile' ? 'translate-x-0.5' : ''}`} />
            </button>
          </div>
        </section>

        {/* Right Column: Tab View Panels */}
        <section className="lg:col-span-8">
          
          {/* TAB 1: BOOKINGS LISTING PANEL */}
          {activeTab === 'bookings' && (
            <div className="space-y-6">
              {/* Tab Title & Booking Status Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-darkBorder/40 pb-6">
                <div>
                  <h1 className="text-2xl font-black">My Ticket Bookings</h1>
                  <p className="text-xs text-gray-400 mt-1">Track and manage your upcoming events and past admissions</p>
                </div>
                
                {/* Secondary filters toggle */}
                <div className="flex bg-darkCard/40 border border-darkBorder/80 p-1 rounded-xl self-start sm:self-center">
                  <button
                    onClick={() => setBookingsTab('upcoming')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                      bookingsTab === 'upcoming'
                        ? 'bg-primary-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Upcoming ({upcomingBookings.length})
                  </button>
                  <button
                    onClick={() => setBookingsTab('past')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                      bookingsTab === 'past'
                        ? 'bg-primary-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Past ({pastBookings.length})
                  </button>
                </div>
              </div>

              {/* Bookings Loader */}
              {loadingBookings ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                  <span className="text-xs text-gray-500">Fetching ticket registers...</span>
                </div>
              ) : bookings.length === 0 ? (
                /* Pure Zero-State */
                <div className="glass-card text-center p-10 max-w-md mx-auto flex flex-col items-center border-dashed border-2 mt-8">
                  <div className="bg-primary-500/10 p-4 rounded-3xl text-primary-400 mb-5">
                    <Compass className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">No Tickets Booked Yet</h3>
                  <p className="text-gray-400 text-xs leading-relaxed mb-6">
                    You haven't purchased or booked seats for any event yet. Explore and find amazing conferences, workshops or comedy nights!
                  </p>
                  <button 
                    onClick={() => navigate('/')}
                    className="btn-primary py-2.5 px-6 text-xs flex items-center gap-1.5"
                  >
                    Browse Active Events
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : bookingsTab === 'upcoming' && upcomingBookings.length === 0 ? (
                /* Upcoming Empty State */
                <div className="glass-card text-center p-8 max-w-sm mx-auto flex flex-col items-center border-dashed border-2 mt-8">
                  <div className="bg-primary-500/10 p-3 rounded-2xl text-primary-400 mb-4">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-md font-bold mb-1">No Upcoming Events</h3>
                  <p className="text-gray-400 text-xs leading-relaxed mb-5">
                    No scheduled upcoming event tickets. Explore the explore feed for upcoming ticket listings.
                  </p>
                  <button 
                    onClick={() => navigate('/')}
                    className="btn-primary py-2 px-5 text-xs"
                  >
                    Find Events
                  </button>
                </div>
              ) : bookingsTab === 'past' && pastBookings.length === 0 ? (
                /* Past Empty State */
                <div className="glass-card text-center p-8 max-w-sm mx-auto flex flex-col items-center border-dashed border-2 mt-8">
                  <div className="bg-primary-500/10 p-3 rounded-2xl text-primary-400 mb-4">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-md font-bold mb-1">No Past Admissions</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Once you attend hosted events, your digital receipt history and post-event rating review triggers will appear here.
                  </p>
                </div>
              ) : (
                /* Bookings List Layout */
                <div className="space-y-6">
                  {(bookingsTab === 'upcoming' ? upcomingBookings : pastBookings).map((booking) => {
                    const event = booking.eventId;
                    if (!event) return null;

                    const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
                      dateStyle: 'medium'
                    });
                    const isRefundable = canCancelBooking(event.date) && booking.status === 'confirmed';

                    return (
                      <div 
                        key={booking._id} 
                        className="glass-card overflow-hidden border border-darkBorder/60 flex flex-col md:flex-row group transition-all duration-300 hover:border-primary-500/20"
                      >
                        {/* Left Side: Image Thumbnail */}
                        <div className="relative w-full md:w-48 aspect-[16/10] md:aspect-auto overflow-hidden bg-gray-900 border-b md:border-b-0 md:border-r border-darkBorder/40">
                          <img 
                            src={event.image?.url} 
                            alt={event.title} 
                            className="object-cover w-full h-full group-hover:scale-102 transition-transform duration-500"
                          />
                          <span className="absolute top-3 left-3 bg-black/75 backdrop-blur-md text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/5 uppercase tracking-wide">
                            {event.category}
                          </span>
                        </div>

                        {/* Right Side: Core receipt details */}
                        <div className="p-6 flex-1 flex flex-col justify-between">
                          <div className="space-y-3.5">
                            {/* Row 1: Title & Badge */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <h3 className="text-lg font-black text-white group-hover:text-primary-400 transition-colors line-clamp-1">
                                {event.title}
                              </h3>
                              
                              {/* Status Badge */}
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border self-start sm:self-center ${
                                booking.status === 'confirmed'
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                  : booking.status === 'cancelled'
                                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                  : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                              }`}>
                                {booking.status}
                              </span>
                            </div>

                            {/* Row 2: Location, Date & Monospace ID */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-400">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-primary-500" />
                                <span>{formattedDate} • {event.time}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-primary-500" />
                                <span className="line-clamp-1">{event.location}</span>
                              </div>
                              <div className="sm:col-span-2 pt-1 font-mono text-[10px] text-gray-500 flex flex-wrap items-center gap-1.5">
                                <span>BOOKING ID:</span>
                                <span className="text-white border border-darkBorder px-2 py-0.5 rounded bg-darkBg tracking-wider font-semibold">
                                  {booking.bookingId}
                                </span>
                              </div>
                            </div>

                            {/* Row 3: Quantities & Paid amount strip */}
                            <div className="flex items-center gap-4 py-2 px-3 bg-darkBg/60 border border-darkBorder/40 rounded-xl text-xs text-gray-400">
                              <div>
                                <span>Ticket Quantity:</span>
                                <span className="block text-white font-bold mt-0.5">{booking.ticketCount} Seat(s)</span>
                              </div>
                              <div className="border-l border-darkBorder/60 pl-4">
                                <span>Total Paid:</span>
                                <span className="block text-emerald-400 font-extrabold mt-0.5">
                                  {booking.totalAmount === 0 ? 'Free' : `₹${booking.totalAmount.toLocaleString('en-IN')}`}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Row 4: Expandable Actions (Cancel / Review triggers) */}
                          <div className="mt-5 pt-4 border-t border-darkBorder/40 flex items-center justify-between gap-4 flex-wrap">
                            <span className="text-[10px] text-gray-500">
                              Host Organizer: <span className="text-gray-300 font-medium">{event.organizerId?.name || 'Admin'}</span>
                            </span>

                            {bookingsTab === 'upcoming' ? (
                              /* Cancellation Actions */
                              booking.status === 'confirmed' ? (
                                isRefundable ? (
                                  <button
                                    onClick={() => triggerCancelBooking(booking)}
                                    disabled={cancellingId === booking._id}
                                    className="btn-secondary !py-2 px-4 text-xs font-bold text-red-400 border border-red-500/10 hover:bg-red-950/20 active:scale-[0.98]"
                                  >
                                    {cancellingId === booking._id ? (
                                      <span className="flex items-center gap-1.5">
                                        <Loader2 className="w-3 animate-spin" />
                                        Cancelling...
                                      </span>
                                    ) : (
                                      'Cancel Ticket'
                                    )}
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-gray-500 bg-darkBg border border-darkBorder px-3 py-1.5 rounded-lg select-none cursor-not-allowed">
                                    <BadgeInfo className="w-3.5 h-3.5 text-yellow-500/60" />
                                    <span className="text-[10px] font-semibold">Cancellation Shield Locked (&lt;24h left)</span>
                                  </div>
                                )
                              ) : (
                                <span className="text-xs text-gray-500 italic">No actions available</span>
                              )
                            ) : (
                              /* Past Review Triggers - Day 9 reviews hook */
                              booking.status === 'confirmed' && (
                                <button
                                  onClick={() => navigate(`/events/${event._id}`)}
                                  className="btn-outline !py-1.5 px-4 text-[10px] font-bold border border-primary-500/20 hover:bg-primary-500 hover:text-white flex items-center gap-1"
                                >
                                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                  Share Rating Review
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROFILE & SECURITY EDITOR PANEL */}
          {activeTab === 'profile' && (
            <div className="glass-card p-6 sm:p-8 border border-darkBorder/60 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="border-b border-darkBorder/40 pb-6 mb-6">
                <h1 className="text-2xl font-black">Profile Settings</h1>
                <p className="text-xs text-gray-400 mt-1">Configure your personal credentials and credential security layers</p>
              </div>

              <form onSubmit={handleProfileUpdate} className="space-y-6">
                {/* Form Input: Name */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold block">Account Name</label>
                  <div className="relative flex items-center">
                    <User className="absolute left-4 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Enter your name"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="bg-darkBg/60 border border-darkBorder p-3 pl-12 rounded-xl text-sm focus:outline-none focus:border-primary-500/50 w-full text-white placeholder-gray-500"
                      required
                    />
                  </div>
                </div>

                {/* Form Input: Email */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold block">Email Address</label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      placeholder="Enter email address"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="bg-darkBg/60 border border-darkBorder p-3 pl-12 rounded-xl text-sm focus:outline-none focus:border-primary-500/50 w-full text-white placeholder-gray-500"
                      required
                    />
                  </div>
                </div>

                {/* Segment Trigger: Password Change Toggler */}
                <div className="pt-4 border-t border-darkBorder/40">
                  <button
                    type="button"
                    onClick={() => setShowPasswordChange(!showPasswordChange)}
                    className="flex items-center gap-2 text-xs font-bold text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    <Key className="w-3.5 h-3.5" />
                    {showPasswordChange ? 'Hide Password Rotate Panel' : 'Security: Change Account Password'}
                  </button>
                </div>

                {/* Animated Password Segment */}
                {showPasswordChange && (
                  <div className="space-y-4 p-4 rounded-2xl bg-darkBg/40 border border-darkBorder/30 animate-slide-up">
                    <h3 className="text-xs text-primary-400 font-bold tracking-wide uppercase flex items-center gap-1 mb-2">
                      <Clock className="w-3.5 h-3.5" />
                      Credential Rotation Guard
                    </h3>

                    {/* Current Password */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-bold block">CURRENT PASSWORD</label>
                      <input
                        type="password"
                        placeholder="Enter active current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="bg-darkBg/80 border border-darkBorder/80 p-2.5 rounded-xl text-xs focus:outline-none focus:border-primary-500/50 w-full text-white placeholder-gray-600"
                        required={showPasswordChange}
                      />
                    </div>

                    {/* New Password */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-bold block">NEW PASSWORD</label>
                      <input
                        type="password"
                        placeholder="Enter secure new password (min. 6 chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-darkBg/80 border border-darkBorder/80 p-2.5 rounded-xl text-xs focus:outline-none focus:border-primary-500/50 w-full text-white placeholder-gray-600"
                        required={showPasswordChange}
                      />
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-bold block">CONFIRM NEW PASSWORD</label>
                      <input
                        type="password"
                        placeholder="Verify your new password choice"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-darkBg/80 border border-darkBorder/80 p-2.5 rounded-xl text-xs focus:outline-none focus:border-primary-500/50 w-full text-white placeholder-gray-600"
                        required={showPasswordChange}
                      />
                    </div>
                  </div>
                )}

                {/* Form Submit Container */}
                <div className="pt-4 border-t border-darkBorder/40 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="btn-primary py-3 px-8 text-xs font-bold shadow-lg shadow-primary-500/10 flex items-center gap-1.5 active:scale-[0.98] transition-all duration-150"
                  >
                    {updatingProfile ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving Profile...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

        </section>
      </main>

      {/* Premium Glassmorphic Ticket Cancellation Modal */}
      {showCancelModal && bookingToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass-card p-6 sm:p-8 border-red-500/20 relative animate-slide-up">
            <div className="flex flex-col items-center text-center">
              {/* Bouncing Warning Icon */}
              <div className="bg-red-500/10 p-4 rounded-full text-red-500 border border-red-500/20 mb-6">
                <XCircle className="w-8 h-8 animate-bounce" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">Cancel Ticket?</h3>
              
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Are you sure you want to cancel your seat reservation for <span className="text-white font-semibold">"{bookingToCancel.eventId?.title}"</span>? 
                This will release <strong className="text-white font-bold">{bookingToCancel.ticketCount} seat(s)</strong> back to public inventory.
              </p>
              
              {/* Receipt info inside modal */}
              <div className="w-full p-4 bg-darkBg/60 border border-darkBorder/40 rounded-2xl mb-8 text-left text-xs text-gray-400 space-y-2">
                <div className="flex justify-between">
                  <span>Booking ID:</span>
                  <span className="font-mono text-white font-semibold uppercase">{bookingToCancel.bookingId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Seats:</span>
                  <span className="text-white font-semibold">{bookingToCancel.ticketCount} Ticket(s)</span>
                </div>
                <div className="flex justify-between">
                  <span>Refund Amount:</span>
                  <span className="text-emerald-400 font-bold">
                    {bookingToCancel.totalAmount === 0 ? 'Free' : `₹${bookingToCancel.totalAmount.toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    setBookingToCancel(null);
                  }}
                  className="btn-secondary py-3 px-5 flex-1 text-sm border border-darkBorder font-semibold"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  disabled={cancellingId === bookingToCancel._id}
                  onClick={executeCancelBooking}
                  className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold py-3 px-5 rounded-xl shadow-lg shadow-red-500/10 flex items-center justify-center gap-2 flex-1 text-sm active:scale-[0.98] transition-all duration-200"
                >
                  {cancellingId === bookingToCancel._id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    'Cancel Booking'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
