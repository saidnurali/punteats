// src/lib/parcelService.ts
// ─── Parcel Delivery — Supabase Data Layer ────────────────────────────────
import { supabase } from '@/lib/supabase';
import { calculateParcelFee, PackageSize, PackageType } from '@/lib/parcelPricing';

export interface ParcelOrder {
  id: string;
  customer_id: string;
  tracking_number: string;
  pickup_address: string;
  pickup_lat?: number;
  pickup_lng?: number;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  package_type: PackageType;
  package_size: PackageSize;
  delivery_note?: string;
  delivery_fee: number;
  service_fee: number;
  total_amount: number;
  payment_method: string;
  status: ParcelStatus;
  driver_id?: string;
  driver?: any;
  created_at: string;
  updated_at: string;
  delivered_at?: string;
}

export type ParcelStatus =
  | 'Pending'
  | 'Driver Assigned'
  | 'Driver Arrived'
  | 'Picked Up'
  | 'On the Way'
  | 'Delivered'
  | 'Cancelled';

export interface CreateParcelPayload {
  customer_id: string;
  pickup_address: string;
  pickup_lat?: number;
  pickup_lng?: number;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  package_type: PackageType;
  package_size: PackageSize;
  delivery_note?: string;
}

// ── Create a new parcel order ──────────────────────────────────────────────
export async function createParcelOrder(payload: CreateParcelPayload): Promise<ParcelOrder> {
  const pricing = calculateParcelFee(payload.package_size);

  const insertData = {
    customer_id: payload.customer_id,
    pickup_address: payload.pickup_address,
    pickup_lat: payload.pickup_lat,
    pickup_lng: payload.pickup_lng,
    recipient_name: payload.recipient_name,
    recipient_phone: payload.recipient_phone,
    delivery_address: payload.delivery_address,
    delivery_lat: payload.delivery_lat,
    delivery_lng: payload.delivery_lng,
    package_type: payload.package_type,
    package_size: payload.package_size,
    delivery_note: payload.delivery_note || null,
    delivery_fee: pricing.deliveryFee,
    service_fee: pricing.serviceFee,
    total_amount: pricing.total,
    payment_method: 'Cash on Delivery',
    status: 'Pending' as ParcelStatus,
  };

  const { data, error } = await supabase
    .from('parcel_orders')
    .insert([insertData])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ParcelOrder;
}

// ── Get a single parcel order by ID ───────────────────────────────────────
export async function getParcelOrder(parcelId: string): Promise<ParcelOrder> {
  const { data, error } = await supabase
    .from('parcel_orders')
    .select('*')
    .eq('id', parcelId)
    .single();

  if (error) throw new Error(error.message);
  return data as ParcelOrder;
}

// ── Get all parcels for a customer ─────────────────────────────────────────
export async function getCustomerParcels(customerId: string): Promise<ParcelOrder[]> {
  const { data, error } = await supabase
    .from('parcel_orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ParcelOrder[];
}

// ── Cancel a parcel (only when Pending) ───────────────────────────────────
export async function cancelParcelOrder(parcelId: string): Promise<void> {
  const { error } = await supabase
    .from('parcel_orders')
    .update({ status: 'Cancelled' })
    .eq('id', parcelId)
    .in('status', ['Pending', 'Driver Assigned']);

  if (error) throw new Error(error.message);
}

// ── Status display helpers ─────────────────────────────────────────────────
export const PARCEL_STATUS_STEPS: ParcelStatus[] = [
  'Pending',
  'Driver Assigned',
  'Driver Arrived',
  'Picked Up',
  'On the Way',
  'Delivered',
];

export const PARCEL_STATUS_LABELS: Record<ParcelStatus, string> = {
  'Pending': 'Searching for Driver',
  'Driver Assigned': 'Driver Assigned',
  'Driver Arrived': 'Driver at Pickup',
  'Picked Up': 'Parcel Picked Up',
  'On the Way': 'On the Way',
  'Delivered': 'Delivered',
  'Cancelled': 'Cancelled',
};

export function getStatusColor(status: ParcelStatus): { bg: string; text: string } {
  switch (status) {
    case 'Delivered': return { bg: '#DCFCE7', text: '#1B7D3C' };
    case 'Cancelled': return { bg: '#FEE2E2', text: '#DC2626' };
    case 'On the Way':
    case 'Picked Up': return { bg: '#DBEAFE', text: '#2563EB' };
    default: return { bg: '#FEF3C7', text: '#D97706' };
  }
}

export function canCancelParcel(status: ParcelStatus): boolean {
  return status === 'Pending' || status === 'Driver Assigned';
}
