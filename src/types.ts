
export type Campus = { id: string; name: string; color: string };
export type View = 'dashboard' | 'checkin' | 'daily_log' | 'customers' | 'bookings' | 'finance' | 'expenses' | 'staff' | 'settings' | 'subscriptions' | 'contracts';

export interface RoomConfig {
  id: string;
  name: string;
  hourlyRate: number;
  capacity: number;
  features?: string[];
  googleCalendarId?: string;
}

export interface Booking {
  id: string;
  room: string;
  user: string;
  userCode?: string;
  date: string;
  startTime: number;
  duration: number;
  type: 'Contracted' | 'Reserved';
  attendees?: number;
  extras?: {
    extraChairs?: boolean;
    screen?: boolean;
    whiteboard?: boolean;
    markers?: boolean;
  };
}

export interface Subscription {
  id: string;
  name: string;
  code: string;
  type: string;
  price: number;
  paid: number;
  remaining: number;
  startDate: string;
  endDate: string;
  daysLeft: number;
  // Hourly System Fields
  totalHours: number;
  usedHours: number;
  status: 'Active' | 'Expired' | 'Exhausted';
}

export interface Contract {
  id: string;
  partner: string;
  type: 'Business' | 'Student';
  discount: string;
  members: number;
  status: 'Active' | 'Expired';
  cashback: number;
  startDate?: string;
  endDate?: string;
  conditionsUs?: string[];
  conditionsPartner?: string[];
  prepaidBalance?: number;
  spacePrice?: number;
}
