import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  MapPin, 
  Sparkles, 
  Loader2, 
  Users, 
  DollarSign, 
  ArrowLeft, 
  Ticket, 
  ShieldAlert, 
  Star, 
  MessageSquare,
  CheckCircle2
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-checkout-script')) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const EventDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dynamic Seat state updated live by WebSockets
  const [seatsRemaining, setSeatsRemaining] = useState(0);
  const [pulseSeats, setPulseSeats] = useState(false);
  
  const [ticketCount, setTicketCount] = useState(1);
  const [booking, setBooking] = useState(false);

  // Reviews & Rating states
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // 1. Fetch event specs on mount
  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        const response = await api.get(`/events/${id}`);
        const eventData = response.data.data;
        setEvent(eventData);
        setSeatsRemaining(eventData.seatsRemaining);
      } catch (error) {
        console.error('Failed to load event details:', error);
        toast.error('Failed to load event specifications', {
          className: 'hot-toast-custom',
        });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [id, navigate]);

  // 2. 🚨 Socket.io Live Session Room Joins
  useEffect(() => {
    if (!id) return;

    // Connect to Backend Socket Server dynamically based on env URL
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';
    const socketUrl = apiUrl.replace('/api', '');
    
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log(`🔌 WebSockets connected: joining room event:${id}`);
      socket.emit('join-event-room', id);
    });

    // Listen for seat decrements from other bookings
    socket.on('seat-update', (data) => {
      if (data.eventId === id) {
        console.log(`🔌 WebSocket Seat Update received: ${data.seatsRemaining} left`);
        setSeatsRemaining(data.seatsRemaining);
        
        // Trigger visual highlight pulse
        setPulseSeats(true);
        setTimeout(() => setPulseSeats(false), 800);
      }
    });

    // Cleanup on unmount
    return () => {
      console.log(`🔌 Leaving socket room event:${id}`);
      socket.emit('leave-event-room', id);
      socket.off('seat-update');
      socket.disconnect();
    };
  }, [id]);

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const response = await api.get(`/reviews/event/${id}`);
      setReviews(response.data.data || []);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const checkEligibility = async () => {
    if (!user || user.role !== 'attendee') return;
    try {
      const response = await api.get(`/reviews/check/${id}`);
      setCanReview(response.data.canReview);
    } catch (error) {
      console.error('Failed to check review eligibility:', error);
    }
  };

  useEffect(() => {
    if (id) {
      fetchReviews();
      checkEligibility();
    }
  }, [id, user]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      return toast.error('Please enter a review comment', { className: 'hot-toast-custom' });
    }

    setSubmittingReview(true);
    try {
      await api.post('/reviews', {
        eventId: id,
        rating: reviewRating,
        comment: reviewComment
      });

      toast.success('Your review has been published successfully!', {
        className: 'hot-toast-custom',
      });

      // Clear review fields & refresh reviews + eligibility list
      setReviewComment('');
      setReviewRating(5);
      fetchReviews();
      checkEligibility();
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error(error.response?.data?.message || 'Review submission failed.', {
        className: 'hot-toast-custom',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to reserve seats!', { className: 'hot-toast-custom' });
      navigate('/login');
      return;
    }

    if (user.role === 'organizer') {
      toast.error('Host accounts are restricted from booking attendee tickets', {
        className: 'hot-toast-custom',
      });
      return;
    }

    setBooking(true);
    try {
      const response = await api.post('/bookings', {
        eventId: id,
        ticketCount: Number(ticketCount),
      });

      const bookingData = response.data.data;
      const rzpOrder = response.data.order;

      // 1. Happy Path: Free event checkout (Bypasses Razorpay sandbox entirely)
      if (event.price === 0 || !rzpOrder) {
        toast.success('Free seats reserved successfully!', {
          className: 'hot-toast-custom',
        });
        navigate('/booking/success', {
          state: {
            booking: bookingData,
            event: event
          }
        });
        return;
      }

      // 1.5. Dynamic Local Simulator Fallback (Bypasses remote Razorpay authentication errors)
      if (rzpOrder.isMock) {
        toast('💳 Simulated Payment Sandbox Active...', {
          icon: '⚙️',
          className: 'hot-toast-custom',
          duration: 3000
        });

        // Add a premium 1.5 second simulated delay
        setTimeout(async () => {
          try {
            const verifyResponse = await api.post('/payments/verify', {
              bookingId: bookingData._id,
              razorpay_payment_id: `mock_pay_${Math.random().toString(36).substr(2, 9)}`,
              razorpay_order_id: rzpOrder.id,
              razorpay_signature: 'mock_signature_bypass',
            });

            toast.success('Simulated transaction approved successfully!', {
              className: 'hot-toast-custom',
            });

            navigate('/booking/success', {
              state: {
                booking: verifyResponse.data.data,
                event: event
              }
            });
          } catch (verifyError) {
            console.error('Simulated signature verification failed:', verifyError);
            toast.error('Local transaction verification failed', { className: 'hot-toast-custom' });
          }
        }, 1500);
        return;
      }

      // 2. Paid Checkout Path: Dynamic Razorpay checkout.js load
      const resScript = await loadRazorpayScript();
      if (!resScript) {
        toast.error('Razorpay payment gateway failed to load. Please check your internet connection!', {
          className: 'hot-toast-custom',
        });
        return;
      }

      // 3. Configure Razorpay Sandbox modal checkout options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_dummykeyid', // Test Key
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: 'Evently',
        description: `Admission tickets for ${event.title}`,
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=100&h=100&fit=crop&q=80', // watermarked visual
        order_id: rzpOrder.id,
        handler: async function (responseRzp) {
          try {
            // Verify payment signature on backend
            const verifyResponse = await api.post('/payments/verify', {
              bookingId: bookingData._id,
              razorpay_payment_id: responseRzp.razorpay_payment_id,
              razorpay_order_id: responseRzp.razorpay_order_id,
              razorpay_signature: responseRzp.razorpay_signature,
            });

            toast.success('Payment verified & seats confirmed!', {
              className: 'hot-toast-custom',
            });

            navigate('/booking/success', {
              state: {
                booking: verifyResponse.data.data,
                event: event
              }
            });
          } catch (verifyError) {
            console.error('Payment verification failed:', verifyError);
            toast.error(verifyError.response?.data?.message || 'Payment signature verification failed. Please contact support.', {
              className: 'hot-toast-custom',
            });
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: {
          color: '#7C3AED', // Brand primary purple color
        },
        modal: {
          ondismiss: function () {
            toast.error('Payment checkout dismissed by attendee.', {
              className: 'hot-toast-custom',
            });
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (error) {
      console.error('Booking failed:', error);
      toast.error(error.response?.data?.message || 'Booking checkout failed', {
        className: 'hot-toast-custom',
      });
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <span className="text-gray-400 font-medium">Loading event brochure...</span>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      {/* Back Button */}
      <button 
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm font-semibold mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Explore
      </button>

      {/* Main Grid: Info vs Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Left Column: Event details (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Event Image Banner Frame */}
          <div className="relative aspect-[16/9] w-full rounded-3xl overflow-hidden border border-darkBorder/60 bg-gray-900 shadow-2xl">
            <img src={event.image.url} alt={event.title} className="object-cover w-full h-full" />
            <span className="absolute top-6 left-6 bg-primary-600/90 backdrop-blur-md text-white font-semibold text-xs px-3.5 py-1.5 rounded-full border border-primary-500/20 shadow-lg">
              {event.category}
            </span>
          </div>

          {/* Details Metadata Grid */}
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              {event.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-6 text-gray-400 text-sm border-y border-darkBorder/30 py-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-500" />
                <span className="font-medium">
                  {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} • {event.time}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-500" />
                <span className="font-medium">{event.location}</span>
              </div>
            </div>
          </div>

          {/* Event description */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold">About the Event</h3>
            <p className="text-gray-400 leading-relaxed text-sm sm:text-base whitespace-pre-wrap">
              {event.description}
            </p>
          </div>

          {/* Organizer Card */}
          <div className="p-6 bg-darkCard/30 border border-darkBorder/60 rounded-2xl flex items-center gap-4">
            <div className="bg-primary-500/10 p-3 rounded-full text-primary-400 border border-primary-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-gray-500 text-xs font-semibold block uppercase tracking-wider">Organized by</span>
              <span className="text-base font-bold text-white mt-0.5 block">{event.organizerId?.name || 'Authorized Host'}</span>
              <span className="text-xs text-gray-400 block mt-0.5">{event.organizerId?.email}</span>
            </div>
          </div>

          {/* Reviews and Ratings Section */}
          <div className="border-t border-darkBorder/40 pt-8 space-y-6">
            <div className="flex items-center justify-between border-b border-darkBorder/40 pb-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary-500" />
                  Attendee Reviews
                </h3>
                <p className="text-xs text-gray-400 mt-1">What attendees thought of this experience</p>
              </div>

              {/* Event Average Rating Display summary */}
              {event.reviewCount > 0 && (
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <span className="text-lg font-black text-white block">{event.averageRating ? event.averageRating.toFixed(1) : '0.0'} / 5.0</span>
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mt-0.5">Based on {event.reviewCount} rating{event.reviewCount > 1 ? 's' : ''}</span>
                  </div>
                  <div className="bg-yellow-500/10 p-2.5 rounded-xl border border-yellow-500/20 text-yellow-400">
                    <Star className="w-5 h-5 fill-current" />
                  </div>
                </div>
              )}
            </div>

            {/* Write a Review segment (Post-Event & Eligibility checked) */}
            {canReview && (
              <div className="glass-card p-6 border border-darkBorder/80 space-y-5 animate-slide-up relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-xl pointer-events-none"></div>
                
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary-400" />
                    Review Your Experience
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Your booking confirmed your attendance. Rate and share your detailed thoughts!</p>
                </div>

                <form onSubmit={handleSubmitReview} className="space-y-4">
                  {/* Clickable Star Rating Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-bold block">STAR RATING</label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="transition-transform duration-100 hover:scale-110 focus:outline-none"
                        >
                          <Star 
                            className={`w-6 h-6 ${
                              star <= reviewRating 
                                ? 'text-yellow-400 fill-current' 
                                : 'text-gray-600 hover:text-yellow-500/80'
                            }`} 
                          />
                        </button>
                      ))}
                      <span className="text-xs text-gray-400 font-bold ml-2">
                        {reviewRating === 5 ? 'Excellent (5/5)' : reviewRating === 4 ? 'Very Good (4/5)' : reviewRating === 3 ? 'Good (3/5)' : reviewRating === 2 ? 'Fair (2/5)' : 'Poor (1/5)'}
                      </span>
                    </div>
                  </div>

                  {/* Comment input textarea */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-bold block">REVIEW DETAILS</label>
                    <textarea
                      placeholder="What did you think of the venue, organizer, and actual activities? Share a helpful review..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="w-full bg-darkBg/60 border border-darkBorder p-3 rounded-xl text-xs focus:outline-none focus:border-primary-500/50 text-white placeholder-gray-500 leading-relaxed"
                      required
                    />
                    <div className="text-[10px] text-gray-500 text-right">
                      {reviewComment.length} / 500 characters maximum
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="btn-primary py-2.5 px-6 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-primary-500/10 active:scale-[0.98]"
                    >
                      {submittingReview ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Publishing...
                        </>
                      ) : (
                        'Submit Review'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Public Roster list */}
            {loadingReviews ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Loading reviews...</span>
              </div>
            ) : reviews.length === 0 ? (
              /* Reviews Zero-State */
              <div className="glass-card text-center p-8 max-w-sm mx-auto flex flex-col items-center border-dashed border-2">
                <div className="bg-primary-500/10 p-3 rounded-2xl text-primary-400 border border-primary-500/20 mb-4">
                  <Star className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold mb-1">No Reviews Yet</h4>
                <p className="text-gray-400 text-xs leading-relaxed">
                  No attendees have rated this event yet. Be the first to share your thoughts once you've attended!
                </p>
              </div>
            ) : (
              /* Review Listing Grid */
              <div className="space-y-4">
                {reviews.map((review) => {
                  const initial = review.userId?.name
                    ? review.userId.name.charAt(0).toUpperCase()
                    : 'U';
                  
                  return (
                    <div 
                      key={review._id} 
                      className="glass-card p-5 border border-darkBorder/40 flex gap-4 animate-fade-in hover:border-darkBorder/60"
                    >
                      {/* Avatar Circle */}
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center text-white font-extrabold text-xs shrink-0 select-none shadow">
                        {initial}
                      </div>

                      {/* Content block */}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <span className="font-extrabold text-white text-xs sm:text-sm">
                            {review.userId?.name || 'Anonymous Attendee'}
                          </span>
                          
                          {/* Star counts */}
                          <div className="flex items-center gap-0.5 select-none">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star 
                                key={star} 
                                className={`w-3.5 h-3.5 ${
                                  star <= review.rating 
                                    ? 'text-yellow-400 fill-current' 
                                    : 'text-gray-700'
                                }`} 
                              />
                            ))}
                          </div>
                        </div>

                        {/* Comment text */}
                        <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap pr-4">
                          {review.comment}
                        </p>

                        <div className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider pt-1 flex items-center justify-end">
                          Reviewed: {new Date(review.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Checkout Ticket Widget (1/3 width) */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 sm:p-8 border border-darkBorder/80 sticky top-28 shadow-2xl flex flex-col gap-6">
            {new Date(event.date) < new Date() ? (
              <div className="flex flex-col gap-5 py-4">
                {/* Clean Concluded Header */}
                <div className="flex items-center gap-2 border-b border-darkBorder/40 pb-4">
                  <span className="bg-red-500/10 text-red-400 font-extrabold text-[10px] px-2.5 py-1 rounded-md border border-red-500/20 uppercase tracking-wider">
                    Concluded
                  </span>
                  <h3 className="text-lg font-bold text-white">Event Concluded</h3>
                </div>
                
                {/* Concluded Info details */}
                <div className="p-5 bg-darkBg/60 border border-darkBorder/40 text-gray-400 rounded-2xl flex flex-col items-center justify-center text-center gap-3.5 py-7 relative overflow-hidden">
                  <div className="bg-gray-800/40 p-3.5 rounded-2xl border border-white/5 text-gray-400">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <p className="text-[11px] text-gray-500 max-w-[200px] leading-relaxed">
                    Booking is closed as this event took place on {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold border-b border-darkBorder/40 pb-4">Ticket Checkout</h3>

                {/* Price Details */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Ticket Price</span>
                  <span className="text-2xl font-black text-white">
                    {event.price === 0 ? 'Free' : `₹${event.price}`}
                  </span>
                </div>

                {/* Live seats tracker */}
                <div className={`p-4 rounded-2xl bg-darkBg/60 border border-darkBorder/40 flex items-center justify-between text-xs text-gray-400 transition-all duration-300 ${
                  pulseSeats ? 'border-primary-500 ring-1 ring-primary-500 scale-[1.02] bg-primary-500/5' : ''
                }`}>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary-400" />
                    <span>Seats Available</span>
                  </div>
                  <span className={`font-extrabold text-sm ${seatsRemaining === 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                    {seatsRemaining === 0 ? 'Sold Out' : `${seatsRemaining} / ${event.capacity}`}
                  </span>
                </div>

                {/* Booking flow condition checks */}
                {user && user.role === 'organizer' ? (
                  <div className="p-4 bg-yellow-950/20 border border-yellow-500/20 text-yellow-400 rounded-xl flex gap-2.5 text-xs leading-relaxed">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <p>Hosts are restricted from purchasing tickets. To book, please sign in with an attendee profile account.</p>
                  </div>
                ) : seatsRemaining === 0 ? (
                  <div className="p-4 bg-red-950/20 border border-red-500/20 text-red-400 rounded-xl flex gap-2.5 text-xs justify-center font-bold">
                    🎫 This event is completely sold out!
                  </div>
                ) : (
                  <form onSubmit={handleBooking} className="space-y-6">
                    {/* Quantity selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-400">Select Quantity</label>
                      <select
                        value={ticketCount}
                        onChange={(e) => setTicketCount(Number(e.target.value))}
                        className="form-input bg-darkBg text-white cursor-pointer font-bold"
                      >
                        {Array.from({ length: Math.min(5, seatsRemaining) }, (_, idx) => idx + 1).map((qty) => (
                          <option key={qty} value={qty}>{qty} Ticket{qty > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>

                    {/* Total pricing calculation */}
                    {event.price > 0 && (
                      <div className="flex items-center justify-between text-sm border-t border-darkBorder/40 pt-4">
                        <span className="text-gray-400">Total Price</span>
                        <span className="text-xl font-bold text-emerald-400">₹{(event.price * ticketCount).toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={booking}
                      className="w-full btn-primary flex items-center justify-center gap-2 py-3.5 shadow-xl font-bold"
                    >
                      {booking ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Reserving Seats...
                        </>
                      ) : (
                        <>
                          <Ticket className="w-5 h-5" />
                          Book Now
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Login redirect notice */}
                {!user && (
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full btn-outline flex items-center justify-center gap-2 py-3.5 text-sm"
                  >
                    Sign In to Reserve Tickets
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailPage;
