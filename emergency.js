
/* ==========================================
   POONAM CARE - EMERGENCY SYSTEM
   SOS Alerts & Emergency Management
   ========================================== */

import {
  ref,
  push,
  set,
  get,
  update
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

import { auth, database } from "./firebase-config.js";

// ==========================================
// 1. CREATE EMERGENCY ALERT
// ==========================================

export async function createEmergencyAlert(data = {}) {
  try {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Please login first.");
    }

    const alertRef = push(
      ref(database, "emergencyAlerts")
    );

    const alertData = {
      alertId: alertRef.key,
      customerUid: user.uid,
      alertType: "SOS",
      status: "pending",
      latitude: null,
      longitude: null,
      locationShared: false,
      message: data.message || "Emergency assistance requested.",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await set(alertRef, alertData);

    return {
      success: true,
      alertId: alertRef.key,
      message: "Emergency alert registered."
    };

  } catch (error) {
    console.error("Emergency Alert Error:", error);

    return {
      success: false,
      message: error.message
    };
  }
}

// ==========================================
// 2. GET CURRENT LOCATION
// ==========================================

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not supported."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      error => {
        reject(new Error("Location permission denied or unavailable."));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

// ==========================================
// 3. ATTACH LOCATION TO ALERT
// ==========================================

export async function attachEmergencyLocation(
  alertId,
  location
) {
  try {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Please login first.");
    }

    if (
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude) ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      throw new Error("Invalid location coordinates.");
    }

    const alertRef = ref(
      database,
      `emergencyAlerts/${alertId}`
    );

    const snapshot = await get(alertRef);

    if (
      !snapshot.exists() ||
      snapshot.val().customerUid !== user.uid
    ) {
      throw new Error("Alert not found or access denied.");
    }

    await update(alertRef, {
      latitude: location.latitude,
      longitude: location.longitude,
      locationAccuracy: location.accuracy || null,
      locationShared: true,
      updatedAt: Date.now()
    });

    return {
      success: true,
      message: "Emergency location shared."
    };

  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

// ==========================================
// 4. SEND SOS WITH LOCATION
// ==========================================

export async function sendSOS(message = "") {
  try {
    // Create alert first so it is recorded
    // even if location permission is unavailable.
    const alert = await createEmergencyAlert({
      message
    });

    if (!alert.success) {
      throw new Error(alert.message);
    }

    try {
      const location = await getCurrentLocation();

      await attachEmergencyLocation(
        alert.alertId,
        location
      );

      return {
        success: true,
        alertId: alert.alertId,
        locationShared: true,
        message: "SOS registered and location shared."
      };

    } catch (locationError) {
      return {
        success: true,
        alertId: alert.alertId,
        locationShared: false,
        message: "SOS registered. Location unavailable."
      };
    }

  } catch (error) {
    console.error("SOS Error:", error);

    return {
      success: false,
      message: error.message
    };
  }
}

// ==========================================
// 5. GET CUSTOMER EMERGENCY HISTORY
// ==========================================

export async function getCustomerEmergencyHistory() {
  try {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Please login first.");
    }

    const snapshot = await get(
      ref(database, "emergencyAlerts")
    );

    if (!snapshot.exists()) return [];

    return Object.values(snapshot.val())
      .filter(alert => alert.customerUid === user.uid)
      .sort((a, b) => b.createdAt - a.createdAt);

  } catch (error) {
    console.error(error);
    throw error;
  }
}

// ==========================================
// 6. GET EMERGENCY ALERT STATUS
// ==========================================

export async function getEmergencyStatus(alertId) {
  try {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Please login first.");
    }

    const snapshot = await get(
      ref(database, `emergencyAlerts/${alertId}`)
    );

    if (
      !snapshot.exists() ||
      snapshot.val().customerUid !== user.uid
    ) {
      throw new Error("Alert not found.");
    }

    return snapshot.val().status;

  } catch (error) {
    console.error(error);
    throw error;
  }
}
