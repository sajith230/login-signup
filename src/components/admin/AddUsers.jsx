import React, { useState } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../../firebase/firebase";
import { doc, setDoc } from "firebase/firestore";

const AddUser = ({ canAddRoles = ["user"] }) => {
  const [profilePic, setProfilePic] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(canAddRoles[0] || "user");

  // Error states
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const roleLabels = {
    user: "User",
    admin: "Admin",
    superadmin: "Super Admin",
  };

  // Validation functions
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

  const generatePassword = () => {
    const randomPass = Math.random().toString(36).slice(-10) + "Aa1!";
    setPassword(randomPass);
    validatePassword(randomPass);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setProfilePic(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    validateFirstName(firstName);
    validateLastName(lastName);
    validateEmail(email);
    validatePhone(phone);
    validatePassword(password);

    if (
      !firstNameError &&
      !lastNameError &&
      !emailError &&
      !phoneError &&
      !passwordError &&
      firstName &&
      lastName &&
      email &&
      phone &&
      password
    ) {
      try {
        // 1.Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const uid = userCredential.user.uid;

        // 2️ Save user info to Firestore
        await setDoc(doc(db, "users", uid), {
          uid,
          firstName,
          lastName,
          email,
          phone,
          role,
          profilePic,
          createdAt: new Date(),
        });

        // 3️ Send email with temporary password
        await sendPasswordResetEmail(auth, email);

        toast.success("User added & email sent!");
        // reset form
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setPassword("");
        setRole(canAddRoles[0] || "user");
        setProfilePic(null);
      } catch (error) {
        toast.error("Error: " + error.message);
      }
    } else {
      toast.error("Please fix the errors before submitting.");
    }
  };

  const getHeading = () => {
    if (canAddRoles.includes("superadmin") || canAddRoles.includes("admin")) {
      return "Add New Admin";
    }
    return "Add New User";
  };

  return (
    <div className="w-full sm:w-3/4 max-w-3xl p-8 bg-white rounded-lg shadow-lg">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-500 mb-5">
        {getHeading()}
      </h2>

      {/* Profile Picture */}
      <div className="flex items-center gap-4 mb-6">
        <img
          src={profilePic || "https://www.w3schools.com/howto/img_avatar.png"}
          alt="Profile"
          className="w-20 h-20 rounded-full border object-cover"
        />
        <label className="text-sm text-indigo-600 cursor-pointer">
          <span className="underline">Change Profile Picture</span>
          <input
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*"
          />
        </label>
      </div>

      <form
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        onSubmit={handleSubmit}
      >
        {/* First Name */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">
            First Name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onBlur={(e) => validateFirstName(e.target.value)}
            placeholder="Enter first name"
            className={`border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none ${
              firstNameError ? "border-red-500" : ""
            }`}
          />
          {firstNameError && (
            <span className="text-red-500 text-sm">{firstNameError}</span>
          )}
        </div>

        {/* Last Name */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">
            Last Name
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onBlur={(e) => validateLastName(e.target.value)}
            placeholder="Enter last name"
            className={`border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none ${
              lastNameError ? "border-red-500" : ""
            }`}
          />
          {lastNameError && (
            <span className="text-red-500 text-sm">{lastNameError}</span>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => validateEmail(e.target.value)}
            placeholder="Enter email"
            className={`border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none ${
              emailError ? "border-red-500" : ""
            }`}
          />
          {emailError && (
            <span className="text-red-500 text-sm">{emailError}</span>
          )}
        </div>

        {/* Phone */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">
            Phone Number
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={(e) => validatePhone(e.target.value)}
            placeholder="Enter phone number"
            className={`border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none ${
              phoneError ? "border-red-500" : ""
            }`}
          />
          {phoneError && (
            <span className="text-red-500 text-sm">{phoneError}</span>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col col-span-1 md:col-span-2">
          <label className="text-sm font-medium text-gray-600 mb-1">
            Password
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  validatePassword(e.target.value);
                }}
                placeholder="Generate or enter password"
                className={`w-full border rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-indigo-400 outline-none ${
                  passwordError ? "border-red-500" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={generatePassword}
              className="px-4 py-2 bg-gray-100 border rounded-lg text-sm hover:bg-gray-200 whitespace-nowrap"
            >
              Generate
            </button>
          </div>

          {passwordError && (
            <span className="text-red-500 text-sm mt-1">{passwordError}</span>
          )}
        </div>

        {/* Role */}
        <div className="flex flex-col col-span-1 md:col-span-2">
          <label className="text-sm font-medium text-gray-600 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none"
          >
            {canAddRoles.map((r) => (
              <option key={r} value={r}>
                {roleLabels[r] || r}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-4 col-span-1 md:col-span-2 mt-6">
          <button
            type="submit"
            className="bg-indigo-500 text-white px-5 py-2 rounded-lg hover:bg-indigo-700"
          >
            Add User
          </button>
          <button
            type="reset"
            onClick={() => {
              setFirstName("");
              setLastName("");
              setEmail("");
              setPhone("");
              setPassword("");
              setRole(canAddRoles[0] || "user");
              setProfilePic(null);
              setFirstNameError("");
              setLastNameError("");
              setEmailError("");
              setPhoneError("");
              setPasswordError("");
            }}
            className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-300"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default AddUser;
