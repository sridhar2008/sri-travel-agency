const userAuthPanel = document.getElementById('userAuthPanel');
const entryGate = document.getElementById('entryGate');

const authMessage = (error) => ({
  'auth/email-already-in-use': 'An account already exists for this email.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/invalid-login-credentials': 'Invalid email or password.',
  'auth/operation-not-allowed': 'Email/password sign-in is disabled. Enable it in Firebase Authentication > Sign-in method.',
  'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication settings.',
  'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/weak-password': 'Use a password with at least 8 characters.',
  'auth/user-not-found': 'No account exists for this email.'
}[error.code] || error.message);

const returnToHome = () => {
  window.location.hash = '#home';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const authPersistence = firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => null);

const createUserRecord = async (user, details = {}) => {
  await firebaseDb.collection('users').doc(user.uid).set({
    uniqueId: user.uid,
    name: details.name || user.displayName || '',
    email: user.email || details.email || '',
    phone: details.phone || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
};

if (entryGate) {
  const entryLoginForm = document.getElementById('entryLoginForm');
  const entryRegisterForm = document.getElementById('entryRegisterForm');
  const entryLoginMessage = document.getElementById('entryLoginMessage');
  const entryRegisterMessage = document.getElementById('entryRegisterMessage');
  let entryAuthAttemptInProgress = false;
  const showEntryMode = (mode) => {
    const register = mode === 'register';
    entryLoginForm.hidden = register;
    entryRegisterForm.hidden = !register;
    document.getElementById('entryLoginTab').classList.toggle('active', !register);
    document.getElementById('entryRegisterTab').classList.toggle('active', register);
  };

  document.getElementById('entryLoginTab').addEventListener('click', () => showEntryMode('login'));
  document.getElementById('entryRegisterTab').addEventListener('click', () => showEntryMode('register'));
  entryLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    entryAuthAttemptInProgress = true;
    entryLoginMessage.textContent = 'Signing in...';
    try {
      await authPersistence;
      await firebaseAuth.signInWithEmailAndPassword(document.getElementById('entryLoginEmail').value.trim(), document.getElementById('entryLoginPassword').value);
      entryGate.hidden = true;
      entryLoginMessage.textContent = '';
      returnToHome();
    } catch (error) {
      entryAuthAttemptInProgress = false;
      entryLoginMessage.textContent = authMessage(error);
    }
  });
  entryRegisterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    entryAuthAttemptInProgress = true;
    entryRegisterMessage.textContent = 'Creating your account...';
    try {
      await authPersistence;
      const name = document.getElementById('entryName').value.trim();
      const email = document.getElementById('entryEmail').value.trim();
      const credential = await firebaseAuth.createUserWithEmailAndPassword(email, document.getElementById('entryPassword').value);
      await credential.user.updateProfile({ displayName: name });
      await createUserRecord(credential.user, { name, email });
      entryGate.hidden = true;
      entryRegisterMessage.textContent = `Account created. Your unique ID is ${credential.user.uid}.`;
      returnToHome();
    } catch (error) {
      entryAuthAttemptInProgress = false;
      entryRegisterMessage.textContent = authMessage(error);
    }
  });
  document.getElementById('entryForgotPassword').addEventListener('click', async () => {
    const email = document.getElementById('entryLoginEmail').value.trim();
    if (!email) {
      entryLoginMessage.textContent = 'Enter your email first.';
      return;
    }
    try {
      await firebaseAuth.sendPasswordResetEmail(email);
      entryLoginMessage.textContent = 'Password reset instructions were sent to your email.';
    } catch (error) {
      entryLoginMessage.textContent = authMessage(error);
    }
  });
  firebaseAuth.onAuthStateChanged((user) => {
    if (user) entryAuthAttemptInProgress = false;
    entryGate.hidden = Boolean(user) || entryAuthAttemptInProgress;
    document.body.classList.toggle('authenticated', Boolean(user));
  });
}

if (userAuthPanel) {
  const userLoginForm = document.getElementById('userLoginForm');
  const userRegisterForm = document.getElementById('userRegisterForm');
  const userLoginTab = document.getElementById('userLoginTab');
  const userRegisterTab = document.getElementById('userRegisterTab');
  const userAccountDetails = document.getElementById('userAccountDetails');
  const userLoginMessage = document.getElementById('userLoginMessage');
  const userRegisterMessage = document.getElementById('userRegisterMessage');
  const userForgotPassword = document.getElementById('userForgotPassword');
  const userLogout = document.getElementById('userLogout');

  const setMessage = (element, message) => { element.textContent = message; };
  const showMode = (mode) => {
    const register = mode === 'register';
    userLoginForm.hidden = register;
    userRegisterForm.hidden = !register;
    userLoginTab.classList.toggle('active', !register);
    userRegisterTab.classList.toggle('active', register);
  };

  const showAccount = (user) => {
    const signedIn = Boolean(user);
    userLoginForm.hidden = signedIn;
    userRegisterForm.hidden = signedIn;
    userLoginTab.hidden = signedIn;
    userRegisterTab.hidden = signedIn;
    userAccountDetails.hidden = !signedIn;
    if (signedIn) {
      document.getElementById('userAccountEmail').textContent = user.email || '';
      document.getElementById('userAccountId').textContent = user.uid;
    }
  };

  userLoginTab.addEventListener('click', () => showMode('login'));
  userRegisterTab.addEventListener('click', () => showMode('register'));

  userLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(userLoginMessage, 'Signing in...');
    try {
      await authPersistence;
      await firebaseAuth.signInWithEmailAndPassword(
        document.getElementById('userLoginEmail').value.trim(),
        document.getElementById('userLoginPassword').value
      );
      setMessage(userLoginMessage, '');
      returnToHome();
    } catch (error) {
      setMessage(userLoginMessage, authMessage(error));
    }
  });

  userRegisterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(userRegisterMessage, 'Creating account...');
    try {
      const name = document.getElementById('userName').value.trim();
      const phone = document.getElementById('userPhone').value.trim();
      const email = document.getElementById('userRegisterEmail').value.trim();
      const credential = await firebaseAuth.createUserWithEmailAndPassword(email, document.getElementById('userRegisterPassword').value);
      await credential.user.updateProfile({ displayName: name });
      await createUserRecord(credential.user, { name, email, phone });
      setMessage(userRegisterMessage, 'Account created. Your unique ID is shown below.');
    } catch (error) {
      setMessage(userRegisterMessage, authMessage(error));
    }
  });

  userForgotPassword.addEventListener('click', async () => {
    const email = document.getElementById('userLoginEmail').value.trim();
    if (!email) return setMessage(userLoginMessage, 'Enter your email first, then choose forgot password.');
    try {
      await firebaseAuth.sendPasswordResetEmail(email);
      setMessage(userLoginMessage, 'Password reset instructions were sent to your email.');
    } catch (error) {
      setMessage(userLoginMessage, authMessage(error));
    }
  });

  userLogout.addEventListener('click', () => firebaseAuth.signOut());
  firebaseAuth.onAuthStateChanged(showAccount);
}
