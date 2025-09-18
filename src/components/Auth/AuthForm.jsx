import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  query,
  collection,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";

const LOCK_DURATION = 1 * 60 * 1000; // 1 minutes
const MAX_FAILED_ATTEMPTS = 2;
const MAX_LOCKOUTS_PER_DAY = 3;

const AuthForm = ({ mode }) => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // state for errors for each field
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Redirect based on role
  const redirectBasedOnRole = (role) => {
    if (role === "superadmin") navigate("/superadmin-dashboard");
    else if (role === "admin") navigate("/admin-dashboard");
    else navigate("/dashboard");
  };

  // ================================ Form Validation Functions ============================================
  // Functions to validate each input field (first name, last name, email, phone, password, confirm password)
  const validateFirstName = (value) => {
    const regex = /^[A-Za-z]{2,50}$/;
    setFirstNameError(
      regex.test(value) ? "" : "First name must be 2-50 alphabets only"
    );
  };

  const validateLastName = (value) => {
    const regex = /^[A-Za-z]{2,50}$/;
    setLastNameError(
      regex.test(value) ? "" : "Last name must be 2-50 alphabets only"
    );
  };

  const validateEmail = (value) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailError(regex.test(value) ? "" : "Invalid email format");
  };

  const validatePhone = (value) => {
    const regex = /^(\+\d{1,3})?\d{10,15}$/;
    setPhoneError(
      regex.test(value)
        ? ""
        : "Phone number must be 10–15 digits (with optional country code like +94)"
    );
  };

  const validatePassword = (value) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    setPasswordError(
      regex.test(value)
        ? ""
        : "Password must include uppercase, lowercase, number, special character, min 8 chars"
    );
  };

  const validateConfirmPassword = (value) => {
    setConfirmPasswordError(value === password ? "" : "Passwords do not match");
  };

  // ================================ Account Lock Handling ============================================
  // Checks if the account is currently locked, prevents login if locked,
  // auto-unlocks if lock duration passed and no admin unlock required
  // NOTE: When manually unlocking a user account as an admin, make sure to update the following fields:
  // isLocked: false
  // adminUnlockRequired: false
  // lockoutCount: 0
  // failedAttempts: 0
  // lockUntil: null
  // This ensures the account can log in normally and automatic lock logic works as expected.
  const checkLockStatus = async (userId) => {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return { isLocked: false };

    const userData = userSnap.data();
    const now = Date.now();

    if (userData.isLocked) {
      // Check if timeout passed
      if (
        userData.lockUntil &&
        now > userData.lockUntil &&
        !userData.adminUnlockRequired
      ) {
        // auto unlock
        await updateDoc(userRef, {
          isLocked: false,
          failedAttempts: 0,
          lockUntil: null,
        });
        return { isLocked: false };
      }

      // Still locked
      return {
        isLocked: true,
        adminUnlockRequired: userData.adminUnlockRequired || false,
      };
    }

    return { isLocked: false };
  };

  // ================================ Record Failed Attempt Handling ===================================
  // Records a failed login attempt, locks account if max attempts reached

  const recordFailedAttempt = async (userId) => {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return;
    const userData = userSnap.data();

    const newFailed = (userData.failedAttempts || 0) + 1;
    let update = { failedAttempts: newFailed };

    if (newFailed >= MAX_FAILED_ATTEMPTS) {
      // apply lock
      const now = Date.now();
      const lockouts = (userData.lockoutCount || 0) + 1;

      update = {
        ...update,
        isLocked: true,
        lockUntil: now + LOCK_DURATION,
        failedAttempts: 0,
        lockoutCount: lockouts,
      };

      // If too many lockouts in 24h -> admin unlock required
      if (lockouts >= MAX_LOCKOUTS_PER_DAY) {
        update.adminUnlockRequired = true;
      }
    }

    await updateDoc(userRef, update);
  };

  // ================================ Form Handling ====================================================
  // Main submit handler for both login and signup

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate all fields before submit
    if (mode === "signup") {
      validateFirstName(firstName);
      validateLastName(lastName);
      validateEmail(email);
      validatePhone(phone);
      validatePassword(password);
      validateConfirmPassword(confirmPassword);

      // Stop submit if there are errors
      if (
        firstNameError ||
        lastNameError ||
        emailError ||
        phoneError ||
        passwordError ||
        confirmPasswordError
      ) {
        setError("Please fix the errors above");
        toast.error("Please fix the display errors");
        return;
      }

      // 1. Create User with Firebase Auth
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;

        // 2. Store user info in Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
          firstName,
          lastName,
          phone,
          email,
          profilePic: "",
          role: "user",
          failedAttempts: 0, // track login failures
          lockedUntil: null, // timestamp until auto unlock
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 3. Send email verification
        await sendEmailVerification(user, {
          url: "http://localhost:3000",
          handleCodeInApp: true,
        });

        toast.success(
          "Registration successful! Please verify your email to activate your account."
        );
        setError("Verification email sent. Please check your inbox.");
        navigate("/");

        // Clear form
        setFirstName("");
        setLastName("");
        setPhone("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      } catch (err) {
        console.log(err);
        if (err.code && err.code === "auth/email-already-in-use") {
          setError(
            "This email is already registered. Please log in or use another email."
          );
          toast.error(
            "This email is already registered. Please log in or use another email."
          );
        } else {
          setError(err.message);
          console.log(err);
          toast.error(err.message);
        }
      }
    } else {
      // LOGIN MODE
      try {
        // Set persistence based on "Remember Me" checkbox
        await setPersistence(
          auth,
          rememberMe ? browserLocalPersistence : browserSessionPersistence
        );

        // Pre-check if account is locked
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const querySnap = await getDocs(q);

        // if email not found, skip lock check to avoid info leak
        if (!querySnap.empty) {
          const userDoc = querySnap.docs[0];
          const lockStatus = await checkLockStatus(userDoc.id);

          if (lockStatus.isLocked) {
            if (lockStatus.adminUnlockRequired) {
              toast.error(
                "Your account is locked. Please contact admin to unlock."
              );
            } else {
              toast.error(
                `User account temporarily locked due to multiple failed login attempts.`
              );
            }
            setEmail("");
            setPassword("");
            return;
          }
        }

        // Attempt sign-in
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;
        // Check email verification
        if (!user.emailVerified) {
          setError(
            "Your email is not verified yet. Please check your inbox or spam folder."
          );
          toast.error(
            "Your email is not verified yet. Please check your inbox or spam folder."
          );

          setPassword("");
          setEmail("");

          return;
        }
        // Fetch user role from Firestore
        const docRef = doc(db, "users", userCredential.user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const userData = docSnap.data();

          // Store login info based on rememberMe
          if (rememberMe) {
            localStorage.setItem("role", userData.role);
            localStorage.setItem("isLoggedIn", "true");
          } else {
            sessionStorage.setItem("role", userData.role);
            sessionStorage.setItem("isLoggedIn", "true");
          }

          // Reset failedAttempts & lockedUntil after a successful login
          await updateDoc(docRef, { failedAttempts: 0, lockedUntil: null });
          console.log(userData);

          toast.success("Login successful!");
          redirectBasedOnRole(userData.role);
        } else {
          setError("User role not found");
          toast.error("User role not found");
        }
      } catch (err) {
        // Handle login errors
        console.log(err);
        if (err.code === "auth/too-many-requests") {
          toast.error(
            "Too many login attempts detected. Please wait a few minutes or contact admin."
          );
        }
        if (
          err.code === "auth/user-not-found" ||
          err.code === "auth/wrong-password" ||
          err.code === "auth/invalid-credential"
        ) {
          setError("Invalid username or password. Please try again.");
          toast.error("Invalid username or password. Please try again.");

          // record failed attempt
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", email));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            await recordFailedAttempt(querySnap.docs[0].id);
          }
        } else {
          setError(err.message);
          toast.error(err.message);
        }
        setEmail("");
        setPassword("");
      }
    }
  };

  return (
    <div className="auth-form flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 ">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-xl text-center font-semibold mb-6 text-gray-500 ">
          {mode === "signup"
            ? "Let's get your account set up"
            : "Login to your account"}
        </h2>

        <form
          className="md:w-96 w-full flex flex-col items-center"
          onSubmit={handleSubmit}
        >
          {/* Signup Fields */}
          {mode === "signup" && (
            <>
              {/* First Name */}
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  validateFirstName(e.target.value);
                }}
                className="w-full h-12 px-4 mb-3 border border-gray-300 rounded-lg outline-none"
                required
              />
              {firstNameError && (
                <p className="text-red-500 text-sm mb-2">{firstNameError}</p>
              )}
              {/* Last Name */}
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  validateLastName(e.target.value);
                }}
                className="w-full h-12 px-4 mb-3 border border-gray-300 rounded-lg outline-none"
                required
              />
              {lastName && (
                <p className="text-red-500 text-sm mb-2">{lastNameError}</p>
              )}
              {/* Phone Number */}
              <input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  validatePhone(e.target.value);
                }}
                className="w-full h-12 px-4 mb-3 border border-gray-300 rounded-lg outline-none"
                required
              />
              {phoneError && (
                <p className="text-red-500 text-sm mb-2">{phoneError}</p>
              )}
            </>
          )}

          {/* Email */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (mode === "signup") validateEmail(e.target.value);
            }}
            className="w-full h-12 px-4 mb-3 border border-gray-300 rounded-lg outline-none"
            required
          />
          {mode === "signup" && emailError && (
            <p className="text-red-500 text-sm mb-2">{emailError}</p>
          )}

          {/* Password */}
          <div className="relative w-full mb-3">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (mode === "signup") validatePassword(e.target.value);
              }}
              className="w-full h-12 px-4 pr-10 border border-gray-300 rounded-lg outline-none"
              required
            />
            {/* Eye Icon */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-500"
            >
              {showPassword ? (
                <EyeSlashIcon className="w-4 h-4" />
              ) : (
                <EyeIcon className="w-4 h-4" />
              )}
            </button>
          </div>
          {mode === "signup" && passwordError && (
            <p className="text-red-500 text-sm mb-2">{passwordError}</p>
          )}

          {/* Only show for login mode */}
          {mode === "login" && (
            <div className="w-full flex items-center justify-between mt-4 text-gray-500/80">
              {/* Remember Me */}
              <div className="flex items-center gap-2">
                <input
                  className="h-5 w-5"
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label className="text-sm" htmlFor="remember">
                  Remember me
                </label>
              </div>
              <a
                className="text-sm underline hover:text-indigo-500"
                href="/forgot-password"
              >
                Forgot password?
              </a>
            </div>
          )}

          {/* Confirm Password Input*/}
          {mode === "signup" && (
            <div className="relative w-full mb-3">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  validateConfirmPassword(e.target.value);
                }}
                className="w-full h-12 px-4 pr-10 border border-gray-300 rounded-lg outline-none"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-500"
                onMouseDown={() => setShowConfirmPassword(true)}
                onMouseUp={() => setShowConfirmPassword(false)}
                onMouseLeave={() => setShowConfirmPassword(false)}
              >
                {showConfirmPassword ? (
                  <EyeSlashIcon className="w-4 h-4" />
                ) : (
                  <EyeIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
          {confirmPasswordError && (
            <p className="text-red-500 text-sm mb-2">{confirmPasswordError}</p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full h-12 rounded-lg bg-indigo-500 text-white font-medium hover:opacity-90 transition-opacity mt-3"
          >
            {mode === "signup" ? "Sign Up" : "Login Now"}
          </button>

          {/* Link to switch forms */}
          <p className="text-gray-500 text-sm mt-4">
            {mode === "signup"
              ? "Already have an account? "
              : "Don’t have an account? "}
            <a
              href={mode === "signup" ? "/" : "/register"}
              className="text-indigo-500 hover:underline"
            >
              {mode === "signup" ? "Login" : "Sign up"}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default AuthForm;
