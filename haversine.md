# Geofencing-Based Attendance System Using the Haversine Formula

# How the Haversine Formula Works
**Great-Circle Distance:**
- It computes the shortest distance over the earth's curved surface between two points specified by their latitude and longitude.

**Accounting for Earth's Shape:**
- Unlike flat-surface geometry, it treats the Earth as a sphere to maintain high accuracy over geographical distances.

**Geofence Validation:**
- The system compares the calculated distance against a pre-set radius (e.g., 100 meters) from the office or site center; if the user falls within the limit, attendance check-in is approved.

# Core Steps in Location
- **AttendanceCoordinate Capture:** The mobile app fetches real-time latitude and longitude values via device GPS sensors.
- **Proximity Check:** The Haversine calculation runs in the background to verify the user's placement inside the virtual boundary.
- **Record Sync:** Validated check-ins log the timestamp and coordinates directly to the cloud HR dashboard.