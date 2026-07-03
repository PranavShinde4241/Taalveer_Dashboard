// ===============================
// LOGIN PAGE LOGIC
// ===============================

const VALID_USERNAME = "guest";
const VALID_PASSWORD = "taalveer@2026";

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorBox = document.getElementById("loginError");

  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
    sessionStorage.setItem("loggedIn", "true");

    // Open dashboard as a separate page
    window.location.href = "dashboard.html";
  } else {
    errorBox.textContent = "Invalid username or password.";
  }
}

// If already logged in, directly open dashboard
window.onload = function () {
  if (sessionStorage.getItem("loggedIn") === "true") {
    window.location.href = "dashboard.html";
  }
};
