const express = require("express");
const {
  PrismaClient,
  PriorityLevel,
  AppointmentStatus,
} = require("@prisma/client");
const prisma = new PrismaClient();
const router = express.Router();
const { jobSequencing } = require("../utils/jobSequencing");
const { fractionalKnapsack } = require("../utils/fractionalKnapsack");
const { kruskalMST, primMST } = require("../utils/mstAlgorithms"); // Updated path

// --- Middleware ---
const isAuthenticated = (req, res, next) => {
  console.log(req.session.user);
  if (!req.session.user) {
    req.session.message = {
      type: "error",
      text: "Please log in to view this page.",
    };
    return res.redirect("/login");
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (req.session.user?.role !== "ADMIN") {
    req.session.message = {
      type: "error",
      text: "Access denied. Admin privileges required.",
    };
    return res.redirect("/"); // Redirect non-admins
  }
  next();
};

// Apply middleware to all admin routes
router.use(isAuthenticated, isAdmin);

// --- Routes ---

// GET Admin Dashboard (Appointment Management)
router.get("/dashboard", async (req, res, next) => {
  const adminId = req.session.user.id;
  const searchQuery = req.query.search || "";
  const sortBy = req.query.sortBy || "priority"; // Default sort: priority

  try {
    let whereClause = {
      clinicAdminId: adminId,
      status: {
        // Optionally filter by status, e.g., show only scheduled/completed
        // in: [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED]
      },
    };

    if (searchQuery) {
      whereClause.OR = [
        { patient: { name: { contains: searchQuery, lte: "insensitive" } } },
        { reason: { contains: searchQuery, lte: "insensitive" } },
      ];
    }

    let appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: { select: { name: true, email: true } },
      },
      orderBy: {
        // Default sort by start time before applying algorithms
        startTime: "asc",
      },
    });

    // --- Apply Sorting Algorithms ---
    const priorityOrder = {
      [PriorityLevel.CRITICAL]: 4,
      [PriorityLevel.HIGH]: 3,
      [PriorityLevel.NORMAL]: 2,
      [PriorityLevel.LOW]: 1,
    };

    if (sortBy === "priority") {
      // Priority Queue (PQ)
      appointments.sort((a, b) => {
        const priorityDiff =
          (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.startTime) - new Date(b.startTime); // Secondary sort by time
      });
      console.log("Sorted by Priority (PQ)");
    } else if (sortBy === "sjf") {
      // Shortest Job First (SJF)
      // Ensure estimatedDuration is calculated if needed, or use startTime/endTime difference
      appointments.forEach((a) => {
        a.calculatedDuration =
          (new Date(a.endTime) - new Date(a.startTime)) / (1000 * 60); // Duration in minutes
      });
      appointments.sort((a, b) => {
        const durationDiff = a.calculatedDuration - b.calculatedDuration;
        if (durationDiff !== 0) return durationDiff;
        // Secondary sort by priority if durations are equal
        return (
          (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
        );
      });
      console.log("Sorted by Estimated Duration (SJF)");
    }
    // else if (sortBy === 'rr_simulation') { // Round Robin (RR) - Just use default chronological order
    // Already sorted by startTime by default Prisma query
    //    console.log("Displaying in chronological order (RR Simulation)");
    // }

    res.render("admin/dashboard", {
      appointments,
      clinicName: req.session.user.clinicName,
      searchQuery,
      sortBy,
      appointmentStatuses: Object.values(AppointmentStatus), // Pass statuses for dropdown
    });
  } catch (error) {
    console.error("Error fetching admin dashboard:", error);
    // req.session.message = { type: 'error', text: 'Failed to load dashboard data.' };
    // res.redirect('/');
    next(error); // Pass to global error handler
  }
});

// POST Update Appointment Status
router.post("/appointments/:id/status", async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  const adminId = req.session.user.id;

  if (!Object.values(AppointmentStatus).includes(status)) {
    req.session.message = { type: "error", text: "Invalid status value." };
    return res.redirect("/admin/dashboard");
  }

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
    });

    if (!appointment || appointment.clinicAdminId !== adminId) {
      req.session.message = {
        type: "error",
        text: "Appointment not found or access denied.",
      };
      return res.redirect("/admin/dashboard");
    }

    await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: { status: status },
    });
    req.session.message = {
      type: "success",
      text: "Appointment status updated.",
    };
  } catch (error) {
    console.error("Error updating appointment status:", error);
    req.session.message = { type: "error", text: "Failed to update status." };
    // Optionally pass to error handler: next(error);
  }
  res.redirect("/admin/dashboard");
});

// --- Job Sequencing (Batch A) ---
router.get("/tasks", async (req, res, next) => {
  try {
    const tasks = await prisma.adminTask.findMany({
      where: { adminId: req.session.user.id },
      orderBy: { deadline: "asc" },
    });
    res.render("admin/tasks", { tasks });
  } catch (error) {
    next(error);
  }
});

router.post("/tasks", async (req, res, next) => {
  const { description, duration, deadline, profit } = req.body;
  try {
    await prisma.adminTask.create({
      data: {
        description,
        duration: parseInt(duration),
        deadline: parseInt(deadline),
        profit: parseInt(profit),
        adminId: req.session.user.id,
      },
    });
    req.session.message = { type: "success", text: "Task added successfully." };
    res.redirect("/admin/tasks");
  } catch (error) {
    req.session.message = { type: "error", text: "Failed to add task." };
    res.redirect("/admin/tasks"); // Or pass error: next(error)
  }
});

router.post("/tasks/:id/delete", async (req, res, next) => {
  const { id } = req.params;
  try {
    await prisma.adminTask.deleteMany({
      // Use deleteMany to ensure admin owns it
      where: { id: parseInt(id), adminId: req.session.user.id },
    });
    req.session.message = { type: "success", text: "Task deleted." };
  } catch (error) {
    req.session.message = { type: "error", text: "Failed to delete task." };
  }
  res.redirect("/admin/tasks");
});

// Inside routes/admin.js

router.get("/tasks/schedule", async (req, res, next) => {
  try {
    const tasks = await prisma.adminTask.findMany({
      where: { adminId: req.session.user.id },
    });

    // Check if tasks array is empty before calling the algorithm
    if (!tasks || tasks.length === 0) {
      return res.render("admin/task_schedule", {
        scheduledTasks: [],
        totalProfit: 0,
        gantt: [], // Pass empty array if no tasks
      });
    }

    const result = jobSequencing(tasks); // Pass original tasks array

    res.render("admin/task_schedule", {
      scheduledTasks: result.schedule,
      totalProfit: result.totalProfit,
      gantt: result.gantt,
    });
  } catch (error) {
    console.error("Error calculating task schedule:", error);
    // Pass a generic error or redirect, or render the page with an error state
    req.session.message = {
      type: "error",
      text: "Failed to calculate task schedule.",
    };
    res.redirect("/admin/tasks");
    // next(error); // Or pass to global handler
  }
});

// --- Fractional Knapsack (Batch D) ---
router.get("/supplies", async (req, res, next) => {
  try {
    const items = await prisma.supplyItem.findMany({
      where: { adminId: req.session.user.id },
      orderBy: { name: "asc" },
    });
    const budget = parseFloat(req.query.budget || "1000"); // Get budget from query or default
    let allocationResult = null;
    let totalValue = 0;
    let totalCost = 0;

    if (items.length > 0) {
      allocationResult = fractionalKnapsack(items, budget);
      totalValue = allocationResult.totalValue;
      totalCost = allocationResult.allocation.reduce(
        (sum, item) => sum + item.costTaken,
        0,
      );
    }

    res.render("admin/supplies", {
      items,
      budget,
      allocationResult: allocationResult ? allocationResult.allocation : [],
      totalValue,
      totalCost,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/supplies", async (req, res, next) => {
  const { name, cost, value } = req.body;
  try {
    await prisma.supplyItem.create({
      data: {
        name,
        cost: parseFloat(cost),
        value: parseFloat(value),
        adminId: req.session.user.id,
      },
    });
    req.session.message = { type: "success", text: "Supply item added." };
    res.redirect("/admin/supplies"); // Redirect back, maybe preserving budget query
  } catch (error) {
    req.session.message = { type: "error", text: "Failed to add supply item." };
    res.redirect("/admin/supplies"); // Or next(error)
  }
});

router.post("/supplies/:id/delete", async (req, res, next) => {
  const { id } = req.params;
  try {
    await prisma.supplyItem.deleteMany({
      where: { id: parseInt(id), adminId: req.session.user.id },
    });
    req.session.message = { type: "success", text: "Supply item deleted." };
  } catch (error) {
    req.session.message = {
      type: "error",
      text: "Failed to delete supply item.",
    };
  }
  res.redirect("/admin/supplies");
});

// --- MST Algorithms (Batch B & C) ---
router.get("/network", async (req, res, next) => {
  try {
    const adminId = req.session.user.id;
    const nodes = await prisma.clinicNode.findMany({ where: { adminId } });
    const edges = await prisma.clinicEdge.findMany({
      where: { adminId },
      include: { nodeA: true, nodeB: true }, // Include node names
    });

    let kruskalResult = null;
    let primResult = null;

    if (nodes.length > 0 && edges.length > 0) {
      // Prepare graph data structure if needed by algorithms, or pass nodes/edges directly
      try {
        kruskalResult = kruskalMST(nodes, edges);
      } catch (kError) {
        console.error("Kruskal Error:", kError);
        req.session.message = { type: "warning", text: err };
      }
      try {
        primResult = primMST(nodes, edges);
      } catch (pError) {
        console.error("Prim Error:", pError);
        // Append warning if Kruskal also failed or set new message
        let currentMsg = req.session.message?.text || "";
        req.session.message = { type: "warning", text: error };
      }
    }

    res.render("admin/network", {
      nodes,
      edges,
      kruskalResult,
      primResult,
    });
  } catch (error) {
    next(error);
  }
});

// Add Node
router.post("/network/nodes", async (req, res, next) => {
  const { name } = req.body;
  try {
    await prisma.clinicNode.create({
      data: { name, adminId: req.session.user.id },
    });
    req.session.message = { type: "success", text: "Node added." };
  } catch (error) {
    if (error.code === "P2002") {
      // Unique constraint violation
      req.session.message = {
        type: "error",
        text: "Node name already exists.",
      };
    } else {
      req.session.message = { type: "error", text: "Failed to add node." };
    }
  }
  res.redirect("/admin/network");
});

// Delete Node
router.post("/network/nodes/:id/delete", async (req, res, next) => {
  const { id } = req.params;
  const adminId = req.session.user.id;
  try {
    // Must delete related edges first due to foreign key constraints
    await prisma.clinicEdge.deleteMany({
      where: {
        adminId: adminId,
        OR: [{ nodeAId: parseInt(id) }, { nodeBId: parseInt(id) }],
      },
    });
    // Now delete the node
    await prisma.clinicNode.deleteMany({
      where: { id: parseInt(id), adminId: adminId },
    });
    req.session.message = {
      type: "success",
      text: "Node and related edges deleted.",
    };
  } catch (error) {
    console.error("Error deleting node:", error);
    req.session.message = { type: "error", text: "Failed to delete node." };
  }
  res.redirect("/admin/network");
});

// Add Edge
router.post("/network/edges", async (req, res, next) => {
  const { nodeAId, nodeBId, cost } = req.body;
  const adminId = req.session.user.id;

  if (nodeAId === nodeBId) {
    req.session.message = {
      type: "error",
      text: "Cannot create an edge from a node to itself.",
    };
    return res.redirect("/admin/network");
  }
  // Ensure nodeAId < nodeBId to prevent duplicate edges in reverse order (optional, handled by unique constraint better)
  const idA = parseInt(nodeAId);
  const idB = parseInt(nodeBId);
  const finalNodeAId = Math.min(idA, idB);
  const finalNodeBId = Math.max(idA, idB);

  try {
    // Check if nodes belong to the admin
    const nodeA = await prisma.clinicNode.findFirst({
      where: { id: finalNodeAId, adminId },
    });
    const nodeB = await prisma.clinicNode.findFirst({
      where: { id: finalNodeBId, adminId },
    });

    if (!nodeA || !nodeB) {
      req.session.message = {
        type: "error",
        text: "One or both nodes not found or do not belong to you.",
      };
      return res.redirect("/admin/network");
    }

    await prisma.clinicEdge.create({
      data: {
        nodeAId: finalNodeAId,
        nodeBId: finalNodeBId,
        cost: parseFloat(cost),
        adminId: adminId,
      },
    });
    req.session.message = { type: "success", text: "Edge added." };
  } catch (error) {
    if (error.code === "P2002") {
      // Unique constraint violation
      req.session.message = {
        type: "error",
        text: "An edge between these two nodes already exists.",
      };
    } else {
      console.error("Edge creation error:", error);
      req.session.message = { type: "error", text: "Failed to add edge." };
    }
  }
  res.redirect("/admin/network");
});

// Delete Edge
router.post("/network/edges/:id/delete", async (req, res, next) => {
  const { id } = req.params;
  try {
    await prisma.clinicEdge.deleteMany({
      where: { id: parseInt(id), adminId: req.session.user.id },
    });
    req.session.message = { type: "success", text: "Edge deleted." };
  } catch (error) {
    req.session.message = { type: "error", text: "Failed to delete edge." };
  }
  res.redirect("/admin/network");
});

module.exports = router;
