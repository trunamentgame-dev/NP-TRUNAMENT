// NP TOURNAMENT BD - Unified Firebase Configuration
// Realtime Database & Firebase Authentication Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBFaoU_cDws6YVAXFMWBnogGAQHhjfC23Q",
  authDomain: "np-trunament-bd.firebaseapp.com",
  databaseURL: "https://np-trunament-bd-default-rtdb.firebaseio.com",
  projectId: "np-trunament-bd",
  storageBucket: "np-trunament-bd.firebasestorage.app",
  messagingSenderId: "324972484501",
  appId: "1:324972484501:web:38598aa922e983990b889c",
  measurementId: "G-LMHCM7J1K5"
};

// Export for module systems and global window
if (typeof window !== 'undefined') {
  window.NP_FIREBASE_CONFIG = firebaseConfig;
  window.DEFAULT_FIREBASE_CONFIG = firebaseConfig;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = firebaseConfig;
}
