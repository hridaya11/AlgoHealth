const express = require("express");
const {
  PrismaClient,
  Role,
  PriorityLevel,
  AppointmentStatus,
} = require("@prisma/client");
const prisma = new PrismaClient();
const router = express.Router();

// --- Middleware ---
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    req.session.message = {
      type: "error",
      text: "Please log in to view this page.",
    };
    return res.redirect("/login");
  }
  next();
};

const isUser = (req, res, next) => {
  if (req.session.user?.role !== "USER") {
    req.session.message = { type: "error", text: "Access denied." };
    return res.redirect("/"); // Redirect non-users (e.g., admins)
  }
  next();
};

// Apply middleware to all user routes
router.use(isAuthenticated, isUser);

// --- Routes ---

// GET User Dashboard
router.get("/dashboard", async (req, res, next) => {
  const userId = req.session.user.id;
  try {
    const appointments = await prisma.appointment.findMany({
      where: { patientId: userId },
      include: {
        clinicAdmin: {
          // Include clinic details
          select: { clinicName: true, name: true },
        },
      },
      orderBy: { startTime: "asc" }, // Order by start time
    });
    res.render("user/dashboard", { appointments });
  } catch (error) {
    console.error("Error fetching user dashboard:", error);
    req.session.message = {
      type: "error",
      text: "Failed to load your appointments.",
    };
    // Render with empty array on error or pass to error handler
    // res.render('user/dashboard', { appointments: [] });
    next(error);
  }
});

// GET Book Appointment Page - Initial Load
router.get("/book", async (req, res, next) => {
  try {
    const clinics = await prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { id: true, clinicName: true, name: true }, // Select necessary fields
    });
    const priorities = Object.values(PriorityLevel);
    res.render("user/book", {
      clinics,
      priorities,
      selectedClinicId: null, // For EJS logic
      selectedDate: null, // For EJS logic
      availableSlots: null, // No slots fetched initially
      searchMethod: null,
      timeTaken: null,
    });
  } catch (error) {
    console.error("Error loading booking page:", error);
    req.session.message = {
      type: "error",
      text: "Failed to load booking page.",
    };
    res.redirect("/user/dashboard");
    // next(error);
  }
});

// POST Book Appointment - Final Submission
router.post("/book", async (req, res, next) => {
  const { clinicAdminId, appointmentSlot, reason, priority } = req.body;
  const patientId = req.session.user.id;

  // Basic Validation
  if (!clinicAdminId || !appointmentSlot || !reason || !priority) {
    req.session.message = {
      type: "error",
      text: "Please select a clinic, date, time slot, and fill all fields.",
    };
    return res.redirect("/user/book"); // Consider redirecting back with query params
  }

  if (!Object.values(PriorityLevel).includes(priority)) {
    req.session.message = {
      type: "error",
      text: "Invalid priority level selected.",
    };
    return res.redirect("/user/book");
  }

  // Slot value is expected to be "startTimeISO|endTimeISO"
  const [startTimeStr, endTimeStr] = appointmentSlot.split("|");
  if (!startTimeStr || !endTimeStr) {
    req.session.message = {
      type: "error",
      text: "Invalid time slot selected.",
    };
    return res.redirect("/user/book");
  }

  const startTime = new Date(startTimeStr);
  const endTime = new Date(endTimeStr);
  const estimatedDuration =
    (endTime.getTime() - startTime.getTime()) / (1000 * 60); // Duration in minutes

  if (
    isNaN(startTime.getTime()) ||
    isNaN(endTime.getTime()) ||
    estimatedDuration <= 0
  ) {
    req.session.message = {
      type: "error",
      text: "Invalid date/time for the selected slot.",
    };
    return res.redirect("/user/book");
  }

  try {
    // *** Crucial Check: Re-verify slot availability before creating ***
    // This prevents race conditions if two users try to book the same slot simultaneously.
    const overlappingAppointments = await prisma.appointment.count({
      where: {
        clinicAdminId: parseInt(clinicAdminId),
        status: AppointmentStatus.SCHEDULED, // Only check against scheduled appointments
        // Check for overlaps:
        // (Existing Starts < New Ends) AND (Existing Ends > New Starts)
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    if (overlappingAppointments > 0) {
      req.session.message = {
        type: "error",
        text: "Sorry, this time slot was just booked. Please select another.",
      };
      // Redirect back to book page, potentially preserving clinic/date selection via query params
      return res.redirect();
    }

    // Create the appointment
    await prisma.appointment.create({
      data: {
        patientId: patientId,
        clinicAdminId: parseInt(clinicAdminId),
        startTime: startTime,
        endTime: endTime,
        reason: reason,
        estimatedDuration: estimatedDuration,
        priority: priority,
        status: AppointmentStatus.SCHEDULED, // Default status
      },
    });
    req.session.message = {
      type: "success",
      text: "Appointment booked successfully!",
    };
    res.redirect("/user/dashboard");
  } catch (error) {
    console.error("Error booking appointment:", error);
    req.session.message = {
      type: "error",
      text: "Failed to book appointment. Please try again.",
    };
    res.redirect("/user/book");
    // next(error);
  }
});

// POST Cancel Appointment
router.post("/appointments/:id/cancel", async (req, res, next) => {
  const { id } = req.params;
  const userId = req.session.user.id;

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
    });

    // Ensure the user owns this appointment and it's cancellable
    if (!appointment || appointment.patientId !== userId) {
      req.session.message = {
        type: "error",
        text: "Appointment not found or access denied.",
      };
      return res.redirect("/user/dashboard");
    }
    // Allow cancellation only if it's currently scheduled
    if (appointment.status !== AppointmentStatus.SCHEDULED) {
      req.session.message = {
        type: "warning",
        text: "Cannot cancel an appointment that is not currently scheduled.",
      };
      return res.redirect("/user/dashboard");
    }

    await prisma.appointment.update({
      where: { id: parseInt(id) },
      // Ensure update only happens if user is the owner (extra check)
      // data: { status: AppointmentStatus.CANCELLED }, // Direct update is fine if previous check passed
      data: {
        status: AppointmentStatus.CANCELLED,
      },
    });

    // Optional: Check if the update actually happened (if using updateMany with where clause)
    // const updateResult = await prisma.appointment.updateMany({
    //     where: { id: parseInt(id), patientId: userId, status: AppointmentStatus.SCHEDULED },
    //     data: { status: AppointmentStatus.CANCELLED },
    // });
    // if (updateResult.count === 0) { // Handle case where appointment was already changed/cancelled
    //      req.session.message = { type: 'warning', text: 'Appointment could not be cancelled (already cancelled or state changed).' };
    // } else {
    req.session.message = { type: "success", text: "Appointment cancelled." };
    // }
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    req.session.message = {
      type: "error",
      text: "Failed to cancel appointment.",
    };
    // next(error);
  }
  res.redirect("/user/dashboard");
});

module.exports = router;
