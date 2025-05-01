const express = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const router = express.Router();

// --- Middleware ---
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session.user) {
    // Redirect to appropriate dashboard based on role
    const redirectPath =
      req.session.user.role === "ADMIN"
        ? "/admin/dashboard"
        : "/user/dashboard";
    req.session.message = { type: "info", text: "You are already logged in." };
    return res.redirect(redirectPath);
  }
  next();
};

// --- Routes ---

// GET Login Page
router.get("/login", redirectIfAuthenticated, (req, res) => {
  res.render("login");
});

// POST Login
router.post("/login", redirectIfAuthenticated, async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.session.message = {
      type: "error",
      text: "Email and password are required.",
    };
    return res.redirect("/login");
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && (await bcrypt.compare(password, user.password))) {
      // Regenerate session ID upon login for security
      req.session.regenerate((err) => {
        if (err) return next(err);

        req.session.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clinicName: user.clinicName,
        };

        req.session.message = { type: "success", text: "Login successful!" };

        const redirectPath =
          user.role === "ADMIN" ? "/admin/dashboard" : "/user/dashboard";
        res.redirect(redirectPath);
      });
    } else {
      req.session.message = {
        type: "error",
        text: "Invalid email or password.",
      };
      res.redirect("/login");
    }
  } catch (error) {
    console.error("Login error:", error);
    req.session.message = {
      type: "error",
      text: "An error occurred during login.",
    };
    res.redirect("/login");
    // Alternatively, pass error to global error handler: next(error);
  }
});

// GET Registration Page
router.get("/register", redirectIfAuthenticated, (req, res) => {
  res.render("register");
});

// POST Registration
router.post("/register", redirectIfAuthenticated, async (req, res, next) => {
  const { name, email, password, confirmPassword, role, clinicName } = req.body;

  // Basic Validation
  if (!name || !email || !password || !confirmPassword || !role) {
    req.session.message = {
      type: "error",
      text: "Please fill in all required fields.",
    };
    return res.redirect("/register");
  }
  if (password !== confirmPassword) {
    req.session.message = { type: "error", text: "Passwords do not match." };
    return res.redirect("/register");
  }
  if (role === "ADMIN" && (!clinicName || clinicName.trim() === "")) {
    req.session.message = {
      type: "error",
      text: "Clinic name is required for admin registration.",
    };
    return res.redirect("/register");
  }
  if (password.length < 6) {
    // Example: Enforce minimum password length
    req.session.message = {
      type: "error",
      text: "Password must be at least 6 characters long.",
    };
    return res.redirect("/register");
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      req.session.message = {
        type: "error",
        text: "Email already registered.",
      };
      return res.redirect("/register");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role === "ADMIN" ? "ADMIN" : "USER", // Ensure valid role
        clinicName: role === "ADMIN" ? clinicName.trim() : null,
      },
    });
    req.session.message = {
      type: "success",
      text: "Registration successful! Please log in.",
    };
    res.redirect("/login");
  } catch (error) {
    // Handle potential Prisma errors (e.g., unique constraint)
    console.error("Registration error:", error);
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      req.session.message = {
        type: "error",
        text: "Email already registered.",
      };
    } else {
      req.session.message = {
        type: "error",
        text: "An error occurred during registration.",
      };
    }
    res.redirect("/register");
    // Alternatively: next(error);
  }
});

// GET Logout
router.get("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      // Even if destroy fails, try to clear cookie and redirect
      // return next(err); // Or handle more gracefully
    }
    res.clearCookie("connect.sid"); // Use the default cookie name, configure if changed
    // Redirect to login page after logout
    res.redirect("/login");
  });
});

module.exports = router;
