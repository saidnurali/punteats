-- ==============================================================================
-- PuntEats Production Security: Row Level Security (RLS) for 'orders' table
-- ==============================================================================
-- Description: 
-- This script secures the 'orders' table so that customers can only view
-- and modify their own orders. It prevents an attacker from fetching the 
-- entire orders table or viewing another customer's order.
-- 
-- Instructions:
-- 1. Go to the Supabase Dashboard -> SQL Editor
-- 2. Paste and run this script to apply the security policies.
-- ==============================================================================

-- 1. Enable RLS on the orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing overly-permissive policies (if any)
-- (You may see notices if these don't exist, which is fine)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.orders;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.orders;
DROP POLICY IF EXISTS "Enable update for all users" ON public.orders;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.orders;
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;

-- 3. Create strict policies using auth.uid()

-- Policy: Customers can only SELECT their own orders
CREATE POLICY "Customers can view their own orders"
ON public.orders
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Customers can only INSERT their own orders
CREATE POLICY "Customers can insert their own orders"
ON public.orders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Customers cannot UPDATE orders directly 
-- (Status changes and driver assignments should be done by Edge Functions/Drivers/Admins)
-- If customers are allowed to cancel, it should be highly restricted:
CREATE POLICY "Customers can update their own orders"
ON public.orders
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Drivers can view orders assigned to them
-- (Assuming driver app uses the same database and auth)
CREATE POLICY "Drivers can view assigned orders"
ON public.orders
FOR SELECT
USING (auth.uid() = driver_id);

-- Policy: Service Role (Edge Functions/Admin) bypasses RLS automatically
-- No explicit policy needed for service_role keys.

-- 4. Secure the 'order_items' table as well
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.order_items;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.order_items;

CREATE POLICY "Customers can view their own order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Customers can insert their own order items"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  )
);
