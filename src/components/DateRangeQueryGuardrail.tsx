import React, { useState, useEffect } from 'react';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Calculator, Loader2, RotateCcw, AlertTriangle, CheckCircle2, ShieldCheck, Info, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export interface DateRangePreset {
  label: string;
  key: string;
  getRange?: () => { start: string; end: string };
}

export interface DateRangeQueryGuardrailProps {
  title?: string;
  badgeLabel?: string;
  description?: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onApplyQuery: (startDate: string, endDate: string) => Promise<void> | void;
  onReset?: () => void;
  isQueryApplied?: boolean;
  activeLoadedRange?: { start: string; end: string } | null;
  calculateDocCount: (startDate: string, endDate: string) => Promise<number>;
  targetEntityLabel?: string;
  presets?: DateRangePreset[];
  className?: string;
  disabled?: boolean;
}

export const DateRangeQueryGuardrail: React.FC<DateRangeQueryGuardrailProps> = ({
  title = 'DATE RANGE QUERY GUARDRAIL',
  badgeLabel = 'Firestore Cost Protection',
  description = 'Filter data by date range. Before running the query, the system calculates exact matching document reads to prevent unexpected database charges.',
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApplyQuery,
  onReset,
  isQueryApplied = false,
  activeLoadedRange,
  calculateDocCount,
  targetEntityLabel = 'documents',
  presets,
  className = '',
  disabled = false
}) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [exactReadCount, setExactReadCount] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [lastAppliedRange, setLastAppliedRange] = useState<{ start: string; end: string } | null>(null);

  // Sync internal tracking if isQueryApplied is reset
  useEffect(() => {
    if (!isQueryApplied && !activeLoadedRange) {
      setLastAppliedRange(null);
    }
  }, [isQueryApplied, activeLoadedRange]);

  const currentActiveRange = activeLoadedRange || (isQueryApplied ? lastAppliedRange : null);
  const isAlreadyDisplayed = !!(
    currentActiveRange &&
    currentActiveRange.start === startDate &&
    currentActiveRange.end === endDate
  );

  const defaultPresets: DateRangePreset[] = [
    { label: 'Today', key: 'today' },
    { label: 'This Month', key: 'this_month' },
    { label: 'Last 30 Days', key: 'last_30_days' }
  ];

  const activePresets = presets || defaultPresets;

  const handleApplyPreset = async (preset: DateRangePreset) => {
    const now = new Date();
    let s = '';
    let e = format(now, 'yyyy-MM-dd');

    if (preset.getRange) {
      const range = preset.getRange();
      s = range.start;
      e = range.end;
    } else if (preset.key === 'today') {
      s = format(now, 'yyyy-MM-dd');
      e = format(now, 'yyyy-MM-dd');
    } else if (preset.key === 'yesterday') {
      s = format(subDays(now, 1), 'yyyy-MM-dd');
      e = format(subDays(now, 1), 'yyyy-MM-dd');
    } else if (preset.key === 'this_month') {
      s = format(startOfMonth(now), 'yyyy-MM-dd');
      e = format(now, 'yyyy-MM-dd');
    } else if (preset.key === 'last_month') {
      s = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
      e = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    } else if (preset.key === 'last_7_days' || preset.key === '7days') {
      s = format(subDays(now, 7), 'yyyy-MM-dd');
      e = format(now, 'yyyy-MM-dd');
    } else if (preset.key === 'last_30_days' || preset.key === '30days') {
      s = format(subDays(now, 30), 'yyyy-MM-dd');
      e = format(now, 'yyyy-MM-dd');
    } else if (preset.key === 'this_year') {
      s = format(startOfYear(now), 'yyyy-MM-dd');
      e = format(now, 'yyyy-MM-dd');
    } else {
      s = format(subDays(now, 30), 'yyyy-MM-dd');
      e = format(now, 'yyyy-MM-dd');
    }

    onStartDateChange(s);
    onEndDateChange(e);
    await triggerCountEstimation(s, e);
  };

  const triggerCountEstimation = async (sDate: string, eDate: string) => {
    if (!sDate || !eDate) {
      toast.error('Please enter both Start Date and To Date');
      return;
    }

    if (new Date(sDate) > new Date(eDate)) {
      toast.error('Start Date cannot be later than To Date');
      return;
    }

    // Inform the user immediately if this date range is already active
    const isTargetAlreadyLoaded = !!(
      currentActiveRange &&
      currentActiveRange.start === sDate &&
      currentActiveRange.end === eDate
    );

    if (isTargetAlreadyLoaded) {
      toast.info(`Data for ${sDate} to ${eDate} is currently displayed on your screen.`);
    }

    setIsCalculating(true);
    try {
      const count = await calculateDocCount(sDate, eDate);
      setExactReadCount(count);
      setShowModal(true);
    } catch (error) {
      console.error('Error estimating document reads:', error);
      toast.error('Failed to calculate document count. Please check your connection and date range.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleEstimateClick = () => {
    triggerCountEstimation(startDate, endDate);
  };

  const handleConfirmQuery = async () => {
    setShowModal(false);
    try {
      await onApplyQuery(startDate, endDate);
      setLastAppliedRange({ start: startDate, end: endDate });
      toast.success(`Loaded ${exactReadCount !== null ? exactReadCount.toLocaleString() : ''} ${targetEntityLabel} for ${startDate} to ${endDate}`);
    } catch (error) {
      console.error('Error executing date range query:', error);
      toast.error('Failed to load data for selected date range');
    }
  };

  const handleInternalReset = () => {
    setLastAppliedRange(null);
    if (onReset) {
      onReset();
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card className="w-full border border-slate-200/80 shadow-xs bg-[#F4F7FC] rounded-2xl overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                <h4 className="text-xs sm:text-sm font-black text-slate-800 tracking-wider uppercase">
                  {title}
                </h4>
                <Badge variant="outline" className="text-[10px] font-bold bg-amber-100/80 text-amber-900 border-amber-200/80 px-2 py-0.5 rounded-full">
                  {badgeLabel}
                </Badge>
                {isAlreadyDisplayed && (
                  <Badge variant="outline" className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Currently Displayed
                  </Badge>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-3xl">
                {description}
              </p>
            </div>

            {/* Quick Presets */}
            {activePresets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Presets:</span>
                {activePresets.map((p) => (
                  <Button
                    key={p.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || isCalculating}
                    onClick={() => handleApplyPreset(p)}
                    className="h-7 text-[11px] font-medium px-2.5 py-0 bg-white hover:bg-slate-100 border-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Date Controls & Action Row */}
          <div className="mt-3.5 pt-3.5 border-t border-slate-200/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="grid grid-cols-2 sm:flex items-center gap-3 w-full sm:w-auto">
              <div className="space-y-1 w-full sm:w-40">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">From Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  disabled={disabled || isCalculating}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="h-8 text-xs font-semibold bg-white border-slate-200 text-slate-800 rounded-lg focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1 w-full sm:w-40">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">To Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  disabled={disabled || isCalculating}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className="h-8 text-xs font-semibold bg-white border-slate-200 text-slate-800 rounded-lg focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:ml-auto">
              <Button
                type="button"
                size="sm"
                disabled={disabled || isCalculating}
                onClick={handleEstimateClick}
                className="h-8 text-xs font-bold bg-[#137a43] hover:bg-[#0f6838] text-white rounded-lg gap-1.5 shadow-sm px-3.5 transition-colors"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Calculating Reads...
                  </>
                ) : (
                  <>
                    <Calculator className="w-3.5 h-3.5 text-amber-300" />
                    Estimate Read Cost & Query
                  </>
                )}
              </Button>

              {isQueryApplied && onReset && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || isCalculating}
                  onClick={handleInternalReset}
                  className="h-8 text-xs font-bold text-slate-600 hover:bg-slate-100 border-slate-200 rounded-lg gap-1 px-3 bg-white"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  Reset to Default
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Firestore Guardrail Read Confirmation Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-base font-bold">
              {isAlreadyDisplayed ? (
                <>
                  <Info className="w-5 h-5 text-blue-600 shrink-0" />
                  Data Already Displayed
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  Confirm Firestore Database Query
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 pt-2 leading-relaxed">
              {isAlreadyDisplayed
                ? 'The records for this date range are already loaded and visible on your screen. You can proceed if you want to force a refresh from the cloud.'
                : 'Before running this query, the system calculated the exact document count for your selected date range.'}
            </DialogDescription>
          </DialogHeader>

          {/* If already displayed, show prominent notification banner */}
          {isAlreadyDisplayed && (
            <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-xl flex items-start gap-2.5 text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <p className="font-bold">Active View Notice</p>
                <p className="text-[11px] text-blue-700 leading-normal">
                  Your screen is already displaying the <strong>{startDate}</strong> &rarr; <strong>{endDate}</strong> interval. Re-fetching will consume <strong>{exactReadCount !== null ? exactReadCount.toLocaleString() : '0'} document reads</strong> to refresh existing data.
                </p>
              </div>
            </div>
          )}

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 my-1 space-y-2.5">
            <div className="flex items-center justify-between text-xs border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Selected Date Range:</span>
              <span className="font-bold font-mono text-slate-800">
                {startDate} &rarr; {endDate}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Matching {targetEntityLabel}:</span>
              <span className="font-bold text-slate-800">
                {exactReadCount !== null ? exactReadCount.toLocaleString() : '--'} records
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="font-bold text-slate-700">Exact Firestore Read Cost:</span>
              <Badge className="font-mono text-xs font-black bg-amber-100 text-amber-900 border-amber-300 px-2 py-0.5">
                {exactReadCount !== null ? `${exactReadCount.toLocaleString()} Reads` : '0 Reads'}
              </Badge>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-normal">
            Proceeding will perform exactly {exactReadCount !== null ? exactReadCount.toLocaleString() : '0'} document reads from your Firestore database.
          </p>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowModal(false)}
              className="text-xs font-bold"
            >
              {isAlreadyDisplayed ? 'Keep Current View' : 'Cancel'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmQuery}
              className={`text-xs font-bold gap-1.5 ${
                isAlreadyDisplayed
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-[#137a43] hover:bg-[#0f6838] text-white'
              }`}
            >
              {isAlreadyDisplayed ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Anyway ({exactReadCount !== null ? exactReadCount.toLocaleString() : '0'} Reads)
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm & Read {exactReadCount !== null ? exactReadCount.toLocaleString() : '0'} Documents
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

