// Batch A - Job Sequencing Algorithm with Deadlines
// Goal: Maximize total profit by selecting jobs that can be completed by their deadline.

function jobSequencing(tasks) {
  // tasks: Array of objects [{ id, description, duration, deadline, profit }, ...]

  if (!tasks || tasks.length === 0) {
    return { schedule: [], totalProfit: 0, gantt: [] }; // Handle empty input
  }

  // 1. Sort tasks in descending order of profit
  // Create a copy to avoid modifying the original array if passed by reference elsewhere
  const sortedTasks = [...tasks].sort((a, b) => b.profit - a.profit);

  // 2. Find the maximum deadline to determine the size of the time slots array
  let maxDeadline = 0;
  sortedTasks.forEach((task) => {
    if (task.deadline > maxDeadline) {
      maxDeadline = task.deadline;
    }
  });
  // Ensure maxDeadline is at least 1 if tasks exist
  if (maxDeadline === 0 && sortedTasks.length > 0) {
    maxDeadline = 1; // Or handle based on task deadlines appropriately
  }

  // 3. Initialize time slots array and schedule tracking
  // slot[i] being true means the time unit i+1 is occupied.
  const timeSlotsOccupied = new Array(maxDeadline).fill(false);
  const scheduledTasks = []; // Store the actual task objects scheduled
  let totalProfit = 0;

  // 4. Iterate through profit-sorted tasks
  for (const task of sortedTasks) {
    // Find the latest possible *available* time slot <= task.deadline
    for (let j = Math.min(maxDeadline, task.deadline) - 1; j >= 0; j--) {
      if (!timeSlotsOccupied[j]) {
        // Found a free slot within the deadline
        timeSlotsOccupied[j] = true; // Mark slot as occupied (conceptual slot for assignment)
        scheduledTasks.push(task); // Add task to the list of tasks to be performed
        totalProfit += task.profit;
        break; // Move to the next task once a slot is found
      }
    }
  }

  // 5. Prepare Gantt chart data based on the scheduled tasks
  // The Gantt chart shows the sequential execution order based on *when they were added*,
  // respecting dependencies only in terms of time calculation.
  // Sort scheduledTasks again if a specific Gantt order (e.g., by deadline) is desired,
  // but usually, it reflects a possible execution sequence.
  // We'll keep the order they were added by the algorithm for simplicity.

  let currentTime = 0; // Keep track of the end time of the last task in the Gantt
  const ganttChartData = scheduledTasks.map((task) => {
    const startTime = currentTime;
    const endTime = startTime + task.duration;
    currentTime = endTime; // Update currentTime for the next task

    return {
      id: task.id,
      description: task.description,
      startTime: startTime,
      endTime: endTime,
      duration: task.duration,
    };
  });

  // 6. Return results
  return {
    // Sort the final schedule list by deadline for clearer presentation if needed
    schedule: scheduledTasks.sort((a, b) => a.deadline - b.deadline),
    totalProfit: totalProfit,
    gantt: ganttChartData, // Pass the calculated Gantt data
  };
}

module.exports = { jobSequencing };
