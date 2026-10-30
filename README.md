# Deadlock Analysis & Resource Allocation Dashboard
### Operating Systems IA Activity 2 — Avoidance, Detection, Prevention, and Recovery


[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Tests: 100% Pass](https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen.svg)](check.js)

A comprehensive, production-grade web application and technical simulation platform for exploring, visualizing, and verifying fundamental Operating Systems resource allocation and deadlock management algorithms.

---

## 🌐 Live Demo & Deployment

This project is 100% static (HTML5/CSS3/Vanilla ES6 JS) and requires zero backend server configuration.

- **GitHub Pages Ready**: Automatically deploys via the included GitHub Actions workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml).
- **Direct Local Preview**: Simply open `index.html` in any modern web browser or run `npx serve .`.

---

## 📌 Executive Summary & Key Highlights

This project provides an interactive simulation and testing platform for Operating Systems resource allocation and deadlock analysis, adhering strictly to **OS IA Activity 2** requirements:

1. **Predefined Assignment Test Cases (TC1 – TC6) Preserved Exactly**:
   - **TC1**: Safe State Verification
   - **TC2**: Request Exceeds Available Resources (Waiting / Deferred)
   - **TC3**: Request Produces Unsafe State (Denied / Restored)
   - **TC4**: Deadlock Detection in Multi-Instance Resource Systems
   - **TC5**: Deadlock Prevention via Linear Resource Ordering
   - **TC6**: Boundary and Invalid Input Handling
   - All input matrices, expected outputs, algorithms, assertions, and test scripts (`check.js`) remain **100% identical and unmodified**.
2. **User-Defined Custom Test Case Simulator**:
   - Configure arbitrary process counts ($N \in [1, 8]$) and resource counts ($M \in [1, 6]$).
   - Dynamic interactive matrices for Allocation, Maximum Claim, and Available resources.
   - Real-time automatic Need matrix calculation ($Need = Maximum - Allocation$) with read-only protection.
   - Comprehensive validation engine rejecting negative values, non-integers, empty cells, and $Allocation > Maximum$.
   - Interactive step-by-step Banker's algorithm stepper with auto-play, manual stepping, and safe sequence visualization.
   - Dynamic resource request evaluation distinguishing **SAFE**, **WAITING / DEFERRED**, **DENIED (UNSAFE)**, and **INVALID** outcomes.
   - Persistent Custom Scenario History log with one-click reloading and CSV export.
3. **Professional Dark-Themed UI/UX**:
   - Modern developer dashboard aesthetic inspired by technical monitoring platforms.
   - Clean typography, responsive CSS grid/flexbox layout, and consistent status color palette:
     - 🟢 **Green**: SAFE / SUCCESS / PASS
     - 🔴 **Red**: DEADLOCKED / DENIED / FAIL
     - 🟠 **Orange**: WAITING / DEFERRED
     - 🟡 **Yellow**: UNSAFE
     - 🔵 **Blue**: INFORMATION / ACTIVE
     - ⚪ **Grey**: INACTIVE / INVALID
   - Live summary metrics displaying real application statistics.
   - Interactive SVG Wait-For Graph with cycle detection and directional dependency arrows.
4. **Academic Reporting & Documentation**:
   - Predefined analytical results table with live execution data and theoretical conclusions.
   - User-defined test report section.
   - Analytical report export to **CSV** and **JSON**.
   - Print-optimized CSS (`@media print`) for clean PDF generation.
   - Editable, localStorage-backed **AI Usage Record** ensuring academic transparency.

---

## 📂 Project Architecture & Repository Structure

```
deadlock_dashboard_web/
├── .github/
│   └── workflows/
│       ├── ci.yml             # GitHub Actions CI matrix (Node 18, 20, 22 regression testing)
│       └── pages.yml          # Automated zero-config deployment to GitHub Pages
├── deadlock_dashboard_web/    # Nested package directory for standalone / assignment grading
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── check.js
│   └── README.md
├── index.html                 # Root dashboard entrypoint (GitHub Pages root compatible)
├── style.css                  # Professional dark theme, status tokens & print stylesheet
├── app.js                     # Core OS algorithms, UI renderer & Custom Simulator engine
├── check.js                   # Node.js automated regression test suite
├── package.json               # NPM scripts ("npm test", "npm start") and metadata
├── .gitignore                 # Standard Git ignore file for OS, Node and editor files
├── LICENSE                    # MIT Open-Source License
└── README.md                  # Complete technical and operating systems documentation
```

---

## 🚀 GitHub Push & Setup Instructions

To push this repository to your personal or university GitHub account:

### Step 1: Initialize and Commit (Local Git)
```bash
# Check git status
git status

# Add all project files
git add .

# Create initial commit
git commit -m "feat: complete OS deadlock analysis dashboard with custom simulator and CI suite"

# Rename branch to main (if not already main)
git branch -M main
```

### Step 2: Link Remote Repository and Push
Create an empty repository on [GitHub](https://github.com/new) (e.g., named `deadlock-dashboard-web`), then link and push:
```bash
# Add your GitHub repository remote URL
git remote add origin https://github.com/<your-username>/deadlock-dashboard-web.git

# Push to GitHub
git push -u origin main
```

### Step 3: Enable GitHub Pages (Optional 1-Click Hosting)
1. Go to your repository on GitHub: `Settings` &rarr; `Pages`.
2. Under **Build and deployment** &rarr; **Source**, select **GitHub Actions** (or **Deploy from a branch** &rarr; `main` / `/ (root)`).
3. The site will be live at `https://<your-username>.github.io/deadlock-dashboard-web/`.

---

## 🧪 Automated Testing & CI

### Running Tests Locally
Verify all algorithms and assertions using Node.js or npm:
```bash
# Using npm
npm test

# Or using Node directly
node check.js
```

### Expected Test Output
```
TC1 PASS | SAFE: P4 → P1 → P2 → P3 → P0 ; Work after each step: [3 2 2] [4 3 2] [7 4 4] [8 6 5] [10 6 6] ; Bonus: P1 requests 1 1 1 → SAFE (granted)
TC2 PASS | WAITING: not granted now; allocation unchanged: yes
TC3 PASS | UNSAFE: denied; in the trial only P4 can finish (1 of 5), Work stuck at [2 0 0]; state restored: yes
TC4 PASS | DEADLOCK: P1, P2, P3 (P0 is not stuck); circular wait P1 → P2 → P3 → P1. ; Recovery: terminate P1 releases [1 0 0], Available becomes [1 0 0], then no deadlock. ; Contrast: if P0 also holds a second R0 instance the cycle P1 → P2 → P3 → P1 still exists, but the result is NO DEADLOCK
TC5 PASS | NO DEADLOCK: P3 holding R2 may not request R0
TC6 PASS | Request from unknown process P9 → INVALID ; Negative request −1 0 0 (P1) → INVALID ; P1 requests 3 0 0 (its Need is 2 2 2) → INVALID ; P4 (zero Need) requests 1 0 0 → INVALID ; P4 (zero Need) requests 0 0 0 → SAFE ; Allocation 3 above Maximum 2 (P4, R0) → INVALID ; Available 0 0 0 and P0 has zero Need → SAFE ; Available 0 0 0 on the main example → UNSAFE
ALL ASSERTIONS PASSED
```

---

## 🧠 Theoretical Operating Systems Principles

### 1. Deadlock Avoidance (Dijkstra's Banker's Algorithm)
- **Concept**: The operating system inspects resource requests before granting them to ensure that the system never enters an **Unsafe State**.
- **Safe State Definition**: A state is safe if there exists a process execution sequence $\langle P_0, P_1, \dots, P_{n-1} \rangle$ such that for each $P_i$, the resources $P_i$ can still request can be satisfied by currently Available resources plus the resources held by all prior processes $P_j$ ($j < i$).
- **Key Distinctions**:
  - **Unsafe $\neq$ Deadlock**: An unsafe state merely implies that the OS cannot guarantee all processes will finish if each requests its declared maximum. Deadlock only occurs if processes subsequently block indefinitely waiting for resources.
  - **Waiting $\neq$ Invalid**: A request $\le Need$ but $> Available$ is **WAITING / DEFERRED** (allocation is untouched). A request $> Need$ is **INVALID** (exceeds declared claim).

### 2. Deadlock Detection in Multi-Instance Resource Systems
- **Vector Reduction Algorithm**: Uses `Work` (initialized to `Available`) and `Finish` vectors. Iteratively finds processes where $Request_i \le Work$, marks $Finish[i] = true$, and adds $Allocation_i$ to `Work`. If any process has $Finish[i] == false$ upon termination, those processes are deadlocked.
- **Wait-For Graph Interpretation**:
  - **Single-instance resources**: A cycle in the Resource-Allocation / Wait-For Graph is a **necessary and sufficient** condition for deadlock.
  - **Multiple-instance resources**: A cycle is **necessary but NOT sufficient**. As demonstrated in Assignment Example 2, if an external process holds additional instances of a contended resource, it can finish and release its allocation, breaking the cycle.

### 3. Deadlock Prevention (Havender's Linear Resource Ordering)
- **Concept**: Precludes deadlock by systematically preventing one of the four Coffman conditions (Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait).
- **Rule**: Imposes a strict global linear ordering function $F: R \to \mathbb{N}$ on all resource types ($R_0 < R_1 < R_2$). A process holding resource $R_i$ may only request $R_j$ if $F(R_j) > F(R_i)$.
- **Engineering Trade-off**: Completely prevents circular wait, but reduces system concurrency and overall resource utilization because processes must acquire resources in predetermined sequences rather than as dynamically needed.

### 4. Deadlock Recovery (Process Termination)
- **Mechanism**: Breaks circular wait by terminating one or more deadlocked processes.
- **Resource Reclamation**: The operating system preempts all resources held by the terminated process and adds them to `Available`, allowing the detection algorithm to re-evaluate remaining processes.

---

## 🧪 Predefined Assignment Test Cases (TC1 – TC6)

All six original assignment test cases are preserved with exact baseline inputs and expected outputs:

| Test ID | System Scenario | Input State | Expected Result | Pass Condition |
| :--- | :--- | :--- | :--- | :--- |
| **TC1** | Safe State Verification | $A_0, M_0, V_0 = [1, 2, 2]$ | Safe sequence found | $\text{Safe} = \text{true}, \text{Seq} = \langle P_4, P_1, P_2, P_3, P_0 \rangle$ |
| **TC2** | Request Exceeds Available | $P_2$ requests $[2, 1, 0]$ | Request not granted immediately | $\text{Status} = \text{WAITING}$, Allocation unchanged |
| **TC3** | Request Produces Unsafe State | $P_0$ requests $[1, 2, 2]$ | Request denied; state restored | $\text{Status} = \text{UNSAFE}$, State restored |
| **TC4** | Deadlock Detection | $DA, DR, DV = [0, 0, 0]$ | Deadlock identified | $\text{Deadlocked} = \{P_1, P_2, P_3\}$, Cycle present |
| **TC5** | Deadlock Prevention | Ordering on TC4 scenario | Circular wait eliminated | $\text{Deadlocked} = \emptyset$, Out-of-order refused |
| **TC6** | Boundary & Invalid Inputs | Unknown PID, negative, $>Need$ | Correct validation messages | All 8 sub-assertions pass cleanly |

---

## 📊 Custom Test Case Simulator Instructions

1. Navigate to the **Custom Test Simulator** tab from the sidebar.
2. Configure the desired number of processes ($N$) and resource types ($M$), or choose from pre-configured presets (e.g. *4-Process Safe System*, *Resource Scarcity Unsafe*, *2-Process Minimal Boundary*).
3. Click **Generate Matrix** to build dynamic grids for Allocation, Maximum Demand, and Available vectors.
4. Input non-negative integers into the Allocation and Maximum Demand cells. The **Need Matrix** automatically computes in real time ($Need = Max - Alloc$).
5. Click **Run Safety Algorithm** to execute Banker's Safety Algorithm, view the step-by-step Work vector progression, and obtain the Safe Sequence.
6. Use the **Custom Resource Request Simulation** panel to submit requests from any process $P_i$ and inspect the 4-way decision outcome.
7. Review your runs in the **Custom Scenario History** table, where you can re-load previous scenarios or export history to CSV.

---

## 📝 Academic AI Usage Record

The dashboard includes a dedicated **AI Usage Record** section conforming to university academic integrity standards. Students can record the AI tools used, queries posed, outputs received, and their independent verification methods. Records can be edited directly in the interface and saved to browser storage or printed as part of the assignment report.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
