// filepath: c:\Users\Pradeep K\OneDrive\Desktop\health tech\login.js
"use strict";

const form = document.getElementById("loginForm");

form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const facility = document.getElementById("facility").value.trim();
    const username = document.getElementById("username").value.trim();

    if (!facility || !username) return;

    try {
        sessionStorage.setItem("healthpass_demo_user", JSON.stringify({ facility, username }));
        window.location.assign("index.html");
    } catch (error) {
        document.getElementById("loginMessage").textContent =
            "Unable to start the demo session in this browser.";
        console.error(error);
    }
});
