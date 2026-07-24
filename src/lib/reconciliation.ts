import { collection, getDocs, doc, writeBatch, Timestamp, addDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface ReconciliationResult {
  repairedSales: number;
  repairedFinancials: number;
  repairedAudits: number;
  message: string;
}

export const reconcileSystemData = async (): Promise<ReconciliationResult> => {
  if (!auth.currentUser) {
    return {
      repairedSales: 0,
      repairedFinancials: 0,
      repairedAudits: 0,
      message: 'Reconciliation deferred: User not authenticated yet'
    };
  }

  try {
    const [salesSnap, finSnap, auditSnap, accountsSnap, locsSnap, poSnap, returnsSnap] = await Promise.all([
      getDocs(collection(db, 'sales')),
      getDocs(collection(db, 'financialTransactions')),
      getDocs(collection(db, 'audit_logs')),
      getDocs(collection(db, 'accounts')),
      getDocs(collection(db, 'locations')),
      getDocs(collection(db, 'purchaseOrders')),
      getDocs(collection(db, 'returnTransactions'))
    ]);

    const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const financials = finSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const audits = auditSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const locations = locsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const purchaseOrders = poSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const returns = returnsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    let repairedSales = 0;
    let repairedFinancials = 0;
    let repairedAudits = 0;

    // Helper for finding accounts
    const defaultAccount = accounts[0] || { id: 'cash', name: 'Cash' };

    // 1. Backtrack & Sync Sales -> Financial Transactions & Audit Logs
    for (const sale of sales) {
      // Process valid completed/returned/partially_returned sales or sales without explicit status
      const isCompleted = !sale.status || sale.status === 'completed' || sale.status === 'returned' || sale.status === 'partially_returned';
      if (!isCompleted) continue;

      // Check if financial transaction exists for this sale
      const existingFin = financials.find(f => 
        f.saleId === sale.id || 
        f.reference === sale.id || 
        (f.description && (f.description.includes(sale.id) || f.description.includes(sale.id.substring(0, 8))))
      );

      if (!existingFin) {
        // Need to create financial transaction
        let splitsToProcess: any[] = [];
        if (sale.paymentMethod === 'split' && sale.paymentSplits && sale.paymentSplits.length > 0) {
          splitsToProcess = sale.paymentSplits;
        } else {
          const matchedAcc = accounts.find(a => 
            a.id === sale.paymentMethod || 
            a.name.toLowerCase() === (sale.paymentMethod || '').toLowerCase()
          );
          splitsToProcess = [{
            methodId: matchedAcc?.id || sale.paymentMethod || defaultAccount.id,
            methodName: matchedAcc?.name || defaultAccount.name,
            amount: sale.total || 0
          }];
        }

        const saleLocation = locations.find(l => l.id === sale.locationId);

        for (const split of splitsToProcess) {
          const matchedAcc = accounts.find(a => 
            a.id === split.methodId || 
            a.name.toLowerCase() === (split.methodName || '').toLowerCase()
          ) || defaultAccount;

          const desc = sale.isTotalEdited
            ? `Sale Payment (Edited Total) #${sale.id.substring(0, 8)}: ${sale.customerDetails?.name || 'Walk-In'}`
            : `Sale Payment #${sale.id.substring(0, 8)}: ${sale.customerDetails?.name || 'Walk-In'}`;

          await addDoc(collection(db, 'financialTransactions'), {
            amount: split.amount || sale.total || 0,
            type: 'income',
            accountId: matchedAcc.id,
            accountName: matchedAcc.name,
            locationId: sale.locationId || null,
            locationName: saleLocation?.name || null,
            category: 'Sales',
            description: desc,
            reference: sale.id,
            saleId: sale.id,
            timestamp: sale.timestamp || Timestamp.now(),
            createdBy: sale.staffId || 'system',
            createdByName: sale.staffName || 'Staff'
          });

          repairedFinancials++;
        }
      }

      // Check if audit log exists for this sale
      const existingAudit = audits.find(a => 
        a.entityId === sale.id || 
        (a.details && (a.details.includes(sale.id) || a.details.includes(sale.id.substring(0, 8))))
      );

      if (!existingAudit) {
        const itemSummary = (sale.items || []).map((i: any) => `${i.name}${i.quantity > 1 ? ` (x${i.quantity})` : ''}`).join(', ');
        await addDoc(collection(db, 'audit_logs'), {
          userId: sale.staffId || 'system',
          userName: sale.staffName || 'Staff',
          userEmail: 'pos@system.local',
          action: 'CREATE_SALE',
          details: `Processed sale #${sale.id.substring(0, 8)}: Total ${(sale.total || 0).toFixed(2)} [${itemSummary}]`,
          entityId: sale.id,
          entityType: 'sale',
          timestamp: sale.timestamp || Timestamp.now()
        });

        repairedAudits++;
      }

      repairedSales++;
    }

    // 2. Backtrack & Sync Purchase Orders -> Financial Transactions & Audit Logs
    for (const po of purchaseOrders) {
      if (po.status === 'received' || po.status === 'partially_received') {
        const existingFin = financials.find(f => 
          f.reference === po.id || 
          (f.description && (f.description.includes(po.id) || f.description.includes(po.poNumber || '')))
        );

        if (!existingFin && po.totalAmount) {
          const poLocation = locations.find(l => l.id === po.locationId);
          await addDoc(collection(db, 'financialTransactions'), {
            amount: po.totalAmount,
            type: 'expense',
            accountId: defaultAccount.id,
            accountName: defaultAccount.name,
            locationId: po.locationId || null,
            locationName: poLocation?.name || null,
            category: 'Inventory Purchase',
            description: `Inventory Stock Receipt PO #${po.poNumber || po.id.substring(0, 8)}`,
            reference: po.id,
            timestamp: po.receivedAt || po.createdAt || Timestamp.now(),
            createdBy: po.createdBy || 'system',
            createdByName: po.createdByName || 'Staff'
          });
          repairedFinancials++;
        }

        const existingAudit = audits.find(a => 
          a.entityId === po.id || 
          (a.details && (a.details.includes(po.id) || a.details.includes(po.poNumber || '')))
        );

        if (!existingAudit) {
          await addDoc(collection(db, 'audit_logs'), {
            userId: po.createdBy || 'system',
            userName: po.createdByName || 'Staff',
            userEmail: 'inventory@system.local',
            action: 'RECEIVE_STOCK',
            details: `Received inventory PO #${po.poNumber || po.id.substring(0, 8)}: Total ${(po.totalAmount || 0).toFixed(2)}`,
            entityId: po.id,
            entityType: 'purchaseOrder',
            timestamp: po.receivedAt || po.createdAt || Timestamp.now()
          });
          repairedAudits++;
        }
      }
    }

    // 3. Backtrack & Sync Returns -> Audit Logs & Financials
    for (const ret of returns) {
      const existingAudit = audits.find(a => 
        a.entityId === ret.id || 
        (a.details && a.details.includes(ret.id))
      );

      if (!existingAudit) {
        await addDoc(collection(db, 'audit_logs'), {
          userId: ret.createdBy || 'system',
          userName: ret.createdByName || 'Staff',
          userEmail: 'returns@system.local',
          action: 'PROCESS_RETURN',
          details: `Processed return #${ret.id.substring(0, 8)} for Sale #${(ret.originalSaleId || '').substring(0, 8)}: Total Refund ${(ret.totalRefund || 0).toFixed(2)}`,
          entityId: ret.id,
          entityType: 'return',
          timestamp: ret.timestamp || Timestamp.now()
        });
        repairedAudits++;
      }
    }

    return {
      repairedSales,
      repairedFinancials,
      repairedAudits,
      message: `System reconciliation completed successfully! Rechecked ${repairedSales} sales. Added ${repairedFinancials} missing financial transactions and ${repairedAudits} missing audit records.`
    };

  } catch (error: any) {
    console.error('Error during system reconciliation:', error);
    return {
      repairedSales: 0,
      repairedFinancials: 0,
      repairedAudits: 0,
      message: `Reconciliation error: ${error?.message || 'Unknown error'}`
    };
  }
};
