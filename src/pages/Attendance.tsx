import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  History, 
  Calendar, 
  User, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  AlertCircle,
  Timer,
  LogIn,
  LogOut,
  ChevronRight,
  Filter,
  Search,
  ArrowRightLeft,
  FileText, 
  Check, 
  X as CloseIcon, 
  MessageSquare, 
  CalendarOff,
  BarChart3
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  Timestamp,
  serverTimestamp,
  getDocs,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocations } from '@/contexts/LocationContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Attendance as AttendanceType, Schedule, UserProfile, AttendanceRequest } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format, isSameDay, startOfDay, endOfDay, parse, isValid, addDays, differenceInMinutes, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { logAction } from '@/lib/audit';

export const Attendance: React.FC = () => {
  const { profile, isAdmin, isManager } = useAuth();
  const { locations, selectedLocationId } = useLocations();
  const { settings } = useSettings();
  
  const [currentUserAttendance, setCurrentUserAttendance] = useState<AttendanceType | null>(null);
  const [personalLogs, setPersonalLogs] = useState<AttendanceType[]>([]);
  const [allLogs, setAllLogs] = useState<AttendanceType[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Partial<Schedule> | null>(null);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkConfig, setBulkConfig] = useState({
    userId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    startTime: '12:00',
    endTime: '21:00',
    daysOff: [0, 6] as number[] // Sat, Sun off as requested (0=Sun, 6=Sat)
  });
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [newRequest, setNewRequest] = useState<Partial<AttendanceRequest>>({
    type: 'leave',
    status: 'pending',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    reason: ''
  });
  
  const [reportStartDate, setReportStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  const getTimeInMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const formatSafeDate = (dateStr: string | undefined, formatStr: string = 'MMM dd, yyyy') => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isValid(d) ? format(d, formatStr) : dateStr;
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;

    // Listen to personal attendance requests
    const qRequests = isManager || isAdmin 
      ? query(collection(db, 'attendanceRequests'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'attendanceRequests'), where('userId', '==', profile.id));

    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRequest));
      if (!isManager && !isAdmin) {
        docs.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
          const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        });
      }
      setRequests(docs);
    });

    // Listen to today's personal attendance
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const qToday = query(
      collection(db, 'attendance'),
      where('userId', '==', profile.id),
      where('date', '==', todayStr),
      limit(1)
    );
    
    const unsubscribeToday = onSnapshot(qToday, (snapshot) => {
      if (!snapshot.empty) {
        setCurrentUserAttendance({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AttendanceType);
      } else {
        setCurrentUserAttendance(null);
      }
    });

    // Listen to personal history
    const qHistory = query(
      collection(db, 'attendance'),
      where('userId', '==', profile.id)
    );
    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceType));
      logs.sort((a, b) => b.date.localeCompare(a.date));
      setPersonalLogs(logs.slice(0, 10));
    });

    // Listen to all users (for schedule management)
    if (isAdmin || isManager) {
      const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
      });

      const unsubscribeSchedules = onSnapshot(collection(db, 'schedules'), (snapshot) => {
        setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)));
      });

      const unsubscribeAllLogs = onSnapshot(
        query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(1000)),
        (snapshot) => {
          setAllLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceType)));
          setLoading(false);
        }
      );

      return () => {
        unsubscribeRequests();
        unsubscribeToday();
        unsubscribeHistory();
        unsubscribeUsers();
        unsubscribeSchedules();
        unsubscribeAllLogs();
      };
    } else {
      setLoading(false);
      return () => {
        unsubscribeRequests();
        unsubscribeToday();
        unsubscribeHistory();
      };
    }
  }, [profile?.id, isAdmin, isManager]);

  const handleTimeIn = async () => {
    if (!profile) return;
    if (selectedLocationId === 'all') {
      toast.error('Please select a specific location to time in');
      return;
    }

    try {
      const location = locations.find(l => l.id === selectedLocationId);
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      
      const attendanceData = {
        userId: profile.id,
        userName: profile.name || 'Staff',
        date: todayStr,
        timeIn: serverTimestamp(),
        timeOut: null,
        locationId: selectedLocationId,
        locationName: location?.name || 'Unknown',
        notes: ''
      };

      await addDoc(collection(db, 'attendance'), attendanceData);
      toast.success('Successfully timed in!');
      await logAction(profile, 'TIME_IN', `Timed in at ${location?.name}`);
    } catch (error) {
      console.error('Error timing in:', error);
      toast.error('Failed to time in');
    }
  };

  const handleTimeOut = async () => {
    if (!currentUserAttendance || !profile) return;

    try {
      const docRef = doc(db, 'attendance', currentUserAttendance.id);
      await updateDoc(docRef, {
        timeOut: serverTimestamp()
      });
      toast.success('Successfully timed out!');
      await logAction(profile, 'TIME_OUT', `Timed out from ${currentUserAttendance.locationName}`);
    } catch (error) {
      console.error('Error timing out:', error);
      toast.error('Failed to time out');
    }
  };

  const handleSaveSchedule = async () => {
    if (!editingSchedule || !profile) return;
    
    try {
      const scheduleData = {
        ...editingSchedule,
        updatedAt: serverTimestamp()
      };

      if (editingSchedule.id) {
        const docRef = doc(db, 'schedules', editingSchedule.id);
        delete (scheduleData as any).id;
        await updateDoc(docRef, scheduleData);
        toast.success('Schedule updated');
      } else {
        await addDoc(collection(db, 'schedules'), scheduleData);
        toast.success('Schedule created');
      }
      
      setIsScheduleDialogOpen(false);
      setEditingSchedule(null);
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Failed to save schedule');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!id) {
      toast.error('Invalid schedule ID');
      return;
    }
    
    const isConfirmed = window.confirm('Are you sure you want to delete this schedule entry?');
    if (!isConfirmed) return;

    try {
      await deleteDoc(doc(db, 'schedules', id));
      toast.success('Schedule deleted successfully');
      await logAction(profile, 'DELETE_SCHEDULE', `Deleted schedule entry ${id}`);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule. Please try again.');
    }
  };

  const handleSubmitRequest = async () => {
    if (!profile || !newRequest.reason) {
      toast.error('Please provide a reason');
      return;
    }

    try {
      const requestData = {
        ...newRequest,
        userId: profile.id,
        userName: profile.name || profile.email,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'attendanceRequests'), requestData);
      toast.success('Request submitted successfully');
      setIsRequestDialogOpen(false);
      setNewRequest({
        type: 'leave',
        status: 'pending',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        reason: ''
      });
      await logAction(profile, 'REQUEST_SUBMITTED', `Submitted a ${newRequest.type} request`);
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request');
    }
  };

  const handleReviewRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'attendanceRequests', requestId), {
        status,
        reviewedBy: profile.id,
        reviewedByName: profile.name || profile.email,
        reviewedAt: serverTimestamp()
      });
      toast.success(`Request ${status}`);
      await logAction(profile, `REQUEST_${status.toUpperCase()}`, `Request ${requestId} was ${status}`);
    } catch (error) {
      toast.error('Failed to update request');
    }
  };

  const handleGenerateBulkSchedule = async () => {
    if (!profile || !bulkConfig.userId || !bulkConfig.startDate || !bulkConfig.endDate) {
      toast.error('Please complete all bulk generator fields');
      return;
    }

    try {
      setLoading(true);
      const start = new Date(bulkConfig.startDate);
      const end = new Date(bulkConfig.endDate);
      
      if (!isValid(start) || !isValid(end)) {
        toast.error('Invalid date range selected');
        return;
      }

      const days = eachDayOfInterval({ start, end });
      const batch = writeBatch(db);

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = day.getDay();
        const isDayOff = bulkConfig.daysOff.includes(dayOfWeek);
        
        // Find existing schedule for this date if any (more efficient to check from already loaded schedules)
        const existing = schedules.find(s => s.userId === bulkConfig.userId && s.date === dateStr);
        
        const scheduleData = {
          userId: bulkConfig.userId,
          userName: allUsers.find(u => u.id === bulkConfig.userId)?.name || allUsers.find(u => u.id === bulkConfig.userId)?.email || bulkConfig.userId,
          date: dateStr,
          isDayOff: isDayOff,
          startTime: isDayOff ? null : bulkConfig.startTime,
          endTime: isDayOff ? null : bulkConfig.endTime,
          updatedAt: serverTimestamp()
        };

        if (existing) {
          batch.update(doc(db, 'schedules', existing.id), scheduleData);
        } else {
          batch.set(doc(collection(db, 'schedules')), scheduleData);
        }
      }

      await batch.commit();
      toast.success('Bulk schedule generated successfully');
      setIsBulkDialogOpen(false);
      await logAction(profile, 'BULK_SCHEDULE_GENERATED', `Populated schedule for staff ${bulkConfig.userId} from ${bulkConfig.startDate} to ${bulkConfig.endDate}`);
    } catch (error) {
      console.error('Error in bulk generation:', error);
      toast.error('Failed to generate bulk schedule');
    } finally {
      setLoading(false);
    }
  };

  const calculateStaffStats = (userId: string) => {
    if (!reportStartDate || !reportEndDate) {
      return { totalHours: '0.0', lateMinutes: 0, absences: 0, leaves: 0 };
    }

    try {
      const start = startOfDay(new Date(reportStartDate));
      const end = endOfDay(new Date(reportEndDate));
      
      if (!isValid(start) || !isValid(end)) {
        return { totalHours: '0.0', lateMinutes: 0, absences: 0, leaves: 0 };
      }

      const days = eachDayOfInterval({ start, end });
      
      let totalWorkMinutes = 0;
      let lateMinutes = 0;
      let absences = 0;
      let leaves = 0;

      const staffSchedules = schedules.filter(s => s.userId === userId);
      const staffLogs = allLogs.filter(l => l.userId === userId);
      const staffRequests = requests.filter(r => r.userId === userId && r.status === 'approved');

      days.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const schedule = staffSchedules.find(s => s.date === dayStr);
        const log = staffLogs.find(l => l.date === dayStr);
        const leaveRequest = staffRequests.find(r => r.type === 'leave' && r.startDate <= dayStr && (r.endDate || r.startDate) >= dayStr);
        const schChange = staffRequests.find(r => r.type === 'schedule_change' && r.startDate === dayStr);

        if (leaveRequest) {
          leaves++;
          return;
        }

        // Important: Absence is only if there IS a schedule (not a day off) and NO log
        if (schedule && !schedule.isDayOff) {
          if (!log) {
            if (isPast(day) && !isToday(day)) {
              absences++;
            }
          } else {
            if (log.timeIn && log.timeOut) {
              const duration = differenceInMinutes(log.timeOut.toDate(), log.timeIn.toDate());
              totalWorkMinutes += duration;
            }

            const effectiveStartTime = schChange?.newStartTime || schedule.startTime;
            if (effectiveStartTime && log.timeIn) {
              const schedInMinutes = getTimeInMinutes(effectiveStartTime);
              const actualInMinutes = log.timeIn.toDate().getHours() * 60 + log.timeIn.toDate().getMinutes();
              if (actualInMinutes > schedInMinutes) {
                lateMinutes += (actualInMinutes - schedInMinutes);
              }
            }
          }
        }
      });

      return {
        totalHours: (totalWorkMinutes / 60).toFixed(1),
        lateMinutes,
        absences,
        leaves
      };
    } catch (error) {
      console.error('Error calculating staff stats:', error);
      return { totalHours: '0.0', lateMinutes: 0, absences: 0, leaves: 0 };
    }
  };

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getDateSchedule = (userId: string, dateStr: string) => {
    return schedules.find(s => s.userId === userId && s.date === dateStr);
  };

  const filteredSchedules = schedules.filter(sch => {
    const searchLower = scheduleSearch.toLowerCase();
    const staffName = sch.userName || allUsers.find(u => u.id === sch.userId)?.name || sch.userId;
    return (
      staffName?.toLowerCase().includes(searchLower) ||
      sch.date.includes(searchLower)
    );
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tight font-heading">Attendance</h1>
          <p className="text-muted-foreground mt-1">Manage schedules and track your working hours.</p>
        </div>
        <div className="flex items-center gap-3 bg-white/50 backdrop-blur-sm px-6 py-3 rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="text-right">
            <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">{format(currentDate, 'EEEE, MMMM dd')}</p>
            <p className="text-xl font-black text-primary tabular-nums">{format(currentTime, 'HH:mm:ss')}</p>
          </div>
          <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center">
            <Timer className="w-6 h-6 text-primary" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Action Section */}
        <div className="lg:col-span-4 space-y-6">
          <Card className={cn(
            "relative overflow-hidden border-none shadow-2xl transition-all duration-500",
            currentUserAttendance && !currentUserAttendance.timeOut ? "bg-gradient-to-br from-indigo-600 to-indigo-700" : "bg-white"
          )}>
            <CardHeader className="relative z-10">
              <CardTitle className={cn(
                "text-lg font-bold",
                currentUserAttendance && !currentUserAttendance.timeOut ? "text-white" : "text-primary"
              )}>
                Timesheet Control
              </CardTitle>
              <CardDescription className={currentUserAttendance && !currentUserAttendance.timeOut ? "text-white/60" : ""}>
                Clock in when starting shift, clock out when finished.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 flex flex-col items-center py-6">
              <div className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-xl animate-pulse ring-8",
                currentUserAttendance && !currentUserAttendance.timeOut 
                  ? "bg-white/10 ring-white/5 text-white" 
                  : "bg-primary/5 ring-primary/5 text-primary"
              )}>
                <Clock className="w-10 h-10" />
              </div>

              {!currentUserAttendance ? (
                <div className="w-full space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-primary/40" />
                      <div>
                        <p className="text-[10px] font-bold text-primary/40 uppercase">Location</p>
                        <p className="text-sm font-bold text-primary">
                          {selectedLocationId === 'all' ? 'Select location first' : locations.find(l => l.id === selectedLocationId)?.name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button 
                    className="w-full h-16 text-lg font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95 group"
                    onClick={handleTimeIn}
                    disabled={selectedLocationId === 'all'}
                  >
                    <LogIn className="w-6 h-6 mr-3 group-hover:translate-x-1 transition-transform" />
                    TIME IN
                  </Button>
                </div>
              ) : !currentUserAttendance.timeOut ? (
                <div className="w-full space-y-6">
                  <div className="space-y-2 text-center text-white">
                    <p className="text-sm font-bold opacity-60 uppercase tracking-widest">Shift Started</p>
                    <p className="text-3xl font-black">
                      {currentUserAttendance.timeIn ? format(currentUserAttendance.timeIn.toDate(), 'HH:mm') : '--:--'}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-xs font-medium opacity-80">
                      <MapPin className="w-3 h-3" />
                      {currentUserAttendance.locationName}
                    </div>
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full h-16 text-lg font-black bg-white hover:bg-slate-50 text-rose-600 border-none rounded-2xl shadow-xl shadow-black/20 transition-all active:scale-95 group"
                    onClick={handleTimeOut}
                  >
                    <LogOut className="w-6 h-6 mr-3 group-hover:-translate-x-1 transition-transform" />
                    TIME OUT
                  </Button>
                </div>
              ) : (
                <div className="w-full text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-black text-primary">Shift Completed</p>
                    <p className="text-sm text-muted-foreground">You are clocked out for today.</p>
                  </div>
                  <div className="flex items-center justify-center gap-6 pt-4">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">In</p>
                      <p className="text-sm font-bold text-primary">
                        {currentUserAttendance.timeIn ? format(currentUserAttendance.timeIn.toDate(), 'HH:mm') : '--:--'}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Out</p>
                      <p className="text-sm font-bold text-primary">
                        {currentUserAttendance.timeOut ? format(currentUserAttendance.timeOut.toDate(), 'HH:mm') : '--:--'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            {/* Background elements */}
            <div className="absolute top-0 right-0 -transtale-y-1/2 translate-x-1/2 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-48 h-48 bg-black/5 rounded-full blur-3xl pointer-events-none" />
          </Card>

          <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary/40" />
                Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {(() => {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const schedule = getDateSchedule(profile?.id || '', todayStr);
                if (!schedule || schedule.isDayOff) return (
                  <div className="text-center py-4">
                    <CalendarOff className="w-10 h-10 text-slate-500/20 mx-auto mb-3" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{schedule?.isDayOff ? 'Day Off' : 'No Schedule Set'}</p>
                    <p className="text-[10px] mt-1 text-slate-400">Enjoy your rest or consult manager.</p>
                  </div>
                );
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                          <LogIn className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-500">Scheduled In</span>
                      </div>
                      <span className="text-sm font-black text-primary">{schedule.startTime}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                          <LogOut className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-500">Scheduled Out</span>
                      </div>
                      <span className="text-sm font-black text-primary">{schedule.endTime}</span>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* View Selection Section */}
        <div className="lg:col-span-8">
          <Tabs defaultValue="history" className="w-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList className="bg-slate-100/50 p-1 rounded-2xl min-h-12 border border-slate-200/60 overflow-x-auto max-w-full flex">
                <TabsTrigger value="history" className="rounded-xl px-6 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wide">
                  My History
                </TabsTrigger>
                <TabsTrigger value="requests" className="rounded-xl px-6 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wide">
                  Requests
                </TabsTrigger>
                {(isAdmin || isManager) && (
                  <>
                    <TabsTrigger value="report" className="rounded-xl px-6 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wide">
                      Report
                    </TabsTrigger>
                    <TabsTrigger value="schedules" className="rounded-xl px-6 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wide">
                      Manage Schedules
                    </TabsTrigger>
                    <TabsTrigger value="compare" className="rounded-xl px-6 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wide">
                      Comparison
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>

            <TabsContent value="requests">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-primary uppercase">Absence & Schedule Requests</h3>
                  <Button 
                    onClick={() => {
                      setNewRequest({
                        type: 'leave',
                        status: 'pending',
                        startDate: format(new Date(), 'yyyy-MM-dd'),
                        reason: ''
                      });
                      setIsRequestDialogOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 font-bold text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    New Request
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {requests.map((req) => (
                    <Card key={req.id} className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden bg-white">
                      <CardContent className="p-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center",
                              req.type === 'leave' ? "bg-rose-50 text-rose-500" : "bg-indigo-50 text-indigo-500"
                            )}>
                              {req.type === 'leave' ? <CalendarOff className="w-6 h-6" /> : <ArrowRightLeft className="w-6 h-6" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-primary">{req.userName}</p>
                                <Badge variant="secondary" className={cn(
                                  "text-[10px] font-bold uppercase",
                                  req.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                  req.status === 'rejected' ? "bg-rose-50 text-rose-600 border-rose-100" :
                                  "bg-amber-50 text-amber-600 border-amber-100"
                                )}>
                                  {req.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500 font-medium">
                                {req.type === 'leave' ? 'Leave Request' : 'Schedule Change'} • {formatSafeDate(req.startDate)}
                                {req.endDate && ` to ${formatSafeDate(req.endDate)}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex-1 max-w-md bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="w-3 h-3 text-slate-400 mt-1" />
                              <p className="text-xs text-slate-600 italic">"{req.reason}"</p>
                            </div>
                            {req.type === 'schedule_change' && (
                              <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-indigo-600">
                                <Clock className="w-3 h-3" />
                                Proposed: {req.newStartTime} - {req.newEndTime}
                              </div>
                            )}
                          </div>

                          {isManager && req.status === 'pending' && (
                            <div className="flex items-center gap-2 min-w-max">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-9 px-4 border-emerald-100 text-emerald-600 hover:bg-emerald-50 gap-2 font-bold text-xs"
                                onClick={() => handleReviewRequest(req.id, 'approved')}
                              >
                                <Check className="w-4 h-4" /> Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-9 px-4 border-rose-100 text-rose-600 hover:bg-rose-50 gap-2 font-bold text-xs"
                                onClick={() => handleReviewRequest(req.id, 'rejected')}
                              >
                                <CloseIcon className="w-4 h-4" /> Reject
                              </Button>
                            </div>
                          )}

                          {req.reviewedBy && (
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Reviewed by</p>
                              <p className="text-xs font-bold text-primary">{req.reviewedByName}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {requests.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed">
                      <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-medium">No requests found.</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="report">
              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-indigo-600 text-white">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h3 className="text-lg font-black italic">Attendance Reports</h3>
                        <p className="text-white/60 text-sm font-medium">Summary of staff hours, tardiness, and absences.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-white/60 uppercase font-bold">Start Date</Label>
                          <Input 
                            type="date" 
                            className="bg-white/10 border-white/20 text-white h-9 text-xs"
                            value={reportStartDate}
                            onChange={(e) => setReportStartDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-white/60 uppercase font-bold">End Date</Label>
                          <Input 
                            type="date" 
                            className="bg-white/10 border-white/20 text-white h-9 text-xs"
                            value={reportEndDate}
                            onChange={(e) => setReportEndDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Name</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Worked Hours</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lates (Min)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Absences</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Approved Leaves</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allUsers.map((user) => {
                        const stats = calculateStaffStats(user.id);
                        return (
                          <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-black text-sm text-primary">{user.name || user.email || user.id}</td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-500 tabular-nums">
                              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 font-black">
                                {stats.totalHours} hrs
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold tabular-nums">
                              <span className={cn(
                                stats.lateMinutes > 0 ? "text-rose-600" : "text-emerald-600"
                              )}>
                                {stats.lateMinutes} min
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-400 tabular-nums">
                              {stats.absences > 0 ? (
                                <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100">
                                  {stats.absences}
                                </Badge>
                              ) : '0'}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-400 tabular-nums">
                              {stats.leaves > 0 ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100">
                                  {stats.leaves}
                                </Badge>
                              ) : '0'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="space-y-4">
                {personalLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-primary">
                          {formatSafeDate(log.date, 'MMMM dd, yyyy')}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            <MapPin className="w-3 h-3" /> {log.locationName}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8 pr-4">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time In</p>
                        <Badge variant="outline" className="bg-indigo-50/50 text-indigo-700 border-indigo-100 font-black tabular-nums">
                          {log.timeIn ? format(log.timeIn.toDate(), 'HH:mm') : '--:--'}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time Out</p>
                        {log.timeOut ? (
                          <Badge variant="outline" className="bg-amber-50/50 text-amber-700 border-amber-100 font-black tabular-nums">
                            {format(log.timeOut.toDate(), 'HH:mm')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-rose-50 text-rose-500 border-rose-100 font-bold italic">
                            Active
                          </Badge>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </motion.div>
                ))}
                {personalLogs.length === 0 && (
                  <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed">
                    <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No attendance records found.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="schedules">
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                  <div className="flex items-center gap-4 flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-400" />
                    <Input 
                      placeholder="Search staff schedules..." 
                      className="bg-slate-50 border-none h-10 text-xs" 
                      value={scheduleSearch}
                      onChange={(e) => setScheduleSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline"
                      className="border-indigo-100 text-indigo-600 hover:bg-indigo-50 rounded-xl gap-2 font-bold text-xs"
                      onClick={() => setIsBulkDialogOpen(true)}
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Bulk Populate
                    </Button>
                    <Button 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 font-bold text-xs"
                      onClick={() => {
                        setEditingSchedule({ date: format(new Date(), 'yyyy-MM-dd') });
                        setIsScheduleDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      Add Single Date
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredSchedules.slice(0, 50).map((sch) => (
                        <tr key={sch.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-black text-primary">
                              {formatSafeDate(sch.date, 'MMM dd, yyyy')}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">
                              {formatSafeDate(sch.date, 'EEEE')}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-600">
                            {sch.userName || allUsers.find(u => u.id === sch.userId)?.name || sch.userId}
                          </td>
                          <td className="px-6 py-4 text-xs font-black text-indigo-600 tabular-nums">
                            {sch.isDayOff ? '--:--' : `${sch.startTime} - ${sch.endTime}`}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="secondary" className={cn(
                              "text-[10px] font-bold uppercase",
                              sch.isDayOff ? "bg-slate-100 text-slate-400" : "bg-emerald-50 text-emerald-600"
                            )}>
                              {sch.isDayOff ? 'Day Off' : 'Working'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                                onClick={() => {
                                  setEditingSchedule(sch);
                                  setIsScheduleDialogOpen(true);
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 hover:text-rose-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSchedule(sch.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredSchedules.length > 50 && (
                    <div className="p-4 text-center text-xs text-slate-400 font-medium bg-slate-50/50">
                      Showing first 50 scheduled dates. Use search or filters to find specific records.
                    </div>
                  )}
                  {schedules.length === 0 && (
                    <div className="text-center py-20 bg-white">
                      <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-medium">No schedules generated yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="compare">
              <div className="space-y-4">
                <Card className="border-none shadow-xl overflow-hidden rounded-3xl">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg font-bold">Daily Comparison Report</CardTitle>
                        <CardDescription>Comparing scheduled vs actual attendance for today.</CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100">Today</Badge>
                        <div className="h-4 w-px bg-slate-200" />
                        <p className="text-xs font-bold text-slate-400">{format(new Date(), 'MMM dd, yyyy')}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Name</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheduled In</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actual In</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheduled Out</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actual Out</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {allUsers.map((user) => {
                            const todayStr = format(new Date(), 'yyyy-MM-dd');
                            const schedule = getDateSchedule(user.id, todayStr);
                            const attendance = allLogs.find(l => l.userId === user.id && l.date === todayStr);

                            const isInLate = schedule && !schedule.isDayOff && attendance && attendance.timeIn && (
                              format(attendance.timeIn.toDate(), 'HH:mm') > (schedule.startTime || '00:00')
                            );

                            return (
                              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-sm text-primary">{user.name || user.email || user.id}</td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-400 tabular-nums">
                                  {schedule?.isDayOff ? 'DAY OFF' : schedule?.startTime || '--:--'}
                                </td>
                                <td className="px-6 py-4 text-xs font-black text-primary tabular-nums">
                                  {attendance?.timeIn ? format(attendance.timeIn.toDate(), 'HH:mm') : '--:--'}
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-400 tabular-nums">
                                  {schedule?.isDayOff ? 'DAY OFF' : schedule?.endTime || '--:--'}
                                </td>
                                <td className="px-6 py-4 text-xs font-black text-primary tabular-nums">
                                  {attendance?.timeOut ? format(attendance.timeOut.toDate(), 'HH:mm') : '--:--'}
                                </td>
                                <td className="px-6 py-4">
                                  {schedule?.isDayOff ? (
                                    <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-100 font-bold uppercase text-[9px] tracking-widest">Off</Badge>
                                  ) : !attendance ? (
                                    <Badge variant="outline" className="bg-rose-50 text-rose-500 border-rose-100 font-bold uppercase text-[9px] tracking-widest">Absent</Badge>
                                  ) : isInLate ? (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-100 font-bold uppercase text-[9px] tracking-widest">Late Arrival</Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold uppercase text-[9px] tracking-widest">On Time</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Request Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="bg-indigo-600 p-8 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black italic">Submit Request</DialogTitle>
              <DialogDescription className="text-white/60 font-medium pt-2">
                Apply for leave or propose a schedule change.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-6 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Request Type</Label>
                <Select 
                  value={newRequest.type} 
                  onValueChange={(val) => setNewRequest(prev => ({ ...prev, type: val as any }))}
                >
                  <SelectTrigger className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Leave of Absence</SelectItem>
                    <SelectItem value="schedule_change">Schedule Change</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Effective Date</Label>
                <Input 
                  type="date" 
                  className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold"
                  value={newRequest.startDate}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
            </div>

            {newRequest.type === 'leave' && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">End Date (optional)</Label>
                <Input 
                  type="date" 
                  className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold"
                  value={newRequest.endDate || ''}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            )}

            {newRequest.type === 'schedule_change' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">New Start Time</Label>
                  <Input 
                    type="time" 
                    className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold"
                    value={newRequest.newStartTime || ''}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, newStartTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">New End Time</Label>
                  <Input 
                    type="time" 
                    className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold"
                    value={newRequest.newEndTime || ''}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, newEndTime: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Reason / Details</Label>
              <textarea 
                className="w-full bg-slate-50 border-none rounded-xl p-4 text-xs font-medium min-h-[100px] focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Explain the reason for your request..."
                value={newRequest.reason || ''}
                onChange={(e) => setNewRequest(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button 
                variant="ghost" 
                onClick={() => setIsRequestDialogOpen(false)}
                className="rounded-xl font-bold"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitRequest}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100 font-bold px-8 h-12"
              >
                Submit Request
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Generator Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-3xl text-primary">
          <div className="bg-indigo-600 p-8 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black italic">Bulk Schedule Generator</DialogTitle>
              <DialogDescription className="text-white/60 font-medium pt-2">
                Populate shifts and day-offs for multiple dates at once.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-6 bg-white overflow-y-auto max-h-[70vh]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Staff Member</Label>
                <Select 
                  value={bulkConfig.userId} 
                  onValueChange={(v) => setBulkConfig({ ...bulkConfig, userId: v })}
                >
                  <SelectTrigger className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold text-primary">
                    <SelectValue placeholder="Select Staff">
                      {bulkConfig.userId ? (allUsers.find(u => u.id === bulkConfig.userId)?.name || allUsers.find(u => u.id === bulkConfig.userId)?.email) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name ? `${u.name} (${u.email})` : u.email || u.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Range Start</Label>
                  <Input 
                    type="date" 
                    className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold"
                    value={bulkConfig.startDate}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Range End</Label>
                  <Input 
                    type="date" 
                    className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold"
                    value={bulkConfig.endDate}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Shift Start</Label>
                  <Input 
                    type="time" 
                    className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold"
                    value={bulkConfig.startTime}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Shift End</Label>
                  <Input 
                    type="time" 
                    className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold"
                    value={bulkConfig.endTime}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Day Offs (Select to skip work days)</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {daysOfWeek.map((day, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant={bulkConfig.daysOff.includes(idx) ? "default" : "outline"}
                      className={cn(
                        "h-8 text-[10px] font-black rounded-lg",
                        bulkConfig.daysOff.includes(idx) ? "bg-rose-500 hover:bg-rose-600" : ""
                      )}
                      onClick={() => {
                        const newDaysOff = bulkConfig.daysOff.includes(idx)
                          ? bulkConfig.daysOff.filter(d => d !== idx)
                          : [...bulkConfig.daysOff, idx];
                        setBulkConfig({ ...bulkConfig, daysOff: newDaysOff });
                      }}
                    >
                      {day.substring(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 sticky bottom-0 bg-white">
              <Button 
                variant="ghost" 
                onClick={() => setIsBulkDialogOpen(false)}
                className="rounded-xl font-bold"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleGenerateBulkSchedule}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100 font-bold px-8 h-12"
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate Schedules'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-3xl text-primary">
          <div className="bg-indigo-600 p-8 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black italic">Single Date Schedule</DialogTitle>
              <DialogDescription className="text-white/60 font-medium pt-2">
                Manually set or override a shift for one specific date.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-6 bg-white">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Staff Member</Label>
                <Select 
                  value={editingSchedule?.userId || ''} 
                  onValueChange={(v) => {
                    const user = allUsers.find(u => u.id === v);
                    setEditingSchedule({ ...editingSchedule, userId: v, userName: user?.name || user?.email || v });
                  }}
                  disabled={!!editingSchedule?.id}
                >
                  <SelectTrigger className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold text-primary">
                    <SelectValue placeholder="Select Staff">
                      {editingSchedule?.userId ? (allUsers.find(u => u.id === editingSchedule.userId)?.name || allUsers.find(u => u.id === editingSchedule.userId)?.email) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name ? `${u.name} (${u.email})` : u.email || u.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Date</Label>
                <Input 
                  type="date" 
                  className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold"
                  value={editingSchedule?.date || ''} 
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, date: e.target.value })}
                  disabled={!!editingSchedule?.id}
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input 
                  type="checkbox" 
                  id="dayOff"
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={editingSchedule?.isDayOff || false}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, isDayOff: e.target.checked })}
                />
                <Label htmlFor="dayOff" className="text-xs font-bold text-slate-600">Mark as Day Off</Label>
              </div>

              {!editingSchedule?.isDayOff && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Start Time</Label>
                    <Input 
                      type="time" 
                      className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold"
                      value={editingSchedule?.startTime || ''} 
                      onChange={(e) => setEditingSchedule({ ...editingSchedule, startTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">End Time</Label>
                    <Input 
                      type="time" 
                      className="bg-slate-50 border-none h-12 rounded-xl text-xs font-bold"
                      value={editingSchedule?.endTime || ''} 
                      onChange={(e) => setEditingSchedule({ ...editingSchedule, endTime: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsScheduleDialogOpen(false)} className="rounded-xl font-bold">Cancel</Button>
              <Button onClick={handleSaveSchedule} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100 font-bold px-8 h-12">
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
