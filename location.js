
/* ==========================================
   POONAM CARE - LOCATION SYSTEM
   Location Permission & Emergency Sharing
   ========================================== */

import {
  ref,
  get,
  set,
  update,
  push
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

import { auth, database } from "./firebase-config.js";

// ==========================================
// 1. CHECK LOCATION SUPPORT
// ==========================================

export function checkLocationSupport() {
  return "geolocation" in navigator;
}

// ==========================================
// 2. GET CURRENT LOCATION
// ==========================================

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {

    if (!checkLocationSupport()) {
      reject(new Error("Location is not supported."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        });
      },

      error => {
        reject(new Error(
          "Location permission denied or unavailable."
        ));
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
// 3. SAVE CUSTOMER LOCATION
// ==========================================

export async function saveCustomerLocation() {
  try {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Please login first.");
    }

    const location = await getCurrentLocation();

    await set(
      ref(database, `customerLocations/${user.uid}`),
      {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        updatedAt: Date.now()
      }
    );

    return {
      success: true,
      message: "Location saved successfully.",
      location
    };

  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

// ==========================================
// 4. SHARE LOCATION WITH EMERGENCY ALERT
// ==========================================

export async function shareEmergencyLocation(alertId) {
  try {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Please login first.");
    }

    if (!alertId) {
      throw new Error("Emergency Alert ID required.");
    }

    const alertRef = ref(
      database,
      `emergencyAlerts/${alertId}`
    );

    const alertSnapshot = await get(alertRef);

    if (
      !alertSnapshot.exists() ||
      alertSnapshot.val().customerUid !== user.uid
    ) {
      throw new Error("Alert not found or access denied.");
    }

    const location = await getCurrentLocation();

    await update(alertRef, {
      latitude: location.latitude,
      longitude: location.longitude,
      locationAccuracy: location.accuracy,
      locationShared: true,
      updatedAt: Date.now()
    });

    return {
      success: true,
      message: "Emergency location shared.",
      location
    };

  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

// ==========================================
// 5. GET CUSTOMER LOCATION
// ==========================================

export async function getCustomerLocation(uid) {
  try {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Login required.");
    }

    const isOwner = await get(
      ref(database, `admins/${user.uid}`)
    );

    const isAuthorizedAdmin =
      isOwner.exists() &&
      isOwner.val().role === "owner" &&
      isOwner.val().active === true;

    if (user.uid !== uid && !isAuthorizedAdmin) {
      throw new Error("Location access denied.");
    }

    const snapshot = await get(
      ref(database, `customerLocations/${uid}`)
    );

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val();

  } catch (error) {
    console.error(error);
    throw error;
  }
}

// ==========================================
// 6. WATCH LOCATION WHILE APP IS ACTIVE
// ==========================================

export function watchCurrentLocation(callback) {
  if (!checkLocationSupport()) {
    throw new Error("Location not supported.");
  }

  const watchId = navigator.geolocation.watchPosition(
    position => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now()
      });
    },

    error => {
      console.error("Location error:", error.message);
    },

    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000
    }
  );

  return function stopWatchingLocation() {
    navigator.geolocation.clearWatch(watchId);
  };
}

// ==========================================
// 7. SAVE LOCATION UPDATE
// ==========================================

export async function saveLocationUpdate(alertId, location) {
  try {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Login required.");
    }

    const alertSnapshot = await get(
      ref(database, `emergencyAlerts/${alertId}`)
    );

    if (
      !alertSnapshot.exists() ||
      alertSnapshot.val().customerUid !== user.uid
    ) {
      throw new Error("Alert not found or access denied.");
    }

    if (
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude) ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      throw new Error("Invalid location.");
    }

    const updateRef = push(
      ref(database, `emergencyAlerts/${alertId}/locationHistory`)
    );

    await set(updateRef, {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || null,
      timestamp: Date.now()
    });

    return {
      success: true,
      message: "Location update saved."
    };

  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

// ==========================================
// 8. GOOGLE MAPS LOCATION LINK
// ==========================================

export function getGoogleMapsLink(latitude, longitude) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid coordinates.");
  }

  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
