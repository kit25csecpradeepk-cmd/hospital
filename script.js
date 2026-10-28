
"use strict";

/*
 * HealthPass demo application
 * Login files are not modified.
 * Data is stored in this browser only.
 */

const STORAGE_KEYS = {
    patient: "healthpass_patient",
    patients: "healthpass_patients",
    records: "healthpass_records",
    logs: "healthpass_logs"
};

const pages = [
    "dashboard",
    "patientQR",
    "findPatient",
    "records",
    "hospital",
    "activity"
];

let patients = [];
let medicalRecords = [];
let accessLogs = [];
let selectedPatientId = null;
let toastTimer = null;

function readJSON(key, fallback) {
    try {
        const stored = localStorage.getItem(key);
        return stored === null ? fallback : JSON.parse(stored);
    } catch (error) {
        console.warn("Could not read stored data:", key, error);
        return fallback;
    }
}

function getDemoUser() {
    try {
        return JSON.parse(
            sessionStorage.getItem("healthpass_demo_user")
        ) || {};
    } catch {
        return {};
    }
}

function getFacility() {
    return getDemoUser().facility || "Demo facility";
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

    toastTimer = setTimeout(() => {
        toast.classList.remove("visible");
    }, 3200);
}

function saveData() {
    try {
        /*
         * The legacy key is retained for compatibility with
         * the original demo version.
         */
        localStorage.setItem(
            STORAGE_KEYS.patients,
            JSON.stringify(patients)
        );

        localStorage.setItem(
            STORAGE_KEYS.patient,
            JSON.stringify(patients[0] || null)
        );

        localStorage.setItem(
            STORAGE_KEYS.records,
            JSON.stringify(medicalRecords)
        );

        localStorage.setItem(
            STORAGE_KEYS.logs,
            JSON.stringify(accessLogs)
        );

        return true;
    } catch (error) {
        console.error("Could not save HealthPass data.", error);
        showToast("Unable to save data. Check browser storage.");
        return false;
    }
}

function addActivity(action, patientId = "") {
    accessLogs.unshift({
        action,
        patientId,
        facility: getFacility(),
        username: getDemoUser().username || "Demo user",
        date: new Date().toLocaleString()
    });

    accessLogs = accessLogs.slice(0, 200);
}

function getPatientById(id) {
    const normalizedId = String(id || "").trim().toUpperCase();

    return patients.find(
        patient => patient.id.toUpperCase() === normalizedId
    ) || null;
}

function getPatientRecords(patientId) {
    return medicalRecords
        .filter(record => record.patientId === patientId)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function getNextPatientId() {
    let highestId = 1000;

    patients.forEach(patient => {
        const match = String(patient.id || "").match(/^HP(\d+)$/i);

        if (match) {
            highestId = Math.max(highestId, Number(match[1]));
        }
    });

    return `HP${highestId + 1}`;
}

/* ---------------- PAGE NAVIGATION ---------------- */

function setPage(pageId, updateHash = true) {
    if (!pages.includes(pageId)) return;

    document.querySelectorAll(".page").forEach(page => {
        page.classList.toggle("active", page.id === pageId);
    });

    document.querySelectorAll(".nav-link").forEach(button => {
        const active = button.dataset.page === pageId;

        button.classList.toggle("active", active);

        if (active) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });

    const titles = {
        dashboard: "Overview",
        patientQR: "Patient QR",
        findPatient: "Find Patient",
        records: "Medical records",
        hospital: "Hospital Login",
        activity: "Access activity"
    };

    document.getElementById("pageTitle").textContent = titles[pageId];

    if (updateHash) {
        history.replaceState(null, "", `#${pageId}`);
    }

    if (pageId === "hospital") {
        renderHospital();
    }

    if (pageId === "patientQR") {
        generateCommonQR();
    }
}

/* ---------------- PATIENT PROFILE ---------------- */

function renderPatientSummary() {
    const summary = document.getElementById("patientSummary");
    const hint = document.getElementById("profileHint");
    const title = document.getElementById("patientFormTitle");

    const patient = getPatientById(selectedPatientId);

    if (!patient) {
        summary.className = "empty-state";

        summary.innerHTML = `
            <span class="empty-icon" aria-hidden="true">＋</span>
            <strong>No patient selected</strong>
            <p>Register a patient or select one from the directory.</p>
        `;

        hint.textContent = "Waiting for profile setup";
        title.textContent = "Register a patient";
        return;
    }

    const fields = [
        ["Patient ID", patient.id],
        ["Full name", patient.name],
        ["Age", patient.age],
        ["Blood group", patient.blood],
        ["Phone", patient.phone || "Not provided"],
        ["Emergency contact", patient.emergency || "Not provided"],
        ["Registered hospital", patient.facility || "Not specified"]
    ];

    summary.className = "profile-details";

    summary.innerHTML = fields.map(([label, value]) => `
        <div class="profile-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
        </div>
    `).join("");

    hint.textContent = `Selected patient · ${patient.id}`;
    title.textContent = `Update patient · ${patient.id}`;
}

function clearPatientForm() {
    document.getElementById("patientForm").reset();
    selectedPatientId = null;
    renderPatientSummary();
}

function loadPatientIntoForm(patientId) {
    const patient = getPatientById(patientId);

    if (!patient) {
        showToast("Patient not found.");
        return;
    }

    selectedPatientId = patient.id;

    document.getElementById("patientName").value = patient.name || "";
    document.getElementById("patientAge").value = patient.age ?? "";
    document.getElementById("patientBlood").value = patient.blood || "";
    document.getElementById("patientPhone").value = patient.phone || "";
    document.getElementById("patientEmergency").value =
        patient.emergency || "";

    renderPatientSummary();
    setPage("dashboard");

    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------------- PATIENT DIRECTORY ---------------- */

function renderPatientDirectory() {
    const directory = document.getElementById("patientDirectory");
    const search = document.getElementById("directorySearch")
        .value.trim().toLowerCase();

    const matches = patients.filter(patient => {
        return (
            String(patient.id).toLowerCase().includes(search) ||
            String(patient.name).toLowerCase().includes(search)
        );
    });

    if (matches.length === 0) {
        directory.innerHTML = `
            <div class="list-empty">
                ${patients.length === 0
                    ? "No patients registered yet."
                    : "No matching patients found."}
            </div>
        `;
        return;
    }

    directory.innerHTML = matches.map(patient => `
        <article class="entry-card">
            <div class="entry-meta">
                <span class="patient-id">${escapeHTML(patient.id)}</span>
                <span>${escapeHTML(patient.blood || "Unknown blood group")}</span>
            </div>

            <h4>${escapeHTML(patient.name)}</h4>

            <p><strong>Age:</strong> ${escapeHTML(patient.age)}</p>
            <p><strong>Hospital:</strong> ${escapeHTML(patient.facility || "Not specified")}</p>
            <p><strong>Visit records:</strong> ${getPatientRecords(patient.id).length}</p>

            <div class="entry-actions">
                <button class="text-action"
                        type="button"
                        data-action="view"
                        data-id="${escapeHTML(patient.id)}">
                    View details
                </button>

                <button class="text-action"
                        type="button"
                        data-action="edit"
                        data-id="${escapeHTML(patient.id)}">
                    Edit profile
                </button>
            </div>
        </article>
    `).join("");
}

/* ---------------- MEDICAL RECORDS ---------------- */

function renderRecords() {
    const list = document.getElementById("recordsList");

    const filterId = document.getElementById("recordSearchId")
        .value.trim().toUpperCase();

    const filteredRecords = medicalRecords
        .filter(record => {
            return !filterId || record.patientId === filterId;
        })
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    if (filteredRecords.length === 0) {
        list.innerHTML = `
            <div class="list-empty">
                No matching visit records found.
            </div>
        `;
        return;
    }

    list.innerHTML = filteredRecords.map(record => {
        const patient = getPatientById(record.patientId);

        return `
            <article class="entry-card">
                <div class="entry-meta">
                    <span>${escapeHTML(record.date)}</span>
                    <span>${escapeHTML(record.facility || "Hospital")}</span>
                </div>

                <p>
                    <strong>Patient ID:</strong>
                    ${escapeHTML(record.patientId)}
                </p>

                <p>
                    <strong>Patient name:</strong>
                    ${escapeHTML(patient?.name || "Patient unavailable")}
                </p>

                <h4>${escapeHTML(record.diagnosis)}</h4>

                <p><strong>Doctor:</strong> ${escapeHTML(record.doctor)}</p>

                <p><strong>Symptoms:</strong><br>
                    ${escapeHTML(record.symptoms)}
                </p>

                <p><strong>Treatment / care plan:</strong><br>
                    ${escapeHTML(record.plan || "Not provided")}
                </p>

                <p><strong>Follow-up:</strong>
                    ${escapeHTML(record.followup || "Not scheduled")}
                </p>
            </article>
        `;
    }).join("");
}

/* ---------------- FIND PATIENT ---------------- */

function showPatientLookup(patientId) {
    const result = document.getElementById("lookupResult");
    const message = document.getElementById("lookupMessage");

    const patient = getPatientById(patientId);

    result.innerHTML = "";
    message.textContent = "";

    if (!patient) {
        message.textContent =
            "Patient ID not found. Check the ID and try again.";

        addActivity("Patient lookup failed", patientId);
        saveData();
        renderAll();
        return;
    }

    const records = getPatientRecords(patient.id);

    const profileFields = [
        ["Patient ID", patient.id],
        ["Full name", patient.name],
        ["Age", patient.age],
        ["Blood group", patient.blood],
        ["Phone", patient.phone || "Not provided"],
        ["Emergency contact", patient.emergency || "Not provided"],
        ["Registered hospital", patient.facility || "Not specified"]
    ];

    result.innerHTML = `
        <div class="lookup-result">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">MATCHED PATIENT</p>
                    <h3>${escapeHTML(patient.name)}</h3>
                </div>
                <span class="patient-id">${escapeHTML(patient.id)}</span>
            </div>

            <div class="profile-details">
                ${profileFields.map(([label, value]) => `
                    <div class="profile-row">
                        <span>${escapeHTML(label)}</span>
                        <strong>${escapeHTML(value)}</strong>
                    </div>
                `).join("")}
            </div>

            <h3 class="lookup-section-title">
                Visit history (${records.length})
            </h3>

            <div class="entry-list">
                ${records.length === 0
                    ? `<div class="list-empty">No visit history available for this patient.</div>`
                    : records.map(record => `
                        <article class="entry-card">
                            <div class="entry-meta">
                                <span>${escapeHTML(record.date)}</span>
                                <span>${escapeHTML(record.facility || "Hospital")}</span>
                            </div>

                            <h4>${escapeHTML(record.diagnosis)}</h4>
                            <p><strong>Doctor:</strong> ${escapeHTML(record.doctor)}</p>
                            <p><strong>Symptoms:</strong><br>${escapeHTML(record.symptoms)}</p>
                            <p><strong>Treatment / care plan:</strong><br>${escapeHTML(record.plan || "Not provided")}</p>
                            <p><strong>Follow-up:</strong> ${escapeHTML(record.followup || "Not scheduled")}</p>
                        </article>
                    `).join("")
                }
            </div>

            <div class="entry-actions">
                <button class="button button-quiet"
                        id="editLookupPatientButton"
                        type="button">
                    Edit patient profile
                </button>
            </div>
        </div>
    `;

    document.getElementById("editLookupPatientButton")
        .addEventListener("click", () => loadPatientIntoForm(patient.id));

    addActivity("Patient record viewed", patient.id);
    saveData();
    renderAll();
}

/* ---------------- COMMON QR CODE ---------------- */

function getLookupUrl() {
    const url = new URL(window.location.href);

    url.search = "";
    url.hash = "findPatient";

    return url.href;
}

function generateCommonQR() {
    const target = getLookupUrl();

    document.getElementById("qrTargetUrl").value = target;

    /*
     * The QR contains only the shared lookup URL.
     * No patient name, ID, or medical details are encoded in it.
     *
     * The image service requires internet access.
     */
    const qrUrl =
        "https://api.qrserver.com/v1/create-qr-code/" +
        "?size=240x240&data=" + encodeURIComponent(target);

    const image = document.getElementById("commonQrImage");

    image.onerror = () => {
        image.alt = "QR image unavailable. Check your internet connection.";
        showToast("QR image could not load. Check internet access.");
    };

    image.src = qrUrl;
}

async function copyQRUrl() {
    const url = document.getElementById("qrTargetUrl").value;

    try {
        await navigator.clipboard.writeText(url);
        showToast("Common QR link copied.");
    } catch {
        const input = document.getElementById("qrTargetUrl");
        input.focus();
        input.select();

        try {
            const copied = document.execCommand("copy");
            showToast(copied
                ? "Common QR link copied."
                : "Please copy the QR link manually.");
        } catch {
            showToast("Please copy the QR link manually.");
        }
    }
}

/* ---------------- HOSPITAL WORKSPACE ---------------- */

function renderHospital() {
    const facility = getFacility();

    document.getElementById("hospitalFacilityName").textContent = facility;

    const facilityPatients = patients.filter(
        patient => patient.facility === facility
    );

    const facilityPatientIds = new Set(
        facilityPatients.map(patient => patient.id)
    );

    const facilityRecords = medicalRecords.filter(record => {
        return (
            record.facility === facility &&
            facilityPatientIds.has(record.patientId)
        );
    });

    document.getElementById("hospitalPatientCount").textContent =
        facilityPatients.length;

    document.getElementById("hospitalRecordCount").textContent =
        facilityRecords.length;

    const list = document.getElementById("hospitalRecordsList");

    if (facilityPatients.length === 0) {
        list.innerHTML = `
            <div class="list-empty">
                No patients are registered under this demo facility.
            </div>
        `;
        return;
    }

    list.innerHTML = facilityPatients.map(patient => {
        const records = getPatientRecords(patient.id).filter(
            record => record.facility === facility
        );

        return `
            <article class="entry-card">
                <div class="entry-meta">
                    <span class="patient-id">${escapeHTML(patient.id)}</span>
                    <span>${records.length} visit(s)</span>
                </div>

                <h4>${escapeHTML(patient.name)}</h4>

                <p><strong>Age:</strong> ${escapeHTML(patient.age)}</p>
                <p><strong>Blood group:</strong> ${escapeHTML(patient.blood)}</p>

                <div class="entry-actions">
                    <button class="text-action"
                            type="button"
                            data-action="view"
                            data-id="${escapeHTML(patient.id)}">
                        View patient history
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

/* ---------------- ACTIVITY LOG ---------------- */

function renderActivity() {
    const list = document.getElementById("activityList");

    if (accessLogs.length === 0) {
        list.innerHTML = `
            <div class="list-empty">
                No activity has been recorded yet.
            </div>
        `;
        return;
    }

    list.innerHTML = accessLogs.map(log => `
        <article class="entry-card">
            <div class="entry-meta">
                <span>${escapeHTML(log.date)}</span>
                <span>${escapeHTML(log.facility)}</span>
            </div>

            <h4>${escapeHTML(log.action)}</h4>

            ${log.patientId ? `
                <p><strong>Patient ID:</strong> ${escapeHTML(log.patientId)}</p>
            ` : ""}

            <p><strong>User:</strong> ${escapeHTML(log.username || "Demo user")}</p>
        </article>
    `).join("");
}

/* ---------------- DASHBOARD REFRESH ---------------- */

function renderAll() {
    renderPatientSummary();
    renderPatientDirectory();
    renderRecords();
    renderActivity();

    document.getElementById("patientCount").textContent = patients.length;
    document.getElementById("recordCount").textContent = medicalRecords.length;
    document.getElementById("activityCount").textContent = accessLogs.length;

    if (document.getElementById("hospital").classList.contains("active")) {
        renderHospital();
    }
}

/* ---------------- OLD DATA MIGRATION ---------------- */

function migrateOldData() {
    const existingPatients = readJSON(STORAGE_KEYS.patients, null);

    if (Array.isArray(existingPatients)) {
        patients = existingPatients.filter(patient => {
            return patient &&
                typeof patient.id === "string" &&
                typeof patient.name === "string";
        });
    } else {
        /*
         * Convert the original single-patient format into an array.
         */
        const oldPatient = readJSON(STORAGE_KEYS.patient, null);

        patients = oldPatient && oldPatient.id
            ? [{
                ...oldPatient,
                facility: oldPatient.facility || getFacility()
            }]
            : [];
    }

    medicalRecords = readJSON(STORAGE_KEYS.records, []);
    accessLogs = readJSON(STORAGE_KEYS.logs, []);

    if (!Array.isArray(medicalRecords)) medicalRecords = [];
    if (!Array.isArray(accessLogs)) accessLogs = [];

    /*
     * Older visit records did not store a patient ID.
     * Associate those legacy records with the migrated patient
     * when only one patient exists.
     */
    if (patients.length === 1) {
        medicalRecords = medicalRecords.map(record => {
            if (!record.patientId) {
                return {
                    ...record,
                    patientId: patients[0].id,
                    facility: record.facility || patients[0].facility
                };
            }

            return record;
        });
    }

    /*
     * Save the migrated data in the new structure.
     */
    saveData();
}

/* ---------------- INITIALIZATION ---------------- */

function initialize() {
    const user = getDemoUser();

    /*
     * Keep the existing login page unchanged.
     * This check is for demo navigation only, not real security.
     */
    if (!user.facility || !user.username) {
        window.location.replace("login.html");
        return;
    }

    migrateOldData();

    document.getElementById("facilityName").textContent = user.facility;
    document.getElementById("usernameLabel").textContent = user.username;

    document.getElementById("userInitials").textContent =
        user.facility.trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part[0])
            .join("")
            .toUpperCase() || "HP";

    document.getElementById("todayLabel").textContent =
        new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium"
        }).format(new Date());

    document.querySelectorAll(".nav-link").forEach(button => {
        button.addEventListener("click", () => {
            setPage(button.dataset.page);
        });
    });

    /* Register or update a patient */
    document.getElementById("patientForm").addEventListener("submit", event => {
        event.preventDefault();

        const form = event.currentTarget;

        if (!form.reportValidity()) return;

        const name = document.getElementById("patientName").value.trim();
        const age = Number(document.getElementById("patientAge").value);
        const blood = document.getElementById("patientBlood").value;

        if (!name || !Number.isFinite(age) || age < 0 || age > 120 || !blood) {
            showToast("Please enter valid patient details.");
            return;
        }

        const phone = document.getElementById("patientPhone").value.trim();
        const emergency = document.getElementById("patientEmergency").value.trim();

        const existingPatient = getPatientById(selectedPatientId);

        let patient;

        if (existingPatient) {
            patient = {
                ...existingPatient,
                name,
                age,
                blood,
                phone,
                emergency
            };

            patients = patients.map(item =>
                item.id === existingPatient.id ? patient : item
            );

            addActivity("Patient profile updated", patient.id);
        } else {
            patient = {
                id: getNextPatientId(),
                name,
                age,
                blood,
                phone,
                emergency,
                facility: getFacility(),
                createdAt: new Date().toISOString()
            };

            patients.push(patient);
            selectedPatientId = patient.id;

            addActivity("Patient profile registered", patient.id);
        }

        if (saveData()) {
            renderAll();

            showToast(
                existingPatient
                    ? `Profile updated · ${patient.id}`
                    : `Patient registered · ${patient.id}`
            );
        }
    });

    document.getElementById("clearPatientButton").addEventListener(
        "click",
        clearPatientForm
    );

    /* Directory search */
    document.getElementById("directorySearch").addEventListener(
        "input",
        renderPatientDirectory
    );

    /* Directory and hospital patient actions */
    document.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const patientId = button.dataset.id;
        const action = button.dataset.action;

        if (action === "edit") {
            loadPatientIntoForm(patientId);
        } else if (action === "view") {
            document.getElementById("lookupPatientId").value = patientId;
            setPage("findPatient");
            showPatientLookup(patientId);
        }
    });

    /* Patient lookup form */
    document.getElementById("patientLookupForm").addEventListener(
        "submit",
        event => {
            event.preventDefault();

            const id = document.getElementById("lookupPatientId")
                .value.trim().toUpperCase();

            if (!id) return;

            showPatientLookup(id);
        }
    );

    /* Add a visit record */
    document.getElementById("recordForm").addEventListener("submit", event => {
        event.preventDefault();

        const form = event.currentTarget;

        if (!form.reportValidity()) return;

        const patientId = document.getElementById("recordPatientId")
            .value.trim().toUpperCase();

        const patient = getPatientById(patientId);

        if (!patient) {
            showToast("Patient ID not found. Register the patient first.");
            return;
        }

        const doctor = document.getElementById("recordDoctor").value.trim();
        const date = document.getElementById("recordDate").value;
        const symptoms = document.getElementById("recordSymptoms").value.trim();
        const diagnosis = document.getElementById("recordDiagnosis").value.trim();
        const plan = document.getElementById("recordPlan").value.trim();
        const followup = document.getElementById("recordFollowup").value;

        if (!doctor || !date || !symptoms || !diagnosis) {
            showToast("Please complete all required visit fields.");
            return;
        }

        medicalRecords.unshift({
            id: `VISIT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            patientId: patient.id,
            doctor,
            date,
            symptoms,
            diagnosis,
            plan,
            followup,
            facility: getFacility(),
            createdAt: new Date().toISOString()
        });

        addActivity("Visit record added", patient.id);

        if (saveData()) {
            form.reset();

            document.getElementById("recordDate").value =
                new Date().toISOString().slice(0, 10);

            renderAll();
            showToast(`Visit record saved for ${patient.id}.`);
        }
    });

    document.getElementById("recordSearchId").addEventListener(
        "input",
        renderRecords
    );

    /* Common QR controls */
    document.getElementById("refreshQRButton").addEventListener(
        "click",
        generateCommonQR
    );

    document.getElementById("copyQRUrlButton").addEventListener(
        "click",
        copyQRUrl
    );

    document.getElementById("printQRButton").addEventListener(
        "click",
        () => window.print()
    );

    /* Sign out using the existing login flow */
    document.getElementById("logoutButton").addEventListener("click", () => {
        sessionStorage.removeItem("healthpass_demo_user");
        window.location.assign("login.html");
    });

    /* Reset all demo data */
    document.getElementById("resetButton").addEventListener("click", () => {
        const confirmed = window.confirm(
            "Clear all HealthPass demo patients, medical records and activity?"
        );

        if (!confirmed) return;

        const oldPatients = patients;
        const oldRecords = medicalRecords;
        const oldLogs = accessLogs;
        const oldSelectedId = selectedPatientId;

        patients = [];
        medicalRecords = [];
        accessLogs = [];
        selectedPatientId = null;

        if (saveData()) {
            clearPatientForm();
            document.getElementById("lookupResult").innerHTML = "";
            document.getElementById("lookupMessage").textContent = "";
            document.getElementById("lookupPatientId").value = "";

            renderAll();
            showToast("All HealthPass demo data has been cleared.");
            setPage("dashboard");
        } else {
            patients = oldPatients;
            medicalRecords = oldRecords;
            accessLogs = oldLogs;
            selectedPatientId = oldSelectedId;
            renderAll();
        }
    });

    document.getElementById("recordDate").value =
        new Date().toISOString().slice(0, 10);

    renderAll();

    /*
     * QR links open #findPatient directly.
     * The user then enters the patient ID.
     */
    const requestedPage = location.hash.slice(1);
    const initialPage = pages.includes(requestedPage)
        ? requestedPage
        : "dashboard";

    setPage(initialPage, false);

    /*
     * If a Patient ID is supplied in the URL, fill it into the lookup form.
     * The common QR itself does not include any patient ID.
     */
    const params = new URLSearchParams(location.search);
    const queryPatientId = params.get("patientId");

    if (queryPatientId) {
        document.getElementById("lookupPatientId").value =
            queryPatientId.toUpperCase();
    }
}

document.addEventListener("DOMContentLoaded", initialize);
