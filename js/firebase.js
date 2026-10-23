// Firebase Configuration

const firebaseConfig = {
        apiKey: "AIzaSyDkwQd8a1Vlaxk_otIR4L63KwJBkmphhRc",
        authDomain: "prayer-tracker-e0903.firebaseapp.com",
        databaseURL: "https://prayer-tracker-e0903-default-rtdb.firebaseio.com",
        projectId: "prayer-tracker-e0903",
        storageBucket: "prayer-tracker-e0903.firebasestorage.app",
        messagingSenderId: "458331425673",
        appId: "1:458331425673:web:4bdeeee8557c5c41ce6f58",
        measurementId: "G-SN2WL21CCZ"
};

// Initialize Firebase safely using compat libraries
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbRef = db.ref('prayerTrackerData');