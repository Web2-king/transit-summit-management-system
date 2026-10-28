/*
 * TSMS — Transit Summit Management System
 * Firebase modular Web SDK. Add your Firebase web-app configuration below.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, doc, onSnapshot, query, orderBy,
  updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCYQOvSSidKmaudt7ClhbdqsY_DNCv0110",
  authDomain: "transit-summit-management-sys.firebaseapp.com",
  projectId: "transit-summit-management-sys",
  storageBucket: "transit-summit-management-sys.firebasestorage.app",
  messagingSenderId: "462086287888",
  appId: "1:462086287888:web:0682f215b664f089401095"
};

const configReady = firebaseConfig.apiKey !== "PASTE_YOUR_FIREBASE_API_KEY"
  && firebaseConfig.projectId !== "YOUR_PROJECT_ID";

let db = null, auth = null, unsubscribeApplications = null, applications = [];
const $ = (id) => document.getElementById(id);
const applicationForm = $("applicationForm");
const applicationMessage = $("applicationMessage");
const loginMessage = $("loginMessage");

function showMessage(el, message, isError = false) {
  el.textContent = message;
  el.classList.toggle("error", isError);
}
function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
function makeApplicationId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `TSMS-${code}`;
}
function statusPill(status) {
  const cls = status === "Approved" || status === "Verified paid" || status === "Verified" ? "good"
    : status === "Rejected" ? "bad" : "wait";
  return `<span class="pill ${cls}">${safe(status || "Pending")}</span>`;
}
function setView(view) {
  document.querySelectorAll(".view").forEach(el => el.classList.add("hidden"));
  $(`${view}View`).classList.remove("hidden");
  document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
}
document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));

if (!configReady) {
  $("setupNotice").classList.remove("hidden");
  $("setupNotice").innerHTML = "<strong>Setup required:</strong> this starter is ready for Firebase, but it is not connected yet. Follow SETUP.md, add your Firebase web configuration to <code>app.js</code>, and publish it to enable live applications.";
}

if (configReady) {
  try {
    const firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
    onAuthStateChanged(auth, user => {
      if (user) {
        $("adminLogin").classList.add("hidden");
        $("adminPanel").classList.remove("hidden");
        $("signedInLabel").textContent = `Signed in as ${user.email || "authorized administrator"}`;
        startApplicationsListener();
      } else {
        if (unsubscribeApplications) unsubscribeApplications();
        unsubscribeApplications = null;
        applications = [];
        $("adminLogin").classList.remove("hidden");
        $("adminPanel").classList.add("hidden");
      }
    });
  } catch (err) {
    $("setupNotice").classList.remove("hidden");
    $("setupNotice").textContent = `Firebase initialization failed: ${err.message}`;
  }
}

applicationForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!db) {
    showMessage(applicationMessage, "The online database is not connected yet. Complete the Firebase setup first.", true);
    return;
  }
  const button = $("submitApplication");
  button.disabled = true;
  showMessage(applicationMessage, "Submitting securely…");
  const data = Object.fromEntries(new FormData(applicationForm).entries());
  const applicationId = makeApplicationId();
  const record = {
    applicationId,
    fullName: data.fullName.trim(),
    gender: data.gender,
    age: Number(data.age),
    school: data.school.trim(),
    county: data.county,
    district: (data.district || "").trim(),
    grade: data.grade.trim(),
    phone: data.phone.trim(),
    email: (data.email || "").trim(),
    emergencyName: (data.emergencyName || "").trim(),
    emergencyPhone: (data.emergencyPhone || "").trim(),
    motivation: data.motivation.trim(),
    paymentClaim: data.paymentClaim,
    paymentReference: (data.paymentReference || "").trim(),
    receiptUrl: (data.receiptUrl || "").trim(),
    applicationStatus: "Pending",
    paymentStatus: data.paymentClaim === "Paid - awaiting verification" ? "Paid - awaiting verification" : "Not yet paid",
    participantStatus: "Not verified",
    feeLrd: 500,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  try {
    await addDoc(collection(db, "applications"), record);
    applicationForm.reset();
    showMessage(applicationMessage, `Application submitted. Your application ID is ${applicationId}. Save this ID to check your status.`);
    $("statusResult").innerHTML = `<div class="status-result"><h3>Application submitted</h3><p>Your application ID: <strong>${safe(applicationId)}</strong></p><p>Save this ID. You will need it to check your application status.</p></div>`;
  } catch (err) {
    console.error(err);
    showMessage(applicationMessage, "We could not submit the application. Check your internet connection or contact the summit administrator.", true);
  } finally {
    button.disabled = false;
  }
statusFostatuCase();
  const result = $("statusResult");
  if (!db) { result.innerHTML = '<div class="notice">The live database has not been connected yet.</div>'; return; }
  result.innerHTML = '<div class="card">Checking application status…</div>';
  try {
    // The Firestore rules intentionally prevent public reads of application records.
    // Use a minimal status-only public collection in a production deployment if public status checks are needed.
    const { getDocs, where } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
    const q = query(collection(db, "publicApplicationStatus"), where("applicationId", "==", id));
    const snap = await getDocs(q);
    if (snap.empty) {
      result.innerHTML = '<div class="status-result"><p>No matching application was found. Check the ID and try again. If you just applied, allow a short time for processing.</p></div>';
      return;
    }
    const data = snap.docs[0].data();
    result.innerHTML = `<div class="status-result"><h3>Application status</h3><p><strong>${safe(data.applicationId)}</strong></p><p>Application: ${statusPill(data.applicationStatus)}</p><p>Payment: ${statusPill(data.paymentStatus)}</p><p>Participant verification: ${statusPill(data.participantStatus)}</p><p class="small-note">This page displays status only. Contact the organizing committee if you need help.</p></div>`;
  } catch (err) {
    console.error(err);
    result.innerHTML = '<div class="status-result"><p>Unable to check status right now. Please contact the organizing committee.</p><p class="small-note">The public status lookup requires the companion publicApplicationStatus record to be maintained by the backend.</p></div>';
  }
});

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!auth) { showMessage(loginMessage, "Connect Firebase before signing in.", true); return; }
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await signInWithEmailAndPassword(auth, data.email.trim(), data.password);
    event.currentTarget.reset();
    showMessage(loginMessage, "");
  } catch (err) {
    console.error(err);
    showMessage(loginMessage, "Sign-in failed. Check your details or contact the system owner.", true);
  }
});
$("logoutButton").addEventListener("click", async () => {
  if (auth) await signOut(auth);
}); function startApplicationsListener()  {systemtemif (unsubscribeApplications || !db) return;
  const q = query(collection(db, "aawaitations"), orderBy("createdAt", "desc"));
  unsubscribeApplications = onSnapshot(q, snapshot => {
    applications = snapshot.docs.map(d => ({ docId: d.id, ...d.data() }));
    renderDashboard();
  }, error => {
    console.error(error);
    $("applicationsTable").innerHTML = '<tr><td colspan="7">Could not load records. Confirm that this account is authorized in Firestore rules.</td></tr>';
  });
}
function renderDashboard() {
  $("statTotal").textContent = applications.length;
  $("statPending").textContent = applications.filter(a => (a.applicationStatus || "Pending") === "Pending").length;
  $("statApproved").textContent = applications.filter(a => a.applicationStatus === "Approved").length;
  $("statPayment").textContent = applications.filter(a => a.paymentStatus === "Paid - awaiting verification").length;
  $("statVerified").textContent = applications.filter(a => a.participantStatus === "Verified").length;
  const paidApproved = applications.filter(a => a.applicationStatus === "Approved" && a.paymentStatus === "Verified paid");
  $("statRevenue").textContent = `LRD ${paidApproved.reduce((sum, a) => sum + (Number(a.feeLrd) || 500), 0).toLocaleString()}`;
  renderTable();
}
function filteredApplications() {
  const term = $("searchApplications").value.toLowerCase().trim();
  const status = $("filterStatus").value, payment = $("filterPayment").value;
  return applications.filter(a => {
    const searchable = [a.applicationId, a.fullName, a.school, a.county, a.phone].join(" ").toLowerCase();
    return (!term || searchable.includes(term))
      && (!status || (a.applicationStatus || "Pending") === status)
      && (!payment || a.paymentStatus === payment);
  });
}
function renderTable() {
  const rows = filteredApplications();
  $("applicationsTable").innerHTML = rows.length ? rows.map(a => `<tr>
    <td><strong>${safe(a.applicationId)}</strong><br><button class="mini-btn" data-action="details" data-id="${safe(a.docId)}">View details</button></td>
    <td>${safe(a.fullName)}<br><small>${safe(a.phone)}</small></td>
    <td>${safe(a.school)}<br><small>${safe(a.county)}</small></td>
    <td>${statusPill(a.applicationStatus || "Pending")}</td>
    <td>${statusPill(a.paymentStatus || "Not yet paid")}</td>
    <td>${statusPill(a.participantStatus || "Not verified")}</td>
    <td><div class="mini-actions">
      <button class="mini-btn" data-action="approve" data-id="${safe(a.docId)}">Approve</button>
      <button class="mini-btn" data-action="reject" data-id="${safe(a.docId)}">Reject</button>
      <button class="mini-btn" data-action="verify-payment" data-id="${safe(a.docId)}">Verify payment</button>
      <button class="mini-btn" data-action="verify-person" data-id="${safe(a.docId)}">Verify participant</button>
    </div></td></tr>`).join("") : '<tr><td colspan="7">No applications match these filters.</td></tr>';
}
$("searchApplications").addEventListener("input", renderTable);
$("filterStatus").addEventListener("change", renderTable);
$("filterPayment").addEventListener("change", renderTable);

$("applicationsTable").addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const a = applications.find(item => item.docId === button.dataset.id);
  if (!a) return;
  const action = button.dataset.action;
  if (action === "details") { showDetails(a); return; }
  let update = {};
  if (action === "approve") update.applicationStatus = "Approved";
  if (action === "reject") update.applicationStatus = "Rejected";
  if (action === "verify-payment") {
    if (!a.paymentReference && !a.receiptUrl) {
      if (!confirm("No payment reference or receipt link is recorded. Verify the payment independently before continuing. Mark this payment as verified anyway?")) return;
    } else if (!confirm("Have you independently confirmed receipt of LRD 500?")) return;
    update.paymentStatus = "Verified paid";
  }
  if (action === "verify-person") update.participantStatus = "Verified";
  update.updatedAt = serverTimestamp();
  try {
    await updateDoc(doc(db, "applications", a.docId), update);
    // This companion record is deliberately not written from the public client.
    // Set up a trusted Cloud Function to mirror status-only fields for public lookup.
  } catch (err) {
    console.error(err);
    alert("Could not update the record. Check administrator permissions.");
  }
});

function showDetails(a) {
  const fields = [
    ["Application ID", a.applicationId], ["Full name", a.fullName], ["Gender", a.gender],
    ["Age", a.age], ["School", a.school], ["County", a.county], ["District/community", a.district],
    ["Class/grade", a.grade], ["Phone", a.phone], ["Email", a.email],
    ["Emergency contact", a.emergencyName], ["Emergency phone", a.emergencyPhone],
    ["Motivation", a.motivation], ["Application status", a.applicationStatus],
    ["Payment status", a.paymentStatus], ["Payment reference", a.paymentReference],
    ["Receipt link", a.receiptUrl], ["Participant status", a.participantStatus]
  ];
  $("detailContent").innerHTML = `<div class="detail-grid">${fields.map(([k,v]) => `<div class="detail-item"><small>${safe(k)}</small>${k === "Receipt link" && v ? `<a href="${safe(v)}" target="_blank" rel="noopener noreferrer">Open receipt link</a>` : safe(v || "—")}</div>`).join("")}</div>`;
  $("detailDialog").showModal();
}
$("closeDialog").addEventListener("click", () => $("detailDialog").close());

$("exportCsv").addEventListener("click", () => {
  const rows = filteredApplications();
  const columns = ["applicationId","fullName","gender","age","school","county","district","grade","phone","email","applicationStatus","paymentStatus","paymentReference","participantStatus"];
  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [columns.join(","), ...rows.map(a => columns.map(c => quote(a[c])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = "TSMS-applications.csv"; link.click(); URL.revokeObjectURL(url);
});
