
const STORAGE_KEY = "maihar_academy_data";

const defaultData = {
  users: [
    {
      id: "trainer1",
      name: "Academy Trainer",
      username: "trainer",
      password: "MPA@123",
      role: "trainer"
    },
    {
      id: "student1",
      name: "Demo Student",
      username: "student01",
      password: "123456",
      role: "student",
      phone: "",
      totalFees: 12000,
      paidFees: 5000
    }
  ],
  attendance: {},
  notices: [
    {
      id: "notice1",
      title: "Welcome to Maihar Physical Academy",
      body: "Welcome to the academy portal. Please check notifications regularly.",
      date: new Date().toLocaleDateString("en-IN"),
      by: "Academy Trainer"
    }
  ]
};

let data = loadData();
let currentUser = null;

const $ = id => document.getElementById(id);

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(defaultData));
  } catch {
    return JSON.parse(JSON.stringify(defaultData));
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isTrainer() {
  return currentUser && currentUser.role === "trainer";
}

function studentsList() {
  return data.users.filter(user =>
    user.role === "student" &&
    (isTrainer() || user.id === currentUser.id)
  );
}

function money(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.display = "none";
  }, 2500);
}

function updateAvatar(imageId, initialsId, name, picture) {
  const image = $(imageId);
  const initials = $(initialsId);
  initials.textContent = name.trim().charAt(0).toUpperCase() || "T";

  if (!picture) {
    image.hidden = true;
    image.removeAttribute("src");
    initials.hidden = false;
    return;
  }

  image.onerror = function() {
    image.hidden = true;
    initials.hidden = false;
  };
  image.src = picture;
  image.hidden = false;
  initials.hidden = true;
}

function renderProfile() {
  if (!currentUser) return;
  $("profileName").textContent = currentUser.name;
  $("profileRole").textContent = isTrainer() ? "Trainer" : "Student";
  updateAvatar(
    "profilePhoto",
    "profileInitials",
    currentUser.name,
    currentUser.profilePicture
  );
}

// LOGIN

// BACKEND CONNECTION
const API_URL = "https://maihar-physical-academy-1.onrender.com";
let authToken = localStorage.getItem("maihar_auth_token");


async function apiRequest(path, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`
    }
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}/api${path}`, options);
  const result = await response.json();

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Request failed");
  }

  return result;
}

async function loadBackendData() {
  const profile = await apiRequest("/me");
  const attendanceResult = await apiRequest("/attendance");
  const noticesResult = await apiRequest("/notices");

  const studentsResult = isTrainer()
    ? await apiRequest("/students")
    : null;

  const users = isTrainer()
    ? studentsResult.students.map(student => ({
        id: student.id,
        name: student.full_name,
        username: student.username,
        phone: student.phone || "",
        course: student.course || "",
        batch: student.batch || "",
        totalFees: Number(student.total_fees || 0),
        paidFees: Number(student.paid_fees || 0),
        role: "student"
      }))
    : [{
        id: profile.user.id,
        name: profile.user.full_name,
        username: profile.user.username,
        phone: profile.user.phone || "",
        totalFees: Number(profile.user.total_fees || 0),
        paidFees: Number(profile.user.paid_fees || 0),
        role: "student"
      }];

  data.users = isTrainer()
    ? users
    : users;

  data.users.unshift(
    isTrainer() ? currentUser : null
  );
  data.users = data.users.filter(Boolean);

  data.attendance = {};

  attendanceResult.attendance.forEach(record => {
    const date = String(record.attendance_date).slice(0, 10);

    if (!data.attendance[date]) {
      data.attendance[date] = {};
    }

    data.attendance[date][record.student_id] =
      record.status.charAt(0).toUpperCase() +
      record.status.slice(1).toLowerCase();
  });

  data.notices = noticesResult.notices.map(notice => ({
    id: notice.id,
    title: notice.title,
    body: notice.body,
    date: new Date(notice.created_at).toLocaleDateString("en-IN"),
    by: notice.trainer_name || "Academy Trainer"
  }));
}


// LOGIN
$("loginForm").addEventListener("submit", async function(event) {
  event.preventDefault();

  const loginButton = $("loginButton");
  if (loginButton.disabled) return;

  const username = $("username").value.trim().toLowerCase();
  const password = $("password").value;

  $("loginError").textContent = "Please wait...";
  $("loginError").classList.add("loading-status");
  loginButton.disabled = true;
  loginButton.classList.add("loading");
  loginButton.setAttribute("aria-busy", "true");
  loginButton.textContent = "Please wait...";

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      $("loginError").textContent =
        result.message || "Incorrect username or password.";
      return;
    }

    authToken = result.token;
    localStorage.setItem("maihar_auth_token", authToken);

    currentUser = {
      id: result.user.id,
      name: result.user.full_name,
      username: result.user.username,
      role: result.user.role,
      profilePicture: result.user.profile_picture || ""
    };

    await loadBackendData();

    $("loginError").textContent = "";
    $("loginPage").classList.add("hidden");
    $("app").classList.remove("hidden");

    renderProfile();

    document.querySelectorAll(".trainer-only").forEach(element => {
      element.classList.toggle("hidden", !isTrainer());
    });

    $("attendanceDate").value = today();

    showPage("dashboard");
    renderAll();

  } catch (error) {
    console.error("Login Error:", error);
    $("loginError").textContent =
      "Backend connection failed. Please start the server.";
  } finally {
    loginButton.disabled = false;
    loginButton.classList.remove("loading");
    loginButton.removeAttribute("aria-busy");
    loginButton.textContent = "Login";
    $("loginError").classList.remove("loading-status");
  }
});


function today() {
  const date = new Date();
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return localDate.toISOString().slice(0, 10);
}

// LOGOUT

// LOGOUT
$("logoutBtn").addEventListener("click", function() {

  // Clear login session
  authToken = null;
localStorage.removeItem("maihar_auth_token");
currentUser = null;

  // Reset user data from memory
  data = JSON.parse(JSON.stringify(defaultData));

  // Hide dashboard and show login
  $("app").classList.add("hidden");
  $("loginPage").classList.remove("hidden");

  // Clear login form
  $("loginForm").reset();
  $("loginError").textContent = "";

  // Reset profile image variables
  pendingProfilePicture = null;
  removeProfilePicture = false;

  showToast("Logged out successfully.");
});


// TRAINER PROFILE
let pendingProfilePicture = null;
let removeProfilePicture = false;

function readProfilePicture(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The selected file is not a valid image."));
      image.onload = () => {
        try {
          const scale = Math.min(1, 320 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");

          if (!context) {
            reject(new Error("This browser could not process the selected image."));
            return;
          }

          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } catch {
          reject(new Error("The selected image could not be processed."));
        }
      };
      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

$("editProfileBtn").addEventListener("click", function() {
  if (!isTrainer()) return;

  $("profileForm").reset();
  $("profileNameInput").value = currentUser.name;
  $("profileUsernameInput").value = currentUser.username;
  $("profilePhoneInput").value = currentUser.phone || "";
  pendingProfilePicture = null;
  removeProfilePicture = false;
  updateAvatar(
    "profilePhotoPreview",
    "profilePreviewInitials",
    currentUser.name,
    currentUser.profilePicture
  );
  $("profileDialog").showModal();
});

$("profilePhotoInput").addEventListener("change", async function() {
  if (!isTrainer()) return;

  const file = this.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    this.value = "";
    showToast("Choose an image file for the profile picture.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    this.value = "";
    showToast("Choose an image smaller than 5 MB.");
    return;
  }

  try {
    pendingProfilePicture = await readProfilePicture(file);
    removeProfilePicture = false;
    updateAvatar(
      "profilePhotoPreview",
      "profilePreviewInitials",
      $("profileNameInput").value,
      pendingProfilePicture
    );
  } catch (error) {
    this.value = "";
    showToast(error.message);
  }
});

$("profileNameInput").addEventListener("input", function() {
  if (!pendingProfilePicture && !removeProfilePicture) {
    updateAvatar(
      "profilePhotoPreview",
      "profilePreviewInitials",
      this.value,
      currentUser.profilePicture
    );
  } else if (removeProfilePicture) {
    updateAvatar(
      "profilePhotoPreview",
      "profilePreviewInitials",
      this.value,
      ""
    );
  }
});

$("removeProfilePhoto").addEventListener("click", function() {
  pendingProfilePicture = null;
  removeProfilePicture = true;
  $("profilePhotoInput").value = "";
  updateAvatar(
    "profilePhotoPreview",
    "profilePreviewInitials",
    $("profileNameInput").value,
    ""
  );
});

$("profileForm").addEventListener("submit", function(event) {
  event.preventDefault();
  if (!isTrainer()) return;

  const name = $("profileNameInput").value.trim();
  const username = $("profileUsernameInput").value.trim();
  const password = $("profilePasswordInput").value;
  const phone = $("profilePhoneInput").value.trim();

  if (!name || !username || (password && password.length < 4)) {
    showToast("Enter a name, username, and a password of at least 4 characters.");
    return;
  }

  if (data.users.some(user =>
    user.id !== currentUser.id &&
    user.username.toLowerCase() === username.toLowerCase()
  )) {
    showToast("That username is already in use.");
    return;
  }

  const previousProfile = {
    name: currentUser.name,
    username: currentUser.username,
    password: currentUser.password,
    phone: currentUser.phone,
    profilePicture: currentUser.profilePicture
  };

  currentUser.name = name;
  currentUser.username = username;
  if (password) currentUser.password = password;
  currentUser.phone = phone;
  if (removeProfilePicture) {
    delete currentUser.profilePicture;
  } else if (pendingProfilePicture) {
    currentUser.profilePicture = pendingProfilePicture;
  }

  try {
    saveData();
  } catch {
    Object.assign(currentUser, previousProfile);
    showToast("Could not save the profile. Check browser storage and try again.");
    return;
  }

  renderProfile();
  $("profileDialog").close();
  showToast("Trainer profile updated.");
});

// NAVIGATION
function showPage(page) {
  const allowedPages = [
    "dashboard",
    "students",
    "attendance",
    "fees",
    "notifications",
    "multimedia",
    "contact"
  ];

  if (!allowedPages.includes(page)) return;

  if (page === "students" && !isTrainer()) return;

  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active-page");
  });

  $(page + "Page").classList.add("active-page");

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  const titles = {
    dashboard: "Dashboard",
    students: "Student Management",
    attendance: "Attendance",
    fees: "Fees Details",
    notifications: "Notifications",
    multimedia: "Multimedia",
    contact: "Contact"
  };

  $("pageTitle").textContent = titles[page];
}

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", function() {
    showPage(this.dataset.page);
    renderAll();
  });
});

// DASHBOARD
function renderDashboard() {
  const students = studentsList();

  $("totalStudents").textContent =
    data.users.filter(user => user.role === "student").length;

  $("totalNotices").textContent = data.notices.length;

  if (isTrainer()) {
    const allStudents = data.users.filter(
      user => user.role === "student"
    );

    const totalPending = allStudents.reduce(
      (sum, student) =>
        sum + Math.max(
          0,
          Number(student.totalFees || 0) -
          Number(student.paidFees || 0)
        ),
      0
    );

    const todayAttendance = data.attendance[today()] || {};

    const presentCount = Object.values(todayAttendance)
      .filter(status => status === "Present").length;

    $("dashboardAttendance").textContent =
      presentCount + " Present";

    $("dashboardPending").textContent = money(totalPending);

  } else {
    const student = currentUser;
    const status = data.attendance[today()]?.[student.id] || "—";

    $("dashboardAttendance").textContent = status;

    $("dashboardPending").textContent = money(
      Math.max(
        0,
        Number(student.totalFees || 0) -
        Number(student.paidFees || 0)
      )
    );
  }

  const notices = [...data.notices].reverse().slice(0, 3);

  $("dashboardNotices").innerHTML =
    notices.map(noticeHTML).join("") ||
    "<p>No notifications available.</p>";
}

// STUDENT MANAGEMENT

 // STUDENT MANAGEMENT
function renderStudents() {
  if (!isTrainer()) return;

  const list = data.users.filter(
    user => user.role === "student"
  );

  $("studentsTable").innerHTML = list.map(student => `
    <tr>
      <td>${escapeHTML(student.name)}</td>
      <td>${escapeHTML(student.username)}</td>
      <td>${escapeHTML(student.phone || "—")}</td>
      <td>${money(student.totalFees)}</td>
      <td>${money(student.paidFees)}</td>
      <td>
        <button class="absent"
          data-delete="${escapeHTML(student.id)}">
          Delete
        </button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", async function() {
      const id = this.dataset.delete;

      const student = data.users.find(
        user => String(user.id) === String(id) &&
                user.role === "student"
      );

      if (!student) return;

      if (!confirm(`Delete ${student.name}?`)) return;

      try {
        await apiRequest(`/students/${id}`, "DELETE");

        await loadBackendData();
        renderAll();

        showToast("Student deleted successfully.");

      } catch (error) {
        alert(error.message || "Unable to delete student.");
        console.error("Delete Student Error:", error);
      }
    });
  });
}


// ADD STUDENT
$("addStudentBtn").addEventListener("click", function() {
  if (isTrainer()) {
    $("studentDialog").showModal();
  }
});

$("studentForm").addEventListener("submit", async function(event) {
  event.preventDefault();

  if (!isTrainer()) return;

  const form = new FormData(this);

  const name = String(form.get("name")).trim();
  const username = String(form.get("username")).trim().toLowerCase();
  const password = String(form.get("password"));
  const phone = String(form.get("phone")).trim();

  const totalFees = Number(form.get("totalFees"));
  const paidFees = Number(form.get("paidFees"));

  if (
    !name ||
    !username ||
    password.length < 8 ||
    !Number.isFinite(totalFees) ||
    !Number.isFinite(paidFees) ||
    totalFees < 0 ||
    paidFees < 0 ||
    paidFees > totalFees
  ) {
    alert("Please enter valid details. Password must be at least 8 characters.");
    return;
  }

  try {
    const result = await apiRequest("/students", "POST", {
      name,
      username,
      password,
      phone,
      totalFees,
      paidFees
    });

    this.reset();
    $("studentDialog").close();

    await loadBackendData();
    renderAll();

    showToast("Student added successfully.");

  } catch (error) {
    alert(error.message || "Unable to add student.");
    console.error("Add Student Error:", error);
  }
});


// ATTENDANCE
$("attendanceDate").addEventListener("change", function() {
  renderAttendance();
});

function formatDateKey(year, month, day) {
  return [
    year,
    String(month + 1).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}

function attendanceDayStatus(date, students) {
  const statuses = students.map(student =>
    data.attendance[date]?.[student.id]
  );
  const presentCount = statuses.filter(status => status === "Present").length;
  const absentCount = statuses.filter(status => status === "Absent").length;

  if (absentCount) {
    return {
      className: "absent",
      label: `${presentCount} present, ${absentCount} absent`
    };
  }

  if (presentCount) {
    return {
      className: "present",
      label: `${presentCount} present`
    };
  }

  return { className: "", label: "No attendance recorded" };
}

function renderAttendanceCalendar(students) {
  const selectedDate = $("attendanceDate").value || today();
  const [year, month] = selectedDate.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthName = firstDay.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
  const calendar = $("attendanceCalendar");
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  $("attendanceMonth").textContent = monthName;
  calendar.innerHTML = weekdays.map(day =>
    `<span class="calendar-weekday">${day}</span>`
  ).join("");

  for (let blank = 0; blank < firstDay.getDay(); blank++) {
    calendar.insertAdjacentHTML("beforeend", '<span class="calendar-empty"></span>');
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = formatDateKey(year, month - 1, day);
    const status = attendanceDayStatus(date, students);
    const isToday = date === today();
    const isSelected = date === selectedDate;
    const classes = [
      "calendar-day",
      status.className ? `calendar-day-${status.className}` : "",
      isToday ? "calendar-day-today" : "",
      isSelected ? "calendar-day-selected" : ""
    ].filter(Boolean).join(" ");

    calendar.insertAdjacentHTML("beforeend", `
      <button type="button" class="${classes}"
        data-calendar-date="${date}"
        aria-label="${monthName} ${day}: ${status.label}"
        aria-pressed="${isSelected}"
        title="${status.label}">
        ${day}
      </button>
    `);
  }

  calendar.querySelectorAll("[data-calendar-date]").forEach(button => {
    button.addEventListener("click", function() {
      $("attendanceDate").value = this.dataset.calendarDate;
      renderAttendance();
    });
  });
}

function renderAttendance() {
  const date = $("attendanceDate").value || today();

  const students = studentsList();
  renderAttendanceCalendar(students);

  $("attendanceTable").innerHTML = students.map(student => {
    const status =
      data.attendance[date]?.[student.id] || "Not marked";

    if (isTrainer()) {
      return `
        <tr>
          <td>${escapeHTML(student.name)}</td>
          <td>${escapeHTML(student.username)}</td>
          <td>
            <button
              class="${status === "Present" ? "present" : ""}"
              data-att="${escapeHTML(student.id)}"
              data-status="Present">
              Present
            </button>

            <button
              class="${status === "Absent" ? "absent" : ""}"
              data-att="${escapeHTML(student.id)}"
              data-status="Absent">
              Absent
            </button>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td>${escapeHTML(student.name)}</td>
        <td>${escapeHTML(student.username)}</td>
        <td>${escapeHTML(status)}</td>
      </tr>
    `;
  }).join("");

  
document.querySelectorAll("[data-att]").forEach(button => {
  button.addEventListener("click", async function() {
    if (!isTrainer()) return;

    const studentId = this.dataset.att;
    const status = this.dataset.status;

    try {
      await apiRequest("/attendance", "POST", {
        student_id: Number(studentId),
        attendance_date: date,
        status: status.toLowerCase()
      });

      await loadBackendData();
      renderAll();

      showToast("Attendance updated successfully.");

    } catch (error) {
      alert(error.message || "Attendance update failed.");
      console.error("Attendance Error:", error);
    }
  });
});

}

// FEES

 // FEES
function renderFees() {
  const students = studentsList();

  $("feesTable").innerHTML = students.map(student => {
    const total = Number(student.totalFees || 0);
    const paid = Number(student.paidFees || 0);
    const remaining = Math.max(0, total - paid);

    return `
      <tr>
        <td>${escapeHTML(student.name)}</td>
        <td>${money(total)}</td>
        <td>${money(paid)}</td>
        <td>${money(remaining)}</td>
        <td>
          ${
            isTrainer()
            ? `<button data-fee="${escapeHTML(student.id)}">
                 Update
               </button>`
            : "—"
          }
        </td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll("[data-fee]").forEach(button => {
    button.addEventListener("click", async function() {
      if (!isTrainer()) return;

      const student = data.users.find(
        user => String(user.id) === this.dataset.fee &&
                user.role === "student"
      );

      if (!student) return;

      const total = prompt(
        "Enter total fees:",
        student.totalFees || 0
      );

      if (total === null) return;

      const paid = prompt(
        "Enter fees paid:",
        student.paidFees || 0
      );

      if (paid === null) return;

      const totalNumber = Number(total);
      const paidNumber = Number(paid);

      if (
        !Number.isFinite(totalNumber) ||
        !Number.isFinite(paidNumber) ||
        totalNumber < 0 ||
        paidNumber < 0 ||
        paidNumber > totalNumber
      ) {
        alert("Invalid fee amounts.");
        return;
      }

      try {
        await apiRequest(`/fees/${student.id}`, "PUT", {
          totalFees: totalNumber,
          paidFees: paidNumber
        });

        await loadBackendData();
        renderAll();

        showToast("Fees updated successfully.");

      } catch (error) {
        alert(error.message || "Fees update failed.");
        console.error("Fees Error:", error);
      }
    });
  });
}


// NOTIFICATIONS
function noticeHTML(notice) {
  return `
    <article class="notice-card">
      <h4>${escapeHTML(notice.title)}</h4>
      <p>${escapeHTML(notice.body)}</p>
      <div class="notice-meta">
        Posted by ${escapeHTML(notice.by)} ·
        ${escapeHTML(notice.date)}
      </div>
    </article>
  `;
}

function renderNotices() {
  const notices = [...data.notices].reverse();

  $("allNotices").innerHTML =
    notices.map(noticeHTML).join("") ||
    "<p>No notifications available.</p>";
}

// ADD NOTICE

$("addNoticeBtn").addEventListener("click", function() {
  if (isTrainer()) {
    $("noticeDialog").showModal();
  }
});

$("noticeForm").addEventListener("submit", async function(event) {
  event.preventDefault();

  if (!isTrainer()) return;

  const form = new FormData(this);

  const title = String(form.get("title")).trim();
  const body = String(form.get("body")).trim();

  if (!title || !body) {
    alert("Please enter notice title and message.");
    return;
  }

  try {
    await apiRequest("/notices", "POST", {
      title: title,
      body: body
    });

    this.reset();
    $("noticeDialog").close();

    await loadBackendData();
    renderAll();

    showToast("Notice published successfully.");

  } catch (error) {
    alert(error.message || "Unable to publish notice.");
    console.error("Notice Error:", error);
  }
});


// CLOSE DIALOGS
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", function() {
    $(this.dataset.close).close();
  });
});

// REFRESH ALL SECTIONS
function renderAll() {
  if (!currentUser) return;

  renderDashboard();
  renderStudents();
  renderAttendance();
  renderFees();
  renderNotices();

  $("year").textContent = new Date().getFullYear();
}


// RESTORE LOGIN SESSION AFTER PAGE REFRESH
async function restoreSession() {

  if (!authToken) return;

  try {
    const profile = await apiRequest("/me");

    currentUser = {
      id: profile.user.id,
      name: profile.user.full_name,
      username: profile.user.username,
      role: profile.user.role,
      profilePicture: profile.user.profile_picture || "",
      totalFees: Number(profile.user.total_fees || 0),
      paidFees: Number(profile.user.paid_fees || 0)
    };

    await loadBackendData();

    $("loginPage").classList.add("hidden");
    $("app").classList.remove("hidden");

    renderProfile();

    document.querySelectorAll(".trainer-only").forEach(element => {
      element.classList.toggle("hidden", !isTrainer());
    });

    $("attendanceDate").value = today();

    showPage("dashboard");
    renderAll();

  } catch (error) {
    console.error("Session Restore Error:", error);

    authToken = null;
    currentUser = null;
    localStorage.removeItem("maihar_auth_token");

    $("app").classList.add("hidden");
    $("loginPage").classList.remove("hidden");
  }
}

restoreSession();
