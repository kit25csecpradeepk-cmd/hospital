// filepath: c:\Users\Pradeep K\OneDrive\Desktop\health tech\script.js
"use strict";

const STORAGE_KEYS = {
    patient: "healthpass_patient",
    records: "healthpass_records",
    logs: "healthpass_logs"
};

const pages = ["dashboard", "records", "activity"];
let patient = null;
let medicalRecords = [];
let accessLogs = [];
let toastTimer;

function readJSON(key, fallback) {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : fallback;
    } catch (error) {
        console.warn(`Could not read ${key}.`, error);
        return fallback;
    }
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEYS.patient, JSON.stringify(patient));
        localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(medicalRecords));
        localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(accessLogs));
        return true;
    } catch (error) {
        console.error("Could not save demo data.", error);
        showToast("Browser storage is unavailable. Your change was not saved.");
        return false;
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
}

function addActivity(action) {
    accessLogs.unshift({
        action,
        facility: getDemoUser().facility,
        date: new Date().toLocaleString()
    });
    accessLogs = accessLogs.slice(0, 100);
}

function getDemoUser() {
    try {
        return JSON.parse(sessionStorage.getItem("healthpass_demo_user")) || {};
    } catch {
        return {};
    }
}

function setPage(pageId) {
    if (!pages.includes(pageId)) return;

    document.querySelectorAll(".page").forEach(page => {
        page.classList.toggle("active", page.id === pageId);
    });
    document.querySelectorAll(".nav-link").forEach(button => {
        const active = button.dataset.page === pageId;
        button.classList.toggle("active", active);
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    });

    const titles = { dashboard: "Overview", records: "Medical records", activity: "Access activity" };
    document.getElementById("pageTitle").textContent = titles[pageId];
    history.replaceState(null, "", `#${pageId}`);
}

function nextPatientId() {
    const oldId = Number(patient?.id?.match(/^HP(\d+)$/)?.[1] || 1000);
    return `HP${oldId + 1}`;
}

function renderPatient() {
    const summary = document.getElementById("patientSummary");
    const patientStatus = document.getElementById("patientStatus");

    if (!patient) {
        summary.className = "empty-state";
        summary.innerHTML = `
            <span class="empty-icon" aria-hidden="true">＋</span>
            <strong>No patient profile yet</strong>
            <p>Complete the form to create a local demo profile.</p>`;
        patientStatus.textContent = "Not registered";
        document.getElementById("profileHint").textContent = "Waiting for profile setup";
        document.getElementById("patientFormTitle").textContent = "Register a patient";
        return;
    }

    const fields = [
        ["Patient ID", patient.id],
        ["Full name", patient.name],
        ["Age", patient.age],
        ["Blood group", patient.blood],
        ["Phone", patient.phone || "Not provided"],
        ["Emergency contact", patient.emergency || "Not provided"]
    ];

    summary.className = "profile-details";
    summary.innerHTML = fields.map(([label, value]) => `
        <div class="profile-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
        </div>`).join("");

    patientStatus.textContent = "Profile ready";
    document.getElementById("profileHint").textContent = `Demo profile · ${patient.id}`;
    document.getElementById("patientFormTitle").textContent = "Update patient profile";

    document.getElementById("patientName").value = patient.name || "";
    document.getElementById("patientAge").value = patient.age || "";
    document.getElementById("patientBlood").value = patient.blood || "";
    document.getElementById("patientPhone").value = patient.phone || "";
    document.getElementById("patientEmergency").value = patient.emergency || "";
}

function renderRecords() {
    const list = document.getElementById("recordsList");

    if (medicalRecords.length === 0) {
        list.innerHTML = `<div class="list-empty">No visit records yet. Add an entry to get started.</div>`;
        return;
    }

    list.innerHTML = medicalRecords.map(record => `
        <article class="entry-card">
            <div class="entry-meta"><span>${escapeHTML(record.date)}</span><span>${escapeHTML(record.facility)}</span></div>
            <h4>${escapeHTML(record.diagnosis)}</h4>
            <p><strong>Doctor:</strong> ${escapeHTML(record.doctor)}</p>
            <p><strong>Symptoms:</strong> ${escapeHTML(record.symptoms)}</p>
            <p><strong>Care plan:</strong> ${escapeHTML(record.plan || "Not provided")}</p>
        </article>`).join("");
}

function renderActivity() {
    const list = document.getElementById("activityList");

    if (accessLogs.length === 0) {
        list.innerHTML = `<div class="list-empty">No activity has been recorded yet.</div>`;
        return;
    }

    list.innerHTML = accessLogs.map(log => `
        <article class="entry-card">
            <div class="entry-meta"><span>${escapeHTML(log.date)}</span><span>${escapeHTML(log.facility)}</span></div>
            <h4>${escapeHTML(log.action)}</h4>
        </article>`).join("");
}

function renderAll() {
    renderPatient();
    renderRecords();
    renderActivity();
    document.getElementById("recordCount").textContent = medicalRecords.length;
    document.getElementById("activityCount").textContent = accessLogs.length;
}

function initialize() {
    const user = getDemoUser();

    // Session state is for demo convenience only, not access control.
    if (!user.facility || !user.username) {
        window.location.replace("login.html");
        return;
    }

    patient = readJSON(STORAGE_KEYS.patient, null);
    medicalRecords = readJSON(STORAGE_KEYS.records, []);
    accessLogs = readJSON(STORAGE_KEYS.logs, []);

    if (!Array.isArray(medicalRecords)) medicalRecords = [];
    if (!Array.isArray(accessLogs)) accessLogs = [];

    document.getElementById("facilityName").textContent = user.facility;
    document.getElementById("usernameLabel").textContent = user.username;
    document.getElementById("userInitials").textContent =
        user.facility.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "HP";
    document.getElementById("todayLabel").textContent =
        new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date());

    renderAll();

    const requestedPage = location.hash.slice(1);
    setPage(pages.includes(requestedPage) ? requestedPage : "dashboard");

    document.querySelectorAll(".nav-link").forEach(button => {
        button.addEventListener("click", () => setPage(button.dataset.page));
    });

    document.getElementById("patientForm").addEventListener("submit", event => {
        event.preventDefault();
        const form = event.currentTarget;

        if (!form.reportValidity()) return;

        const wasRegistered = Boolean(patient);
        patient = {
            id: patient?.id || nextPatientId(),
            name: document.getElementById("patientName").value.trim(),
            age: Number(document.getElementById("patientAge").value),
            blood: document.getElementById("patientBlood").value,
            phone: document.getElementById("patientPhone").value.trim(),
            emergency: document.getElementById("patientEmergency").value.trim()
        };

        addActivity(wasRegistered ? "Patient profile updated" : "Patient profile registered");
        if (saveData()) {
            renderAll();
            showToast(wasRegistered ? "Patient profile updated." : `Patient profile saved · ${patient.id}`);
        }
    });

    document.getElementById("clearPatientButton").addEventListener("click", () => {
        document.getElementById("patientForm").reset();
    });

    document.getElementById("recordForm").addEventListener("submit", event => {
        event.preventDefault();
        if (!patient) {
            showToast("Register a patient before adding a visit record.");
            setPage("dashboard");
            return;
        }

        const form = event.currentTarget;
        if (!form.reportValidity()) return;

        medicalRecords.unshift({
            doctor: document.getElementById("recordDoctor").value.trim(),
            date: document.getElementById("recordDate").value,
            symptoms: document.getElementById("recordSymptoms").value.trim(),
            diagnosis: document.getElementById("recordDiagnosis").value.trim(),
            plan: document.getElementById("recordPlan").value.trim(),
            facility: getDemoUser().facility || "Demo facility"
        });

        addActivity("Visit record added");
        if (saveData()) {
            form.reset();
            document.getElementById("recordDate").value = new Date().toISOString().slice(0, 10);
            renderAll();
            showToast("Visit record saved.");
        }
    });

    document.getElementById("logoutButton").addEventListener("click", () => {
        sessionStorage.removeItem("healthpass_demo_user");
        window.location.assign("login.html");
    });

    document.getElementById("resetButton").addEventListener("click", () => {
        if (!window.confirm("Clear the demo patient, records, and activity from this browser?")) return;
        patient = null;
        medicalRecords = [];
        accessLogs = [];
        if (saveData()) {
            document.getElementById("patientForm").reset();
            renderAll();
            showToast("Demo data has been cleared.");
            setPage("dashboard");
        }
    });

    document.getElementById("recordDate").value = new Date().toISOString().slice(0, 10);
}

document.addEventListener("DOMContentLoaded", initialize);
