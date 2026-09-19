const firebaseConfig = {
  apiKey: 'AIzaSyBrmRVU-tquMeTvzVoCHdSiFFGstbT_A8I',
  authDomain: 'sriagency-afaa9.firebaseapp.com',
  projectId: 'sriagency-afaa9',
  storageBucket: 'sriagency-afaa9.firebasestorage.app',
  messagingSenderId: '718226465119',
  appId: '1:718226465119:web:828e62f0a0a176b125d6ea',
  measurementId: 'G-MQTKHHXXR3'
};

firebase.initializeApp(firebaseConfig);
const firebaseAuth = firebase.auth();
const firebaseDb = firebase.firestore();
