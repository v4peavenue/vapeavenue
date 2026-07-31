import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Customer } from '@/types';
import { handleFirestoreError, OperationType } from './firestore-utils';

export interface LoyaltyCalculationResult {
  tier1Triggers: number;   // How many Tier 1 (5th item) discounts earned in this checkout
  tier2Triggers: number;   // How many Tier 2 (10th item) discounts earned in this checkout
  discountAmount: number; // Total Peso discount earned from loyalty
  startCount: number;     // Customer item count in cycle before this purchase (0-9)
  cartItemCount: number;  // Total items in current cart
  endCount: number;       // Customer item count in cycle after this purchase (0-9)
  newTotalItems: number;  // New cumulative total items purchased after this purchase
  breakdown: string[];    // Human-readable labels explaining earned discounts
}

/**
 * Calculates loyalty discounts based on items in the cart and customer's current item count.
 * 
 * Rules:
 * - Tier 1: 5th item in cycle grants tier1Discount (default ₱50)
 * - Tier 2: 10th item in cycle grants tier2Discount (default ₱100)
 * - Cycle resets back to 0 after 10th item (i.e., item #11 is cycle item #1).
 */
export function calculateLoyaltyDiscount(
  startCount: number = 0,
  cartItemCount: number = 0,
  tier1Discount: number = 50,
  tier2Discount: number = 100,
  loyaltyEnabled: boolean = true
): LoyaltyCalculationResult {
  const normalizedStart = Math.max(0, startCount || 0);
  const normalizedCartCount = Math.max(0, cartItemCount || 0);

  if (!loyaltyEnabled || normalizedCartCount <= 0) {
    return {
      tier1Triggers: 0,
      tier2Triggers: 0,
      discountAmount: 0,
      startCount: normalizedStart,
      cartItemCount: normalizedCartCount,
      endCount: normalizedStart % 10,
      newTotalItems: normalizedStart,
      breakdown: []
    };
  }

  let tier1Triggers = 0;
  let tier2Triggers = 0;
  const breakdown: string[] = [];

  for (let i = 1; i <= normalizedCartCount; i++) {
    const itemPositionInCycle = (normalizedStart + i) % 10;
    if (itemPositionInCycle === 5) {
      tier1Triggers++;
    } else if (itemPositionInCycle === 0) {
      tier2Triggers++;
    }
  }

  const tier1Total = tier1Triggers * tier1Discount;
  const tier2Total = tier2Triggers * tier2Discount;
  const discountAmount = tier1Total + tier2Total;

  if (tier1Triggers > 0) {
    breakdown.push(`Tier 1 Discount (5th Item Milestone): ₱${tier1Total.toFixed(2)}${tier1Triggers > 1 ? ` (${tier1Triggers}x)` : ''}`);
  }
  if (tier2Triggers > 0) {
    breakdown.push(`Tier 2 Discount (10th Item Milestone): ₱${tier2Total.toFixed(2)}${tier2Triggers > 1 ? ` (${tier2Triggers}x)` : ''}`);
  }

  const newTotalItems = normalizedStart + normalizedCartCount;
  const endCount = newTotalItems % 10;

  return {
    tier1Triggers,
    tier2Triggers,
    discountAmount,
    startCount: normalizedStart,
    cartItemCount: normalizedCartCount,
    endCount,
    newTotalItems,
    breakdown
  };
}

/**
 * Backend checkout function to safely update customer's purchase count and loyalty cycle state.
 * Resets loyaltyItemCount back to (previous + added) % 10 after hitting/passing the 10th item.
 */
export async function processCustomerLoyaltyCheckout(
  customerId: string,
  itemsPurchasedCount: number
): Promise<{ success: boolean; newTotalItems?: number; newLoyaltyCount?: number }> {
  if (!customerId || customerId === 'walk-in' || customerId === 'new') {
    return { success: false };
  }

  const customerRef = doc(db, 'customers', customerId);

  try {
    const snapshot = await getDoc(customerRef);
    if (!snapshot.exists()) {
      return { success: false };
    }

    const customerData = snapshot.data() as Customer;
    const currentTotal = customerData.totalItemsPurchased || 0;
    const newTotalItems = currentTotal + itemsPurchasedCount;
    const newLoyaltyCount = newTotalItems % 10;

    await updateDoc(customerRef, {
      totalItemsPurchased: newTotalItems,
      loyaltyItemCount: newLoyaltyCount
    });

    return {
      success: true,
      newTotalItems,
      newLoyaltyCount
    };
  } catch (error) {
    console.error(`Error updating loyalty for customer ${customerId}:`, error);
    handleFirestoreError(error, OperationType.UPDATE, `customers/${customerId}`);
    return { success: false };
  }
}
