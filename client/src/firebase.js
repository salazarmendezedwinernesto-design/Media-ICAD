// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB38yQMwfLS5s_OQbbCXFn6LFQytLCuJ9o",
  authDomain: "crew-nexus.firebaseapp.com",
  projectId: "crew-nexus",
  storageBucket: "crew-nexus.firebasestorage.app",
  messagingSenderId: "827864830905",
  appId: "1:827864830905:web:c2179a1eda4ecd03a55c68",
  measurementId: "G-PH85QEN9YW",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
