// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB1-hge9myCfb_zXHt5JHFteaxBjRcLopg",
  authDomain: "remguia.firebaseapp.com",
  projectId: "remguia",
  storageBucket: "remguia.firebasestorage.app",
  messagingSenderId: "711688626638",
  appId: "1:711688626638:web:a496171789cec99b4fcb9f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
