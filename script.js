(() => {
  "use strict";

  const API_URL = "https://mental-health-score-cyt3.onrender.com";

  const form          = document.getElementById("predict-form");
  const submitBtn     = document.getElementById("submit-btn");
  const orbStage      = document.querySelector(".orb-stage");
  const orbRing       = document.getElementById("orb-ring");
  const orbValue      = document.getElementById("orb-value");
  const orbLabel      = document.getElementById("orb-label");
  const panelMessage  = document.getElementById("panel-message");
  const errorBanner   = document.getElementById("error-banner");
  const recapChips    = document.getElementById("recap-chips");

  const RING_CIRCUMFERENCE = 2 * Math.PI * 92; // matches r=92 in the SVG

  // -----------------------------------------------------------------
  // Idle breathing state on load
  // -----------------------------------------------------------------
  orbStage.classList.add("breathing");

  // -----------------------------------------------------------------
  // Sliders: live value readout + filled track
  // -----------------------------------------------------------------
  const sliderConfigs = [
    { input: "usage",    output: "usage-out"    },
    { input: "study",    output: "study-out"    },
    { input: "activity", output: "activity-out" },
    { input: "sleep",    output: "sleep-out"    },
  ];

  function paintSlider(input) {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);
    const pct = ((val - min) / (max - min)) * 100;
    input.style.background =
      `linear-gradient(90deg, var(--lavender) ${pct}%, var(--border) ${pct}%)`;
  }

  sliderConfigs.forEach(({ input, output }) => {
    const inputEl = document.getElementById(input);
    const outputEl = document.getElementById(output);
    const sync = () => {
      outputEl.textContent = `${parseFloat(inputEl.value).toFixed(1)} h`;
      paintSlider(inputEl);
    };
    inputEl.addEventListener("input", sync);
    sync();
  });

  // -----------------------------------------------------------------
  // Field <-> error helpers
  // -----------------------------------------------------------------
  function clearFieldError(name) {
    const errEl = document.getElementById(`err-${name}`);
    if (errEl) errEl.textContent = "";
    const fieldEl = document.querySelector(`[data-field="${name}"]`) ||
                    document.getElementById(name)?.closest(".field");
    if (fieldEl) fieldEl.classList.remove("invalid");
  }

  function setFieldError(name, message) {
    const errEl = document.getElementById(`err-${name}`);
    if (errEl) errEl.textContent = message;
    const inputEl = document.getElementById(cssIdFor(name));
    const fieldEl = inputEl ? inputEl.closest(".field")
                            : document.querySelector(`[name="${name}"]`)?.closest(".field");
    if (fieldEl) fieldEl.classList.add("invalid");
  }

  // maps a payload key to the primary input's DOM id (for number/text/select fields)
  function cssIdFor(name) {
    const map = {
      Age: "age",
      Country: "country",
      Most_Used_Platform: "platform",
      Daily_Unlocks: "unlocks",
      Avg_Daily_Usage_Hours: "usage",
      Study_Hours: "study",
      Physical_Activity_Hours: "activity",
      Sleep_Hours_Per_Night: "sleep",
    };
    return map[name] || null;
  }

  function clearAllErrors() {
    form.querySelectorAll(".field-error").forEach(el => (el.textContent = ""));
    form.querySelectorAll(".field.invalid").forEach(el => el.classList.remove("invalid"));
    errorBanner.classList.add("hidden");
    errorBanner.textContent = "";
  }

  // -----------------------------------------------------------------
  // Client-side validation (mirrors the Pydantic model's constraints)
  // -----------------------------------------------------------------
  function validate(payload) {
    let valid = true;

    const req = (name, val) => {
      if (val === "" || val === null || val === undefined) {
        setFieldError(name, "Required");
        valid = false;
      }
    };

    req("Age", payload.Age);
    if (payload.Age !== "" && (payload.Age < 10 || payload.Age > 100)) {
      setFieldError("Age", "Must be between 10 and 100");
      valid = false;
    }
    req("Gender", payload.Gender);
    req("Country", payload.Country);
    req("Academic_Level", payload.Academic_Level);
    req("Most_Used_Platform", payload.Most_Used_Platform);
    req("Purpose_Of_Use", payload.Purpose_Of_Use);
    req("Stress_Level", payload.Stress_Level);

    req("Daily_Unlocks", payload.Daily_Unlocks);
    if (payload.Daily_Unlocks !== "" && payload.Daily_Unlocks < 0) {
      setFieldError("Daily_Unlocks", "Cannot be negative");
      valid = false;
    }

    if (payload.Avg_Daily_Usage_Hours < 0 || payload.Avg_Daily_Usage_Hours > 24) {
      setFieldError("Avg_Daily_Usage_Hours", "Must be between 0 and 24");
      valid = false;
    }
    if (payload.Study_Hours < 0 || payload.Study_Hours > 24) {
      setFieldError("Study_Hours", "Must be between 0 and 24");
      valid = false;
    }
    if (payload.Physical_Activity_Hours < 0 || payload.Physical_Activity_Hours > 3) {
      setFieldError("Physical_Activity_Hours", "Must be between 0 and 3");
      valid = false;
    }
    if (payload.Sleep_Hours_Per_Night < 0 || payload.Sleep_Hours_Per_Night > 24) {
      setFieldError("Sleep_Hours_Per_Night", "Must be between 0 and 24");
      valid = false;
    }

    return valid;
  }

  // -----------------------------------------------------------------
  // Build the payload straight from the form
  // -----------------------------------------------------------------
  function buildPayload() {
    const fd = new FormData(form);
    return {
      Age: fd.get("Age") === "" ? "" : Number(fd.get("Age")),
      Gender: fd.get("Gender") || "",
      Country: (fd.get("Country") || "").trim(),
      Academic_Level: fd.get("Academic_Level") || "",
      Most_Used_Platform: fd.get("Most_Used_Platform") || "",
      Purpose_Of_Use: fd.get("Purpose_Of_Use") || "",
      Avg_Daily_Usage_Hours: Number(fd.get("Avg_Daily_Usage_Hours") || 0),
      Daily_Unlocks: fd.get("Daily_Unlocks") === "" ? "" : Number(fd.get("Daily_Unlocks")),
      Study_Hours: Number(fd.get("Study_Hours") || 0),
      Physical_Activity_Hours: Number(fd.get("Physical_Activity_Hours") || 0),
      Sleep_Hours_Per_Night: Number(fd.get("Sleep_Hours_Per_Night") || 0),
      Stress_Level: fd.get("Stress_Level") || "",
    };
  }

  // -----------------------------------------------------------------
  // Result presentation
  // -----------------------------------------------------------------
  function bandForScore(score) {
    if (score <= 3)  return { label: "Reads low — reach out to someone you trust", color: "#ff5c7c" };
    if (score <= 6)  return { label: "Reads moderate — worth keeping an eye on",     color: "#ffc46b" };
    if (score <= 8)  return { label: "Reads steady",                                color: "#7ee8c2" };
    return               { label: "Reads strong",                                    color: "#b4a0ff" };
  }

  function showResult(score) {
    const clamped = Math.max(0, Math.min(10, score));
    const pct = clamped / 10;
    const offset = RING_CIRCUMFERENCE * (1 - pct);
    const band = bandForScore(clamped);

    orbRing.style.stroke = band.color;
    orbRing.style.strokeDashoffset = String(offset);
    orbValue.textContent = score.toFixed(2);
    orbLabel.textContent = band.label;

    panelMessage.textContent =
      "Estimate from the model — scored roughly on a 0–10 scale, higher reflects a steadier signal.";
  }

  function renderRecap(payload) {
    recapChips.innerHTML = "";
    const entries = [
      `${payload.Age} yrs`,
      payload.Gender,
      payload.Academic_Level,
      payload.Most_Used_Platform,
      `${payload.Avg_Daily_Usage_Hours.toFixed(1)}h usage`,
      `${payload.Sleep_Hours_Per_Night.toFixed(1)}h sleep`,
      `${payload.Stress_Level} stress`,
    ];
    entries.forEach(text => {
      const chip = document.createElement("span");
      chip.className = "recap-chip";
      chip.textContent = text;
      recapChips.appendChild(chip);
    });
    recapChips.classList.remove("hidden");
  }

  // -----------------------------------------------------------------
  // Submit handler
  // -----------------------------------------------------------------
  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    clearAllErrors();

    const payload = buildPayload();
    if (!validate(payload)) {
      panelMessage.textContent = "A few fields need a second look.";
      return;
    }

    // loading state
    submitBtn.disabled = true;
    submitBtn.classList.add("loading");
    orbStage.classList.remove("breathing");
    orbStage.classList.add("thinking");
    orbValue.textContent = "…";
    orbLabel.textContent = "Reading the signal";
    panelMessage.textContent = "Sending your answers to the model…";
    recapChips.classList.add("hidden");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 422) {
        const body = await response.json();
        handleValidationErrors(body);
        panelMessage.textContent = "The backend flagged a few fields — check the form.";
        resetOrbToIdle();
        return;
      }

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();
      orbStage.classList.remove("thinking");
      orbStage.classList.remove("breathing");
      showResult(data.predicted_mental_health_score);
      renderRecap(payload);
    } catch (err) {
      console.error(err);
      resetOrbToIdle();
      showBanner(
        err instanceof TypeError
          ? "Couldn't reach the API. Make sure the FastAPI server is running at 127.0.0.1:8000 (uvicorn main:app --reload) and that CORS is enabled."
          : "Something went wrong while getting your prediction. Please try again."
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("loading");
    }
  });

  function resetOrbToIdle() {
    orbStage.classList.remove("thinking");
    orbStage.classList.add("breathing");
    orbValue.textContent = "—";
    orbLabel.textContent = "Awaiting input";
    orbRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    orbRing.style.stroke = "";
  }

  function showBanner(message) {
    errorBanner.textContent = message;
    errorBanner.classList.remove("hidden");
  }

  // FastAPI 422 error shape: { detail: [{ loc: ["body","Age"], msg: "...", ... }, ...] }
  function handleValidationErrors(body) {
    if (!body || !Array.isArray(body.detail)) {
      showBanner("The backend rejected this submission. Please check your inputs.");
      return;
    }
    body.detail.forEach(item => {
      const field = item.loc?.[item.loc.length - 1];
      if (field) setFieldError(field, item.msg || "Invalid value");
    });
  }

  // -----------------------------------------------------------------
  // Clear a field's error the moment the person edits it
  // -----------------------------------------------------------------
  form.addEventListener("input", (evt) => {
    const name = evt.target.name;
    if (name) clearFieldError(name);
  });
  form.addEventListener("change", (evt) => {
    const name = evt.target.name;
    if (name) clearFieldError(name);
  });
})();
