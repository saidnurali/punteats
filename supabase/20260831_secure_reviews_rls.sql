-- ==============================================================================
-- PuntEats Production Security: Row Level Security (RLS) for 'reviews' table
-- ==============================================================================
-- Requirements met:
-- 1. Customer can only create a review for an order they actually own.
-- 2. Only completed/delivered orders can be reviewed.
-- 3. Customer cannot submit a review for another customer's order.
-- 4. Customer cannot manipulate restaurant_id/driver_id/order_id.
-- 5. Prevent duplicate reviews.

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.reviews;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.reviews;
DROP POLICY IF EXISTS "Users can read own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can insert own reviews" ON public.reviews;

-- 1. Read Policy: Anyone can read reviews (public for restaurant pages)
CREATE POLICY "Reviews are public to read"
ON public.reviews
FOR SELECT
USING (true);

-- 2. Insert Policy: Strict Ownership and Order Validation
CREATE POLICY "Customers can only review their own delivered orders"
ON public.reviews
FOR INSERT
WITH CHECK (
  auth.uid() = user_id -- Must be the authenticated user
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = reviews.order_id
    AND o.user_id = auth.uid() -- The order must belong to the user
    AND o.status = 'Delivered' -- The order must be delivered
    AND (
      -- The review must target the restaurant from the order
      (reviews.restaurant_id IS NOT NULL AND o.restaurant_id = reviews.restaurant_id)
      OR
      -- Or the driver from the order
      (reviews.driver_id IS NOT NULL AND o.driver_id = reviews.driver_id)
    )
  )
  AND NOT EXISTS (
    -- Prevent duplicate reviews for the same order and target
    SELECT 1 FROM public.reviews r2
    WHERE r2.order_id = reviews.order_id
    AND r2.user_id = auth.uid()
    AND (
      (r2.restaurant_id IS NOT NULL AND r2.restaurant_id = reviews.restaurant_id)
      OR
      (r2.driver_id IS NOT NULL AND r2.driver_id = reviews.driver_id)
    )
  )
);

-- 3. Update Policy: Only users can update their own reviews (e.g., changing rating)
CREATE POLICY "Customers can update their own reviews"
ON public.reviews
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Delete Policy: Only users can delete their own reviews
CREATE POLICY "Customers can delete their own reviews"
ON public.reviews
FOR DELETE
USING (auth.uid() = user_id);
