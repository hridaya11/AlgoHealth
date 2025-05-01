document.addEventListener("DOMContentLoaded", () => {
  const clinicSelect = document.getElementById("clinicAdminId");
  const dateInput = document.getElementById("appointmentDate");
  const findSlotsButton = document.getElementById("findSlotsButton");
  const slotSelect = document.getElementById("appointmentSlot");
  const slotsLoadingDiv = document.getElementById("slotsLoading");
  const slotsErrorDiv = document.getElementById("slotsError");
  const bookingForm = document.getElementById("bookingForm");
  const submitButton = document.getElementById("submitBookingButton");
  const searchTimeDiv = document.getElementById("slotSearchTime");
  const methodRadios = document.querySelectorAll('input[name="searchMethod"]');

  function clearSlots() {
    slotSelect.innerHTML =
      '<option value="">-- Select Date and Find Slots --</option>';
    slotSelect.disabled = true;
    submitButton.disabled = true;
    slotsErrorDiv.style.display = "none";
    slotsErrorDiv.textContent = "";
    searchTimeDiv.textContent = ""; // Clear search time
  }

  function enableSubmitIfReady() {
    // Enable submit only if clinic, date, and a valid slot are selected
    if (
      clinicSelect.value &&
      dateInput.value &&
      slotSelect.value &&
      !slotSelect.disabled
    ) {
      submitButton.disabled = false;
    } else {
      submitButton.disabled = true;
    }
  }

  async function fetchAndDisplaySlots() {
    const clinicId = clinicSelect.value;
    const date = dateInput.value;
    const selectedMethod = document.querySelector(
      'input[name="searchMethod"]:checked',
    ).value;

    if (!clinicId || !date) {
      clearSlots();
      // Optionally show a message to select clinic and date first
      slotsErrorDiv.textContent = "Please select a clinic and a date first.";
      slotsErrorDiv.style.display = "block";
      return;
    }

    clearSlots(); // Clear previous slots before fetching new ones
    slotsLoadingDiv.style.display = "block";
    findSlotsButton.disabled = true; // Disable button during fetch

    try {
      // *** FIX 1: Added the correct fetch URL ***
      const response = await fetch(
        `/api/slots/${clinicId}/${date}?method=${selectedMethod}`,
      );
      slotsLoadingDiv.style.display = "none"; // Hide loading indicator

      if (!response.ok) {
        let errorMsg = "Failed to load slots. Please try again.";
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch (e) {
          /* Ignore json parsing error if response isn't JSON */
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      // *** FIX 2: Added the content for searchTimeDiv ***
      searchTimeDiv.textContent = `Slot search (${data.searchMethod}) took: ${data.timeTaken} ms`; // Display search time

      if (data.availableSlots && data.availableSlots.length > 0) {
        slotSelect.innerHTML =
          '<option value="">-- Select a Time Slot --</option>'; // Reset placeholder
        data.availableSlots.forEach((slot) => {
          const option = document.createElement("option");
          // *** FIX 3: Set the correct option value ***
          // Value combines start and end ISO strings, separated by '|'
          option.value = `${slot.startISO}|${slot.endISO}`;
          option.textContent = slot.label;
          slotSelect.appendChild(option);
        });
        slotSelect.disabled = false; // Enable slot selection
      } else {
        slotSelect.innerHTML =
          '<option value="">-- No Slots Available --</option>';
        slotsErrorDiv.textContent =
          "No available time slots for the selected date and clinic.";
        slotsErrorDiv.style.display = "block";
        slotSelect.disabled = true;
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
      slotsLoadingDiv.style.display = "none";
      slotsErrorDiv.textContent =
        error.message || "An error occurred while fetching slots.";
      slotsErrorDiv.style.display = "block";
      slotSelect.innerHTML =
        '<option value="">-- Error Loading Slots --</option>';
      slotSelect.disabled = true;
    } finally {
      findSlotsButton.disabled = false; // Re-enable button after fetch attempt
      enableSubmitIfReady(); // Check if submit should be enabled
    }
  }

  // Event Listeners
  if (findSlotsButton) {
    findSlotsButton.addEventListener("click", fetchAndDisplaySlots);
  }

  if (clinicSelect) {
    clinicSelect.addEventListener("change", clearSlots); // Clear slots if clinic changes
  }
  if (dateInput) {
    dateInput.addEventListener("change", clearSlots); // Clear slots if date changes
  }
  if (methodRadios) {
    methodRadios.forEach((radio) => {
      radio.addEventListener("change", clearSlots); // Clear slots if method changes before Find is clicked
    });
  }

  if (slotSelect) {
    slotSelect.addEventListener("change", enableSubmitIfReady);
  }

  // Initial check in case the form is pre-filled (e.g., after an error redirect)
  // Call clearSlots initially to ensure submit is disabled until interaction
  clearSlots();
  // You might want to trigger fetchAndDisplaySlots if clinic/date are pre-filled on load
  // For example, if redirecting back after an error:
  // if (clinicSelect.value && dateInput.value) {
  //     fetchAndDisplaySlots();
  // } else {
  //     enableSubmitIfReady();
  // }
  enableSubmitIfReady(); // Still call this to handle potential pre-filled valid states
});
