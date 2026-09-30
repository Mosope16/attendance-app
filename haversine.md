# Geofencing-Based Attendance System Using the Haversine Formula

## How the Haversine Formula Works
**Great-Circle Distance:**
- It computes the shortest distance over the earth's curved surface between two points specified by their latitude and longitude:
  $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
  where $\phi$ is latitude, $\lambda$ is longitude, and $R \approx 6,371,000\text{ m}$ (mean Earth radius).

**Accounting for Earth's Shape:**
- Unlike flat Euclidean geometry, it models the Earth spherically to maintain sub-meter accuracy over micro-geographical distances.

**Dynamic Geofence Validation:**
- The system compares the calculated distance against the session's designated venue radius:
  - **30m**: Computer Laboratories & Seminar Rooms
  - **50m**: Standard Classrooms (Default)
  - **100m**: Large Tiered Lecture Theatres
  - **200m**: Multi-level Auditoriums & Open Amphitheatres
- If the student's GPS distance $\le \text{allowed radius}$, attendance check-in is authorized.

## Core Steps in Verification
- **Coordinate Acquisition:** High-accuracy GPS coordinates are polled from the lecturer's and student's devices via `expo-location`.
- **Proximity Computation:** The Haversine algorithm calculates real-time spatial separation between student and session center.
- **Dynamic In-Session Adjustment:** Lecturers can expand the boundary in real-time during live sessions to mitigate indoor concrete GPS signal drift.
- **Tamper Prevention:** Disallows proxy check-ins outside the physical lecture venue while preventing false rejections in large halls.