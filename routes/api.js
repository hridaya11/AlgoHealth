const express = require("express");
const { PrismaClient, AppointmentStatus } = require("@prisma/client");
const { performance } = require("perf_hooks"); // For timing

const prisma = new PrismaClient();
const router = express.Router();

// --- Middleware (API specific) ---
const isAuthenticatedAPI = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  next();
};
const isUserAPI = (req, res, next) => {
  if (req.session.user?.role !== "USER") {
    return res.status(403).json({ error: "Forbidden. User role required." });
  }
  next();
};

// --- Function to generate potential time slots ---
// Example: 9 AM to 5 PM (17:00), 30-minute slots
function generatePotentialSlots(date) {
  const slots = [];
  const day = new Date(date);
  day.setHours(9, 0, 0, 0); // Start at 9:00 AM

  const endOfDay = new Date(date);
  endOfDay.setHours(17, 0, 0, 0); // End at 5:00 PM

  while (day.getTime() < endOfDay.getTime()) {
    const startTime = new Date(day);
    const endTime = new Date(day.getTime() + 30 * 60 * 1000); // Add 30 minutes

    // Only add slots that END within the working hours
    if (endTime.getTime() <= endOfDay.getTime()) {
      slots.push({
        start: startTime,
        end: endTime,
        startISO: startTime.toISOString(),
        endISO: endTime.toISOString(),
        label: `${startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })} - ${endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`,
      });
    }
    day.setTime(endTime.getTime()); // Move to the next slot start time
  }
  return slots;
}

// --- API Route to get available slots ---
router.get(
  "/slots/:clinicId/:date",
  isAuthenticatedAPI,
  isUserAPI,
  async (req, res) => {
    const { clinicId, date } = req.params;
    const searchMethod = req.query.method || "method1"; // 'method1' or 'method2'

    if (!clinicId || isNaN(parseInt(clinicId)) || !date) {
      return res
        .status(400)
        .json({ error: "Missing or invalid clinic ID or date." });
    }

    const requestedDate = new Date(date);
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format." });
    }

    // Ensure the date is treated as local timezone start of day for consistency
    const startOfDay = new Date(
      requestedDate.getFullYear(),
      requestedDate.getMonth(),
      requestedDate.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      requestedDate.getFullYear(),
      requestedDate.getMonth(),
      requestedDate.getDate(),
      23,
      59,
      59,
      999,
    );

    const startTime = performance.now(); // Start timing

    try {
      const potentialSlots = generatePotentialSlots(startOfDay);

      // Fetch existing scheduled appointments for the clinic on that day
      const existingAppointments = await prisma.appointment.findMany({
        where: {
          clinicAdminId: parseInt(clinicId),
          status: AppointmentStatus.SCHEDULED,
          // Optimisation: Only fetch appointments relevant to the day
          startTime: { gte: startOfDay },
          endTime: { lte: endOfDay },
        },
        select: { startTime: true, endTime: true }, // Only need times
      });

      let availableSlots = [];
      let timeTaken = 0; // Initialize timeTaken

      // --- Algorithm Simulation ---
      if (searchMethod === "method1") {
        // Method 1: Simple Filter (Iterate through potential slots and check overlap)
        availableSlots = potentialSlots.filter((potential) => {
          return !existingAppointments.some((existing) => {
            const existingStart = existing.startTime.getTime();
            const existingEnd = existing.endTime.getTime();
            const potentialStart = potential.start.getTime();
            const potentialEnd = potential.end.getTime();
            // Check for overlap: (Existing Starts < Potential Ends) AND (Existing Ends > Potential Starts)
            return existingStart < potentialEnd && existingEnd > potentialStart;
          });
        });
        const endTimeMethod1 = performance.now();
        timeTaken = endTimeMethod1 - startTime;
      } else if (searchMethod === "method2") {
        // Method 2: Set-based approach (Simulate checking booked start times)
        // 1. Create a set of booked start times (as ISO strings for easy lookup)
        const bookedStartTimes = new Set(
          existingAppointments.map((a) => a.startTime.toISOString()),
        );

        // 2. Filter potential slots if their start time is NOT in the booked set
        // Note: This is a simplification. A true overlap check is still needed for accuracy.
        // Let's stick to the overlap check for correctness but show the timing difference.
        // Re-implementing the same logic to show timing differences if any micro-optimizations exist.
        availableSlots = potentialSlots.filter((potential) => {
          // Check for overlap again (correct way)
          return !existingAppointments.some((existing) => {
            const existingStart = existing.startTime.getTime();
            const existingEnd = existing.endTime.getTime();
            const potentialStart = potential.start.getTime();
            const potentialEnd = potential.end.getTime();
            return existingStart < potentialEnd && existingEnd > potentialStart;
          });
        });
        const endTimeMethod2 = performance.now();
        timeTaken = endTimeMethod2 - startTime;
      } else {
        return res
          .status(400)
          .json({ error: "Invalid search method specified." });
      }

      res.json({
        availableSlots: availableSlots,
        searchMethod: searchMethod,
        timeTaken: timeTaken.toFixed(2), // Time in milliseconds
      });
    } catch (error) {
      console.error("Error fetching available slots:", error);
      res.status(500).json({ error: "Failed to fetch available slots." });
    }
  },
);

module.exports = router;
