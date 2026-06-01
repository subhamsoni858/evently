import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Link } from 'react-router-dom';
import { Calendar, MapPin, Search, Sparkles, Plus, LogIn, User, ArrowRight, Heart, LogOut, Star } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OrganizerDashboard from './pages/OrganizerDashboard';
import CreateEventPage from './pages/CreateEventPage';
import EditEventPage from './pages/EditEventPage';
import api from './utils/api';
import EventDetailPage from './pages/EventDetailPage';
import BookingSuccessPage from './pages/BookingSuccessPage';
import UserDashboard from './pages/UserDashboard';

// Subcomponent: Landing & Discovery View
function LandingPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [priceFilter, setPriceFilter] = useState(''); // '', 'free', 'paid'
  const [dateFilter, setDateFilter] = useState(''); // '', 'today', 'week', 'month'
  
  // Pagination States
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Public category pills list
  const categoriesList = ['All', 'Tech', 'Music', 'Comedy', 'Workshop', 'Sports', 'Art', 'Food', 'Business', 'Other'];

  const fetchEvents = async (resetPage = false) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    try {
      const response = await api.get('/events', {
        params: {
          search: searchQuery || undefined,
          category: activeCategory !== 'All' ? activeCategory : undefined,
          price: priceFilter || undefined,
          dateRange: dateFilter || undefined,
          page: currentPage,
          limit: 6
        }
      });
      setEvents(response.data.data);
      setTotalPages(response.data.totalPages || 1);
      setTotalEvents(response.data.totalEvents || 0);
    } catch (error) {
      console.error('Failed to load events:', error);
      toast.error('Failed to fetch events from database', {
        className: 'hot-toast-custom',
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch events when filters or page adjustments change
  useEffect(() => {
    fetchEvents();
  }, [activeCategory, priceFilter, dateFilter, page]);

  // Search submit handler
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    fetchEvents(true); // Reset to page 1 on new search
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveCategory('All');
    setPriceFilter('');
    setDateFilter('');
    setPage(1);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-darkBg text-gray-100 font-sans">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-darkBg/80 backdrop-blur-lg border-b border-darkBorder/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <div onClick={() => navigate('/')} className="flex items-center gap-2 cursor-pointer group">
            <div className="bg-primary-600 p-2 rounded-xl text-white group-hover:bg-primary-500 transition-colors shadow-lg shadow-primary-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-primary-400 font-sans">
              Evently
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-gray-400 font-medium text-sm">
            <span className="text-white hover:text-white cursor-pointer transition-colors" onClick={() => navigate('/')}>Explore</span>
            {user && user.role === 'organizer' && (
              <span className="hover:text-white cursor-pointer transition-colors text-primary-400 hover:text-primary-300 font-semibold" onClick={() => navigate('/organizer/dashboard')}>Host Panel</span>
            )}
            {user && user.role === 'attendee' && (
              <span className="hover:text-white cursor-pointer transition-colors text-primary-400 hover:text-primary-300 font-semibold" onClick={() => navigate('/dashboard')}>My Bookings</span>
            )}
            <span className="hover:text-white cursor-pointer transition-colors" onClick={handleResetFilters}>Reset Filters</span>
          </nav>

          {/* Dynamic Auth Actions */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                {/* User Capsule (Clickable Navigation) */}
                <div 
                  className="hidden sm:flex flex-col text-right cursor-pointer hover:opacity-80 transition-opacity animate-fade-in"
                  onClick={() => navigate(user.role === 'organizer' ? '/organizer/dashboard' : '/dashboard')}
                >
                  <span className="text-white font-semibold text-sm leading-none">{user.name}</span>
                  <span className="text-primary-400 text-xs mt-1 font-semibold uppercase tracking-wider">{user.role}</span>
                </div>
                
                {/* Logout */}
                <button 
                  onClick={logout}
                  className="btn-secondary flex items-center gap-2 text-sm !py-2 px-4 border border-darkBorder hover:border-red-500/30 hover:text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => navigate('/login')}
                  className="btn-secondary flex items-center gap-2 text-sm !py-2 px-4"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
                <button 
                  onClick={() => navigate('/signup')}
                  className="btn-primary flex items-center gap-2 text-sm !py-2 px-4 shadow-md"
                >
                  <User className="w-4 h-4" />
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl leading-[1.1] mb-6">
          Discover, Create and Book <br className="hidden sm:inline" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 via-primary-500 to-violet-500">
            Unforgettable Events
          </span>
        </h1>

        <p className="text-gray-400 text-lg sm:text-xl max-w-2xl font-light mb-10 leading-relaxed">
          Experience real-time seat availability, frictionless payments via Razorpay, and instant background-processed tickets for premier workshops, concerts, and tech gatherings.
        </p>

        {/* Search Bar */}
        <form 
          onSubmit={handleSearchSubmit} 
          className="w-full max-w-2xl bg-darkCard border border-darkBorder p-2 rounded-2xl flex items-center gap-2 shadow-2xl focus-within:border-primary-500/50 transition-all duration-300"
        >
          <div className="flex items-center gap-2 flex-1 pl-3 text-gray-500">
            <Search className="w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search tech hackathons, music gigs, venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none w-full placeholder-gray-500 text-sm"
            />
          </div>
          <button 
            type="submit"
            className="btn-primary flex items-center gap-2 text-sm py-2 px-6"
          >
            Find Events
          </button>
        </form>
      </section>

      {/* Discovery Filters Ribbon */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-darkBorder/40">
        {/* Category Pills Slider */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-darkBorder">
          {categoriesList.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setPage(1); // Reset page
              }}
              className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                activeCategory === cat
                  ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-500/10'
                  : 'bg-darkCard/40 border-darkBorder text-gray-400 hover:border-gray-700 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Price & Date Dropdowns Ribbon */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Ticket Cost:</span>
            <select
              value={priceFilter}
              onChange={(e) => {
                setPriceFilter(e.target.value);
                setPage(1);
              }}
              className="bg-darkCard border border-darkBorder text-gray-300 px-3 py-2 rounded-xl focus:outline-none focus:border-primary-500 cursor-pointer"
            >
              <option value="">All Prices</option>
              <option value="free">Free Events Only</option>
              <option value="paid">Paid Events Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500">Scheduled:</span>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="bg-darkCard border border-darkBorder text-gray-300 px-3 py-2 rounded-xl focus:outline-none focus:border-primary-500 cursor-pointer"
            >
              <option value="">Any Time</option>
              <option value="today">Today Only</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          {/* Reset Filters Quick Button */}
          {(searchQuery || activeCategory !== 'All' || priceFilter || dateFilter) && (
            <button
              onClick={handleResetFilters}
              className="text-primary-400 hover:text-primary-300 transition-colors underline ml-auto cursor-pointer"
            >
              Clear Active Filters
            </button>
          )}
        </div>
      </section>

      {/* Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass-card flex flex-col overflow-hidden animate-pulse">
                <div className="aspect-[16/10] bg-darkCard/80 border-b border-darkBorder/40"></div>
                <div className="p-6 space-y-4">
                  <div className="h-6 bg-darkCard/80 rounded w-3/4"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-darkCard/80 rounded w-1/2"></div>
                    <div className="h-4 bg-darkCard/80 rounded w-2/3"></div>
                  </div>
                  <div className="h-10 bg-darkCard/80 rounded w-full pt-4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          // Empty State
          <div className="glass-card text-center p-12 max-w-xl mx-auto flex flex-col items-center justify-center mt-12 border-dashed border-2">
            <div className="bg-primary-500/10 p-4 rounded-3xl text-primary-400 border border-primary-500/20 mb-6">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">No Matching Events</h3>
            <p className="text-gray-400 text-sm max-w-xs leading-relaxed mb-6">
              We couldn't find any events matching your selected filters or search terms. Try widening your parameters.
            </p>
            <button
              onClick={handleResetFilters}
              className="btn-primary py-2.5 px-6 text-sm"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          // Active Event Grid
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {events.map((event) => (
                <div 
                  key={event._id} 
                  className="glass-card glass-card-hover flex flex-col group overflow-hidden border border-darkBorder/60"
                >
                  {/* Poster image */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-900 border-b border-darkBorder/40">
                    <img 
                      src={event.image.url} 
                      alt={event.title}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-4 left-4 bg-primary-600/90 backdrop-blur-md text-white font-semibold text-xs px-3 py-1 rounded-full border border-primary-500/20">
                      {event.category}
                    </span>
                    {event.averageRating > 0 && (
                      <span className="absolute top-4 right-4 bg-black/75 backdrop-blur-md text-yellow-400 font-bold text-xs px-2.5 py-1 rounded-lg border border-yellow-500/20 flex items-center gap-1 select-none">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {event.averageRating.toFixed(1)}
                      </span>
                    )}
                    <span className="absolute bottom-4 right-4 bg-black/75 backdrop-blur-md text-gray-200 font-semibold text-xs px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${event.seatsRemaining === 0 ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                      {event.seatsRemaining} / {event.capacity} left
                    </span>
                  </div>

                  {/* Info Details */}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2.5 line-clamp-1 group-hover:text-primary-400 transition-colors">
                        {event.title}
                      </h3>
                      
                      <div className="flex flex-col gap-2 text-gray-400 text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary-500" />
                          <span>{new Date(event.date).toLocaleDateString('en-US', { dateStyle: 'medium' })} • {event.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary-500" />
                          <span className="line-clamp-1">{event.location}</span>
                        </div>
                      </div>
                      
                      {/* Host Name label */}
                      <span className="text-[10px] bg-darkBg border border-darkBorder/80 text-gray-500 font-medium tracking-wide uppercase px-2.5 py-1 rounded-md inline-block mb-4">
                        Host: {event.organizerId?.name || 'Unknown'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-darkBorder/60">
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-xs font-medium">Tickets from</span>
                        <span className="text-xl font-extrabold text-white">
                          {event.price === 0 ? 'Free' : `₹${event.price}`}
                        </span>
                      </div>
                      <button 
                        onClick={() => navigate(`/events/${event._id}`)}
                        className="btn-outline flex items-center gap-1 py-2 px-4 text-xs font-semibold hover:bg-primary-500 hover:text-white"
                      >
                        Book Now
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Pagination Selector Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12 pt-6 border-t border-darkBorder/20">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="btn-secondary !py-2 px-4 text-xs border border-darkBorder font-semibold disabled:opacity-30 disabled:pointer-events-none"
                >
                  Prev
                </button>
                
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pNum) => (
                  <button
                    key={pNum}
                    onClick={() => setPage(pNum)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all duration-200 border ${
                      page === pNum
                        ? 'bg-primary-600 border-primary-500 text-white shadow-md'
                        : 'bg-darkCard/20 border-darkBorder text-gray-400 hover:border-gray-700 hover:text-white'
                    }`}
                  >
                    {pNum}
                  </button>
                ))}

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="btn-secondary !py-2 px-4 text-xs border border-darkBorder font-semibold disabled:opacity-30 disabled:pointer-events-none"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-darkCard/30 border-t border-darkBorder/40 py-10 mt-16 text-center text-gray-500 text-sm">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary-500" />
            <span className="font-bold text-gray-300">Evently Inc.</span>
          </div>
          <p>© 2026 Evently Inc. All rights reserved.</p>
          <div className="flex items-center gap-1 text-xs">
            Made with <Heart className="w-3 h-3 text-red-500 fill-current" /> in India
          </div>
        </div>
      </footer>
    </div>
  );
}

// Global Application Router Wrapper with Auth Context
function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="bottom-right" reverseOrder={false} />
        
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* Organizer Event Management Routes */}
          <Route path="/organizer/dashboard" element={<OrganizerDashboard />} />
          <Route path="/organizer/create-event" element={<CreateEventPage />} />
          <Route path="/organizer/edit-event/:id" element={<EditEventPage />} />

          {/* Attendee Booking System Routes */}
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/booking/success" element={<BookingSuccessPage />} />
          <Route path="/dashboard" element={<UserDashboard />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
