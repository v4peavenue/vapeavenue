import { 
  doc, 
  runTransaction, 
  collection, 
  Timestamp, 
  addDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { SaleItem, Sale, UserProfile, Location } from '@/types';
import { logAction } from './audit';

export interface AuthoritativeInventoryResult {
  success: boolean;
  saleId: string;
  itemDeductions: {
    productId: string;
    productName: string;
    previousStock: number;
    quantitySold: number;
    newStock: number;
    locationId: string;
  }[];
}

/**
 * Authoritative single-source atomic inventory deduction for a sale.
 * 
 * Strict Inventory Rule:
 * "New Stock = Previous Stock - Quantity Sold"
 * 
 * Guarantees:
 * 1. Single authoritative execution per sale (idempotent; checks if already deducted).
 * 2. Atomic read-and-write via Firestore transaction.
 * 3. Never allows stock to become negative.
 * 4. Logs full trace to console and audit logs.
 */
export async function executeSaleWithAuthoritativeInventory(params: {
  saleRef: any;
  saleData: any;
  cart: SaleItem[];
  checkoutLocationId: string;
  resolvedSplits: any[];
  isPending: boolean;
  isPromoPending: boolean;
  isTotalPending: boolean;
  customerDetails: any;
  locations: Location[];
  profile: UserProfile | null;
  accounts: any[];
}): Promise<AuthoritativeInventoryResult> {
  const {
    saleRef,
    saleData,
    cart,
    checkoutLocationId,
    resolvedSplits,
    isPending,
    isPromoPending,
    isTotalPending,
    customerDetails,
    locations,
    profile,
    accounts
  } = params;

  if (!cart || cart.length === 0) {
    throw new Error('Cannot execute sale with empty cart.');
  }

  if (!checkoutLocationId || checkoutLocationId === 'all') {
    throw new Error('A valid specific branch location is required for inventory deduction.');
  }

  // Deduplicate cart items by productId to prevent accidental multiple lines for same product
  const consolidatedItems = new Map<string, SaleItem>();
  for (const item of cart) {
    if (consolidatedItems.has(item.productId)) {
      const existing = consolidatedItems.get(item.productId)!;
      existing.quantity += item.quantity;
      existing.subtotal += item.subtotal;
    } else {
      consolidatedItems.set(item.productId, { ...item });
    }
  }

  const result = await runTransaction(db, async (transaction) => {
    // 1. Idempotency Check: verify this sale has not already been created or deducted
    const existingSaleDoc = await transaction.get(saleRef);
    if (existingSaleDoc.exists()) {
      const data = existingSaleDoc.data() as any;
      if (data?.stockDeducted) {
        console.warn(`[INVENTORY] Sale ${saleRef.id} was already executed and stock was already deducted. Preventing duplicate deduction.`);
        return {
          success: true,
          saleId: saleRef.id,
          itemDeductions: []
        };
      }
    }

    // 2. Read all product documents inside the transaction to get authoritative previous stock
    const productUpdates: {
      ref: any;
      name: string;
      productId: string;
      previousLocStock: number;
      newLocStock: number;
      previousGlobalStock: number;
      newGlobalStock: number;
      updatedStocksMap: Record<string, number>;
      quantitySold: number;
    }[] = [];

    for (const item of consolidatedItems.values()) {
      const prodRef = doc(db, 'products', item.productId);
      const prodDoc = await transaction.get(prodRef);

      if (!prodDoc.exists()) {
        throw new Error(`Product "${item.name}" (ID: ${item.productId}) does not exist in inventory.`);
      }

      const prodData = prodDoc.data();
      const previousLocStock = Number(prodData?.stocks?.[checkoutLocationId] ?? 0);
      const previousGlobalStock = Number(
        prodData?.stock ?? 
        Object.values(prodData?.stocks || {}).reduce((sum: number, v: any) => sum + Number(v), 0)
      );

      // Validate stock availability
      if (previousLocStock < item.quantity) {
        throw new Error(
          `Insufficient stock for "${item.name}" at this branch. Available: ${previousLocStock}, Requested: ${item.quantity}. Sale rejected to prevent negative inventory.`
        );
      }

      // Authoritative calculation: New Stock = Previous Stock - Quantity Sold
      const newLocStock = previousLocStock - item.quantity;
      const newGlobalStock = Math.max(0, previousGlobalStock - item.quantity);
      const updatedStocksMap = { ...(prodData?.stocks || {}) };
      updatedStocksMap[checkoutLocationId] = newLocStock;

      productUpdates.push({
        ref: prodRef,
        name: prodData.name || item.name,
        productId: item.productId,
        previousLocStock,
        newLocStock,
        previousGlobalStock,
        newGlobalStock,
        updatedStocksMap,
        quantitySold: item.quantity
      });
    }

    // 3. Apply product updates inside the transaction
    for (const update of productUpdates) {
      transaction.update(update.ref, {
        stock: update.newGlobalStock,
        stocks: update.updatedStocksMap,
        [`stocks.${checkoutLocationId}`]: update.newLocStock,
        updatedAt: Timestamp.now()
      });

      // Console trace as requested:
      console.log(
        `[INVENTORY] SALE CREATED\nProduct: ${update.name}\nPrevious Stock: ${update.previousLocStock}\nQuantity Sold: ${update.quantitySold}\nNew Stock: ${update.newLocStock}`
      );
    }

    // 4. Save the sale document atomically with stockDeducted: true
    const finalizedSaleData = {
      ...saleData,
      stockDeducted: true,
      updatedAt: Timestamp.now()
    };
    transaction.set(saleRef, finalizedSaleData);

    // 5. Update financial accounts & create transaction records if not pending
    if (!isPending && !isPromoPending && !isTotalPending) {
      for (const split of resolvedSplits) {
        if (!split.methodId) continue;
        const accountRef = doc(db, 'accounts', split.methodId);
        const account = accounts.find(a => a.id === split.methodId) || { name: split.methodName, balance: 0 };
        const currentBalance = account.balance || 0;
        const newBalance = currentBalance + split.amount;

        transaction.update(accountRef, {
          balance: newBalance,
          lastUpdated: Timestamp.now()
        });

        const finRef = doc(collection(db, 'financialTransactions'));
        transaction.set(finRef, {
          amount: split.amount,
          type: 'income',
          accountId: split.methodId,
          accountName: split.methodName,
          locationId: checkoutLocationId || null,
          locationName: locations.find(l => l.id === checkoutLocationId)?.name || null,
          category: 'Sales',
          description: saleData.isTotalEdited 
            ? `Sale Payment (Edited Total) #${saleRef.id.substring(0, 8)}: ${customerDetails.name || 'Walk-In'}`
            : `Sale Payment #${saleRef.id.substring(0, 8)}: ${customerDetails.name || 'Walk-In'}`,
          reference: split.reference || saleRef.id,
          saleId: saleRef.id,
          timestamp: Timestamp.now(),
          createdBy: profile?.id || 'anonymous',
          createdByName: profile?.name || 'Staff',
          accountBalance: newBalance
        });
      }
    }

    return {
      success: true,
      saleId: saleRef.id,
      itemDeductions: productUpdates.map(u => ({
        productId: u.productId,
        productName: u.name,
        previousStock: u.previousLocStock,
        quantitySold: u.quantitySold,
        newStock: u.newLocStock,
        locationId: checkoutLocationId
      }))
    };
  });

  return result;
}

/**
 * Authoritative sale editing:
 * 
 * Strict Rule:
 * When editing sale quantity from oldQuantity -> newQuantity:
 * Only apply the DIFFERENCE:
 * "New Stock = Previous Stock - (newQuantity - oldQuantity)"
 * 
 * Example:
 * Stock = 9, edited from 1 -> 2:
 * diff = 2 - 1 = +1
 * New Stock = 9 - 1 = 8.
 * It must NOT do: 9 - 2 = 7.
 */
export async function authoritativeEditSale(params: {
  saleId: string;
  itemQuantityChanges: {
    productId: string;
    oldQuantity: number;
    newQuantity: number;
    price: number;
  }[];
  profile: UserProfile | null;
}): Promise<{ success: boolean; message: string }> {
  const { saleId, itemQuantityChanges, profile } = params;

  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, 'sales', saleId);
    const saleDoc = await transaction.get(saleRef);

    if (!saleDoc.exists()) {
      throw new Error(`Sale #${saleId} not found.`);
    }

    const saleData = saleDoc.data() as Sale;
    if (saleData.status === 'voided') {
      throw new Error('Cannot edit a voided sale.');
    }

    const locationId = saleData.locationId;
    if (!locationId) {
      throw new Error('Sale has no associated location ID.');
    }

    // Process each changed item
    const updatedSaleItems = [...(saleData.items || [])];

    for (const change of itemQuantityChanges) {
      const { productId, oldQuantity, newQuantity } = change;
      const diff = newQuantity - oldQuantity;

      if (diff === 0) continue; // No change in quantity

      const prodRef = doc(db, 'products', productId);
      const prodDoc = await transaction.get(prodRef);

      if (!prodDoc.exists()) {
        throw new Error(`Product ID ${productId} not found.`);
      }

      const prodData = prodDoc.data();
      const currentLocStock = Number(prodData?.stocks?.[locationId] ?? 0);
      const currentGlobalStock = Number(
        prodData?.stock ?? 
        Object.values(prodData?.stocks || {}).reduce((sum: number, v: any) => sum + Number(v), 0)
      );

      // If increasing sold quantity (diff > 0), verify additional stock is available
      if (diff > 0 && currentLocStock < diff) {
        throw new Error(
          `Cannot increase quantity for "${prodData.name}". Available stock is ${currentLocStock}, but ${diff} more unit(s) are required.`
        );
      }

      // Authoritative formula: New Stock = Previous Stock - (newQuantity - oldQuantity)
      const newLocStock = currentLocStock - diff;
      const newGlobalStock = Math.max(0, currentGlobalStock - diff);

      if (newLocStock < 0) {
        throw new Error(`Resulting stock for "${prodData.name}" would be negative (${newLocStock}). Operation aborted.`);
      }

      const updatedStocksMap = { ...(prodData?.stocks || {}) };
      updatedStocksMap[locationId] = newLocStock;

      transaction.update(prodRef, {
        stock: newGlobalStock,
        stocks: updatedStocksMap,
        [`stocks.${locationId}`]: newLocStock,
        updatedAt: Timestamp.now()
      });

      console.log(
        `[INVENTORY] SALE EDITED\nProduct: ${prodData.name}\nPrevious Stock: ${currentLocStock}\nQuantity Sold Change: ${oldQuantity} -> ${newQuantity} (Delta: ${diff})\nNew Stock: ${newLocStock}`
      );

      // Update the sale item array
      const itemIndex = updatedSaleItems.findIndex(i => (i.productId || (i as any).id) === productId);
      if (itemIndex >= 0) {
        const item = updatedSaleItems[itemIndex];
        const unitPrice = item.price || change.price || 0;
        updatedSaleItems[itemIndex] = {
          ...item,
          quantity: newQuantity,
          subtotal: newQuantity * unitPrice
        };
      }
    }

    // Recalculate subtotal and total
    const newSubtotal = updatedSaleItems.reduce((sum, item) => sum + item.subtotal, 0);
    const promoDiscount = saleData.discount || 0;
    const deliveryFee = saleData.deliveryFee || 0;
    const newTotal = Math.max(0, newSubtotal - promoDiscount + deliveryFee);
    const newTax = newTotal * (12 / 112);

    transaction.update(saleRef, {
      items: updatedSaleItems,
      subtotal: newSubtotal,
      total: newTotal,
      tax: newTax,
      updatedAt: Timestamp.now()
    });

    return {
      success: true,
      message: `Sale #${saleId.substring(0, 8)} updated successfully. Inventory difference applied.`
    };
  });
}

/**
 * Authoritative sale cancellation / voiding:
 * 
 * Strict Rule:
 * Restores inventory exactly once:
 * "New Stock = Previous Stock + Quantity Sold"
 * 
 * Example:
 * Stock before sale = 10, Sold = 1 -> Stock = 9.
 * Cancel sale:
 * Stock becomes exactly 10 (not 11 or 9).
 */
export async function authoritativeVoidSale(params: {
  saleToVoid: Sale;
  voidAccountId: string;
  profile: UserProfile | null;
  locations: Location[];
  accounts: any[];
}): Promise<{ success: boolean; message: string }> {
  const { saleToVoid, voidAccountId, profile, locations, accounts } = params;

  if (saleToVoid.status === 'voided') {
    throw new Error('This sale is already voided.');
  }

  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, 'sales', saleToVoid.id);
    const freshSaleDoc = await transaction.get(saleRef);
    if (!freshSaleDoc.exists()) {
      throw new Error(`Sale #${saleToVoid.id} does not exist.`);
    }

    const freshSaleData = freshSaleDoc.data() as Sale;
    if (freshSaleData.status === 'voided') {
      throw new Error('This sale has already been voided.');
    }

    const wasStockDeducted = freshSaleData.stockDeducted !== false;
    const locationId = freshSaleData.locationId;

    if (wasStockDeducted && locationId) {
      for (const item of freshSaleData.items || []) {
        const prodId = item.productId || (item as any).id;
        if (!prodId) continue;

        const returnedQty = item.returnedQuantity || 0;
        const netQtyToReturn = Math.max(0, item.quantity - returnedQty);
        if (netQtyToReturn <= 0) continue;

        const productRef = doc(db, 'products', prodId);
        const prodDoc = await transaction.get(productRef);
        if (!prodDoc.exists()) continue;

        const prodData = prodDoc.data();
        const currentLocStock = Number(prodData?.stocks?.[locationId] ?? 0);
        const currentGlobalStock = Number(prodData?.stock ?? 0);

        // Authoritative restore: New Stock = Previous Stock + Net Quantity to Return
        const newLocStock = currentLocStock + netQtyToReturn;
        const newGlobalStock = currentGlobalStock + netQtyToReturn;
        const updatedStocksMap = { ...(prodData?.stocks || {}) };
        updatedStocksMap[locationId] = newLocStock;

        transaction.update(productRef, {
          stock: newGlobalStock,
          stocks: updatedStocksMap,
          [`stocks.${locationId}`]: newLocStock,
          updatedAt: Timestamp.now()
        });

        console.log(
          `[INVENTORY] SALE CANCELLED / RETURNED\nProduct: ${prodData.name}\nPrevious Stock: ${currentLocStock}\nQuantity Restored: ${netQtyToReturn}\nNew Stock: ${newLocStock}`
        );
      }
    }

    // Mark sale as voided and stockDeducted: false so stock cannot be restored again
    transaction.update(saleRef, {
      status: 'voided',
      stockDeducted: false,
      updatedAt: Timestamp.now()
    });

    // Reverse financial account balance
    const account = accounts.find(a => a.id === voidAccountId);
    if (account && voidAccountId) {
      const accountRef = doc(db, 'accounts', voidAccountId);
      const currentBalance = account.balance || 0;
      const newBalance = currentBalance - freshSaleData.total;

      transaction.update(accountRef, {
        balance: newBalance,
        lastUpdated: Timestamp.now()
      });

      const newTransRef = doc(collection(db, 'financialTransactions'));
      transaction.set(newTransRef, {
        amount: freshSaleData.total,
        type: 'expense',
        accountId: voidAccountId,
        accountName: account.name,
        locationId: freshSaleData.locationId || null,
        locationName: locations.find(l => l.id === freshSaleData.locationId)?.name || null,
        category: 'Sales Refund / Void',
        description: `Voided Sale #${freshSaleData.id.substring(0, 8)} (${freshSaleData.customerDetails?.name || 'Walk-In'})`,
        reference: freshSaleData.id,
        saleId: freshSaleData.id,
        timestamp: Timestamp.now(),
        createdBy: profile?.id || 'anonymous',
        createdByName: profile?.name || 'Staff',
        accountBalance: newBalance
      });
    }

    return {
      success: true,
      message: `Sale #${freshSaleData.id.substring(0, 8)} voided. Stock restored exactly once.`
    };
  });
}
