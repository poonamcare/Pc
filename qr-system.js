
/* ==========================================
   POONAM CARE - QR SYSTEM
   Unique QR Generation & Scan Management
   ========================================== */

import QRCode from "https://esm.sh/qrcode@1.5.4";

import {
  ref,
  get,
  set,
  push,
  update
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

import { auth, database } from "./firebase-config.js";

// ==========================================
// 1. GENERATE UNIQUE QR TOKEN
// ==========================================

export function generateQRToken() {
  return crypto.randomUUID();
}

// ==========================================
// 2. GENERATE CUSTOMER QR CODE
// ==========================================

export async function generateCustomerQR(uid, elementId) {
  try {
    const user = auth.currentUser;

    if (!user || user.uid !== uid) {
      throw new Error("Unauthorized QR generation.");
    }

    const snapshot = await get(
      ref(database, `customers/${uid}`)
    );

    if (!snapshot.exists()) {
      throw new Error("Customer not found.");
    }

    const customer = snapshot.val();

    let token = customer.qrToken;

    if (!token) {
      token = generateQRToken();

      await update(
        ref(database, `customers/${uid}`),
        { qrToken: token }
      );
    }

    const qrURL = `${window.location.origin}/scan.html?token=${encodeURIComponent(token)}`;

    const canvas = document.getElementById(elementId);

    if (!canvas) {
      throw new Error("QR display element not found.");
    }

    await QRCode.toCanvas(canvas, qrURL, {
      width: 260,
      margin: 2,
      errorCorrectionLevel: "H"
    });

    return {
      success: true,
      token,
      qrURL
    };

  } catch (error) {
    console.error("QR Generation Error:", error);

    return {
      success: false,
      message: error.message
    };
  }
}

// ==========================================
// 3. VERIFY QR TOKEN
// ==========================================

export async function verifyQRCode(token) {
  try {
    if (!token || typeof token !== "string") {
      throw new Error("Invalid QR code.");
    }

    const snapshot = await get(
      ref(database, "customers")
    );

    if (!snapshot.exists()) {
      throw new Error("No registered customers.");
    }

    const customers = snapshot.val();

    const match = Object.entries(customers).find(
      ([uid, customer]) =>
        customer.qrToken === token &&
        customer.accountStatus === "active"
    );

    if (!match) {
      throw new Error("QR code is invalid or inactive.");
    }

    const [uid, customer] = match;

    return {
      success: true,
      uid,
      name: customer.name,
      message: "QR verified."
    };

  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

// ==========================================
// 4. SAVE QR SCAN RECORD
// ==========================================

export async function saveQRScan(token) {
  try {
    const result = await verifyQRCode(token);

    if (!result.success) {
      throw new Error(result.message);
    }

    const scanRef = push(ref(database, "qrScans"));

    await set(scanRef, {
      scanId: scanRef.key,
      customerUid: result.uid,
      scannedAt: Date.now(),
      scanStatus: "verified"
    });

    return {
      success: true,
      scanId: scanRef.key,
      customerUid: result.uid,
      message: "QR scan recorded."
    };

  } catch (error) {
    console.error("QR Scan Error:", error);

    return {
      success: false,
      message: error.message
    };
  }
}

// ==========================================
// 5. PROCESS QR SCAN
// ==========================================

export async function processQRScan() {
  try {
    const params = new URLSearchParams(
      window.location.search
    );

    const token = params.get("token");

    if (!token) {
      throw new Error("QR token missing.");
    }

    const result = await saveQRScan(token);

    if (!result.success) {
      throw new Error(result.message);
    }

    return result;

  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

// ==========================================
// 6. GET CUSTOMER QR HISTORY
// ==========================================

export async function getCustomerQRHistory(uid) {
  try {
    if (!auth.currentUser || auth.currentUser.uid !== uid) {
      throw new Error("Unauthorized access.");
    }

    const snapshot = await get(
      ref(database, "qrScans")
    );

    if (!snapshot.exists()) return [];

    return Object.values(snapshot.val())
      .filter(record => record.customerUid === uid)
      .sort((a, b) => b.scannedAt - a.scannedAt);

  } catch (error) {
    console.error(error);
    throw error;
  }
}
